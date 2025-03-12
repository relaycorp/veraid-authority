import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { MEMBER_ID, ORG_NAME, TEST_SERVICE_OID } from '../../testUtils/stubs.js';
import type { Result } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

import type { MemberWorkloadIdentityCreationResult } from './memberWorkloadIdentityTypes.js';
import { MemberWorkloadIdentityProblem } from './MemberWorkloadIdentityProblem.js';
import type { MemberWorkloadIdentitySchema } from './memberWorkloadIdentity.schema.js';

const OPENID_PROVIDER_ISSUER_URL = 'https://idp.example.com';
const JWT_SUBJECT_FIELD = 'sub';
const JWT_SUBJECT_VALUE = 'alice@example.com';
const PLAINTEXT = Buffer.from('test plaintext').toString('base64');

const WORKLOAD_IDENTITY_ID = '111111111111111111111111';
const WORKLOAD_IDENTITIES_PATH = `/orgs/${ORG_NAME}/members/${MEMBER_ID}/workload-identities/`;
const WORKLOAD_IDENTITY_PATH = `${WORKLOAD_IDENTITIES_PATH}${WORKLOAD_IDENTITY_ID}`;

const mockCreateWorkloadIdentity = mockSpy(
  jest.fn<
    () => Promise<Result<MemberWorkloadIdentityCreationResult, MemberWorkloadIdentityProblem>>
  >(),
);
const mockGetWorkloadIdentity = mockSpy(
  jest.fn<() => Promise<Result<MemberWorkloadIdentitySchema, MemberWorkloadIdentityProblem>>>(),
);
const mockDeleteWorkloadIdentity = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberWorkloadIdentityProblem>>>(),
);

jest.unstable_mockModule('./memberWorkloadIdentity.js', () => ({
  createWorkloadIdentity: mockCreateWorkloadIdentity,
  getWorkloadIdentity: mockGetWorkloadIdentity,
  deleteWorkloadIdentity: mockDeleteWorkloadIdentity,
}));

const { makeTestApiServer, testOrgRouteAuth } = await import('../../testUtils/apiServer.js');

describe('member workload identity routes', () => {
  const getTestServerFixture = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServerFixture().server;
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: WORKLOAD_IDENTITIES_PATH,
    };

    describe('Auth', () => {
      const payload: MemberWorkloadIdentitySchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };
      testOrgRouteAuth('ORG_MEMBERSHIP', { ...injectionOptions, payload }, getTestServerFixture, {
        spy: mockCreateWorkloadIdentity,
        result: { id: WORKLOAD_IDENTITY_ID },
      });
    });

    test('Valid data should be stored', async () => {
      const payload: MemberWorkloadIdentitySchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };
      mockCreateWorkloadIdentity.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          id: WORKLOAD_IDENTITY_ID,
        },
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.json()).toStrictEqual({
        self: WORKLOAD_IDENTITY_PATH,
      });
    });

    test('Invalid TTL should be refused', async () => {
      const payload: MemberWorkloadIdentitySchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
        veraidSignatureTtlSeconds: 0,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    });

    test('Malformed service OID should be refused', async () => {
      const payload: MemberWorkloadIdentitySchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: `${TEST_SERVICE_OID}@`,
        veraidSignaturePlaintext: PLAINTEXT,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    });

    test('Service function returning INVALID_TTL should be refused', async () => {
      const payload: MemberWorkloadIdentitySchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };
      mockCreateWorkloadIdentity.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberWorkloadIdentityProblem.INVALID_TTL,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', MemberWorkloadIdentityProblem.INVALID_TTL);
    });
  });

  describe('delete', () => {
    const injectionOptions: InjectOptions = {
      method: 'DELETE',
      url: WORKLOAD_IDENTITY_PATH,
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetWorkloadIdentity.mockResolvedValueOnce({
          didSucceed: true,

          result: {
            openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectField: JWT_SUBJECT_FIELD,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
            veraidServiceOid: TEST_SERVICE_OID,
            veraidSignatureTtlSeconds: 3600,
            veraidSignaturePlaintext: PLAINTEXT,
          },
        });
      });

      testOrgRouteAuth('ORG_MEMBERSHIP', injectionOptions, getTestServerFixture, {
        spy: mockDeleteWorkloadIdentity,
      });
    });

    test('Valid id should be accepted', async () => {
      mockGetWorkloadIdentity.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
          jwtSubjectField: JWT_SUBJECT_FIELD,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignatureTtlSeconds: 3600,
          veraidSignaturePlaintext: PLAINTEXT,
        },
      });
      mockDeleteWorkloadIdentity.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(mockGetWorkloadIdentity).toHaveBeenCalledWith(MEMBER_ID, WORKLOAD_IDENTITY_ID, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(mockDeleteWorkloadIdentity).toHaveBeenCalledWith(WORKLOAD_IDENTITY_ID, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Non existing id should resolve into not found status', async () => {
      mockGetWorkloadIdentity.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberWorkloadIdentityProblem.NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', MemberWorkloadIdentityProblem.NOT_FOUND);
    });
  });

  describe('get', () => {
    const injectionOptions: InjectOptions = {
      method: 'GET',
      url: WORKLOAD_IDENTITY_PATH,
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetWorkloadIdentity.mockResolvedValueOnce({
          didSucceed: true,

          result: {
            openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectField: JWT_SUBJECT_FIELD,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
            veraidServiceOid: TEST_SERVICE_OID,
            veraidSignatureTtlSeconds: 3600,
            veraidSignaturePlaintext: PLAINTEXT,
          },
        });
      });

      testOrgRouteAuth('ORG_MEMBERSHIP', injectionOptions, getTestServerFixture, {
        spy: mockGetWorkloadIdentity,
      });
    });

    test('Valid id should return the workload identity', async () => {
      mockGetWorkloadIdentity.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
          jwtSubjectField: JWT_SUBJECT_FIELD,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignatureTtlSeconds: 3600,
          veraidSignaturePlaintext: PLAINTEXT,
        },
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.json()).toStrictEqual({
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: PLAINTEXT,
      });
    });

    test('Non existing id should resolve into not found status', async () => {
      mockGetWorkloadIdentity.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberWorkloadIdentityProblem.NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', MemberWorkloadIdentityProblem.NOT_FOUND);
    });
  });
});
