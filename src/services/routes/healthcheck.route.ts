import type { FastifyInstance, RouteOptions } from 'fastify';

import { registerDisallowedMethods } from '../fastify.js';
import { HTTP_STATUS_CODES } from '../http.js';

export default function registerRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions,
  done: () => void,
): void {
  registerDisallowedMethods(['HEAD', 'GET'], '/', fastify);

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
