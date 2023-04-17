import type { FastifyInstance, RouteOptions } from 'fastify';
import { CloudEvent } from 'cloudevents';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import { Emitter } from '../../utilities/eventing/Emitter.js';
import { type ExampleEventPayload, EXAMPLE_TYPE } from '../../events/example.event.js';

export default function registerRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  // `POST /awala` is probably the only endpoint in the API server that actually needs the emitter.
  const emitter = Emitter.init() as Emitter<ExampleEventPayload>;

  fastify.route({
    method: ['POST'],
    url: '/example-event-publisher',

    async handler(_request, reply): Promise<void> {
      const event = new CloudEvent({
        // This should be unique for a given `source`, unless we want to replace an existing
        // (in-flight) event. This is required (but we may not actually care about it).
        id: 'id',

        // The source is a URL that identifies the source of the event. The URL may or may not
        // exist. This field is required (but we may not actually care about it).
        source: 'https://veraid.net/authority/api',

        // The subject is whom this event refers to. The field is optional.
        subject: 'bbc.com',

        // The type is what we'd use for routing purposes. This field is required.
        type: EXAMPLE_TYPE,

        // The data is the actual payload. This field is required.
        data: { foo: 'bar' },
      });
      await emitter.emit(event);

      await reply
        .code(HTTP_STATUS_CODES.OK)
        .header('Content-Type', 'text/plain')
        .send('Event emitted!');
    },
  });

  done();
}
