import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, partialPinoLog } from './testUtils/logging.js';
import {
  MEMBER_MONGO_ID,
  MEMBER_PUBLIC_KEY_IMPORT_TOKEN,
  TEST_SERVICE_OID,
} from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import {
  createMemberKeyImportToken,
  deleteMemberKeyImportToken,
  getMemberKeyImportToken,
} from './memberKeyImportToken.js';
import { MemberKeyImportTokenModelSchema } from './models/MemberKeyImportToken.model.js';
import { requireFailureResult, requireSuccessfulResult } from './testUtils/result.js';
import { MemberPublicKeyImportProblemType } from './MemberKeyImportTokenProblemType.js';
import { deleteMemberPublicKey } from './memberPublicKey.js';

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

  describe('getMemberKeyImportToken', () => {
    test('Existing token should return data', async () => {
      const dbResult = await memberKeyImportTokenModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
      });

      const result = await getMemberKeyImportToken(dbResult._id.toString(), serviceOptions);

      requireSuccessfulResult(result);

      expect(result.result.memberId).toStrictEqual(MEMBER_MONGO_ID);
      expect(result.result.serviceOid).toStrictEqual(TEST_SERVICE_OID);
    });

    test('Non existing token should return non existing error', async () => {
      const result = await getMemberKeyImportToken(MEMBER_PUBLIC_KEY_IMPORT_TOKEN, serviceOptions);

      requireFailureResult(result);

      expect(result.reason).toStrictEqual(MemberPublicKeyImportProblemType.TOKEN_NOT_FOUND);
    });
  });

  describe('deleteMemberKeyImportToken', () => {
    test('Existing id should remove member public key import token', async () => {
      const memberPublicKeyImportToken = await memberKeyImportTokenModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
      });

      const result = await deleteMemberKeyImportToken(
        memberPublicKeyImportToken._id.toString(),
        serviceOptions,
      );

      expect(result.didSucceed).toBeTrue();
      const dbResult = await memberKeyImportTokenModel.findById(memberPublicKeyImportToken._id);
      expect(dbResult).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member public key import token deleted', {
          id: memberPublicKeyImportToken.id,
        }),
      );
    });

    test('Non existing id should not remove any member public key', async () => {
      const memberPublicKeyImportToken = await memberKeyImportTokenModel.create({
        memberId: MEMBER_MONGO_ID,
        serviceOid: TEST_SERVICE_OID,
      });

      const result = await deleteMemberPublicKey(MEMBER_PUBLIC_KEY_IMPORT_TOKEN, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberKeyImportTokenModel.findById(memberPublicKeyImportToken.id);
      expect(dbResult).not.toBeNull();
    });
  });
});
