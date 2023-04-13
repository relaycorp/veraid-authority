import type { FastifyInstance, RouteOptions } from 'fastify';
import { CloudEvent } from 'cloudevents';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import { Emitter } from '../../utilities/eventing/Emitter.js';

export default function registerRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  const emitter = Emitter.initFromEnv();

  fastify.route({
    method: ['POST'],
    url: '/example-event-publisher',

    async handler(_request, reply): Promise<void> {
      const event = new CloudEvent({ id: 'id', source: 'https://example.com', type: 'type' });
      await emitter.emit(event);

      await reply
        .code(HTTP_STATUS_CODES.OK)
        .header('Content-Type', 'text/plain')
        .send('Event emitted!');
    },
  });

  done();
}
