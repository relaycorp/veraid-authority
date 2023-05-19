import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import fastifyJwtJwks, { type FastifyJwtJwksOptions } from 'fastify-jwt-jwks';
import env from 'env-var';

function getOauth2PluginOptions(): FastifyJwtJwksOptions {
  const audience = env.get('OAUTH2_TOKEN_AUDIENCE').required().asString();
  const jwksUrl = env.get('OAUTH2_JWKS_URL').required().asUrlString();

  const issuer = env.get('OAUTH2_TOKEN_ISSUER').asUrlString();
  const issuerRegex = env.get('OAUTH2_TOKEN_ISSUER_REGEX').asRegExp('u');
  if (
    (issuer === undefined && issuerRegex === undefined) ||
    (issuer !== undefined && issuerRegex !== undefined)
  ) {
    throw new Error('Either OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set');
  }

  return { audience, jwksUrl, issuer: issuer ?? issuerRegex };
}

async function registerJwksPlugin(fastify: FastifyInstance): Promise<void> {
  const options = getOauth2PluginOptions();
  await fastify.register(fastifyJwtJwks, options);
}

const jwksPlugin = fastifyPlugin(registerJwksPlugin, {
  name: 'jwks-authentication',
});
export default jwksPlugin;
