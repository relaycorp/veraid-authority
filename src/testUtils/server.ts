import { makeServer } from '../services/server.js';
import type { FastifyTypedInstance } from '../services/types/FastifyTypedInstance.js';

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
