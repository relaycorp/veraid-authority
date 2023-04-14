import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, type MockLogging, partialPinoLog } from './testUtils/logging.js';
import { AWALA_PDA, MEMBER_PUBLIC_KEY_MONGO_ID, SIGNATURE } from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberBundleRequestModelSchema } from './models/MemberBundleRequest.model.js';
import { createMemberBundleRequest } from './awala.js';
import type { MemberBundleRequest } from './schemas/awala.schema.js';

function getTimestampWithOffset(miliSeconds: number) {
  const date = new Date(Date.now() + miliSeconds);
  return date.toISOString();
}

describe('awala', () => {
  const getConnection = setUpTestDbConnection();

  let mockLogging: MockLogging;
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModelSchema>;
  beforeEach(() => {
    mockLogging = makeMockLogging();
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
      existingConnection: connection,
    });
  });

  describe('createMemberBundleRequest', () => {
    let futureTimestamp: string;
    let methodInput: MemberBundleRequest;
    beforeEach(() => {
      futureTimestamp = getTimestampWithOffset(5000);
      methodInput = {
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        memberBundleStartDate: futureTimestamp,
        awalaPda: AWALA_PDA,
        signature: SIGNATURE,
      };
    });

    test('Valid data should be accepted and stored', async () => {
      const result = await createMemberBundleRequest(methodInput, serviceOptions);

      const dbResult = await memberBundleRequestModel.findOne({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      });
      expect(result).toStrictEqual({
        didSucceed: true,
      });
      expect(dbResult).not.toBeNull();
      expect(dbResult!.awalaPda.toString('base64')).toBe(AWALA_PDA);
      expect(dbResult!.signature.toString('base64')).toBe(SIGNATURE);
      expect(dbResult!.memberBundleStartDate).toBeDate();
      expect(dbResult!.memberBundleStartDate.toISOString()).toBe(futureTimestamp);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Member bundle request created', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });

    test('Member bundle data should be updated', async () => {
      const data = {
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        memberBundleStartDate: new Date(),
        signature: 'test',
        awalaPda: 'test',
      };
      await memberBundleRequestModel.create(data);

      await createMemberBundleRequest(methodInput, serviceOptions);
      const dbResult = await memberBundleRequestModel.findOne({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      });
      expect(dbResult).not.toBeNull();
      expect(dbResult!.awalaPda.toString('base64')).toBe(AWALA_PDA);
      expect(dbResult!.signature.toString('base64')).toBe(SIGNATURE);
      expect(dbResult!.memberBundleStartDate).toBeDate();
      expect(dbResult!.memberBundleStartDate.toISOString()).toBe(futureTimestamp);
    });

    test('Existing data should not create new entry', async () => {
      await memberBundleRequestModel.create(methodInput);

      await createMemberBundleRequest(methodInput, serviceOptions);

      const countResult = await memberBundleRequestModel.count({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      });
      expect(countResult).toBe(1);
    });
  });
});
