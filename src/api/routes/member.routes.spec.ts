/* eslint-disable unicorn/text-encoding-identifier-case */
import type { FastifyInstance, InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { MEMBER_EMAIL, MEMBER_MONGO_ID, MEMBER_NAME, ORG_NAME } from '../../testUtils/stubs.js';
import type { Result, SuccessfulResult } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { MemberCreationResult } from '../../memberTypes.js';
import { MemberProblemType } from '../../MemberProblemType.js';
import {
  type MemberSchema,
  type MemberSchemaRole,
  memberSchemaRoles,
  type PatchMemberSchema,
} from '../../schemas/member.schema.js';

const mockCreateMember = mockSpy(
  jest.fn<() => Promise<Result<MemberCreationResult, MemberProblemType>>>(),
);
const mockGetMember = mockSpy(jest.fn<() => Promise<Result<MemberSchema, MemberProblemType>>>());
const mockDeleteMember = mockSpy(jest.fn<() => Promise<Result<undefined, MemberProblemType>>>());
const mockUpdateMember = mockSpy(jest.fn<() => Promise<Result<undefined, MemberProblemType>>>());

jest.unstable_mockModule('../../member.js', () => ({
  createMember: mockCreateMember,
  getMember: mockGetMember,
  deleteMember: mockDeleteMember,
  updateMember: mockUpdateMember,
}));

const { makeTestApiServer, testOrgRouteAuth } = await import('../../testUtils/apiServer.js');

describe('member routes', () => {
  const testMemberId = 'TEST_ID';
  const getTestServerFixture = makeTestApiServer();
  let serverInstance: FastifyInstance;
  beforeEach(() => {
    serverInstance = getTestServerFixture().server;
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: `/orgs/${ORG_NAME}/members`,
    };

    describe('Auth', () => {
      const payload: MemberSchema = { role: 'REGULAR' };
      testOrgRouteAuth('ORG', { ...injectionOptions, payload }, getTestServerFixture, {
        spy: mockCreateMember,
        result: { id: testMemberId },
      });
    });

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
        const memberPath = `/orgs/${ORG_NAME}/members/${testMemberId}`;
        expect(response.json()).toStrictEqual({
          self: memberPath,
          publicKeys: `${memberPath}/public-keys`,
          publicKeyImportTokens: `${memberPath}/public-key-import-tokens`,
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
      ['Null', null],
    ])('%s email should be allowed', async (_type, email: string | null | undefined) => {
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

    test('Null member name should be allowed', async () => {
      const payload: MemberSchema = {
        role: 'REGULAR',
        name: null,
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

    test('Duplicated name should resolve into conflict status', async () => {
      const payload: MemberSchema = {
        role: 'REGULAR',
        name: MEMBER_NAME,
      };
      mockCreateMember.mockResolvedValueOnce({
        didSucceed: false,

        reason: MemberProblemType.EXISTING_MEMBER_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.CONFLICT);
      expect(response.json()).toHaveProperty('type', MemberProblemType.EXISTING_MEMBER_NAME);
    });
  });

  describe('get by org name and member id', () => {
    const injectionOptions: InjectOptions = {
      method: 'GET',
      url: `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}`,
    };

    describe('Auth', () => {
      testOrgRouteAuth('ORG_MEMBERSHIP', injectionOptions, getTestServerFixture, {
        spy: mockGetMember,
        result: { role: 'REGULAR', name: MEMBER_NAME, email: MEMBER_EMAIL },
      });
    });

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

      expect(mockGetMember).toHaveBeenCalledWith(ORG_NAME, MEMBER_MONGO_ID, {
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

      expect(mockGetMember).toHaveBeenCalledWith(ORG_NAME, MEMBER_MONGO_ID, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', MemberProblemType.MEMBER_NOT_FOUND);
    });
  });

  describe('delete', () => {
    const injectionOptions: InjectOptions = {
      method: 'DELETE',
      url: `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}`,
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetMember.mockResolvedValueOnce({ didSucceed: true, result: { role: 'REGULAR' } });
      });

      testOrgRouteAuth('ORG_MEMBERSHIP_RESTRICTED', injectionOptions, getTestServerFixture, {
        spy: mockDeleteMember,
      });
    });

    test('Valid org name and member id should be accepted', async () => {
      mockGetMember.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          role: 'ORG_ADMIN',
        },
      });
      mockDeleteMember.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(mockDeleteMember).toHaveBeenCalledWith(MEMBER_MONGO_ID, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Non existing org name or member id should resolve into not found status', async () => {
      mockGetMember.mockResolvedValueOnce({
        didSucceed: false,
        reason: MemberProblemType.MEMBER_NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', MemberProblemType.MEMBER_NOT_FOUND);
    });
  });

  describe('update', () => {
    const injectionOptions: InjectOptions = {
      method: 'PATCH',
      url: `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}`,
    };

    const getMemberSuccessResponse: SuccessfulResult<MemberSchema> = {
      didSucceed: true,

      result: {
        name: MEMBER_NAME,
        email: MEMBER_EMAIL,
        role: 'ORG_ADMIN',
      },
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetMember.mockResolvedValueOnce({ didSucceed: true, result: { role: 'REGULAR' } });
      });

      testOrgRouteAuth(
        'ORG_MEMBERSHIP_RESTRICTED',
        { ...injectionOptions, payload: {} },
        getTestServerFixture,
        { spy: mockUpdateMember },
      );
    });

    test('Empty parameters should be allowed', async () => {
      mockGetMember.mockResolvedValueOnce(getMemberSuccessResponse);
      mockUpdateMember.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload: {},
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test.each(memberSchemaRoles)('Role %s should be allowed', async (role: MemberSchemaRole) => {
      mockGetMember.mockResolvedValueOnce(getMemberSuccessResponse);
      mockUpdateMember.mockResolvedValueOnce({
        didSucceed: true,
      });
      const payload: MemberSchema = {
        role,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Invalid role should be resolved into bad request status', async () => {
      const payload: PatchMemberSchema = {
        role: 'INVALID_ROLE' as any,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    });

    test('Null name should be allowed', async () => {
      mockGetMember.mockResolvedValueOnce(getMemberSuccessResponse);
      mockUpdateMember.mockResolvedValueOnce({
        didSucceed: true,
      });
      const payload: PatchMemberSchema = {
        name: null,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Malformed name should be resolved into bad request status', async () => {
      mockGetMember.mockResolvedValueOnce(getMemberSuccessResponse);
      mockUpdateMember.mockResolvedValueOnce({
        didSucceed: false,
        reason: MemberProblemType.MALFORMED_MEMBER_NAME,
      });
      const payload: PatchMemberSchema = {
        name: `@${MEMBER_NAME}`,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response.json()).toHaveProperty('type', MemberProblemType.MALFORMED_MEMBER_NAME);
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    });

    test('Duplicated name should be resolved into bad request status', async () => {
      mockGetMember.mockResolvedValueOnce(getMemberSuccessResponse);
      mockUpdateMember.mockResolvedValueOnce({
        didSucceed: false,
        reason: MemberProblemType.EXISTING_MEMBER_NAME,
      });
      const payload: PatchMemberSchema = {
        name: `@${MEMBER_NAME}`,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response.json()).toHaveProperty('type', MemberProblemType.EXISTING_MEMBER_NAME);
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.CONFLICT);
    });

    test('Non existing org name or member id should resolve into not found status', async () => {
      mockGetMember.mockResolvedValueOnce({
        didSucceed: false,
        reason: MemberProblemType.MEMBER_NOT_FOUND,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload: {},
      });

      expect(mockGetMember).toHaveBeenCalledWith(ORG_NAME, MEMBER_MONGO_ID, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(response.json()).toHaveProperty('type', MemberProblemType.MEMBER_NOT_FOUND);
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
    });

    test('Null email should be allowed', async () => {
      mockGetMember.mockResolvedValueOnce(getMemberSuccessResponse);
      mockUpdateMember.mockResolvedValueOnce({
        didSucceed: true,
      });
      const payload: PatchMemberSchema = {
        email: null,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Malformed email should be resolved into bad request status', async () => {
      const payload: PatchMemberSchema = {
        email: 'INVALID_EMAIL',
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    });
  });
});
