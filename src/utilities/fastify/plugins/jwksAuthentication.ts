import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import fastifyAuth0Verify, { type FastifyAuth0VerifyOptions } from 'fastify-auth0-verify';
import env from 'env-var';

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

async function registerJwksPlugin(fastify: FastifyInstance): Promise<void> {
  const options = getOauth2PluginOptions();
  await fastify.register(fastifyAuth0Verify, options);
}

const jwksPlugin = fastifyPlugin(registerJwksPlugin, {
  name: 'jwks-authentication',
});
export default jwksPlugin;
