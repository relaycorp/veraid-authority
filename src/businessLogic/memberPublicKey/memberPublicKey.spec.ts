/* eslint-disable unicorn/text-encoding-identifier-case */
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { setUpTestDbConnection } from '../../testUtils/db.js';
import { makeMockLogging, type MockLogging, partialPinoLog } from '../../testUtils/logging.js';
import {
  MEMBER_MONGO_ID,
  MEMBER_PUBLIC_KEY, MEMBER_PUBLIC_KEY_MONGO_ID,
} from '../../testUtils/stubs.js';
import type { ServiceOptions } from '../serviceTypes.js';
import {
  createMemberPublicKey,
  deleteMemberPublicKey,
} from './memberPublicKey.js';
import { requireSuccessfulResult } from '../../testUtils/result.js';
import { getPromiseRejection } from '../../testUtils/jest.js';
import { MemberPublicKeyModelSchema } from '../../models/MemberPublicKey.model.js';

describe('member', () => {
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
        const memberPublicKey = await createMemberPublicKey(
          MEMBER_MONGO_ID,
          MEMBER_PUBLIC_KEY,
          serviceOptions,
        );

        requireSuccessfulResult(memberPublicKey)
        const dbResult = await memberPublicKeyModel.findById(memberPublicKey.result.id);
        expect(dbResult?.memberId).toStrictEqual(MEMBER_MONGO_ID);
        expect(dbResult?.publicKey).toStrictEqual(MEMBER_PUBLIC_KEY);
        expect(mockLogging.logs).toContainEqual(
          partialPinoLog('info', 'Member public key created', { id: memberPublicKey.result.id }),
        );
      },
    );

    test('Record creation errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(
        async () => createMemberPublicKey(MEMBER_MONGO_ID, MEMBER_PUBLIC_KEY, serviceOptions),
        Error,
      );

      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });

  describe('deleteMemberPublicKey', () => {
    test('Existing id should remove member public key', async () => {
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: MEMBER_MONGO_ID,
        publicKey: MEMBER_PUBLIC_KEY
      });

      const result = await deleteMemberPublicKey(memberPublicKey.id, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberPublicKeyModel.findById(memberPublicKey._id);
      expect(dbResult).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member public key deleted', { id: memberPublicKey.id }),
      );
    });

    test('Non existing id should not remove any member public key', async () => {
      const memberPublicKey = await memberPublicKeyModel.create({
        memberId: MEMBER_MONGO_ID,
        publicKey: MEMBER_PUBLIC_KEY
      });

      const result = await deleteMemberPublicKey(MEMBER_PUBLIC_KEY_MONGO_ID, serviceOptions);

      requireSuccessfulResult(result);
      const dbResult = await memberPublicKeyModel.findById(memberPublicKey.id);
      expect(dbResult).not.toBeNull();
    });

    test('Record deletion errors should be propagated', async () => {
      await connection.close();

      const error = await getPromiseRejection(
        async () => deleteMemberPublicKey(MEMBER_PUBLIC_KEY_MONGO_ID, serviceOptions),
        Error,
      );
      expect(error).toHaveProperty('name', 'MongoNotConnectedError');
    });
  });
});
