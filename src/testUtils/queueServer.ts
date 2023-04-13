import type { BaseLogger } from 'pino';

import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';
import { makeQueueServer } from '../backgroundQueue/server.js';

import { makeTestServer } from './server.js';

export { REQUIRED_ENV_VARS as REQUIRED_QUEUE_ENV_VARS } from './envVars.js';

export function setUpTestQueueServer(logger?: BaseLogger): () => FastifyTypedInstance {
  return makeTestServer(makeQueueServer, logger);
}
