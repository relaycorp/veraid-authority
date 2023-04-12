import type { RouteOptions, FastifyInstance } from 'fastify';
import fastifyRoutes from '@fastify/routes';

import type { PluginDone } from '../utilities/fastify/PluginDone.js';
import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';

function registerErrorRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['POST'],
    url: '/5xx',

    handler(): void {
      throw new Error('ERROR_MESSAGE');
    },
  });

  fastify.route({
    method: ['POST'],
    url: '/4xx',

    schema: {
      body: {
        type: 'object',

        properties: {
          test: { type: 'string' },
        },

        required: ['test'],
      } as const,
    },

    handler(): void {
      this.log.info('SCHEMA_INCORRECTLY_VALIDATED', {});
    },
  });

  done();
}

export async function errorAppPlugin(server: FastifyInstance) {
  await server.register(fastifyRoutes);
  await server.register(registerErrorRoutes);
}
