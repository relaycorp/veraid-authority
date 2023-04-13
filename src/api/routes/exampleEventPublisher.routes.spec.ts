import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import { setUpTestServer } from '../../testUtils/server.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { mockEmitter } from '../../testUtils/eventing/mockEmitter.js';

describe('healthcheck routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);
  const getEvents = mockEmitter();

  const getTestServer = setUpTestServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServer();
  });

  test('Event should be published', async () => {
    const response = await serverInstance.inject({
      method: 'POST',
      url: '/example-event-publisher',
    });

    expect(response).toHaveProperty('statusCode', 200);
    expect(getEvents()).toContainEqual(
      expect.objectContaining({
        id: 'id',
        source: 'https://example.com',
        type: 'type',
      }),
    );
  });
});
