import { makeServer } from '../api/server.js';
import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';

import type { MockLogging } from './logging.js';

export function setUpTestServer(mockLogging?: MockLogging): () => FastifyTypedInstance {
  let server: FastifyTypedInstance;
  beforeEach(async () => {
    server = await makeServer(mockLogging ? mockLogging.logger : undefined);
  });

  afterEach(async () => {
    await server.close();
  });

  return () => server;
}
