import type { FastifyTypedInstance } from '../services/fastify.js';
import { makeServer } from '../services/server.js';

export function setUpTestServer(): () => FastifyTypedInstance {
  let server: FastifyTypedInstance;
  beforeEach(async () => {
    server = await makeServer();
  });

  afterEach(async () => {
    await server.close();
  });

  return () => server;
}
