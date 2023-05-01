import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection, HydratedDocument } from 'mongoose';
import { jest } from '@jest/globals';
import { addSeconds } from 'date-fns';

import { setUpTestDbConnection } from './testUtils/db.js';
import { makeMockLogging, partialPinoLog } from './testUtils/logging.js';
import {
  AWALA_PDA,
  MEMBER_MONGO_ID,
  MEMBER_PUBLIC_KEY_MONGO_ID,
  SIGNATURE,
  TEST_SERVICE_OID,
} from './testUtils/stubs.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberBundleRequestModelSchema } from './models/MemberBundleRequest.model.js';
import { createMemberBundleRequest, postToAwala } from './awala.js';
import type { MemberBundleRequest } from './schemas/awala.schema.js';
import { mockSpy } from './testUtils/jest.js';
import { AWALA_MIDDLEWARE_ENDPOINT } from './testUtils/eventing/stubs.js';
import { requireFailureResult } from './testUtils/result.js';
import { generateKeyPair } from './testUtils/webcrypto.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import { VeraidContentType } from './utilities/veraid.js';
import { AwalaContentType } from './utilities/awala.js';

const { publicKey } = await generateKeyPair();
const publicKeyBuffer = await derSerialisePublicKey(publicKey);

describe('createMemberBundleRequest', () => {
  const getConnection = setUpTestDbConnection();
  const mockLogging = makeMockLogging();
  let connection: Connection;
  let serviceOptions: ServiceOptions;
  let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModelSchema>;
  let memberPublicKey: HydratedDocument<MemberPublicKeyModelSchema>;
  let futureTimestamp: string;
  let methodInput: MemberBundleRequest;
  beforeEach(async () => {
    connection = getConnection();
    serviceOptions = {
      dbConnection: connection,
      logger: mockLogging.logger,
    };
    memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
      existingConnection: connection,
    });

    const memberPublicKeyModel = getModelForClass(MemberPublicKeyModelSchema, {
      existingConnection: connection,
    });

    memberPublicKey = await memberPublicKeyModel.create({
      memberId: MEMBER_MONGO_ID,
      serviceOid: TEST_SERVICE_OID,
      publicKey: publicKeyBuffer,
    });

    futureTimestamp = addSeconds(new Date(), 5).toISOString();
    methodInput = {
      publicKeyId: memberPublicKey._id.toString(),
      memberBundleStartDate: futureTimestamp,
      awalaPda: AWALA_PDA,
      signature: SIGNATURE,
    };
  });

  test('Valid data should be accepted and stored', async () => {
    const result = await createMemberBundleRequest(methodInput, serviceOptions);

    const dbResult = await memberBundleRequestModel.findOne({
      publicKeyId: memberPublicKey._id.toString(),
    });
    expect(result).toStrictEqual({
      didSucceed: true,
    });
    expect(dbResult).not.toBeNull();
    expect(dbResult!.memberId).toBe(MEMBER_MONGO_ID);
    expect(dbResult!.awalaPda.toString('base64')).toBe(AWALA_PDA);
    expect(dbResult!.signature.toString('base64')).toBe(SIGNATURE);
    expect(dbResult!.memberBundleStartDate).toBeDate();
    expect(dbResult!.memberBundleStartDate.toISOString()).toBe(futureTimestamp);
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'Member bundle request created', {
        memberPublicKeyId: memberPublicKey._id.toString(),
      }),
    );
  });

  test('Member bundle data should be updated', async () => {
    const data = {
      publicKeyId: memberPublicKey._id.toString(),
      memberBundleStartDate: new Date(),
      signature: 'test',
      awalaPda: 'test',
      memberId: MEMBER_MONGO_ID,
    };
    await memberBundleRequestModel.create(data);

    await createMemberBundleRequest(methodInput, serviceOptions);
    const dbResult = await memberBundleRequestModel.findOne({
      publicKeyId: memberPublicKey._id.toString(),
    });
    expect(dbResult).not.toBeNull();
    expect(dbResult!.memberId).toBe(MEMBER_MONGO_ID);
    expect(dbResult!.awalaPda.toString('base64')).toBe(AWALA_PDA);
    expect(dbResult!.signature.toString('base64')).toBe(SIGNATURE);
    expect(dbResult!.memberBundleStartDate).toBeDate();
    expect(dbResult!.memberBundleStartDate.toISOString()).toBe(futureTimestamp);
  });

  test('Existing data should not create new entry', async () => {
    await memberBundleRequestModel.create({
      ...methodInput,
      memberId: MEMBER_MONGO_ID,
    });

    await createMemberBundleRequest(methodInput, serviceOptions);

    const countResult = await memberBundleRequestModel.count({
      publicKeyId: memberPublicKey._id.toString(),
    });
    expect(countResult).toBe(1);
  });

  test('Non existing public key id should be refused', async () => {
    const result = await createMemberBundleRequest(
      {
        ...methodInput,
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      },
      serviceOptions,
    );

    expect(result.didSucceed).not.toBeTrue();
    const dbResult = await memberBundleRequestModel.exists({
      publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
    });
    expect(dbResult).toBeNull();
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

      test('Content type should be that of an Awala PDA', async () => {
        await postToAwala(awalaPostData, AWALA_PDA, testAwalaEndpoint);

        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          expect.objectContaining({
            headers: { [contentTypeHeaderName]: AwalaContentType.PDA },
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
              [contentTypeHeaderName]: VeraidContentType.MEMBER_BUNDLE,
            }),
          }),
        );
      });

      test('Headers should include X-Awala-Recipient with recipient id', async () => {
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
