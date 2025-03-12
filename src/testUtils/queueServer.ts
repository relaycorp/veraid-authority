import { makeQueueServer } from '../servers/backgroundQueue/server.js';

import { makeTestServer, type TestServerFixture } from './server.js';
import { REQUIRED_ENV_VARS } from './envVars.js';

const REQUIRED_QUEUE_ENV_VARS = REQUIRED_ENV_VARS;

export function setUpTestQueueServer(): () => TestServerFixture {
  return makeTestServer(makeQueueServer, REQUIRED_QUEUE_ENV_VARS);
}
