/* eslint-disable unicorn/text-encoding-identifier-case */
import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import {
  MEMBER_EMAIL,
  MEMBER_NAME,
  NON_ASCII_MEMBER_NAME,
  ORG_NAME,
} from '../../testUtils/stubs.js';
import type { Result } from '../../utilities/result.js';
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
jest.unstable_mockModule('../../member.js', () => ({
  createMember: mockCreateMember,
}));

const { setUpTestServer } = await import('../../testUtils/server.js');

describe('member routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);
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
      ['Empty', undefined],
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

      // To be fixed -> ['Non ASCII', NON_ASCII_MEMBER_EMAIL],
      ['Empty', undefined],
    ])('%s email should be accepted', async (_type, email: string | undefined) => {
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

    test.each([
      ['ASCII', MEMBER_NAME],
      ['Non ASCII', NON_ASCII_MEMBER_NAME],
      ['Empty', undefined],
    ])('%s name should be accepted', async (_type, name: string | undefined) => {
      const payload: MemberSchema = {
        role: 'REGULAR',
        name,
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

    test('Malformed name should be refused', async () => {
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
});
