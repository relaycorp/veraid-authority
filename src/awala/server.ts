import type { FastifyInstance } from 'fastify';
import type { BaseLogger } from 'pino';

import { makeFastify } from '../utilities/fastify/server.js';
import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';
import registerHealthCheck from '../utilities/fastify/plugins/healthCheck.js';

import awalaRoutes from './routes/awala.routes.js';

async function makeAwalaServerPlugin(server: FastifyTypedInstance) {
  await server.register(registerHealthCheck);
  await server.register(awalaRoutes);
}

export async function makeAwalaServer(logger?: BaseLogger): Promise<FastifyInstance> {
  return makeFastify(makeAwalaServerPlugin, logger);
}
