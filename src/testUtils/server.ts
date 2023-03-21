import type { FastifyTypedInstance } from '../services/fastify.js';
import { makeServer } from '../services/server.js';

export function setUpTestServer(): () => FastifyTypedInstance {
  let server: FastifyTypedInstance;
  beforeAll(async () => {
    server = await makeServer();
  });

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,@typescript-eslint/strict-boolean-expressions
    if (server) {
      await server.close();
    }
    // eslint-disable-next-line require-atomic-updates
    server = await makeServer();
  });

  afterEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,@typescript-eslint/strict-boolean-expressions
    if (server) {
      await server.close();
    }
  });

  return () => server;
}
