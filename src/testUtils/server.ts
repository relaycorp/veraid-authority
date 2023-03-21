/* eslint-disable require-atomic-updates */

import type { FastifyTypedInstance } from '../services/fastify.js';
import { makeServer } from '../services/server.js';

export function setUpTestServer(): () => FastifyTypedInstance {
  let server: FastifyTypedInstance;
  beforeAll(async () => {
    server = await makeServer();
  });

  beforeEach(async () => {
    await server.close();
    server = await makeServer();
  });

  afterEach(async () => {
    await server.close();
  });

  return () => server;
}
