/* eslint-disable unicorn/text-encoding-identifier-case */
import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import { MEMBER_EMAIL, MEMBER_NAME, ORG_NAME } from '../../testUtils/stubs.js';
import type { Result, SuccessfulResult } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../http.js';
import type { FastifyTypedInstance } from '../fastify.js';
import type { MemberCreationResult } from '../../memberTypes.js';
import { MemberProblemType } from '../../MemberProblemType.js';
import {
  type MemberSchema,
  type MemberSchemaRole,
  memberSchemaRoles,
} from '../schema/member.schema.js';

const mockCreateMember = mockSpy(
  jest.fn<() => Promise<Result<MemberCreationResult, MemberProblemType>>>(),
);
const mockGetMember = mockSpy(jest.fn<() => Promise<Result<MemberSchema, MemberProblemType>>>());
jest.unstable_mockModule('../../member.js', () => ({
  createMember: mockCreateMember,
  getMember: mockGetMember,
}));

const { setUpTestServer } = await import('../../testUtils/server.js');

describe('member routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);
  const mongoId = '6424ad273f75645b35f9ee79';
  const getTestServer = setUpTestServer();
  let serverInstance: FastifyTypedInstance;
  const testMemberId = 'TEST_ID';
  beforeEach(() => {
    serverInstance = getTestServer();
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: `/orgs/${ORG_NAME}/members`,
    };

    test.each(memberSchemaRoles)(
      'Minimum required data with role %s should be stored',
      async (memberSchemaRole: MemberSchemaRole) => {
        const payload: MemberSchema = {
          role: memberSchemaRole,
        };
        mockCreateMember.mockResolvedValueOnce({
          didSucceed: true,

          result: {
            id: testMemberId,
          },
        });

        const response = await serverInstance.inject({
          ...injectionOptions,
          payload,
        });

        expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
        expect(response.headers['content-type']).toStartWith('application/json');
        expect(response.json()).toStrictEqual({
          self: `/orgs/${ORG_NAME}/members/${testMemberId}`,
        });
      },
    );

    test.each([
      ['Invalid', 'INVALID_ROLE'],
      ['Missing', undefined],
    ])('%s role should be refused', async (_type, role: string | undefined) => {
      const payload: MemberSchema = {
        role,
      } as any;

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    });

    test.each([
      ['ASCII', MEMBER_EMAIL],
      ['Missing', undefined],
    ])('%s email should be allowed', async (_type, email: string | undefined) => {
      const payload: MemberSchema = {
        role: 'REGULAR',
        email,
      };
      mockCreateMember.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          id: testMemberId,
        },
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
    });

    test('Malformed email should be refused', async () => {
      const payload: MemberSchema = {
        role: 'REGULAR',
        email: 'invalidEmail',
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    });

    test('Member name should be allowed', async () => {
      const payload: MemberSchema = {
        role: 'REGULAR',
        name: MEMBER_NAME,
      };
      mockCreateMember.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          id: testMemberId,
        },
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
    });

    test('Malformed name should resolve into bad request status', async () => {
      const payload: MemberSchema = {
        role: 'REGULAR',
        name: `${MEMBER_NAME}@`,
      };
      mockCreateMember.mockResolvedValueOnce({
        didSucceed: false,

        reason: MemberProblemType.MALFORMED_MEMBER_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', MemberProblemType.MALFORMED_MEMBER_NAME);
    });
  });

  describe('get by org name and member id', () => {
    const injectionOptions: InjectOptions = {
      method: 'GET',
      url: `/orgs/${ORG_NAME}/members/${mongoId}`,
    };

    test('Existing member should be returned', async () => {
      const getMemberSuccessResponse: SuccessfulResult<MemberSchema> = {
        didSucceed: true,

        result: {
          role: 'ORG_ADMIN',
          name: MEMBER_NAME,
          email: MEMBER_EMAIL,
        },
      };
      mockGetMember.mockResolvedValueOnce(getMemberSuccessResponse);

      const response = await serverInstance.inject(injectionOptions);

      expect(mockGetMember).toHaveBeenCalledWith(ORG_NAME, mongoId, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.headers['content-type']).toStartWith('application/json');
      expect(response.json()).toStrictEqual(getMemberSuccessResponse.result);
    });

    test('Non existing member id should resolve into not found status', async () => {
      mockGetMember.mockResolvedValueOnce({
        didSucceed: false,
        reason: MemberProblemType.MEMBER_NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(mockGetMember).toHaveBeenCalledWith(ORG_NAME, mongoId, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', MemberProblemType.MEMBER_NOT_FOUND);
    });
  });
});
