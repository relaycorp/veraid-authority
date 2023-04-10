import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import { setUpTestServer } from '../../testUtils/server.js';
import type { FastifyTypedInstance } from '../types/FastifyTypedInstance.js';

describe('healthcheck routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);

  const getTestServer = setUpTestServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServer();
  });

  test('A plain simple HEAD request should provide some diagnostic information', async () => {
    const response = await serverInstance.inject({ method: 'HEAD', url: '/' });

    expect(response).toHaveProperty('statusCode', 200);
    expect(response).toHaveProperty('headers.content-type', 'text/plain');
  });

  test('A plain simple GET request should provide some diagnostic information', async () => {
    const response = await serverInstance.inject({ method: 'GET', url: '/' });

    expect(response).toHaveProperty('statusCode', 200);
    expect(response).toHaveProperty('headers.content-type', 'text/plain');
    expect(response.payload).toContain('Success');
  });
});
