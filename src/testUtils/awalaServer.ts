import { makeAwalaServer } from '../servers/awala/server.js';

import { makeTestServer, type TestServerFixture } from './server.js';
import { REQUIRED_ENV_VARS } from './envVars.js';

const REQUIRED_AWALA_ENV_VARS = REQUIRED_ENV_VARS;

export function setUpTestAwalaServer(): () => TestServerFixture {
  return makeTestServer(makeAwalaServer, REQUIRED_AWALA_ENV_VARS);
}
