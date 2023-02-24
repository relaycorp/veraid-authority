import type { FastifyInstance, FastifyPluginCallback, RouteOptions } from 'fastify';
import type { Logger } from 'pino';
import 'reflect-metadata';

import { configureFastify } from './fastify.js';
import healthcheckRoute from './routes/healthcheck.route.js';

const ROUTES: FastifyPluginCallback<RouteOptions>[] = [healthcheckRoute];

/**
 * Initialize a Fastify server instance.
 *
 * This function doesn't call .listen() so we can use .inject() for testing purposes.
 */
export async function makeServer(logger?: Logger): Promise<FastifyInstance> {
  return configureFastify(ROUTES, undefined, logger);
}
