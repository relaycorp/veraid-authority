import pino from 'pino';

import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import { setUpTestServer } from '../../testUtils/server.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import { makeMockLogging } from '../../testUtils/logging.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

describe('error routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);
  const mockLogging = makeMockLogging();
  const getTestServer = setUpTestServer(mockLogging);
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServer();
  });

  test('Thrown error should be handled gracefully and logged', async () => {
    const response = await serverInstance.inject({ method: 'HEAD', url: '/error' });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.INTERNAL_ERROR);
    expect(response.headers['content-type']).toStartWith('text/plain');
    expect(response.body).toBe('Internal server error');
    expect(mockLogging.logs).toContainEqual(
      expect.objectContaining({
        level: pino.levels.values.info,
        msg: 'Internal server error',

        err: expect.objectContaining({
          message: 'ERROR_MESSAGE',
          stack: expect.toStartWith('Error: '),
        }),
      }),
    );
  });
});
