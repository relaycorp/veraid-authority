import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { BaseLogger } from 'pino';

import { makeFastify } from '../utilities/fastify/server.js';
import type { RouteOptions } from '../utilities/fastify/RouteOptions.js';
import jwksPlugin from '../utilities/fastify/plugins/jwksAuthentication.js';

import healthcheckRoutes from './routes/healthcheck.routes.js';
import orgRoutes from './routes/org.routes.js';
import awalaRoutes from './routes/awala.routes.js';

const ROOT_ROUTES: FastifyPluginCallback<RouteOptions>[] = [
  healthcheckRoutes,
  orgRoutes,
  awalaRoutes,
];

async function makeApiServerPlugin(server: FastifyInstance): Promise<void> {
  await server.register(jwksPlugin);
  await Promise.all(ROOT_ROUTES.map((route) => server.register(route)));
}

export async function makeApiServer(customLogger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeApiServerPlugin, customLogger);
}
