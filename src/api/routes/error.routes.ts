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

    handler(_request, _reply): void {
      throw new Error("")
    },
  });

  done();
}
