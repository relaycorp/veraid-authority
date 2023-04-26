import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { jest } from '@jest/globals';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, partialPinoLog } from './testUtils/logging.js';
import { AWALA_PDA, MEMBER_PUBLIC_KEY_MONGO_ID, SIGNATURE } from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberBundleRequestModelSchema } from './models/MemberBundleRequest.model.js';
import { createMemberBundleRequest, postToAwala } from './awala.js';
import type { MemberBundleRequest } from './schemas/awala.schema.js';
import { mockSpy } from './testUtils/jest.js';
import { AWALA_MIDDLEWARE_ENDPOINT } from './testUtils/eventing/stubs.js';
import { requireFailureResult } from './testUtils/result.js';

function getTimestampWithOffset(miliSeconds: number) {
  const date = new Date(Date.now() + miliSeconds);
  return date.toISOString();
}

describe('awala', () => {
  const getConnection = setUpTestDbConnection();

  const mockLogging = makeMockLogging();
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModelSchema>;
  beforeEach(() => {
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

  describe('postToAwala', () => {
    const mockFetch = mockSpy(jest.spyOn(global, 'fetch'));
    const TEST_AWALA_ENDPOINT : URL = new URL(AWALA_MIDDLEWARE_ENDPOINT)
    const TEST_RECIPIENT_ID : string = "TEST_RECIPIENT_ID"
    const contentTypeHeaderName = 'content-type';
    const awalaRecipientHeaderName = 'X-Awala-Recipient';
    const awalaPostData = "Test data";

    test("Should send data to Awala", async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ recipientId: TEST_RECIPIENT_ID})));

      const awalaResponse = await postToAwala(awalaPostData,AWALA_PDA,TEST_AWALA_ENDPOINT);

      expect(awalaResponse.didSucceed).toBeTrue();
      expect(mockFetch).toHaveBeenNthCalledWith(1, TEST_AWALA_ENDPOINT, {
        method: 'POST',
        headers: { [contentTypeHeaderName]: 'application/vnd+relaycorp.awala.pda-path' },
        body: AWALA_PDA,
      })
      expect(mockFetch).toHaveBeenNthCalledWith(2, TEST_AWALA_ENDPOINT, {
        method: 'POST',
        headers: {
          [contentTypeHeaderName]: 'application/vnd.veraid.member-bundle',
          [awalaRecipientHeaderName]: TEST_RECIPIENT_ID
        },
        body: awalaPostData,
      })
    })

    test("Missing recipient id from Awala response should fail", async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ })));

      const awalaResponse = await postToAwala(awalaPostData,AWALA_PDA,TEST_AWALA_ENDPOINT);

      requireFailureResult(awalaResponse);
      expect(awalaResponse.reason).toBe("Recipient id was missing from Awala PDA import response");

    })

  })
});
