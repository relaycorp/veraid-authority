import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { BaseLogger } from 'pino';

import { makeFastify } from '../../utilities/fastify/server.js';
import type { RouteOptions } from '../../utilities/fastify/RouteOptions.js';
import jwksPlugin from '../../utilities/fastify/plugins/jwksAuthentication.js';
import registerHealthCheck from '../../utilities/fastify/plugins/healthCheck.js';
import orgRoutes from '../../entities/organisations/org.routes.js';
// eslint-disable-next-line max-len
import signatureBundleIssuance from '../../entities/memberSignatures/signatureBundleIssuance.routes.js';

export async function makeApiServerPlugin(server: FastifyInstance): Promise<void> {
  const rootRoutes: FastifyPluginCallback<RouteOptions>[] = [registerHealthCheck, orgRoutes];

  await server.register(jwksPlugin);
  await Promise.all(rootRoutes.map((route) => server.register(route)));
  await server.register(signatureBundleIssuance);
}

export async function makeApiServer(customLogger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeApiServerPlugin, customLogger);
}
