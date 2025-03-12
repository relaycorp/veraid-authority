import { CloudEvent } from 'cloudevents';

import { setUpTestQueueServer } from '../../testUtils/queueServer.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import { CE_ID, CE_SOURCE } from '../../testUtils/eventing/stubs.js';
import { postEvent } from '../../testUtils/eventing/cloudEvents.js';
import { partialPinoLog } from '../../testUtils/logging.js';

import { QueueProblem } from './QueueProblem.js';

describe('makeQueueServer', () => {
  const getTestServerFixture = setUpTestQueueServer();

  describe('GET', () => {
    test('Response should be 200 OK', async () => {
      const { server } = getTestServerFixture();

      const response = await server.inject({ method: 'GET', url: '/' });

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.OK);
      expect(response.body).toContain('It works');
    });
  });

  describe('POST', () => {
    test('Malformed CloudEvent should be refused', async () => {
      const { server, logs } = getTestServerFixture();

      const response = await server.inject({
        method: 'POST',
        url: '/',

        headers: {},
        payload: 'null',
      });

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', QueueProblem.INVALID_EVENT);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refusing invalid event', { err: expect.anything() }),
      );
    });

    test('Unsupported CloudEvent type should be refused', async () => {
      const { server, logs } = getTestServerFixture();
      const event = new CloudEvent({
        type: 'net.veraid.invalid',
        id: CE_ID,
        source: CE_SOURCE,
        data: {},
      });

      const response = await postEvent(event, server);

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', QueueProblem.UNSUPPORTED_EVENT);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refusing unsupported event type', { eventType: event.type }),
      );
    });
  });
});
