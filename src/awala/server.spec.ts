import type { FastifyInstance } from 'fastify';

import { setUpTestAwalaServer } from '../testUtils/awalaServer.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';

describe('makeAwalaServer', () => {
  const getTestServerFixture = setUpTestAwalaServer();
  let server: FastifyInstance;
  beforeEach(() => {
    ({ server } = getTestServerFixture());
  });

  describe('GET', () => {
    test('Response should be 200 OK', async () => {
      const response = await server.inject({ method: 'GET', url: '/' });

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.OK);
      expect(response.body).toContain('It works');
    });
  });
});
