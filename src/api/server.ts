import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { BaseLogger } from 'pino';

import { makeFastify } from '../utilities/fastify/server.js';
import type { RouteOptions } from '../utilities/fastify/RouteOptions.js';
import jwksPlugin from '../utilities/fastify/plugins/jwksAuthentication.js';

import healthcheckRoutes from './routes/healthcheck.routes.js';
import orgRoutes from './routes/org.routes.js';

export async function makeApiServerPlugin(server: FastifyInstance): Promise<void> {
  const rootRoutes: FastifyPluginCallback<RouteOptions>[] = [
    healthcheckRoutes,
    orgRoutes,
  ];

  await server.register(jwksPlugin);
  await Promise.all(rootRoutes.map((route) => server.register(route)));
}

export async function makeApiServer(customLogger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeApiServerPlugin, customLogger);
}
