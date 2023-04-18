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
import type { Result, SuccessfulResult } from '../utilities/result.js';

import { makeTestServer, type TestServerFixture } from './server.js';
import { OAUTH2_JWKS_URL, OAUTH2_TOKEN_AUDIENCE, OAUTH2_TOKEN_ISSUER } from './authn.js';
import { type EnvVarMocker, REQUIRED_ENV_VARS } from './envVars.js';
import { MEMBER_MONGO_ID, MEMBER_NAME, ORG_NAME } from './stubs.js';
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

type RouteLevel = 'ORG_BULK' | 'ORG_MEMBERSHIP_RESTRICTED' | 'ORG_MEMBERSHIP' | 'ORG';

interface Processor<ProcessorResolvedValue> {
  readonly spy: jest.Mock<() => Promise<Result<ProcessorResolvedValue, any>>>;
  readonly result: ProcessorResolvedValue;
}

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

export function testOrgRouteAuth<ProcessorResolvedValue>(
  routeLevel: RouteLevel,
  injectionOptions: InjectOptions,
  fixtureGetter: () => TestServerFixture,
  processor: Processor<ProcessorResolvedValue>,
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

  beforeEach(() => {
    const result = {
      didSucceed: true,
      result: processor.result,
    };
    processor.spy.mockResolvedValue(result as SuccessfulResult<ProcessorResolvedValue>);
  });

  function expectAccessToBeGranted(response: LightMyRequestResponse, reason: string) {
    expect(response.statusCode).toBeWithin(HTTP_STATUS_CODES.OK, MAX_SUCCESSFUL_STATUS);
    expect(processor.spy).toHaveBeenCalled();
    expect(logs).toContainEqual(
      partialPinoLog('debug', 'Authorisation granted', { userEmail: USER_EMAIL, reason }),
    );
  }

  function expectAccessToBeDenied(response: LightMyRequestResponse, reason: string) {
    expect(response.statusCode).toBe(HTTP_STATUS_CODES.FORBIDDEN);
    expect(processor.spy).not.toHaveBeenCalled();
    expect(logs).toContainEqual(
      partialPinoLog('info', 'Authorisation denied', { userEmail: USER_EMAIL, reason }),
    );
  }

  test('Anonymous access should be denied', async () => {
    unsetAuthUser();

    const response = await server.inject(injectionOptions);

    expect(response.statusCode).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
    expect(processor.spy).not.toHaveBeenCalled();
  });

  test('Super admin should be granted access', async () => {
    setAuthUser(USER_EMAIL);

    const response = await server.inject(injectionOptions);

    expectAccessToBeGranted(response, 'User is super admin');
  });

  if (routeLevel === 'ORG_BULK') {
    test('Any org admin should be denied access', async () => {
      await memberModel.create(STUB_ORG_ADMIN);
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      expectAccessToBeDenied(response, 'Non-super admin tries to access bulk org endpoint');
    });
  } else {
    test('Org admin should be granted access', async () => {
      await memberModel.create({ ...STUB_ORG_ADMIN, role: Role.ORG_ADMIN });
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      expectAccessToBeGranted(response, 'User is org admin');
    });
  }

  if (routeLevel === 'ORG') {
    test('Admin from different org should be denied access', async () => {
      await memberModel.create({ ...STUB_ORG_ADMIN, orgName: `not-${STUB_ORG_ADMIN.orgName}` });
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      expectAccessToBeDenied(response, 'User is not a member of the org');
    });
  }

  if (routeLevel === 'ORG_MEMBERSHIP') {
    test('Org member should be granted access', async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      await memberModel.create({ ...STUB_ORG_MEMBER, _id: MEMBER_MONGO_ID });
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      expectAccessToBeGranted(response, 'User is accessing their own membership');
    });

    test('Another member from same org should be denied access', async () => {
      await memberModel.create({ ...STUB_ORG_MEMBER, email: `not-${USER_EMAIL}` });
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      expectAccessToBeDenied(response, 'User is accessing different membership');
    });
  } else {
    test('Org member should be denied access', async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      await memberModel.create({ ...STUB_ORG_MEMBER, _id: MEMBER_MONGO_ID });
      setAuthUser(USER_EMAIL);
      envVarMocker(REQUIRED_API_ENV_VARS);

      const response = await server.inject(injectionOptions);

      let reason: string;
      switch (routeLevel) {
        case 'ORG_MEMBERSHIP_RESTRICTED': {
          reason = 'User is not an admin';
          break;
        }
        case 'ORG_BULK': {
          reason = 'Non-super admin tries to access bulk org endpoint';
          break;
        }
        default: {
          reason = 'User is not accessing their own membership';
          break;
        }
      }
      expectAccessToBeDenied(response, reason);
    });
  }
}
