import { makeServer } from '../api/server.js';
import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';

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
