import type { FastifyInstance } from 'fastify';

import { registerDisallowedMethods } from '../fastify.js';

export default function registerRoutes(fastify: FastifyInstance): void {
  registerDisallowedMethods(['HEAD', 'GET'], '/', fastify);

  fastify.route({
    method: ['HEAD', 'GET'],
    url: '/',

    async handler(_request, reply): Promise<void> {
      reply
        .code(200)
        .header('Content-Type', 'text/plain')
        .send('Success! The PoWeb service works.');
    },
  });
}
