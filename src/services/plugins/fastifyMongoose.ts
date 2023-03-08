import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { createMongooseConnectionFromEnv } from '../../utilities/mongo.js';

async function fastifyMongoose(fastify: FastifyInstance): Promise<void> {
  const mongooseConnection = await createMongooseConnectionFromEnv();

  fastify.addHook('onClose', async () => {
    await mongooseConnection.close();
  });

  fastify.decorate('mongoose', mongooseConnection);
}

const fastifyMongoosePlugin = fastifyPlugin(fastifyMongoose, { name: 'fastify-mongoose' });
export default fastifyMongoosePlugin;
