import type { FastifyInstance, RouteOptions } from 'fastify';

import type { PluginDone } from '../../utilities/fastify/PluginDone.js';

export default function registerRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['HEAD'],
    url: '/error',

    handler(): void {
      throw new Error('ERROR_MESSAGE');
    },
  });

  done();
}
