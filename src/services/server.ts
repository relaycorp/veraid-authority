import type { FastifyInstance, FastifyPluginCallback, RouteOptions } from 'fastify';
import type { Logger } from 'pino';
import fastifyRoutes from '@fastify/routes';

import { configureFastify } from './fastify.js';
import healthcheckRoutes from './routes/healthcheck.routes.js';
import orgRoutes from './routes/org.routes.js';
import memberRoutes from './routes/member.routes.js';
import memberPublicKey from './routes/memberPublicKey.routes.js';
import memberKeyImportToken from './routes/memberKeyImportToken.routes.js';
import notFoundHandler from './plugins/notFoundHandler.js';
import fastifyMongoose from './plugins/fastifyMongoose.js';

const ROUTES: FastifyPluginCallback<RouteOptions>[] = [
  healthcheckRoutes,
  orgRoutes,
  memberRoutes,
  memberPublicKey,
  memberKeyImportToken,
];

/**
 * Initialize a Fastify server instance.
 *
 * This function doesn't call .listen() so we can use .inject() for testing purposes.
 */
export async function makeServer(logger?: Logger): Promise<FastifyInstance> {
  return configureFastify(
    [fastifyMongoose, fastifyRoutes, notFoundHandler, ...ROUTES],
    undefined,
    logger,
  );
}
