import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { MEMBER_ID, ORG_NAME, TEST_SERVICE_OID } from '../../testUtils/stubs.js';
import type { Result } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

import type { SignatureSpecCreationResult } from './SignatureSpecTypes.js';
import { SignatureSpecProblem } from './SignatureSpecProblem.js';
import type { SignatureSpecSchema } from './SignatureSpec.schema.js';

const OPENID_PROVIDER_ISSUER_URL = new URL('https://idp.example.com');
const JWT_SUBJECT_CLAIM = 'sub';
const JWT_SUBJECT_VALUE = 'alice@example.com';
const PLAINTEXT = Buffer.from('test plaintext').toString('base64');

const SIGNATURE_SPEC_ID = '111111111111111111111111';
const SIGNATURE_SPECS_PATH = `/orgs/${ORG_NAME}/members/${MEMBER_ID}/signature-specs/`;
const SIGNATURE_SPEC_PATH = `${SIGNATURE_SPECS_PATH}${SIGNATURE_SPEC_ID}`;

const mockCreateSignatureSpec = mockSpy(
  jest.fn<() => Promise<Result<SignatureSpecCreationResult, SignatureSpecProblem>>>(),
);
const mockGetSignatureSpec = mockSpy(
  jest.fn<() => Promise<Result<SignatureSpecSchema, SignatureSpecProblem>>>(),
);
const mockDeleteSignatureSpec = mockSpy(
  jest.fn<() => Promise<Result<undefined, SignatureSpecProblem>>>(),
);

jest.unstable_mockModule('./signatureSpec.js', () => ({
  createSignatureSpec: mockCreateSignatureSpec,
  getSignatureSpec: mockGetSignatureSpec,
  deleteSignatureSpec: mockDeleteSignatureSpec,
}));

const { makeTestApiServer, testOrgRouteAuth } = await import('../../testUtils/apiServer.js');

describe('signature spec routes', () => {
  const getTestServerFixture = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServerFixture().server;
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: SIGNATURE_SPECS_PATH,
    };

    describe('Auth', () => {
      const payload: SignatureSpecSchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectClaim: JWT_SUBJECT_CLAIM,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };
      testOrgRouteAuth('ORG_MEMBERSHIP', { ...injectionOptions, payload }, getTestServerFixture, {
        spy: mockCreateSignatureSpec,
        result: { id: SIGNATURE_SPEC_ID },
      });
    });

    test('Valid data should be stored', async () => {
      const payload: SignatureSpecSchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectClaim: JWT_SUBJECT_CLAIM,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };
      mockCreateSignatureSpec.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          id: SIGNATURE_SPEC_ID,
        },
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.json()).toStrictEqual({
        self: SIGNATURE_SPEC_PATH,
      });
    });

    test('Malformed issuer URI should be refused', async () => {
      const payload: SignatureSpecSchema = {
        openidProviderIssuerUrl: 'Not a URI' as any,
        jwtSubjectClaim: JWT_SUBJECT_CLAIM,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty(
        'message',
        'body/openidProviderIssuerUrl must match format "uri"',
      );
    });

    test('Non-HTTP(S) issuer URL should be refused', async () => {
      const payload: SignatureSpecSchema = {
        openidProviderIssuerUrl: 'mailto:alice@example.com' as any,
        jwtSubjectClaim: JWT_SUBJECT_CLAIM,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', SignatureSpecProblem.MALFORMED_ISSUER_URL);
    });

    test('Invalid TTL should be refused', async () => {
      const payload: SignatureSpecSchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectClaim: JWT_SUBJECT_CLAIM,
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
      const payload: SignatureSpecSchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectClaim: JWT_SUBJECT_CLAIM,
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
      const payload: SignatureSpecSchema = {
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
        jwtSubjectClaim: JWT_SUBJECT_CLAIM,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignaturePlaintext: PLAINTEXT,
      };
      mockCreateSignatureSpec.mockResolvedValueOnce({
        didSucceed: false,
        context: SignatureSpecProblem.INVALID_TTL,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', SignatureSpecProblem.INVALID_TTL);
    });
  });

  describe('delete', () => {
    const injectionOptions: InjectOptions = {
      method: 'DELETE',
      url: SIGNATURE_SPEC_PATH,
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetSignatureSpec.mockResolvedValueOnce({
          didSucceed: true,

          result: {
            openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectClaim: JWT_SUBJECT_CLAIM,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
            veraidServiceOid: TEST_SERVICE_OID,
            veraidSignatureTtlSeconds: 3600,
            veraidSignaturePlaintext: PLAINTEXT,
          },
        });
      });

      testOrgRouteAuth('ORG_MEMBERSHIP', injectionOptions, getTestServerFixture, {
        spy: mockDeleteSignatureSpec,
      });
    });

    test('Valid id should be accepted', async () => {
      mockGetSignatureSpec.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
          jwtSubjectClaim: JWT_SUBJECT_CLAIM,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignatureTtlSeconds: 3600,
          veraidSignaturePlaintext: PLAINTEXT,
        },
      });
      mockDeleteSignatureSpec.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(mockGetSignatureSpec).toHaveBeenCalledWith(MEMBER_ID, SIGNATURE_SPEC_ID, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(mockDeleteSignatureSpec).toHaveBeenCalledWith(SIGNATURE_SPEC_ID, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Non existing id should resolve into not found status', async () => {
      mockGetSignatureSpec.mockResolvedValueOnce({
        didSucceed: false,
        context: SignatureSpecProblem.NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', SignatureSpecProblem.NOT_FOUND);
    });
  });

  describe('get', () => {
    const injectionOptions: InjectOptions = {
      method: 'GET',
      url: SIGNATURE_SPEC_PATH,
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetSignatureSpec.mockResolvedValueOnce({
          didSucceed: true,

          result: {
            openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
            jwtSubjectClaim: JWT_SUBJECT_CLAIM,
            jwtSubjectValue: JWT_SUBJECT_VALUE,
            veraidServiceOid: TEST_SERVICE_OID,
            veraidSignatureTtlSeconds: 3600,
            veraidSignaturePlaintext: PLAINTEXT,
          },
        });
      });

      testOrgRouteAuth('ORG_MEMBERSHIP', injectionOptions, getTestServerFixture, {
        spy: mockGetSignatureSpec,
      });
    });

    test('Valid id should return the signature spec', async () => {
      mockGetSignatureSpec.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL,
          jwtSubjectClaim: JWT_SUBJECT_CLAIM,
          jwtSubjectValue: JWT_SUBJECT_VALUE,
          veraidServiceOid: TEST_SERVICE_OID,
          veraidSignatureTtlSeconds: 3600,
          veraidSignaturePlaintext: PLAINTEXT,
        },
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.json()).toStrictEqual({
        openidProviderIssuerUrl: OPENID_PROVIDER_ISSUER_URL.toString(),
        jwtSubjectClaim: JWT_SUBJECT_CLAIM,
        jwtSubjectValue: JWT_SUBJECT_VALUE,
        veraidServiceOid: TEST_SERVICE_OID,
        veraidSignatureTtlSeconds: 3600,
        veraidSignaturePlaintext: PLAINTEXT,
      });
    });

    test('Non existing id should resolve into not found status', async () => {
      mockGetSignatureSpec.mockResolvedValueOnce({
        didSucceed: false,
        context: SignatureSpecProblem.NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', SignatureSpecProblem.NOT_FOUND);
    });
  });
});
