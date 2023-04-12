import type { Logger } from 'pino';

import { makeServer } from '../api/server.js';
import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';

export function setUpTestServer(customLogger?: Logger): () => FastifyTypedInstance {
  let server: FastifyTypedInstance;
  beforeEach(async () => {
    server = await makeServer(customLogger);
  });

  afterEach(async () => {
    await server.close();
  });

  return () => server;
}
