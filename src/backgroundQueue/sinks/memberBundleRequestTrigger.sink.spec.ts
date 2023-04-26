import { CloudEvent } from 'cloudevents';
import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { addDays, addSeconds } from 'date-fns';

import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { setUpTestQueueServer } from '../../testUtils/queueServer.js';
import { CE_ID, CE_SOURCE } from '../../testUtils/eventing/stubs.js';
import { postEvent } from '../../testUtils/eventing/cloudEvents.js';
import {
  BUNDLE_REQUEST_TRIGGER_TYPE,
  type MemberBundleRequestTriggerPayload,
} from '../../events/bundleRequestTrigger.event.js';
import { mockEmitter } from '../../testUtils/eventing/mockEmitter.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import { AWALA_PDA, MEMBER_PUBLIC_KEY_MONGO_ID, SIGNATURE } from '../../testUtils/stubs.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';

import { BUNDLE_REQUEST_DATE_RANGE } from './memberBundleRequestTrigger.sink.js';

describe('triggerBundleRequest', () => {
  const getEvents = mockEmitter();

  const getTestServerFixture = setUpTestQueueServer();
  let server: FastifyTypedInstance;
  let dbConnection: Connection;
  let memberBundleRequestModel: ReturnModelType<typeof MemberBundleRequestModelSchema>;

  beforeEach(() => {
    ({ server, dbConnection } = getTestServerFixture());
    memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
      existingConnection: dbConnection,
    });
  });

  test('Multiple Existing requests should be sent', async () => {
    const mongoId = '111111111111111111111111';
    const requestData1 = {
      publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      memberBundleStartDate: new Date(),
      signature: SIGNATURE,
      awalaPda: Buffer.from(AWALA_PDA, 'base64'),
    };
    const requestData2 = {
      publicKeyId: mongoId,
      memberBundleStartDate: new Date(),
      signature: SIGNATURE,
      awalaPda: Buffer.from(AWALA_PDA, 'base64'),
    };
    await memberBundleRequestModel.create(requestData1);
    await memberBundleRequestModel.create(requestData2);
    const triggerEvent = new CloudEvent<MemberBundleRequestTriggerPayload>({
      id: CE_ID,
      source: CE_SOURCE,
      type: BUNDLE_REQUEST_TRIGGER_TYPE,
    });

    await postEvent(triggerEvent, server);

    const publishedEvents = getEvents();
    expect(publishedEvents).toHaveLength(2);
    expect(publishedEvents).toContainEqual(
      expect.objectContaining<Partial<CloudEvent<MemberBundleRequestPayload>>>({
        id: MEMBER_PUBLIC_KEY_MONGO_ID,
        source: 'https://veraid.net/authority/bundle-request-trigger',
        type: BUNDLE_REQUEST_TYPE,

        data: {
          awalaPda: AWALA_PDA,
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        },
      }),
    );
    expect(publishedEvents).toContainEqual(
      expect.objectContaining<Partial<CloudEvent<MemberBundleRequestPayload>>>({
        id: mongoId,
        source: 'https://veraid.net/authority/bundle-request-trigger',
        type: BUNDLE_REQUEST_TYPE,

        data: {
          awalaPda: AWALA_PDA,
          publicKeyId: mongoId,
        },
      }),
    );
  });

  test('Processing empty collection should not emit events', async () => {
    const triggerEvent = new CloudEvent<MemberBundleRequestTriggerPayload>({
      id: CE_ID,
      source: CE_SOURCE,
      type: BUNDLE_REQUEST_TRIGGER_TYPE,
    });

    await postEvent(triggerEvent, server);

    const publishedEvents = getEvents();
    expect(publishedEvents).toHaveLength(0);
  });

  test.each([
    ['Future', BUNDLE_REQUEST_DATE_RANGE],
    ['Past', -BUNDLE_REQUEST_DATE_RANGE],
  ])('%s bundle start date should be emitted', async (_type: string, range: number) => {
    const requestData = {
      publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      memberBundleStartDate: addDays(new Date(), range),
      signature: SIGNATURE,
      awalaPda: Buffer.from(AWALA_PDA, 'base64'),
    };
    await memberBundleRequestModel.create(requestData);
    const triggerEvent = new CloudEvent<MemberBundleRequestTriggerPayload>({
      id: CE_ID,
      source: CE_SOURCE,
      type: BUNDLE_REQUEST_TRIGGER_TYPE,
    });

    await postEvent(triggerEvent, server);

    const publishedEvents = getEvents();
    expect(publishedEvents).toHaveLength(1);
  });

  test('Bundle start date more then 3 days into the future should not be sent', async () => {
    const data = {
      publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      memberBundleStartDate: addSeconds(addDays(new Date(), BUNDLE_REQUEST_DATE_RANGE), 20),
      signature: SIGNATURE,
      awalaPda: Buffer.from(AWALA_PDA, 'base64'),
    };
    const futureBundleRequest = await memberBundleRequestModel.create(data);
    const triggerEvent = new CloudEvent<MemberBundleRequestTriggerPayload>({
      id: CE_ID,
      source: CE_SOURCE,
      type: BUNDLE_REQUEST_TRIGGER_TYPE,
    });

    await postEvent(triggerEvent, server);

    const publishedEvents = getEvents();
    expect(publishedEvents).toHaveLength(0);
    const futureBundleRequestCheck = memberBundleRequestModel.findById(futureBundleRequest._id);
    expect(futureBundleRequestCheck).not.toBeNull();
  });
});
