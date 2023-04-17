import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { BaseLogger } from 'pino';
import fastifyRoutes from '@fastify/routes';

import { makeFastify } from '../utilities/fastify/server.js';
import type { RouteOptions } from '../utilities/fastify/RouteOptions.js';
import notFoundHandler from '../utilities/fastify/plugins/notFoundHandler.js';
import jwksPlugin from '../utilities/fastify/plugins/jwksAuthentication.js';

import exampleEventPublisher from './routes/exampleEventPublisher.routes.js';
import healthcheckRoutes from './routes/healthcheck.routes.js';
import orgRoutes from './routes/org.routes.js';

const ROOT_ROUTES: FastifyPluginCallback<RouteOptions>[] = [
  exampleEventPublisher,
  healthcheckRoutes,
  orgRoutes,
];

async function makeApiServerPlugin(server: FastifyInstance): Promise<void> {
  await server.register(fastifyRoutes);
  await server.register(notFoundHandler);

  await server.register(jwksPlugin);

  await Promise.all(ROOT_ROUTES.map((route) => server.register(route)));
}

export async function makeApiServer(customLogger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeApiServerPlugin, customLogger);
}
