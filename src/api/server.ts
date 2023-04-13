import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { Logger } from 'pino';
import fastifyRoutes from '@fastify/routes';
import fastifyOauth2Verify, { type FastifyAuth0VerifyOptions } from 'fastify-auth0-verify';
import env from 'env-var';

import { makeFastify } from '../utilities/fastify/server.js';
import type { RouteOptions } from '../utilities/fastify/RouteOptions.js';
import notFoundHandler from '../utilities/fastify/plugins/notFoundHandler.js';

import exampleEventPublisher from './routes/exampleEventPublisher.routes.js';
import healthcheckRoutes from './routes/healthcheck.routes.js';
import orgRoutes from './routes/org.routes.js';

const ROOT_ROUTES: FastifyPluginCallback<RouteOptions>[] = [
  exampleEventPublisher,
  healthcheckRoutes,
  orgRoutes,
];

function getOauth2PluginOptions(): FastifyAuth0VerifyOptions {
  const audience = env.get('OAUTH2_TOKEN_AUDIENCE').required().asString();
  const domain = env.get('OAUTH2_JWKS_URL').required().asUrlString();

  const issuer = env.get('OAUTH2_TOKEN_ISSUER').asUrlString();
  const issuerRegex = env.get('OAUTH2_TOKEN_ISSUER_REGEX').asRegExp('u');
  if (
    (issuer === undefined && issuerRegex === undefined) ||
    (issuer !== undefined && issuerRegex !== undefined)
  ) {
    throw new Error('Either OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set');
  }

  return {
    audience,
    domain,
    issuer: issuer ?? (issuerRegex as any),
  };
}

async function makeApiServerPlugin(server: FastifyInstance): Promise<void> {
  await server.register(fastifyRoutes);
  await server.register(notFoundHandler);

  const verifyOptions = getOauth2PluginOptions();
  await server.register(fastifyOauth2Verify, verifyOptions);

  await Promise.all(ROOT_ROUTES.map((route) => server.register(route)));
}

/**
 * Initialize a Fastify server instance.
 *
 * This function doesn't call .listen() so we can use .inject() for testing purposes.
 */
export async function makeServer(customLogger?: Logger): Promise<FastifyInstance> {
  return makeFastify(makeApiServerPlugin, customLogger);
}
