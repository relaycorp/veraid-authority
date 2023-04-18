import { jest } from '@jest/globals';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  InjectOptions,
  LightMyRequestResponse,
  onRequestAsyncHookHandler,
  onRequestHookHandler,
} from 'fastify';
import fastifyPlugin, { type PluginMetadata } from 'fastify-plugin';
import type { Connection } from 'mongoose';

import type { PluginDone } from '../utilities/fastify/PluginDone.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { MemberModelSchema, Role } from '../models/Member.model.js';

import { makeTestServer, type TestServerFixture } from './server.js';
import { OAUTH2_JWKS_URL, OAUTH2_TOKEN_AUDIENCE, OAUTH2_TOKEN_ISSUER } from './authn.js';
import { type EnvVarMocker, REQUIRED_ENV_VARS } from './envVars.js';
import { MEMBER_NAME, ORG_NAME } from './stubs.js';
import { mockSpy } from './jest.js';
import { type MockLogSet, partialPinoLog } from './logging.js';

const mockAuthenticate = mockSpy(jest.fn<onRequestAsyncHookHandler | onRequestHookHandler>());
function mockJwksAuthentication(
  fastify: FastifyInstance,
  _opts: PluginMetadata,
  done: PluginDone,
): void {
  fastify.decorate('authenticate', mockAuthenticate);
  done();
}
jest.unstable_mockModule('../../utilities/fastify/plugins/jwksAuthentication.js', () => ({
  default: fastifyPlugin(mockJwksAuthentication),
}));
const { makeApiServer } = await import('../api/server.js');

const MAX_SUCCESSFUL_STATUS = 399;

const USER_EMAIL = 'user@veraid-authority.example';

const STUB_ORG_MEMBER: MemberModelSchema = {
  orgName: ORG_NAME,
  name: MEMBER_NAME,
  role: Role.REGULAR,
  email: USER_EMAIL,
};
const STUB_ORG_ADMIN: MemberModelSchema = {
  ...STUB_ORG_MEMBER,
  role: Role.ORG_ADMIN,
};

function setAuthUser(sub: string) {
  mockAuthenticate.mockImplementation((request, _reply, done) => {
    request.user = { sub };
    done();
  });
}

function unsetAuthUser() {
  mockAuthenticate.mockImplementation(async (_request: FastifyRequest, reply: FastifyReply) => {
    await reply.code(HTTP_STATUS_CODES.UNAUTHORIZED).send();
  });
}

type OrgUserRole = 'ORG_ADMIN' | 'ORG_MEMBER' | 'SUPER_ADMIN';

export const REQUIRED_API_ENV_VARS = {
  ...REQUIRED_ENV_VARS,
  OAUTH2_JWKS_URL,
  OAUTH2_TOKEN_AUDIENCE,
  OAUTH2_TOKEN_ISSUER,
};

export function makeTestApiServer(): () => TestServerFixture {
  const getFixture = makeTestServer(makeApiServer, REQUIRED_API_ENV_VARS);

  beforeEach(() => {
    setAuthUser(USER_EMAIL);

    const { envVarMocker } = getFixture();
    envVarMocker({ ...REQUIRED_API_ENV_VARS, AUTHORITY_SUPERADMIN: USER_EMAIL });
  });

  return getFixture;
}

export function testOrgAuth(
  minRole: OrgUserRole,
  injectionOptions: InjectOptions,
  fixtureGetter: () => TestServerFixture,
  processorSpy: jest.Mock<any>,
): void {
  let server: FastifyInstance;
  let logs: MockLogSet;
  let envVarMocker: EnvVarMocker;
  let memberModel: ReturnModelType<typeof MemberModelSchema>;
  beforeEach(() => {
    let dbConnection: Connection;
    ({ dbConnection, server, logs, envVarMocker } = fixtureGetter());

    memberModel = getModelForClass(MemberModelSchema, { existingConnection: dbConnection });
  });

  function expectAccessToBeGranted(response: LightMyRequestResponse) {
    expect(response.statusCode).toBeWithin(HTTP_STATUS_CODES.OK, MAX_SUCCESSFUL_STATUS);
    expect(processorSpy).toHaveBeenCalled();
  }

  function expectAccessToBeDenied(
    response: LightMyRequestResponse,
    expectedStatusCode: number = HTTP_STATUS_CODES.FORBIDDEN,
  ) {
    expect(response.statusCode).toBe(expectedStatusCode);
    expect(processorSpy).not.toHaveBeenCalled();
  }

  test('Anonymous access should be denied', async () => {
    unsetAuthUser();

    const response = await server.inject(injectionOptions);

    expectAccessToBeDenied(response, HTTP_STATUS_CODES.UNAUTHORIZED);
  });

  test('Super admin should be granted access', async () => {
    setAuthUser(USER_EMAIL);

    const response = await server.inject(injectionOptions);

    expectAccessToBeGranted(response);
    expect(logs).toContainEqual(
      partialPinoLog('debug', 'Authorisation granted to super admin', { user: USER_EMAIL }),
    );
  });

  if (minRole === 'SUPER_ADMIN') {
    test('Org admin should be denied access', async () => {
      await memberModel.create(STUB_ORG_ADMIN);
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      expectAccessToBeDenied(response);
    });
  }

  if (minRole === 'ORG_ADMIN') {
    test('Org admin should be granted access', async () => {
      await memberModel.create({ ...STUB_ORG_ADMIN, role: Role.ORG_ADMIN });
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      expectAccessToBeGranted(response);
      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Authorisation granted to org admin', { user: USER_EMAIL }),
      );
    });
  }

  test('Admin from different org should be denied access', async () => {
    await memberModel.create({ ...STUB_ORG_ADMIN, orgName: `not-${STUB_ORG_ADMIN.orgName}` });
    setAuthUser(USER_EMAIL);
    envVarMocker(REQUIRED_API_ENV_VARS);

    const response = await server.inject(injectionOptions);

    expectAccessToBeDenied(response);
    expect(logs).toContainEqual(
      partialPinoLog('debug', 'Authorisation denied to non-org member', { user: USER_EMAIL }),
    );
  });

  if (minRole === 'ORG_MEMBER') {
    test('Org member should be granted access', async () => {
      await memberModel.create(STUB_ORG_MEMBER);
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      expectAccessToBeGranted(response);
      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Authorisation granted to org member', { user: USER_EMAIL }),
      );
    });
  } else {
    test('Org member should be denied access', async () => {
      await memberModel.create(STUB_ORG_MEMBER);
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      expectAccessToBeDenied(response);
    });
  }

  test('Member from different org should be denied access', async () => {
    await memberModel.create({ ...STUB_ORG_MEMBER, orgName: `not-${STUB_ORG_MEMBER.orgName}` });
    setAuthUser(USER_EMAIL);
    envVarMocker(REQUIRED_API_ENV_VARS);

    const response = await server.inject(injectionOptions);

    expectAccessToBeDenied(response);
    expect(logs).toContainEqual(
      partialPinoLog('debug', 'Authorisation denied to non-org member', { user: USER_EMAIL }),
    );
  });
}
