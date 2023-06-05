import type { FastifyInstance } from 'fastify';

import { setUpTestQueueServer } from '../testUtils/queueServer.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';

describe('makeQueueServer', () => {
  const getTestServerFixture = setUpTestQueueServer();
  let server: FastifyInstance;
  beforeEach(() => {
    ({ server } = getTestServerFixture());
  });

  describe('GET', () => {
    test('Response should be 200 OK', async () => {
      const response = await server.inject({ method: 'GET', url: '/' });

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.OK);
      expect(response.body).toBe('It works');
    });
  });
});
