import { CloudEvent } from 'cloudevents';

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

describe('triggerBundleRequest', () => {
  const getEvents = mockEmitter();

  const getTestServerFixture = setUpTestQueueServer();
  let server: FastifyTypedInstance;
  beforeEach(() => {
    ({ server } = getTestServerFixture());
  });

  test('New events should be fired', async () => {
    const triggerEvent = new CloudEvent<MemberBundleRequestTriggerPayload>({
      id: CE_ID,
      source: CE_SOURCE,
      type: BUNDLE_REQUEST_TRIGGER_TYPE,
    });

    await postEvent(triggerEvent, server);

    const publishedEvents = getEvents();
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents).toContainEqual(
      expect.objectContaining<Partial<CloudEvent<MemberBundleRequestPayload>>>({
        id: 'the public key id',
        source: 'https://veraid.net/authority/bundle-request-trigger',
        type: BUNDLE_REQUEST_TYPE,
        data: { awalaPda: 'PDA, base64-encoded', publicKeyId: 'the public key id' },
      }),
    );
  });
});
