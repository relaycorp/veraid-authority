import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, type MockLogging, partialPinoLog } from './testUtils/logging.js';
import { MEMBER_MONGO_ID, TEST_SERVICE_OID } from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { createMemberKeyImportToken } from './memberKeyImportToken.js';
import { MemberKeyImportTokenModelSchema } from './models/MemberKeyImportToken.model.js';

describe('member key import token', () => {
  const getConnection = setUpTestDbConnection();

  let mockLogging: MockLogging;
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let memberKeyImportTokenModel: ReturnModelType<typeof MemberKeyImportTokenModelSchema>;
  beforeEach(() => {
    mockLogging = makeMockLogging();
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

    test('Multiple tokens with same member id and service oid should be created', async () => {
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
});
