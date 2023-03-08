import type { FastifyInstance, FastifyPluginCallback, RouteOptions } from 'fastify';
import type { Logger } from 'pino';
import fastifyRoutes from '@fastify/routes';

import { configureFastify } from './fastify.js';
import healthcheckRoutes from './routes/healthcheck.routes.js';
import orgRoutes from './routes/org.routes.js';
import notFoundHandler from './plugins/notFoundHandler.js';

const ROUTES: FastifyPluginCallback<RouteOptions>[] = [healthcheckRoutes, orgRoutes];

/**
 * Initialize a Fastify server instance.
 *
 * This function doesn't call .listen() so we can use .inject() for testing purposes.
 */
export async function makeServer(logger?: Logger): Promise<FastifyInstance> {
  return configureFastify([fastifyRoutes, notFoundHandler, ...ROUTES], undefined, logger);
}
