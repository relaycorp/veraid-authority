import { jest } from '@jest/globals';
import { getModelForClass } from '@typegoose/typegoose';
import type {
  FastifyInstance,
  InjectOptions,
  LightMyRequestResponse,
  onRequestAsyncHookHandler,
  onRequestHookHandler,
} from 'fastify';
import fastifyPlugin, { type PluginMetadata } from 'fastify-plugin';

import type { PluginDone } from '../utilities/fastify/PluginDone.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { MemberModelSchema, Role } from '../models/Member.model.js';
import type { Result, SuccessfulResult } from '../utilities/result.js';

import { makeTestServer, type TestServerFixture } from './server.js';
import { OAUTH2_JWKS_URL, OAUTH2_TOKEN_AUDIENCE, OAUTH2_TOKEN_ISSUER } from './authn.js';
import { REQUIRED_ENV_VARS } from './envVars.js';
import { getMockInstance } from './jest.js';
import { partialPinoLog } from './logging.js';
import { MEMBER_EMAIL, MEMBER_NAME, ORG_NAME } from './stubs.js';

function mockJwksAuthentication(
  fastify: FastifyInstance,
  _opts: PluginMetadata,
  done: PluginDone,
): void {
  fastify.decorate(
    'authenticate',
    jest.fn<onRequestHookHandler>().mockImplementation((_request, _reply, handlerDone) => {
      handlerDone();
    }),
  );

  done();
}
jest.unstable_mockModule('../../utilities/fastify/plugins/jwksAuthentication.js', () => ({
  default: fastifyPlugin(mockJwksAuthentication, { name: 'mock-jwks-authentication' }),
}));
const { makeApiServer } = await import('../api/server.js');

const MAX_SUCCESSFUL_STATUS = 399;

// We should have the same super admin across all tests to avoid concurrency issues
const SUPER_ADMIN_EMAIL = 'admin@veraid-authority.example';

function getMockAuthenticateFromServer(fastify: FastifyInstance) {
  const childrenSymbol = Object.getOwnPropertySymbols(fastify).find(
    (symbol) => symbol.description === 'fastify.children',
  );
  if (childrenSymbol === undefined) {
    throw new Error('Could not find children property');
  }

  // @ts-expect-error: Allow lookup by symbol
  const children = fastify[childrenSymbol] as FastifyInstance[];

  const childContext = Object.values(children).find((value) => 'authenticate' in value);
  if (childContext === undefined) {
    throw new Error('Could not find child context');
  }
  const { authenticate } = childContext;
  return getMockInstance(authenticate) as jest.Mock<onRequestAsyncHookHandler>;
}

function setAuthUser(fastify: FastifyInstance, userEmail: string) {
  // eslint-disable-next-line @typescript-eslint/require-await
  getMockAuthenticateFromServer(fastify).mockImplementation(async (request) => {
    (request as unknown as { user: { sub: string } }).user = { sub: userEmail };
  });
}

function unsetAuthUser(fastify: FastifyInstance) {
  getMockAuthenticateFromServer(fastify).mockImplementation(async (_request, reply) => {
    await reply.code(HTTP_STATUS_CODES.UNAUTHORIZED).send();
  });
}

type RouteLevel = 'ORG_BULK' | 'ORG_MEMBERSHIP_RESTRICTED' | 'ORG_MEMBERSHIP' | 'ORG';

interface Processor<ProcessorResolvedValue> {
  readonly spy: jest.Mock<() => Promise<Result<ProcessorResolvedValue, any>>>;
  readonly result?: ProcessorResolvedValue;
}

export type RequestOptionsGetter = (memberId?: string) => InjectOptions;

export const REQUIRED_API_ENV_VARS = {
  ...REQUIRED_ENV_VARS,
  OAUTH2_JWKS_URL,
  OAUTH2_TOKEN_AUDIENCE,
  OAUTH2_TOKEN_ISSUER,
};

export function makeTestApiServer(): () => TestServerFixture {
  const getFixture = makeTestServer(makeApiServer, REQUIRED_API_ENV_VARS);

  beforeEach(() => {
    const { envVarMocker, server } = getFixture();

    setAuthUser(server, SUPER_ADMIN_EMAIL);

    envVarMocker({ ...REQUIRED_API_ENV_VARS, AUTHORITY_SUPERADMIN: SUPER_ADMIN_EMAIL });
  });

  return getFixture;
}

export function testOrgRouteAuth<ProcessorResolvedValue>(
  routeLevel: RouteLevel,
  requestOptionsOrGetter: InjectOptions | RequestOptionsGetter,
  fixtureGetter: () => TestServerFixture,
  processor: Processor<ProcessorResolvedValue>,
): void {
  // Use unique values across test suites to avoid concurrency issues.
  const orgMember: MemberModelSchema = {
    orgName: ORG_NAME,
    name: MEMBER_NAME,
    role: Role.REGULAR,
    email: MEMBER_EMAIL,
  };

  let server: FastifyInstance;
  beforeEach(() => {
    ({ server } = fixtureGetter());
  });

  beforeEach(() => {
    const result = {
      didSucceed: true,
      result: processor.result,
    };
    processor.spy.mockResolvedValue(result as SuccessfulResult<ProcessorResolvedValue>);
  });

  async function makeRequest(memberId?: string): Promise<LightMyRequestResponse> {
    const options =
      typeof requestOptionsOrGetter === 'function'
        ? requestOptionsOrGetter(memberId)
        : requestOptionsOrGetter;
    return server.inject(options);
  }

  async function createOrgMember(member: MemberModelSchema): Promise<string> {
    const { dbConnection } = fixtureGetter();
    const memberModel = getModelForClass(MemberModelSchema, {
      existingConnection: dbConnection,
    });
    const { id } = await memberModel.create(member);
    return id as string;
  }

  function expectAccessToBeGranted(
    response: LightMyRequestResponse,
    reason: string,
    expectedUserEmail: string = MEMBER_EMAIL,
  ) {
    expect(response.statusCode).toBeWithin(HTTP_STATUS_CODES.OK, MAX_SUCCESSFUL_STATUS);
    expect(processor.spy).toHaveBeenCalled();
    expect(fixtureGetter().logs).toContainEqual(
      partialPinoLog('debug', 'Authorisation granted', { userEmail: expectedUserEmail, reason }),
    );
  }

  function expectAccessToBeDenied(response: LightMyRequestResponse, reason: string) {
    expect(response.statusCode).toBe(HTTP_STATUS_CODES.FORBIDDEN);
    expect(processor.spy).not.toHaveBeenCalled();
    expect(fixtureGetter().logs).toContainEqual(
      partialPinoLog('info', 'Authorisation denied', { userEmail: MEMBER_EMAIL, reason }),
    );
  }

  test('Anonymous access should be denied', async () => {
    unsetAuthUser(server);

    const response = await makeRequest();

    expect(response.statusCode).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
    expect(processor.spy).not.toHaveBeenCalled();
  });

  test('Super admin should be granted access', async () => {
    setAuthUser(server, SUPER_ADMIN_EMAIL);

    const response = await makeRequest();

    expectAccessToBeGranted(response, 'User is super admin', SUPER_ADMIN_EMAIL);
  });

  if (routeLevel === 'ORG_BULK') {
    test('Any org admin should be denied access', async () => {
      const memberId = await createOrgMember({
        ...orgMember,
        role: Role.ORG_ADMIN,
      });
      setAuthUser(server, MEMBER_EMAIL);

      const response = await makeRequest(memberId);

      expectAccessToBeDenied(response, 'Non-super admin tries to access bulk org endpoint');
    });
  } else {
    test('Org admin should be granted access', async () => {
      const memberId = await createOrgMember({
        ...orgMember,
        role: Role.ORG_ADMIN,
      });
      setAuthUser(server, MEMBER_EMAIL);

      const response = await makeRequest(memberId);

      expectAccessToBeGranted(response, 'User is org admin');
    });
  }

  if (routeLevel === 'ORG') {
    test('Admin from different org should be denied access', async () => {
      const memberId = await createOrgMember({
        ...orgMember,
        role: Role.ORG_ADMIN,
        orgName: `not-${orgMember.orgName}`,
      });
      setAuthUser(server, MEMBER_EMAIL);

      const response = await makeRequest(memberId);

      expectAccessToBeDenied(response, 'User is not a member of the org');
    });
  }

  if (routeLevel === 'ORG_MEMBERSHIP') {
    test('Org member should be granted access', async () => {
      const memberId = await createOrgMember(orgMember);
      setAuthUser(server, MEMBER_EMAIL);

      const response = await makeRequest(memberId);

      expectAccessToBeGranted(response, 'User is accessing their own membership');
    });

    test('Another member from same org should be denied access', async () => {
      const memberId = await createOrgMember({ ...orgMember, email: `not-${MEMBER_EMAIL}` });
      setAuthUser(server, MEMBER_EMAIL);

      const response = await makeRequest(memberId);

      expectAccessToBeDenied(response, 'User is accessing different membership');
    });
  } else {
    test('Org member should be denied access', async () => {
      const memberId = await createOrgMember(orgMember);
      setAuthUser(server, MEMBER_EMAIL);

      const response = await makeRequest(memberId);

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
