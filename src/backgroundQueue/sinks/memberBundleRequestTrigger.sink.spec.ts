import { CloudEvent } from 'cloudevents';

import { configureMockEnvVars } from '../../testUtils/envVars.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { REQUIRED_QUEUE_ENV_VARS, setUpTestQueueServer } from '../../testUtils/queueServer.js';
import { makeMockLogging } from '../../testUtils/logging.js';
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

  configureMockEnvVars(REQUIRED_QUEUE_ENV_VARS);

  const mockLogging = makeMockLogging();
  const getTestServer = setUpTestQueueServer(mockLogging.logger);
  let server: FastifyTypedInstance;
  beforeEach(() => {
    server = getTestServer();
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
