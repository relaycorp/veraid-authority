import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { createMongooseConnectionFromEnv } from '../../mongo.js';
import type { RouteOptions } from '../RouteOptions.js';
import type { PluginDone } from '../PluginDone.js';

function fastifyMongoose(fastify: FastifyInstance, _opts: RouteOptions, done: PluginDone): void {
  const mongooseConnection = createMongooseConnectionFromEnv();

  fastify.addHook('onClose', async () => {
    await mongooseConnection.close();
  });

  fastify.decorate('mongoose', mongooseConnection);

  done();
}

const fastifyMongoosePlugin = fastifyPlugin(fastifyMongoose, { name: 'fastify-mongoose' });
export default fastifyMongoosePlugin;
