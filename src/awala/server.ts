import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { BaseLogger } from 'pino';

import { makeFastify } from '../utilities/fastify/server.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import type { PluginDone } from '../utilities/fastify/PluginDone.js';
import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';
import awalaRoutes from './routes/awala.routes.js';


function makeAwalaServerPlugin(
  server: FastifyTypedInstance,
  _opts: FastifyPluginOptions,
  done: PluginDone,
): void {
  server.removeAllContentTypeParsers();
  server.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, payload, next) => {
    next(null, payload);
  });

  server.get('/', async (_request, reply) => {
    await reply.status(HTTP_STATUS_CODES.OK).send('It works');
  });

  server.register(awalaRoutes)

  done();
}

export async function makeAwalaServer(logger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeAwalaServerPlugin, logger);
}
