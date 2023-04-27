import { HTTP_STATUS_CODES } from '../utilities/http.js';

import { getServiceUrl } from './utils/knative.js';
import { BUNDLE_REQUEST_TRIGGER_TYPE } from '../events/bundleRequestTrigger.event.js';
import { CloudEvent, HTTP } from 'cloudevents';
import { CE_ID, CE_SOURCE } from '../testUtils/eventing/stubs.js';

const QUEUE_URL = await getServiceUrl('veraid-authority-queue');

async function postEvent(event: CloudEvent<unknown>): Promise<Response> {
  const message = HTTP.structured(event);

  return fetch(QUEUE_URL, {
    method: 'POST',
    headers: message.headers as HeadersInit,
    body: message.body as string,
  });
}

describe('Background queue', () => {
  test('Supported event should be accepted', async () => {
    const event = new CloudEvent({
      id: CE_ID,
      type: BUNDLE_REQUEST_TRIGGER_TYPE,
      source: CE_SOURCE,
    });

    const response = await postEvent(event);

    expect(response.status).toBe(HTTP_STATUS_CODES.NO_CONTENT);
  });

  test('Unsupported event should be refused', async () => {
    const event = new CloudEvent({
      id: CE_ID,
      type: 'invalid',
      source: CE_SOURCE,
    });

    const response = await postEvent(event);

    expect(response.status).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
  });
});
