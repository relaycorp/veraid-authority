import type { CloudEventV1 } from 'cloudevents';

import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { mockEmitter } from '../../testUtils/eventing/mockEmitter.js';
import { makeTestApiServer } from '../../testUtils/apiServer.js';
import { type ExampleEventPayload, EXAMPLE_TYPE } from '../../events/example.event.js';

describe('example event publisher routes', () => {
  const getEvents = mockEmitter();

  const getTestServerFixture = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServerFixture().server;
  });

  test('Event should be published', async () => {
    const response = await serverInstance.inject({
      method: 'POST',
      url: '/example-event-publisher',
    });

    expect(response).toHaveProperty('statusCode', 200);
    expect(getEvents()).toContainEqual(
      expect.objectContaining<Partial<CloudEventV1<ExampleEventPayload>>>({
        id: 'id',
        source: 'https://veraid.net/authority/api',
        subject: 'bbc.com',
        type: EXAMPLE_TYPE,
        data: { foo: 'bar' },
      }),
    );
  });
});
