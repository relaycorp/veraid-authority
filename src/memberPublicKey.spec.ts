import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, partialPinoLog } from './testUtils/logging.js';
import {
  AWALA_PEER_ID,
  MEMBER_MONGO_ID,
  MEMBER_PUBLIC_KEY_MONGO_ID as PUBLIC_KEY_ID,
  SIGNATURE,
  TEST_SERVICE_OID,
} from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import {
  createMemberPublicKey,
  deleteMemberPublicKey,
  getMemberPublicKey,
} from './memberPublicKey.js';
import { MemberPublicKeyProblemType } from './MemberPublicKeyProblemType.js';
import { generateKeyPair } from './testUtils/webcrypto.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';
import { MemberBundleRequestModelSchema } from './models/MemberBundleRequest.model.js';

const { publicKey } = await generateKeyPair();
const publicKeyBuffer = await derSerialisePublicKey(publicKey);
const publicKeyBase64 = publicKeyBuffer.toString('base64');

describe('member public key', () => {
  const getConnection = setUpTestDbConnection();

  const mockLogging = makeMockLogging();
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let memberPublicKeyModel: ReturnModelType<typeof MemberPublicKeyModelSchema>;
  beforeEach(() => {
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
          memberPublicKeyId: memberPublicKey.result.id,
        }),
      );
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
      expect(memberPublicKey.context).toBe(MemberPublicKeyProblemType.MALFORMED_PUBLIC_KEY);
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
      expect(result.context).toBe(MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND);
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
      expect(result.context).toBe(MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND);
    });
  });

  describe('deleteMemberPublicKey', () => {
    let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModelSchema>;
    const memberPublicKeyData = {
      memberId: MEMBER_MONGO_ID,
      publicKey: publicKeyBuffer,
      serviceOid: TEST_SERVICE_OID,
    };
    beforeEach(() => {
      memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
        existingConnection: connection,
      });
    });

    test('Existing id should remove member public key', async () => {
      const memberPublicKey = await memberPublicKeyModel.create(memberPublicKeyData);

      const result = await deleteMemberPublicKey(memberPublicKey._id.toString(), serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberPublicKeyModel.findById(memberPublicKey._id);
      expect(dbResult).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member public key deleted', {
          memberPublicKeyId: memberPublicKey.id,
        }),
      );
    });

    test('Non existing id should not remove any member public key', async () => {
      const memberPublicKey = await memberPublicKeyModel.create(memberPublicKeyData);

      const result = await deleteMemberPublicKey(PUBLIC_KEY_ID, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberPublicKeyModel.findById(memberPublicKey.id);
      expect(dbResult).not.toBeNull();
    });

    test('Related bundle request should be removed', async () => {
      const memberPublicKey = await memberPublicKeyModel.create(memberPublicKeyData);
      const memberBundleRequest = await memberBundleRequestModel.create({
        memberBundleStartDate: new Date(),
        signature: Buffer.from(SIGNATURE, 'base64'),
        peerId: AWALA_PEER_ID,
        publicKeyId: memberPublicKey._id,
        memberId: MEMBER_MONGO_ID,
      });

      const result = await deleteMemberPublicKey(memberPublicKey._id.toString(), serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberBundleRequestModel.findById(memberBundleRequest._id);
      expect(dbResult).toBeNull();
    });

    test('Unrelated bundle request should not be removed', async () => {
      const memberPublicKey = await memberPublicKeyModel.create(memberPublicKeyData);
      const memberBundleRequest = await memberBundleRequestModel.create({
        memberBundleStartDate: new Date(),
        signature: Buffer.from(SIGNATURE, 'base64'),
        peerId: AWALA_PEER_ID,
        publicKeyId: PUBLIC_KEY_ID,
        memberId: MEMBER_MONGO_ID,
      });

      const result = await deleteMemberPublicKey(memberPublicKey._id.toString(), serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberBundleRequestModel.findById(memberBundleRequest._id);
      expect(dbResult).not.toBeNull();
    });
  });
});
