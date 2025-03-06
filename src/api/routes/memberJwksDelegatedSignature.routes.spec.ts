import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { MEMBER_MONGO_ID, ORG_NAME, TEST_SERVICE_OID } from '../../testUtils/stubs.js';
import type { Result } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { MemberJwksDelegatedSignatureCreationResult } from '../../memberJwksDelegatedSignatureTypes.js';
import { MemberJwksDelegatedSignatureProblem } from '../../MemberJwksDelegatedSignatureProblem.js';
import type { MemberJwksDelegatedSignatureSchema } from '../../schemas/memberJwksDelegatedSignature.schema.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

const JWKS_URL = 'https://example.com/.well-known/jwks.json';
const JWT_SUBJECT_FIELD = 'sub';
const JWT_SUBJECT_VALUE = 'alice@example.com';
const PLAINTEXT = Buffer.from('test plaintext').toString('base64');

const DELEGATED_SIGNATURE_ID = '111111111111111111111111';
const DELEGATED_SIGNATURE_PATH = `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}/delegated-signatures/jwks/${DELEGATED_SIGNATURE_ID}`;

const mockCreateJwksDelegatedSignature = mockSpy(
  jest.fn<
    () => Promise<
      Result<MemberJwksDelegatedSignatureCreationResult, MemberJwksDelegatedSignatureProblem>
    >
  >(),
);
const mockGetJwksDelegatedSignature = mockSpy(
  jest.fn<
    () => Promise<Result<MemberJwksDelegatedSignatureSchema, MemberJwksDelegatedSignatureProblem>>
  >(),
);
const mockDeleteJwksDelegatedSignature = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberJwksDelegatedSignatureProblem>>>(),
);

jest.unstable_mockModule('../../memberJwksDelegatedSignature.js', () => ({
  createJwksDelegatedSignature: mockCreateJwksDelegatedSignature,
  getJwksDelegatedSignature: mockGetJwksDelegatedSignature,
  deleteJwksDelegatedSignature: mockDeleteJwksDelegatedSignature,
}));

const { makeTestApiServer, testOrgRouteAuth } = await import('../../testUtils/apiServer.js');

describe('member JWKS delegated signature routes', () => {
  const getTestServerFixture = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServerFixture().server;
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: DELEGATED_SIGNATURE_PATH,
    };

    describe('Auth', () => {
      const payload: MemberJwksDelegatedSignatureSchema = {
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };
      testOrgRouteAuth('ORG_MEMBERSHIP', { ...injectionOptions, payload }, getTestServerFixture, {
        spy: mockCreateJwksDelegatedSignature,
        result: { id: DELEGATED_SIGNATURE_ID },
      });
    });

    test('Valid data should be stored', async () => {
      const payload: MemberJwksDelegatedSignatureSchema = {
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };
      mockCreateJwksDelegatedSignature.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          id: DELEGATED_SIGNATURE_ID,
        },
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.json()).toStrictEqual({
        self: DELEGATED_SIGNATURE_PATH,
      });
    });

    test('Invalid TTL should be refused', async () => {
      const payload: MemberJwksDelegatedSignatureSchema = {
        jwksUrl: JWKS_URL,
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
      const payload: MemberJwksDelegatedSignatureSchema = {
        jwksUrl: JWKS_URL,
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
      const payload: MemberJwksDelegatedSignatureSchema = {
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };
      mockCreateJwksDelegatedSignature.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberJwksDelegatedSignatureProblem.INVALID_TTL,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty(
        'type',
        MemberJwksDelegatedSignatureProblem.INVALID_TTL,
      );
    });
  });

  describe('delete', () => {
    const injectionOptions: InjectOptions = {
      method: 'DELETE',
      url: DELEGATED_SIGNATURE_PATH,
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetJwksDelegatedSignature.mockResolvedValueOnce({
          didSucceed: true,

          result: {
            jwksUrl: JWKS_URL,
            jwtSubjectField: JWT_SUBJECT_FIELD,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
            veraidServiceOid: TEST_SERVICE_OID,
            veraidSignatureTtlSeconds: 3600,
            veraidSignaturePlaintext: PLAINTEXT,
          },
        });
      });

      testOrgRouteAuth('ORG_MEMBERSHIP', injectionOptions, getTestServerFixture, {
        spy: mockDeleteJwksDelegatedSignature,
      });
    });

    test('Valid id should be accepted', async () => {
      mockGetJwksDelegatedSignature.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          jwksUrl: JWKS_URL,
          jwtSubjectField: JWT_SUBJECT_FIELD,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignatureTtlSeconds: 3600,
          veraidSignaturePlaintext: PLAINTEXT,
        },
      });
      mockDeleteJwksDelegatedSignature.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(mockGetJwksDelegatedSignature).toHaveBeenCalledWith(
        MEMBER_MONGO_ID,
        DELEGATED_SIGNATURE_ID,
        {
          logger: expect.anything(),
          dbConnection: serverInstance.mongoose,
        },
      );
      expect(mockDeleteJwksDelegatedSignature).toHaveBeenCalledWith(DELEGATED_SIGNATURE_ID, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Non existing id should resolve into not found status', async () => {
      mockGetJwksDelegatedSignature.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberJwksDelegatedSignatureProblem.NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', MemberJwksDelegatedSignatureProblem.NOT_FOUND);
    });
  });

  describe('get', () => {
    const injectionOptions: InjectOptions = {
      method: 'GET',
      url: DELEGATED_SIGNATURE_PATH,
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetJwksDelegatedSignature.mockResolvedValueOnce({
          didSucceed: true,

          result: {
            jwksUrl: JWKS_URL,
            jwtSubjectField: JWT_SUBJECT_FIELD,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
            veraidServiceOid: TEST_SERVICE_OID,
            veraidSignatureTtlSeconds: 3600,
            veraidSignaturePlaintext: PLAINTEXT,
          },
        });
      });

      testOrgRouteAuth('ORG_MEMBERSHIP', injectionOptions, getTestServerFixture, {
        spy: mockGetJwksDelegatedSignature,
      });
    });

    test('Valid id should return the delegated signature', async () => {
      mockGetJwksDelegatedSignature.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          jwksUrl: JWKS_URL,
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
        jwksUrl: JWKS_URL,
        jwtSubjectField: JWT_SUBJECT_FIELD,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: PLAINTEXT,
      });
    });

    test('Non existing id should resolve into not found status', async () => {
      mockGetJwksDelegatedSignature.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberJwksDelegatedSignatureProblem.NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', MemberJwksDelegatedSignatureProblem.NOT_FOUND);
    });
  });
});
