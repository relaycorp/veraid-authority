import type { BaseLogger } from 'pino';

import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';
import type { ServerMaker } from '../utilities/fastify/ServerMaker.js';

export function makeTestServer(serverMaker: ServerMaker, logger?: BaseLogger) {
  let server: FastifyTypedInstance;
  beforeEach(async () => {
    server = await serverMaker(logger);
  });

  afterEach(async () => {
    await server.close();
  });

  return () => server;
}
