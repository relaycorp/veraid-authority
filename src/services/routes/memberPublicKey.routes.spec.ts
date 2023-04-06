import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import {
  MEMBER_MONGO_ID,
  MEMBER_PUBLIC_KEY_MONGO_ID as PUBLIC_KEY_ID,
  ORG_NAME,
  TEST_OID,
} from '../../testUtils/stubs.js';
import type { Result } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../http.js';
import type { FastifyTypedInstance } from '../fastify.js';
import type { MemberPublicKeyCreationResult } from '../../businessLogic/memberPublicKey/memberPublicKeyTypes.js';
import { MemberPublicKeyProblemType } from '../../businessLogic/memberPublicKey/MemberPublicKeyProblemType.js';
import type { MemberPublicKeySchema } from '../schema/memberPublicKey.schema.js';
import { generatePublicKey } from '../../testUtils/publicKeyGenerator.js';

const mockCreateMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<MemberPublicKeyCreationResult, MemberPublicKeyProblemType>>>(),
);
const mockGetMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<MemberPublicKeySchema, MemberPublicKeyProblemType>>>(),
);
const mockDeleteMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberPublicKeyProblemType>>>(),
);

jest.unstable_mockModule('../../businessLogic/memberPublicKey/memberPublicKey.js', () => ({
  createMemberPublicKey: mockCreateMemberPublicKey,
  getMemberPublicKey: mockGetMemberPublicKey,
  deleteMemberPublicKey: mockDeleteMemberPublicKey,
}));
const { setUpTestServer } = await import('../../testUtils/server.js');
const publicKey = await generatePublicKey();

describe('member public keys routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);
  const getTestServer = setUpTestServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServer();
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}/public-keys`,
    };

    test('Valid data should be stored', async () => {
      const payload: MemberPublicKeySchema = {
        oid: TEST_OID,
        publicKey: publicKey.toString('base64'),
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
      expect(response.headers['content-type']).toStartWith('application/json');
      expect(response.json()).toStrictEqual({
        self: `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}/public-keys/${PUBLIC_KEY_ID}`,
      });
    });

    test('Malformed public key should be refused', async () => {
      const payload: MemberPublicKeySchema = {
        oid: TEST_OID,
        publicKey: Buffer.from('invalid public key').toString('base64'),
      };
      mockCreateMemberPublicKey.mockResolvedValueOnce({
        didSucceed: false,
        reason: MemberPublicKeyProblemType.MALFORMED_PUBLIC_KEY,
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

    test('Malformed oid should be refused', async () => {
      const payload: MemberPublicKeySchema = {
        oid: `${TEST_OID}@`,
        publicKey: publicKey.toString('base64'),
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

    test('Valid id should be accepted', async () => {
      mockGetMemberPublicKey.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          publicKey: publicKey.toString('base64'),
          oid: TEST_OID,
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
        reason: MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND,
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
