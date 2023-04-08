import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { jest } from '@jest/globals';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, type MockLogging, partialPinoLog } from './testUtils/logging.js';
import {
  MEMBER_MONGO_ID,
  MEMBER_PUBLIC_KEY_MONGO_ID as PUBLIC_KEY_ID,
  TEST_SERVICE_OID,
} from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import { getPromiseRejection } from './testUtils/jest.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import {
  createMemberPublicKey,
  deleteMemberPublicKey,
  getMemberPublicKey,
} from './memberPublicKey.js';
import { MemberPublicKeyProblemType } from './MemberPublicKeyProblemType.js';
import { generateKeyPair } from './testUtils/webcrypto.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';

const { publicKey } = await generateKeyPair();
const publicKeyBuffer = await derSerialisePublicKey(publicKey);
const publicKeyBase64 = publicKeyBuffer.toString('base64');

describe('member public key', () => {
  const getConnection = setUpTestDbConnection();

  let mockLogging: MockLogging;
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let memberPublicKeyModel: ReturnModelType<typeof MemberPublicKeyModelSchema>;
  beforeEach(() => {
    mockLogging = makeMockLogging();
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    memberPublicKeyModel = getModelForClass(MemberPublicKeyModelSchema, {
      existingConnection: connection,
    });
  });

  describe('createMemberPublicKey', () => {
    test('Member public key should be created', async () => {
      const commandRunTime = new Date();

      const memberPublicKey = await createMemberPublicKey(
        MEMBER_MONGO_ID,
        {
          publicKey: publicKeyBase64,
          serviceOid: TEST_SERVICE_OID,
        },
        serviceOptions,
      );

      requireSuccessfulResult(memberPublicKey);
      const dbResult = await memberPublicKeyModel.findById(memberPublicKey.result.id);
      expect(dbResult!.memberId).toStrictEqual(MEMBER_MONGO_ID);
      expect(dbResult!.serviceOid).toStrictEqual(TEST_SERVICE_OID);
      expect(dbResult!.publicKey.toString('base64')).toStrictEqual(publicKeyBase64);
      expect(dbResult!.creationDate).toBeBetween(commandRunTime, new Date());
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member public key created', {
          id: memberPublicKey.result.id,
        }),
      );
      jest.useRealTimers();
    });

    test('Malformed public key should be refused', async () => {
      const memberPublicKey = await createMemberPublicKey(
        MEMBER_MONGO_ID,
        {
          publicKey: Buffer.from('invalid public key').toString('base64'),
          serviceOid: TEST_SERVICE_OID,
        },
        serviceOptions,
      );

      requireFailureResult(memberPublicKey);
      expect(memberPublicKey.reason).toBe(MemberPublicKeyProblemType.MALFORMED_PUBLIC_KEY);
    });

    test('Record creation errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(
        async () =>
          createMemberPublicKey(
            MEMBER_MONGO_ID,
            {
              publicKey: publicKeyBase64,
              serviceOid: TEST_SERVICE_OID,
            },
            serviceOptions,
          ),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });

  describe('getMemberPublicKey', () => {
    test('Existing id should return the corresponding data', async () => {
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
        publicKey: publicKeyBuffer,
      });

      const result = await getMemberPublicKey(
        MEMBER_MONGO_ID,
        memberPublicKey._id.toString(),
        serviceOptions,
      );

      requireSuccessfulResult(result);
      expect(result.result).toMatchObject({
        serviceOid: TEST_SERVICE_OID,
        publicKey: publicKeyBase64,
      });
    });

    test('Non existing id should return non existing error', async () => {
      const invalidPublicKeyId = '111111111111111111111111';
      await memberPublicKeyModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
        publicKey: publicKeyBuffer,
      });

      const result = await getMemberPublicKey(MEMBER_MONGO_ID, invalidPublicKeyId, serviceOptions);

      requireFailureResult(result);
      expect(result.reason).toBe(MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND);
    });

    test('Non existing member id should return non existing error', async () => {
      const invalidMemberKeyId = '111111111111111111111111';
      await memberPublicKeyModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
        publicKey: publicKeyBuffer,
      });

      const result = await getMemberPublicKey(invalidMemberKeyId, MEMBER_MONGO_ID, serviceOptions);

      requireFailureResult(result);
      expect(result.reason).toBe(MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND);
    });

    test('Record Find errors should be propagated', async () => {
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
        publicKey: publicKeyBase64,
      });
      await connection.close();

      const error = await getPromiseRejection(
        async () =>
          getMemberPublicKey(MEMBER_MONGO_ID, memberPublicKey._id.toString(), serviceOptions),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });

  describe('deleteMemberPublicKey', () => {
    test('Existing id should remove member public key', async () => {
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: MEMBER_MONGO_ID,
        publicKey: publicKeyBuffer,
        serviceOid: TEST_SERVICE_OID,
      });

      const result = await deleteMemberPublicKey(memberPublicKey._id.toString(), serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberPublicKeyModel.findById(memberPublicKey._id);
      expect(dbResult).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member public key deleted', {
          id: memberPublicKey.id,
        }),
      );
    });

    test('Non existing id should not remove any member public key', async () => {
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: MEMBER_MONGO_ID,
        publicKey: publicKeyBuffer,
        serviceOid: TEST_SERVICE_OID,
      });

      const result = await deleteMemberPublicKey(PUBLIC_KEY_ID, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberPublicKeyModel.findById(memberPublicKey.id);
      expect(dbResult).not.toBeNull();
    });

    test('Record deletion errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(
        async () => deleteMemberPublicKey(PUBLIC_KEY_ID, serviceOptions),
        Error,
      );
      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });
});
