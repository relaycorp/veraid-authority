import { CloudEvent } from 'cloudevents';
import { jest } from '@jest/globals';
import type { Connection } from 'mongoose';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';

import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { CE_SOURCE } from '../../testUtils/eventing/stubs.js';
import { postEvent } from '../../testUtils/eventing/cloudEvents.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import { AWALA_PDA, MEMBER_PUBLIC_KEY_MONGO_ID, SIGNATURE } from '../../testUtils/stubs.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { Result } from '../../utilities/result.js';
import type { EnvVarSet } from '../../testUtils/envVars.js';
import type { ServiceOptions } from '../../serviceTypes.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import { partialPinoLog } from '../../testUtils/logging.js';

const mockPostToAwala = mockSpy(jest.fn<() => Promise<Result<undefined, string>>>());
jest.unstable_mockModule('../../awala.js', () => ({
  postToAwala: mockPostToAwala,
  createMemberBundleRequest: jest.fn(),
}));

const mockgGenerateMemberBundle = mockSpy(
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
  generateMemberBundle: mockgGenerateMemberBundle,
}));

const { setUpTestQueueServer } = await import('../../testUtils/queueServer.js');

describe('memberBundleIssuance', () => {
  const getTestServerFixture = setUpTestQueueServer();
  let server: FastifyTypedInstance;
  let envVars: EnvVarSet;
  let logs: object[];
  let dbConnection: Connection;
  let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModelSchema>;
  let triggerEvent: CloudEvent<MemberBundleRequestPayload>;

  beforeEach(() => {
    ({ server, envVars, logs, dbConnection } = getTestServerFixture());
    memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
      existingConnection: dbConnection,
    });
    triggerEvent = new CloudEvent<MemberBundleRequestPayload>({
      id: MEMBER_PUBLIC_KEY_MONGO_ID,
      source: CE_SOURCE,
      type: BUNDLE_REQUEST_TYPE,

      data: {
        awalaPda: AWALA_PDA,
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      },
    });
  });

  describe('Success path', () => {
    const memberBundle = new ArrayBuffer(1);

    beforeEach(() => {
      mockgGenerateMemberBundle.mockResolvedValueOnce({
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

      expect(mockgGenerateMemberBundle).toHaveBeenCalledOnceWith(
        MEMBER_PUBLIC_KEY_MONGO_ID,
        expect.objectContaining<ServiceOptions>({
          logger: server.log,
          dbConnection: server.mongoose,
        }),
      );
    });

    test('Bundle should sent to awala', async () => {
      await postEvent(triggerEvent, server);

      expect(mockPostToAwala).toHaveBeenCalledOnceWith(
        expect.toSatisfy<ArrayBuffer>((arrayBuffer) =>
          Buffer.from(memberBundle).equals(Buffer.from(arrayBuffer)),
        ),
        AWALA_PDA,
        new URL(envVars.AWALA_MIDDLEWARE_ENDPOINT!),
      );
      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Sending member bundle to Awala', {
          eventId: MEMBER_PUBLIC_KEY_MONGO_ID,
          memberPublicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
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

  test('Execution start should be logged', async () => {
    const memberBundle = new ArrayBuffer(1);
    mockgGenerateMemberBundle.mockResolvedValueOnce({
      didSucceed: true,
      result: memberBundle,
    });

    await postEvent(triggerEvent, server);

    expect(logs).toContainEqual(
      partialPinoLog('debug', 'Starting member bundle request trigger', {
        eventId: MEMBER_PUBLIC_KEY_MONGO_ID,
      }),
    );
  });

  test('Malformed data should stop execution', async () => {
    triggerEvent = new CloudEvent<MemberBundleRequestPayload>({
      id: MEMBER_PUBLIC_KEY_MONGO_ID,
      source: CE_SOURCE,
      type: BUNDLE_REQUEST_TYPE,

      data: {
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      } as any,
    });

    await postEvent(triggerEvent, server);

    expect(mockgGenerateMemberBundle).not.toHaveBeenCalled();
    expect(logs).toContainEqual(
      partialPinoLog('info', 'Malformed event data', {
        eventId: MEMBER_PUBLIC_KEY_MONGO_ID,
        validationError: expect.stringContaining('awalaPda'),
      }),
    );
  });

  describe('Failed bundle generation with should retry true', () => {
    beforeEach(() => {
      mockgGenerateMemberBundle.mockResolvedValueOnce({
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

  describe('Failed bundle generation with should retry false', () => {
    beforeEach(() => {
      mockgGenerateMemberBundle.mockResolvedValueOnce({
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

  test('Failed posting to awala should not remove member bundle request', async () => {
    const memberBundleRequest = await memberBundleRequestModel.create({
      publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      awalaPda: Buffer.from(AWALA_PDA, 'base64'),
      signature: Buffer.from(SIGNATURE, 'base64'),
      memberBundleStartDate: new Date(),
    });
    const memberBundle = new ArrayBuffer(1);
    mockgGenerateMemberBundle.mockResolvedValueOnce({
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
      partialPinoLog('info', 'Posting to awala failed', {
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
