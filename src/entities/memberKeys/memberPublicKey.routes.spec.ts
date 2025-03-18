import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import {
  MEMBER_ID,
  MEMBER_PUBLIC_KEY_MONGO_ID as PUBLIC_KEY_ID,
  ORG_NAME,
  TEST_SERVICE_OID,
} from '../../testUtils/stubs.js';
import type { Result } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import { generateKeyPair } from '../../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../../utilities/webcrypto.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { bufferToArrayBuffer } from '../../utilities/buffer.js';
import { VeraidContentType } from '../../utilities/veraid.js';

import type { BundleCreationFailure } from './memberBundle.js';
import type { MemberPublicKeySchema } from './memberPublicKey.schema.js';
import { MemberPublicKeyProblem } from './MemberPublicKeyProblem.js';
import type { MemberPublicKeyCreationResult } from './memberPublicKeyTypes.js';

const mockCreateMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<MemberPublicKeyCreationResult, MemberPublicKeyProblem>>>(),
);
const mockGetMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<MemberPublicKeySchema, MemberPublicKeyProblem>>>(),
);
const mockDeleteMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberPublicKeyProblem>>>(),
);

jest.unstable_mockModule('./memberPublicKey.js', () => ({
  createMemberPublicKey: mockCreateMemberPublicKey,
  getMemberPublicKey: mockGetMemberPublicKey,
  deleteMemberPublicKey: mockDeleteMemberPublicKey,
}));

const CERTIFICATE_EXPIRY_DAYS = 90;
const mockGenerateMemberBundle = mockSpy(
  jest.fn<() => Promise<Result<{ serialise: () => ArrayBuffer }, BundleCreationFailure>>>(),
);
jest.unstable_mockModule('./memberBundle.js', () => ({
  generateMemberBundle: mockGenerateMemberBundle,
  CERTIFICATE_EXPIRY_DAYS,
}));

const { makeTestApiServer, testOrgRouteAuth } = await import('../../testUtils/apiServer.js');
const { publicKey } = await generateKeyPair();
const publicKeyBuffer = await derSerialisePublicKey(publicKey);
const publicKeyBase64 = publicKeyBuffer.toString('base64');

describe('member public keys routes', () => {
  const getTestServerFixture = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServerFixture().server;
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: `/orgs/${ORG_NAME}/members/${MEMBER_ID}/public-keys`,
    };

    describe('Auth', () => {
      const payload: MemberPublicKeySchema = {
        serviceOid: TEST_SERVICE_OID,
        publicKey: publicKeyBase64,
      };
      testOrgRouteAuth('ORG_MEMBERSHIP', { ...injectionOptions, payload }, getTestServerFixture, {
        spy: mockCreateMemberPublicKey,
        result: { id: PUBLIC_KEY_ID },
      });
    });

    test('Valid data should be stored', async () => {
      const payload: MemberPublicKeySchema = {
        serviceOid: TEST_SERVICE_OID,
        publicKey: publicKeyBase64,
      };
      mockCreateMemberPublicKey.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          id: PUBLIC_KEY_ID,
        },
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.json()).toStrictEqual({
        self: `/orgs/${ORG_NAME}/members/${MEMBER_ID}/public-keys/${PUBLIC_KEY_ID}`,
        bundle: `/orgs/${ORG_NAME}/members/${MEMBER_ID}/public-keys/${PUBLIC_KEY_ID}/bundle`,
      });
    });

    test('Malformed public key should be refused', async () => {
      const payload: MemberPublicKeySchema = {
        serviceOid: TEST_SERVICE_OID,
        publicKey: Buffer.from('invalid public key').toString('base64'),
      };
      mockCreateMemberPublicKey.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberPublicKeyProblem.MALFORMED_PUBLIC_KEY,
      });
      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toStrictEqual({
        type: MemberPublicKeyProblem.MALFORMED_PUBLIC_KEY,
      });
    });

    test('Malformed service OID should be refused', async () => {
      const payload: MemberPublicKeySchema = {
        serviceOid: `${TEST_SERVICE_OID}@`,
        publicKey: publicKeyBase64,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    });
  });

  describe('delete', () => {
    const injectionOptions: InjectOptions = {
      method: 'DELETE',
      url: `/orgs/${ORG_NAME}/members/${MEMBER_ID}/public-keys/${PUBLIC_KEY_ID}`,
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetMemberPublicKey.mockResolvedValueOnce({
          didSucceed: true,
          result: { publicKey: publicKeyBase64, serviceOid: TEST_SERVICE_OID },
        });
      });

      testOrgRouteAuth('ORG_MEMBERSHIP', injectionOptions, getTestServerFixture, {
        spy: mockDeleteMemberPublicKey,
      });
    });

    test('Valid id should be accepted', async () => {
      mockGetMemberPublicKey.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          publicKey: publicKeyBase64,
          serviceOid: TEST_SERVICE_OID,
        },
      });
      mockDeleteMemberPublicKey.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(mockGetMemberPublicKey).toHaveBeenCalledWith(MEMBER_ID, PUBLIC_KEY_ID, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(mockDeleteMemberPublicKey).toHaveBeenCalledWith(PUBLIC_KEY_ID, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Non existing id should resolve into not found status', async () => {
      mockGetMemberPublicKey.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberPublicKeyProblem.PUBLIC_KEY_NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', MemberPublicKeyProblem.PUBLIC_KEY_NOT_FOUND);
    });
  });

  describe('bundle', () => {
    const injectOptions: InjectOptions = {
      method: 'GET',
      url: `/orgs/${ORG_NAME}/members/${MEMBER_ID}/public-keys/${PUBLIC_KEY_ID}/bundle`,
    };

    const bundleSerialised = Buffer.from('bundle');
    beforeEach(() => {
      mockGenerateMemberBundle.mockResolvedValue({
        didSucceed: true,
        result: { serialise: () => bufferToArrayBuffer(bundleSerialised) },
      });
    });

    test('Bundle should be generated for the specified public key', async () => {
      await serverInstance.inject(injectOptions);

      expect(mockGenerateMemberBundle).toHaveBeenCalledWith(PUBLIC_KEY_ID, expect.anything());
    });

    test('Response body should be generated bundle', async () => {
      const response = await serverInstance.inject(injectOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.rawPayload).toMatchObject(bundleSerialised);
    });

    test('Content type should be that of a bundle', async () => {
      const response = await serverInstance.inject(injectOptions);

      expect(response.headers).toHaveProperty('content-type', VeraidContentType.MEMBER_BUNDLE);
    });

    test('HTTP Not Found should be returned if DB records do not exist', async () => {
      mockGenerateMemberBundle.mockResolvedValue({
        didSucceed: false,
        context: { didChainRetrievalFail: false },
      });

      const response = await serverInstance.inject(injectOptions);

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.NOT_FOUND);
    });

    test('HTTP Service Unavailable should be returned if bundle generation fails', async () => {
      mockGenerateMemberBundle.mockResolvedValue({
        didSucceed: false,
        context: { didChainRetrievalFail: true },
      });

      const response = await serverInstance.inject(injectOptions);

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
    });
  });
});
