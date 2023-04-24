import fastifyRoutes from '@fastify/routes';
import {
  fastify,
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyPluginCallback,
  type HTTPMethods,
} from 'fastify';
import env from 'env-var';
import type { BaseLogger } from 'pino';

import { makeLogger } from '../logging.js';
import { configureExitHandling } from '../exitHandling.js';
import { HTTP_STATUS_CODES } from '../http.js';

import fastifyMongoose from './plugins/fastifyMongoose.js';
import notFoundHandler from './plugins/notFoundHandler.js';

const SERVER_PORT = 8080;
const SERVER_HOST = '0.0.0.0';

const DEFAULT_REQUEST_ID_HEADER = 'X-Request-Id';

export const HTTP_METHODS: readonly HTTPMethods[] = [
  'POST',
  'DELETE',
  'GET',
  'HEAD',
  'PATCH',
  'PUT',
  'OPTIONS',
];

export async function makeFastify(
  appPlugin: FastifyPluginAsync | FastifyPluginCallback,
  customLogger?: BaseLogger,
) {
  const logger = customLogger ?? makeLogger();
  configureExitHandling(logger);

  const server = fastify({
    logger,

    requestIdHeader: env
      .get('REQUEST_ID_HEADER')
      .default(DEFAULT_REQUEST_ID_HEADER)
      .asString()
      .toLowerCase(),

    trustProxy: true,
  });

  await server.register(fastifyMongoose);

  const internalServerError = 'Internal server error';
  server.setErrorHandler(async (error, _request, reply) => {
    if (
      error.statusCode !== undefined &&
      error.statusCode < HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ) {
      logger.info(error, 'Client error');
      await reply.send(error);
      return;
    }

    logger.error(error, internalServerError);
    await reply.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send(internalServerError);
  });

  await server.register(fastifyRoutes);
  await server.register(notFoundHandler);

  await server.register(appPlugin);

  await server.ready();

  return server;
}

export async function runFastify(fastifyInstance: FastifyInstance): Promise<void> {
  await fastifyInstance.listen({ host: SERVER_HOST, port: SERVER_PORT });
}
