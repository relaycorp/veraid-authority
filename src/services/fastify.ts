import type { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import fastifyOauth2Verify, { type FastifyAuth0VerifyOptions } from 'fastify-auth0-verify';
import env from 'env-var';
import {
  fastify,
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyPluginCallback,
  type FastifyPluginOptions,
  type HTTPMethods,
  type RawReplyDefaultExpression,
  type RawRequestDefaultExpression,
  type RawServerDefault,
} from 'fastify';
import type { Logger } from 'pino';

import { configureExitHandling } from '../utilities/exitHandling.js';
import { makeLogger } from '../utilities/logging.js';

const DEFAULT_REQUEST_ID_HEADER = 'X-Request-Id';
const SERVER_PORT = 8080;
const SERVER_HOST = '0.0.0.0';

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

export const HTTP_METHODS: readonly HTTPMethods[] = [
  'POST',
  'DELETE',
  'GET',
  'HEAD',
  'PATCH',
  'PUT',
  'OPTIONS',
];

export type FastifyTypedInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  JsonSchemaToTsProvider
>;

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

  const verifyOptions = getOauth2PluginOptions();
  await server.register(fastifyOauth2Verify, verifyOptions);

  await Promise.all(plugins.map((plugin) => server.register(plugin, pluginOptions)));

  await server.ready();

  return server;
}

export async function runFastify(fastifyInstance: FastifyInstance): Promise<void> {
  await fastifyInstance.listen({ host: SERVER_HOST, port: SERVER_PORT });
}
