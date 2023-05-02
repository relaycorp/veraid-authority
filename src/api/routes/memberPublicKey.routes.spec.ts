import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import {
  MEMBER_MONGO_ID,
  MEMBER_PUBLIC_KEY_MONGO_ID as PUBLIC_KEY_ID,
  ORG_NAME,
  TEST_SERVICE_OID,
} from '../../testUtils/stubs.js';
import type { Result } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { MemberPublicKeyCreationResult } from '../../memberPublicKeyTypes.js';
import { MemberPublicKeyProblemType } from '../../MemberPublicKeyProblemType.js';
import type { MemberPublicKeySchema } from '../../schemas/memberPublicKey.schema.js';
import { generateKeyPair } from '../../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../../utilities/webcrypto.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

const mockCreateMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<MemberPublicKeyCreationResult, MemberPublicKeyProblemType>>>(),
);
const mockGetMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<MemberPublicKeySchema, MemberPublicKeyProblemType>>>(),
);
const mockDeleteMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberPublicKeyProblemType>>>(),
);

jest.unstable_mockModule('../../memberPublicKey.js', () => ({
  createMemberPublicKey: mockCreateMemberPublicKey,
  getMemberPublicKey: mockGetMemberPublicKey,
  deleteMemberPublicKey: mockDeleteMemberPublicKey,
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
      url: `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}/public-keys`,
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
        self: `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}/public-keys/${PUBLIC_KEY_ID}`,
      });
    });

    test('Malformed public key should be refused', async () => {
      const payload: MemberPublicKeySchema = {
        serviceOid: TEST_SERVICE_OID,
        publicKey: Buffer.from('invalid public key').toString('base64'),
      };
      mockCreateMemberPublicKey.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberPublicKeyProblemType.MALFORMED_PUBLIC_KEY,
      });
      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toStrictEqual({
        type: MemberPublicKeyProblemType.MALFORMED_PUBLIC_KEY,
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
      url: `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}/public-keys/${PUBLIC_KEY_ID}`,
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

      expect(mockGetMemberPublicKey).toHaveBeenCalledWith(MEMBER_MONGO_ID, PUBLIC_KEY_ID, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(mockDeleteMemberPublicKey).toHaveBeenCalledWith(PUBLIC_KEY_ID, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Non existing id should resolve into not found status', async () => {
      mockGetMemberPublicKey.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND,
      });

      const response = await serverInstance.inject(injectionOptions);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty(
        'type',
        MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND,
      );
    });
  });
});
