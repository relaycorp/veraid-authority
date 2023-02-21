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

export function registerDisallowedMethods(
  allowedMethods: readonly HTTPMethods[],
  endpointUrl: string,
  fastifyInstance: FastifyInstance,
): void {
  const allowedMethodsString = allowedMethods.join(', ');

  const methods = HTTP_METHODS.filter((method) => !allowedMethods.includes(method));

  fastifyInstance.route({
    method: methods,
    url: endpointUrl,

    async handler(request, reply): Promise<void> {
      const statusCode = request.method === 'OPTIONS' ? 204 : 405;
      await reply.code(statusCode).header('Allow', allowedMethodsString).send();
    },
  });
}

/**
 * Initialize a Fastify server instance.
 *
 * This function doesn't call .listen() so we can use .inject() for testing purposes.
 */
export async function configureFastify<RouteOptions extends FastifyPluginOptions = object>(
  routes: readonly FastifyPluginCallback<RouteOptions>[],
  routeOptions?: RouteOptions,
  customLogger?: Logger,
): Promise<FastifyInstance> {
  const logger = customLogger ?? makeLogger();
  configureExitHandling(logger);

  const server = fastify({
    logger,

    requestIdHeader: env.get('REQUEST_ID_HEADER')
      .default(DEFAULT_REQUEST_ID_HEADER)
      .asString()
      .toLowerCase(),

    trustProxy: true,
  });

  await Promise.all(routes.map((route) => server.register(route, routeOptions)));

  await server.ready();

  return server;
}

export async function runFastify(fastifyInstance: FastifyInstance): Promise<void> {
  await fastifyInstance.listen({ host: SERVER_HOST, port: SERVER_PORT });
}
