import type { FastifyInstance } from 'fastify';

import { registerDisallowedMethods } from '../fastify.js';

export default async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  registerDisallowedMethods(['HEAD', 'GET'], '/', fastify);

  fastify.route({
    method: ['HEAD', 'GET'],
    url: '/',

    async handler(_request, reply): Promise<void> {
      await reply.code(200).header('Content-Type', 'text/plain').send('Success! It works.');
    },
  });
}
