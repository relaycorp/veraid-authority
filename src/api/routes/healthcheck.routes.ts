import type { FastifyInstance, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';

export default function registerRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['HEAD', 'GET'],
    url: '/',

    async handler(_request, reply): Promise<void> {
      await reply
        .code(HTTP_STATUS_CODES.OK)
        .header('Content-Type', 'text/plain')
        .send('Success! It works.');
    },
  });

  done();
}
