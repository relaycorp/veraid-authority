import fastifyMongodb from '@fastify/mongodb';
import env from 'env-var';
import {
  fastify,
  type FastifyInstance,
  type FastifyPluginCallback,
  type FastifyPluginOptions,
  type HTTPMethods,
} from 'fastify';
import type { Logger } from 'pino';

import { configureExitHandling } from '../utilities/exitHandling.js';
import { makeLogger } from '../utilities/logging.js';

const DEFAULT_REQUEST_ID_HEADER = 'X-Request-Id';
const SERVER_PORT = 8080;
const SERVER_HOST = '0.0.0.0';

export const HTTP_METHODS: readonly HTTPMethods[] = [
  'POST',
  'DELETE',
  'GET',
  'HEAD',
  'PATCH',
  'PUT',
  'OPTIONS',
];

/**
 * Initialize a Fastify server instance.
 *
 * This function doesn't call .listen() so we can use .inject() for testing purposes.
 */
export async function configureFastify<PluginOptions extends FastifyPluginOptions = object>(
  plugins: readonly FastifyPluginCallback<PluginOptions>[],
  pluginOptions?: PluginOptions,
  customLogger?: Logger,
): Promise<FastifyInstance> {
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

  const mongoUri = env.get('MONGODB_URI').required().asString();
  await server.register(fastifyMongodb, { forceClose: true, url: mongoUri });

  await Promise.all(plugins.map((plugin) => server.register(plugin, pluginOptions)));

  await server.ready();

  return server;
}

export async function runFastify(fastifyInstance: FastifyInstance): Promise<void> {
  await fastifyInstance.listen({ host: SERVER_HOST, port: SERVER_PORT });
}
