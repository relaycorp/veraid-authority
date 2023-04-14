import { CloudEvent } from 'cloudevents';
import type { FastifyInstance } from 'fastify';

import { configureMockEnvVars } from '../testUtils/envVars.js';
import { REQUIRED_QUEUE_ENV_VARS, setUpTestQueueServer } from '../testUtils/queueServer.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { CE_ID, CE_SOURCE } from '../testUtils/eventing/stubs.js';
import { postEvent } from '../testUtils/eventing/cloudEvents.js';

import { QueueProblemType } from './QueueProblemType.js';

configureMockEnvVars(REQUIRED_QUEUE_ENV_VARS);

describe('makeQueueServer', () => {
  const getServer = setUpTestQueueServer();
  let server: FastifyInstance;
  beforeEach(() => {
    server = getServer();
  });

  describe('GET', () => {
    test('Response should be 200 OK', async () => {
      const response = await server.inject({ method: 'GET', url: '/' });

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.OK);
      expect(response.body).toBe('It works');
    });
  });

  describe('POST', () => {
    test('Malformed CloudEvent should be refused', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { 'content-type': 'application/cloudevents+json' },
        payload: 'null',
      });

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', QueueProblemType.INVALID_EVENT);
    });

    test('Unsupported CloudEvent type should be refused', async () => {
      const event = new CloudEvent({
        type: 'net.veraid.invalid',
        id: CE_ID,
        source: CE_SOURCE,
        data: {},
      });

      const response = await postEvent(event, server);

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', QueueProblemType.UNSUPPORTED_EVENT);
    });
  });
});
