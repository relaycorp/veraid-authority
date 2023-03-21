import type { FastifyTypedInstance } from '../services/fastify.js';
import { makeServer } from '../services/server.js';

export function setUpTestServer(): () => FastifyTypedInstance {
  let server: FastifyTypedInstance;
  beforeAll(async () => {
    server = await makeServer();
  });

  afterAll(async () => {
    await server.close();
  });

  return () => server;
}
