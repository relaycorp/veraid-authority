import { CloudEvent } from 'cloudevents';

import { configureMockEnvVars } from '../../testUtils/envVars.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { REQUIRED_QUEUE_ENV_VARS, setUpTestQueueServer } from '../../testUtils/queueServer.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import { makeMockLogging, partialPinoLog } from '../../testUtils/logging.js';
import { CE_ID, CE_SOURCE } from '../../testUtils/eventing/stubs.js';
import { postEvent } from '../../testUtils/eventing/cloudEvents.js';
import { EXAMPLE_TYPE, type ExampleEventPayload } from '../../events/example.event.js';

describe('example event publisher routes', () => {
  configureMockEnvVars(REQUIRED_QUEUE_ENV_VARS);

  const mockLogging = makeMockLogging();
  const getTestServer = setUpTestQueueServer(mockLogging.logger);
  let server: FastifyTypedInstance;
  beforeEach(() => {
    server = getTestServer();
  });

  test('Event should be processed', async () => {
    const event = new CloudEvent<ExampleEventPayload>({
      id: CE_ID,
      source: CE_SOURCE,
      type: EXAMPLE_TYPE,
      data: { foo: 'bar' },
    });

    const response = await postEvent(event, server);

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'Event processed', { event: event.toJSON() }),
    );
  });
});
