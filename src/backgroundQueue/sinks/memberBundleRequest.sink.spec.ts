import { CloudEvent } from 'cloudevents';
import { jest } from '@jest/globals';
import type { Connection } from 'mongoose';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import { addDays, parseISO } from 'date-fns';

import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { CE_SOURCE } from '../../testUtils/eventing/stubs.js';
import { postEvent } from '../../testUtils/eventing/cloudEvents.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import {
  AWALA_PEER_ID,
  MEMBER_MONGO_ID,
  MEMBER_PUBLIC_KEY_MONGO_ID,
  SIGNATURE,
} from '../../testUtils/stubs.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { Result } from '../../utilities/result.js';
import type { ServiceOptions } from '../../serviceTypes.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import { partialPinoLog } from '../../testUtils/logging.js';
import { stringToArrayBuffer } from '../../testUtils/buffer.js';
import { mockEmitters } from '../../testUtils/eventing/mockEmitters.js';
import { OUTGOING_SERVICE_MESSAGE_TYPE } from '../../events/outgoingServiceMessage.event.js';
import { VeraidContentType } from '../../utilities/veraid.js';
import { EmitterChannel } from '../../utilities/eventing/EmitterChannel.js';
import type { BundleCreationFailure } from '../../memberBundle.js';

const CERTIFICATE_EXPIRY_DAYS = 90;
const mockGenerateMemberBundle = mockSpy(
  jest.fn<() => Promise<Result<ArrayBuffer, BundleCreationFailure>>>(),
);
jest.unstable_mockModule('../../memberBundle.js', () => ({
  generateMemberBundle: mockGenerateMemberBundle,
  CERTIFICATE_EXPIRY_DAYS,
}));

const { setUpTestQueueServer } = await import('../../testUtils/queueServer.js');

describe('memberBundleIssuance', () => {
  const getTestServerFixture = setUpTestQueueServer();
  const getEvents = mockEmitters();
  let server: FastifyTypedInstance;
  let logs: object[];
  let dbConnection: Connection;
  let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModelSchema>;
  const triggerEvent = new CloudEvent<MemberBundleRequestPayload>({
    source: CE_SOURCE,
    type: BUNDLE_REQUEST_TYPE,
    subject: AWALA_PEER_ID,
    datacontenttype: 'text/plain',
    data: MEMBER_PUBLIC_KEY_MONGO_ID,
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
    });

    test('Execution start should be logged', async () => {
      await postEvent(triggerEvent, server);

      expect(logs).toContainEqual(
        partialPinoLog('debug', 'Processing member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });

    test('Bundle should be generated', async () => {
      await postEvent(triggerEvent, server);

      expect(mockGenerateMemberBundle).toHaveBeenCalledOnceWith(
        MEMBER_PUBLIC_KEY_MONGO_ID,
        expect.objectContaining<ServiceOptions>({
          logger: expect.anything(),
          dbConnection: server.mongoose,
        }),
      );
    });

    describe('Outgoing message emission', () => {
      test('Should emit one cloud event', async () => {
        await postEvent(triggerEvent, server);

        expect(logs).toContainEqual(
          partialPinoLog('debug', 'Emitting member bundle event', {
            publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          }),
        );
        expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toHaveLength(1);
      });

      test('Version should be 1.0', async () => {
        await postEvent(triggerEvent, server);

        expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toContainEqual(
          expect.objectContaining({ specversion: '1.0' }),
        );
      });

      test('Type should be outgoing service message', async () => {
        await postEvent(triggerEvent, server);

        expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toContainEqual(
          expect.objectContaining({
            type: OUTGOING_SERVICE_MESSAGE_TYPE,
          }),
        );
      });

      test('Subject should be peer id', async () => {
        await postEvent(triggerEvent, server);

        expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toContainEqual(
          expect.objectContaining({
            subject: AWALA_PEER_ID,
          }),
        );
      });

      test('Data content type should be member bundle', async () => {
        await postEvent(triggerEvent, server);

        expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toContainEqual(
          expect.objectContaining({
            datacontenttype: VeraidContentType.MEMBER_BUNDLE,
          }),
        );
      });

      test('Data should be buffer from member bundle', async () => {
        await postEvent(triggerEvent, server);

        expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toContainEqual(
          expect.objectContaining({
            data: Buffer.from(memberBundle),
          }),
        );
      });

      test('Time should be creation of message in ISO format', async () => {
        const creationDate = new Date();

        await postEvent(triggerEvent, server);

        const postEventDate = new Date();
        expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toContainEqual(
          expect.objectContaining({
            time: expect.toSatisfy((time: string) => {
              const dateFromTime = parseISO(time);
              return creationDate <= dateFromTime && dateFromTime <= postEventDate;
            }),
          }),
        );
      });

      test('Expiry date should be that of the bundle in ISO format', async () => {
        const expiryDate = addDays(new Date(), CERTIFICATE_EXPIRY_DAYS);

        await postEvent(triggerEvent, server);

        const postEventDate = addDays(new Date(), CERTIFICATE_EXPIRY_DAYS);
        expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toContainEqual(
          expect.objectContaining({
            expiry: expect.toSatisfy((expiry: string) => {
              const dateFromExpiry = parseISO(expiry);
              return expiryDate <= dateFromExpiry && dateFromExpiry <= postEventDate;
            }),
          }),
        );
      });
    });

    test('Should remove member bundle request', async () => {
      const memberBundleRequest = await memberBundleRequestModel.create({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        peerId: AWALA_PEER_ID,
        signature: Buffer.from(SIGNATURE, 'base64'),
        memberBundleStartDate: new Date(),
        memberId: MEMBER_MONGO_ID,
      });

      await postEvent(triggerEvent, server);

      const memberBundleRequestCheck = await memberBundleRequestModel.findById(
        memberBundleRequest._id,
      );
      expect(memberBundleRequestCheck).toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Deleted bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });
  });

  test('Event with missing subject should be refused', async () => {
    const invalidTriggerEvent = triggerEvent.cloneWith({ subject: undefined });

    await postEvent(invalidTriggerEvent, server);

    expect(mockGenerateMemberBundle).not.toHaveBeenCalled();
    expect(logs).toContainEqual(
      partialPinoLog('info', 'Refusing member bundle request with missing subject', {
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      }),
    );
  });

  describe('Failed bundle generation with shouldRetry true', () => {
    beforeEach(() => {
      mockGenerateMemberBundle.mockResolvedValueOnce({
        didSucceed: false,

        context: {
          chainRetrievalFailed: true,
        },
      });
    });

    test('Should not emit outgoing message', async () => {
      await postEvent(triggerEvent, server);

      expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toHaveLength(0);
    });

    test('Should not remove member public key', async () => {
      const memberBundleRequest = await memberBundleRequestModel.create({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        peerId: AWALA_PEER_ID,
        signature: Buffer.from(SIGNATURE, 'base64'),
        memberBundleStartDate: new Date(),
        memberId: MEMBER_MONGO_ID,
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

        context: {
          chainRetrievalFailed: false,
        },
      });
    });

    test('Should retry false should not emit outgoing message', async () => {
      await postEvent(triggerEvent, server);

      expect(getEvents(EmitterChannel.AWALA_OUTGOING_MESSAGES)).toHaveLength(0);
    });

    test('Should remove member bundle request', async () => {
      const memberBundleRequest = await memberBundleRequestModel.create({
        publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        peerId: AWALA_PEER_ID,
        signature: Buffer.from(SIGNATURE, 'base64'),
        memberBundleStartDate: new Date(),
        memberId: MEMBER_MONGO_ID,
      });

      await postEvent(triggerEvent, server);

      const memberBundleRequestCheck = await memberBundleRequestModel.findById(
        memberBundleRequest._id,
      );
      expect(memberBundleRequestCheck).toBeNull();
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Deleted bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });
  });
});
