import { CloudEvent } from 'cloudevents';
import { jest } from '@jest/globals';
import type { Connection } from 'mongoose';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';

import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { AWALA_MIDDLEWARE_ENDPOINT, CE_SOURCE } from '../../testUtils/eventing/stubs.js';
import { postEvent } from '../../testUtils/eventing/cloudEvents.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import { AWALA_PDA, MEMBER_PUBLIC_KEY_MONGO_ID, SIGNATURE } from '../../testUtils/stubs.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { Result } from '../../utilities/result.js';
import type { ServiceOptions } from '../../serviceTypes.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import { partialPinoLog } from '../../testUtils/logging.js';
import { stringToArrayBuffer } from '../../testUtils/buffer.js';

const mockPostToAwala = mockSpy(jest.fn<() => Promise<Result<undefined, string>>>());
jest.unstable_mockModule('../../awala.js', () => ({
  postToAwala: mockPostToAwala,
  createMemberBundleRequest: jest.fn(),
}));

const mockGenerateMemberBundle = mockSpy(
  jest.fn<
    () => Promise<
      Result<
        ArrayBuffer,
        {
          shouldRetry: boolean;
        }
      >
    >
  >(),
);

jest.unstable_mockModule('../../memberBundle.js', () => ({
  generateMemberBundle: mockGenerateMemberBundle,
}));

const { setUpTestQueueServer } = await import('../../testUtils/queueServer.js');

describe('memberBundleIssuance', () => {
  const getTestServerFixture = setUpTestQueueServer();
  let server: FastifyTypedInstance;
  let logs: object[];
  let dbConnection: Connection;
  let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModelSchema>;
  const triggerEvent = new CloudEvent<MemberBundleRequestPayload>({
    id: MEMBER_PUBLIC_KEY_MONGO_ID,
    source: CE_SOURCE,
    type: BUNDLE_REQUEST_TYPE,

    data: {
      awalaPda: AWALA_PDA,
      publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
    },
  });

  beforeEach(() => {
    ({ server, logs, dbConnection } = getTestServerFixture());
    memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
      existingConnection: dbConnection,
    });
  });

  describe('Success path', () => {
    const memberBundle = stringToArrayBuffer('memberBundle');

    beforeEach(() => {
      mockGenerateMemberBundle.mockResolvedValueOnce({
        didSucceed: true,
        result: memberBundle,
      });
      mockPostToAwala.mockResolvedValueOnce({
        didSucceed: true,
      });
    });

    test('Execution start should be logged', async () => {
      await postEvent(triggerEvent, server);

      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Starting member bundle request trigger', {
          eventId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });

    test('Bundle should be generated', async () => {
      await postEvent(triggerEvent, server);

      expect(mockGenerateMemberBundle).toHaveBeenCalledOnceWith(
        MEMBER_PUBLIC_KEY_MONGO_ID,
        expect.objectContaining<ServiceOptions>({
          logger: server.log,
          dbConnection: server.mongoose,
        }),
      );
    });

    describe('Awala request', () => {
      test('Should be logged', async () => {
        await postEvent(triggerEvent, server);

        expect(logs).toContainEqual(
          partialPinoLog('debug', 'Sending member bundle to Awala', {
            eventId: MEMBER_PUBLIC_KEY_MONGO_ID,
            memberPublicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          }),
        );
      });

      test('Should be called with member bundle and member public key id', async () => {
        const requestBody = JSON.stringify({
          memberBundle: Buffer.from(memberBundle).toString('base64'),
          memberPublicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        });

        await postEvent(triggerEvent, server);

        expect(mockPostToAwala).toHaveBeenCalledOnceWith(
          requestBody,
          expect.anything(),
          expect.anything(),
        );
      });

      test('Should be called with correct Awala PDA', async () => {
        await postEvent(triggerEvent, server);

        expect(mockPostToAwala).toHaveBeenCalledOnceWith(
          expect.anything(),
          AWALA_PDA,
          expect.anything(),
        );
      });

      test('Should be called with correct Awala middleware endpoint', async () => {
        await postEvent(triggerEvent, server);

        expect(mockPostToAwala).toHaveBeenCalledOnceWith(
          expect.anything(),
          expect.anything(),
          new URL(AWALA_MIDDLEWARE_ENDPOINT),
        );
      });
    });

    test('Should remove member bundle request', async () => {
      const memberBundleRequest = await memberBundleRequestModel.create({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        awalaPda: Buffer.from(AWALA_PDA, 'base64'),
        signature: Buffer.from(SIGNATURE, 'base64'),
        memberBundleStartDate: new Date(),
      });

      await postEvent(triggerEvent, server);

      const memberBundleRequestCheck = await memberBundleRequestModel.findById(
        memberBundleRequest._id,
      );
      expect(memberBundleRequestCheck).toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Removed Bundle Request', {
          eventId: MEMBER_PUBLIC_KEY_MONGO_ID,
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });
  });

  test('Malformed event data should stop execution', async () => {
    const invalidTriggerEvent = new CloudEvent<MemberBundleRequestPayload>({
      id: MEMBER_PUBLIC_KEY_MONGO_ID,
      source: CE_SOURCE,
      type: BUNDLE_REQUEST_TYPE,

      data: {
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      } as any,
    });

    await postEvent(invalidTriggerEvent, server);

    expect(mockGenerateMemberBundle).not.toHaveBeenCalled();
    expect(logs).toContainEqual(
      partialPinoLog('info', 'Refusing malformed member bundle request event', {
        eventId: MEMBER_PUBLIC_KEY_MONGO_ID,
        validationError: expect.stringContaining('awalaPda'),
      }),
    );
  });

  describe('Failed bundle generation with shouldRetry true', () => {
    beforeEach(() => {
      mockGenerateMemberBundle.mockResolvedValueOnce({
        didSucceed: false,

        reason: {
          shouldRetry: true,
        },
      });
    });

    test('Should not post to awala', async () => {
      await postEvent(triggerEvent, server);

      expect(mockPostToAwala).not.toHaveBeenCalled();
    });

    test('Should not remove member public key', async () => {
      const memberBundleRequest = await memberBundleRequestModel.create({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        awalaPda: Buffer.from(AWALA_PDA, 'base64'),
        signature: Buffer.from(SIGNATURE, 'base64'),
        memberBundleStartDate: new Date(),
      });

      await postEvent(triggerEvent, server);

      const memberBundleRequestCheck = await memberBundleRequestModel.findById(
        memberBundleRequest._id,
      );
      expect(memberBundleRequestCheck).not.toBeNull();
    });
  });

  describe('Failed bundle generation with shouldRetry false', () => {
    beforeEach(() => {
      mockGenerateMemberBundle.mockResolvedValueOnce({
        didSucceed: false,

        reason: {
          shouldRetry: false,
        },
      });
    });

    test('Should retry false should not post to awala', async () => {
      await postEvent(triggerEvent, server);

      expect(mockPostToAwala).not.toHaveBeenCalled();
    });

    test('Should remove member bundle request', async () => {
      const memberBundleRequest = await memberBundleRequestModel.create({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        awalaPda: Buffer.from(AWALA_PDA, 'base64'),
        signature: Buffer.from(SIGNATURE, 'base64'),
        memberBundleStartDate: new Date(),
      });

      await postEvent(triggerEvent, server);

      const memberBundleRequestCheck = await memberBundleRequestModel.findById(
        memberBundleRequest._id,
      );
      expect(memberBundleRequestCheck).toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Removed Bundle Request', {
          eventId: MEMBER_PUBLIC_KEY_MONGO_ID,
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });
  });

  test('Failed posting to Awala should not remove member bundle request', async () => {
    const memberBundleRequest = await memberBundleRequestModel.create({
      publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      awalaPda: Buffer.from(AWALA_PDA, 'base64'),
      signature: Buffer.from(SIGNATURE, 'base64'),
      memberBundleStartDate: new Date(),
    });
    const memberBundle = stringToArrayBuffer('memberBundle');
    mockGenerateMemberBundle.mockResolvedValueOnce({
      didSucceed: true,
      result: memberBundle,
    });
    const awalaReason = 'Some random reason';
    mockPostToAwala.mockResolvedValueOnce({
      didSucceed: false,
      reason: awalaReason,
    });

    await postEvent(triggerEvent, server);

    expect(logs).toContainEqual(
      partialPinoLog('info', 'Failed to post member bundle to Awala', {
        eventId: MEMBER_PUBLIC_KEY_MONGO_ID,
        reason: awalaReason,
      }),
    );
    const memberBundleRequestCheck = await memberBundleRequestModel.findById(
      memberBundleRequest._id,
    );
    expect(memberBundleRequestCheck).not.toBeNull();
  });
});
