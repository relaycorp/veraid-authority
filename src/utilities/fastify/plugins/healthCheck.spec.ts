import type { FastifyPluginCallback } from 'fastify';
import type { BaseLogger } from 'pino';

import { HTTP_STATUS_CODES } from '../../http.js';
import { partialPinoLog } from '../../../testUtils/logging.js';
import { makeTestServer } from '../../../testUtils/server.js';
import { makeFastify } from '../server.js';
import { REQUIRED_ENV_VARS } from '../../../testUtils/envVars.js';

import registerHealthCheck from './healthCheck.js';

describe('healthcheck routes', () => {
  const getTestServerFixture = makeTestServer(
    async (logger?: BaseLogger) =>
      makeFastify(registerHealthCheck as FastifyPluginCallback, logger),
    REQUIRED_ENV_VARS,
  );

  test('Response should report when server is running fine', async () => {
    const { server } = getTestServerFixture();

    const response = await server.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toStrictEqual(HTTP_STATUS_CODES.OK);
    expect(response.headers).toHaveProperty('content-type', 'text/plain');
    expect(response.payload).toContain('Success');
  });

  test('Server error response should be returned if the database is not available', async () => {
    const { server, logs } = getTestServerFixture();
    await server.mongoose.destroy(true);

    const response = await server.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toStrictEqual(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
    expect(response.headers).toHaveProperty('content-type', 'text/plain');
    expect(response.payload).toContain('Failed to connect to the database');
    expect(logs).toContainEqual(
      partialPinoLog('error', 'Failed to connect to the database', {
        err: expect.objectContaining({ message: expect.anything() }),
      }),
    );
  });

  test('HEAD request should be supported', async () => {
    const { server } = getTestServerFixture();

    const response = await server.inject({ method: 'HEAD', url: '/' });

    expect(response.statusCode).toStrictEqual(HTTP_STATUS_CODES.OK);
    expect(response.headers).toHaveProperty('content-type', 'text/plain');
  });
});
