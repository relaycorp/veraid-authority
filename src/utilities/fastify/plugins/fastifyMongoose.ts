import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { createMongooseConnectionFromEnv } from '../../mongo.js';

const DELAY = 5000;

async function fastifyMongoose(fastify: FastifyInstance): Promise<void> {
  // eslint-disable-next-line promise/avoid-new,no-promise-executor-return
  await new Promise((resolve) => setTimeout(resolve, DELAY));

  const mongooseConnection = await createMongooseConnectionFromEnv();

  fastify.addHook('onClose', async () => {
    await mongooseConnection.close();
  });

  fastify.decorate('mongoose', mongooseConnection);
}

const fastifyMongoosePlugin = fastifyPlugin(fastifyMongoose, { name: 'fastify-mongoose' });
export default fastifyMongoosePlugin;
