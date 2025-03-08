import { CloudEvent } from 'cloudevents';

import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { BUNDLE_REQUEST_TRIGGER_TYPE } from '../events/bundleRequestTrigger.event.js';
import { CE_ID, CE_SOURCE } from '../testUtils/eventing/stubs.js';

import { postEvent } from './utils/events.js';
import { waitForServers } from './utils/wait.js';

const QUEUE_URL = 'http://127.0.0.1:8082';

describe('Background queue', () => {
  beforeAll(waitForServers);

  test('Supported event should be accepted', async () => {
    const event = new CloudEvent({
      id: CE_ID,
      type: BUNDLE_REQUEST_TRIGGER_TYPE,
      source: CE_SOURCE,
    });

    const response = await postEvent(event, QUEUE_URL);

    expect(response.status).toBe(HTTP_STATUS_CODES.NO_CONTENT);
  });

  test('Unsupported event should be refused', async () => {
    const event = new CloudEvent({
      id: CE_ID,
      type: 'invalid',
      source: CE_SOURCE,
    });

    const response = await postEvent(event, QUEUE_URL);

    expect(response.status).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
  });
});
