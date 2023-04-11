import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import { setUpTestServer } from '../../testUtils/server.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';

describe('error routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);

  const getTestServer = setUpTestServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServer();
  });

  test('Thrown error should be handled gracefully', async () => {
    const response = await serverInstance.inject({ method: 'HEAD', url: '/error' });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.INTERNAL_ERROR);
    expect(response.headers['content-type']).toStartWith('text/plain');
    expect(response.body).toBe("Internal server error");
  });
});
