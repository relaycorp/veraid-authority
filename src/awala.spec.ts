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
    const testAwalaEndpoint: URL = new URL(AWALA_MIDDLEWARE_ENDPOINT);
    const testRecipientId = 'TEST_RECIPIENT_ID';
    const contentTypeHeaderName = 'content-type';
    const awalaRecipientHeaderName = 'X-Awala-Recipient';
    const awalaPostData = 'Test data';

    describe('Success path', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ recipientId: testRecipientId })));
      });

      describe('Should make authorization request', () => {
        test('Endpoint should be taken from parameter', async () => {
          await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

          expect(mockFetch).toHaveBeenNthCalledWith(1, testAwalaEndpoint, expect.anything());
        });

        test('Method should be POST', async () => {
          await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

          expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.objectContaining({
              method: 'POST',
            }),
          );
        });

        test('Content type should be application/vnd+relaycorp.awala.pda-path', async () => {
          await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

          expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.objectContaining({
              headers: { [contentTypeHeaderName]: 'application/vnd+relaycorp.awala.pda-path' },
            }),
          );
        });

        test('Body should be Awala PDA', async () => {
          await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

          expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.objectContaining({
              body: AWALA_PDA,
            }),
          );
        });
      });

      describe('Should post data to awala', () => {
        test('Endpoint should be taken from parameter', async () => {
          await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

          expect(mockFetch).toHaveBeenNthCalledWith(2, testAwalaEndpoint, expect.anything());
        });

        test('Method should be POST', async () => {
          await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

          expect(mockFetch).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({
              method: 'POST',
            }),
          );
        });

        test('Content type should be application/vnd.veraid.member-bundle', async () => {
          await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

          expect(mockFetch).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({
              headers: expect.objectContaining({
                [contentTypeHeaderName]: 'application/vnd.veraid.member-bundle',
              }),
            }),
          );
        });

        test('Content type should be application/vnd+relaycorp.awala.pda-path', async () => {
          await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

          expect(mockFetch).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({
              headers: expect.objectContaining({
                [awalaRecipientHeaderName]: testRecipientId,
              }),
            }),
          );
        });

        test('Body should be taken form parameter', async () => {
          await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

          expect(mockFetch).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({
              body: awalaPostData,
            }),
          );
        });
      });

      test('Should return success', async () => {
        const result = await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(result.didSucceed).toBeTrue();
      });
    });

    test('Missing recipient id from Awala response should not post data', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({})));

      const awalaResponse = await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

      requireFailureResult(awalaResponse);
      expect(awalaResponse.reason).toBe('Recipient id was missing from Awala PDA import response');
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });
});
