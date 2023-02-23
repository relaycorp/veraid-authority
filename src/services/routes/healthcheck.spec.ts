import { testDisallowedMethods } from '../../testUtils/fastify.js';
import { makeServer } from '../server.js';
import { configureMockEnvVars } from '../../testUtils/envVars.js';

describe('healthcheck', () => {
  configureMockEnvVars({ AUTHORITY_VERSION: '1.2.3' });

  testDisallowedMethods(['HEAD', 'GET'], '/', makeServer);

  test('A plain simple HEAD request should provide some diagnostic information', async () => {
    const serverInstance = await makeServer();

    const response = await serverInstance.inject({ method: 'HEAD', url: '/' });

    expect(response).toHaveProperty('statusCode', 200);
    expect(response).toHaveProperty('headers.content-type', 'text/plain');
  });

  test('A plain simple GET request should provide some diagnostic information', async () => {
    const serverInstance = await makeServer();

    const response = await serverInstance.inject({ method: 'GET', url: '/' });

    expect(response).toHaveProperty('statusCode', 200);
    expect(response).toHaveProperty('headers.content-type', 'text/plain');
    expect(response.payload).toContain('Success');
  });
});
