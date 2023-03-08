import type { RouteOptions } from 'fastify';

import type { FastifyTypedInstance } from '../fastify.js';
import { HTTP_STATUS_CODES } from '../http.js';
import type { PluginDone } from '../types/PluginDone.js';
import { ORG_SCHEMA } from '../schema/org.schema.js';

export default function registerRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['POST'],
    url: '/orgs',

    schema: {
      body: ORG_SCHEMA,
    },

    async handler(_request, reply): Promise<void> {
      await reply
        .code(HTTP_STATUS_CODES.OK)
        .header('Content-Type', 'text/plain')
        .send('Success! It works.');
    },
  });

  done();
}
