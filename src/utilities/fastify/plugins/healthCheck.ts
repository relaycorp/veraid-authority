import type { FastifyInstance, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../../http.js';
import type { PluginDone } from '../PluginDone.js';

export default function registerHealthCheck(
  fastify: FastifyInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['HEAD', 'GET'],
    url: '/',

    async handler(request, reply) {
      const client = fastify.mongoose.getClient();
      try {
        await client.db().command({ ping: 1 });
      } catch (err) {
        request.log.error({ err }, 'Failed to connect to the database');
        return reply
          .code(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE)
          .header('Content-Type', 'text/plain')
          .send('Failed to connect to the database');
      }

      return reply
        .code(HTTP_STATUS_CODES.OK)
        .header('Content-Type', 'text/plain')
        .send('Success! It works.');
    },
  });

  done();
}
