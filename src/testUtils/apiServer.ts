import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';
import { makeApiServer } from '../api/server.js';

import { makeTestServer } from './server.js';
import { OAUTH2_JWKS_URL, OAUTH2_TOKEN_AUDIENCE, OAUTH2_TOKEN_ISSUER } from './authn.js';
import { configureMockEnvVars, REQUIRED_ENV_VARS } from './envVars.js';

export const REQUIRED_API_ENV_VARS = {
  ...REQUIRED_ENV_VARS,
  OAUTH2_JWKS_URL,
  OAUTH2_TOKEN_AUDIENCE,
  OAUTH2_TOKEN_ISSUER,
};

export function makeTestApiServer(): () => FastifyTypedInstance {
  configureMockEnvVars(REQUIRED_API_ENV_VARS);
  return makeTestServer(makeApiServer);
}
