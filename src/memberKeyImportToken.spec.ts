import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { jest } from '@jest/globals';
import type { CloudEventV1 } from 'cloudevents';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, partialPinoLog } from './testUtils/logging.js';
import {
  AWALA_PDA,
  MEMBER_MONGO_ID,
  MEMBER_PUBLIC_KEY_MONGO_ID,
  TEST_SERVICE_OID,
} from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberKeyImportTokenModelSchema } from './models/MemberKeyImportToken.model.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import { generateKeyPair } from './testUtils/webcrypto.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';
import { mockSpy } from './testUtils/jest.js';
import type { Result } from './utilities/result.js';
import type { MemberPublicKeyCreationResult } from './memberPublicKeyTypes.js';
import { MemberPublicKeyImportProblemType } from './MemberKeyImportTokenProblemType.js';
import { MemberPublicKeyProblemType } from './MemberPublicKeyProblemType.js';
import { mockEmitter } from './testUtils/eventing/mockEmitter.js';
import {
  type MemberBundleRequestPayload,
  BUNDLE_REQUEST_TYPE,
} from './events/bundleRequest.event.js';

const { publicKey } = await generateKeyPair();
const publicKeyBuffer = await derSerialisePublicKey(publicKey);
const publicKeyBase64 = publicKeyBuffer.toString('base64');

const mockCreateMemberPublicKey = mockSpy(
  jest.fn<() => Promise<Result<MemberPublicKeyCreationResult, MemberPublicKeyProblemType>>>(),
);

jest.unstable_mockModule('./memberPublicKey.js', () => ({
  createMemberPublicKey: mockCreateMemberPublicKey,
}));

const { createMemberKeyImportToken, processMemberKeyImportToken } = await import(
  './memberKeyImportToken.js'
);

describe('member key import token', () => {
  const getConnection = setUpTestDbConnection();

  const mockLogging = makeMockLogging();
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let memberKeyImportTokenModel: ReturnModelType<typeof MemberKeyImportTokenModelSchema>;
  beforeEach(() => {
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    memberKeyImportTokenModel = getModelForClass(MemberKeyImportTokenModelSchema, {
      existingConnection: connection,
    });
  });

  describe('createMemberKeyImportToken', () => {
    test('Token should be created', async () => {
      const meberKeyImportToken = await createMemberKeyImportToken(
        MEMBER_MONGO_ID,
        TEST_SERVICE_OID,
        serviceOptions,
      );

      const dbResult = await memberKeyImportTokenModel.findById(meberKeyImportToken.result.id);
      expect(dbResult!.memberId).toStrictEqual(MEMBER_MONGO_ID);
      expect(dbResult!.serviceOid).toStrictEqual(TEST_SERVICE_OID);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member key import token created', {
          id: meberKeyImportToken.result.id,
        }),
      );
    });

    test('Multiple tokens for same member and service should be allowed', async () => {
      const meberKeyImportTokenOne = await createMemberKeyImportToken(
        MEMBER_MONGO_ID,
        TEST_SERVICE_OID,
        serviceOptions,
      );
      const meberKeyImportTokenTwo = await createMemberKeyImportToken(
        MEMBER_MONGO_ID,
        TEST_SERVICE_OID,
        serviceOptions,
      );

      const dbResultOne = await memberKeyImportTokenModel.findById(
        meberKeyImportTokenOne.result.id,
      );
      const dbResultTwo = await memberKeyImportTokenModel.findById(
        meberKeyImportTokenTwo.result.id,
      );
      expect(meberKeyImportTokenOne.result.id).not.toBe(meberKeyImportTokenTwo.result.id);
      expect(dbResultOne).not.toBeNull();
      expect(dbResultTwo).not.toBeNull();
    });
  });

  describe('processMemberKeyImportToken', () => {
    const getEvents = mockEmitter();

    test('Valid data should return be processed', async () => {
      const keyImportToken = await memberKeyImportTokenModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
      });
      mockCreateMemberPublicKey.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          id: MEMBER_PUBLIC_KEY_MONGO_ID,
        },
      });

      const result = await processMemberKeyImportToken(
        {
          publicKey: publicKeyBase64,
          publicKeyImportToken: keyImportToken._id.toString(),
          awalaPda: AWALA_PDA,
        },
        serviceOptions,
      );

      requireSuccessfulResult(result);
      const importTokenCount = await memberKeyImportTokenModel.count();
      expect(mockCreateMemberPublicKey).toHaveBeenCalledOnceWith(
        MEMBER_MONGO_ID,
        {
          publicKey: publicKeyBase64,
          serviceOid: TEST_SERVICE_OID,
        },
        serviceOptions,
      );
      expect(importTokenCount).toBe(0);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member public key import token deleted', {
          token: keyImportToken._id.toString(),
        }),
      );
    });

    test('Valid data should emit a an event', async () => {
      const keyImportToken = await memberKeyImportTokenModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
      });
      mockCreateMemberPublicKey.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          id: MEMBER_PUBLIC_KEY_MONGO_ID,
        },
      });

      const result = await processMemberKeyImportToken(
        {
          publicKey: publicKeyBase64,
          publicKeyImportToken: keyImportToken._id.toString(),
          awalaPda: AWALA_PDA,
        },
        serviceOptions,
      );

      requireSuccessfulResult(result);
      expect(getEvents()).toContainEqual(
        expect.objectContaining<Partial<CloudEventV1<MemberBundleRequestPayload>>>({
          id: MEMBER_MONGO_ID,
          source: 'https://veraid.net/authority/awala-member-key-import',
          type: BUNDLE_REQUEST_TYPE,

          data: {
            publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
            awalaPda: AWALA_PDA,
          },
        }),
      );
    });

    test('Non existing token should return error', async () => {
      const invalidToken = '111111111111111111111111';

      const result = await processMemberKeyImportToken(
        {
          publicKey: publicKeyBase64,
          publicKeyImportToken: invalidToken,
          awalaPda: AWALA_PDA,
        },
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.context).toBe(MemberPublicKeyImportProblemType.TOKEN_NOT_FOUND);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member public key import token not found', {
          token: invalidToken,
        }),
      );
    });

    test('Malformed public key should return error', async () => {
      const keyImportToken = await memberKeyImportTokenModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
      });
      mockCreateMemberPublicKey.mockResolvedValueOnce({
        didSucceed: false,
        context: MemberPublicKeyProblemType.MALFORMED_PUBLIC_KEY,
      });

      const result = await processMemberKeyImportToken(
        {
          publicKey: publicKeyBase64,
          publicKeyImportToken: keyImportToken._id.toString(),
          awalaPda: AWALA_PDA,
        },
        serviceOptions,
      );

      requireFailureResult(result);
      expect(result.context).toBe(MemberPublicKeyImportProblemType.KEY_CREATION_ERROR);
      expect(mockCreateMemberPublicKey).toHaveBeenCalledOnceWith(
        MEMBER_MONGO_ID,
        {
          publicKey: publicKeyBase64,
          serviceOid: TEST_SERVICE_OID,
        },
        serviceOptions,
      );
    });
  });
});
