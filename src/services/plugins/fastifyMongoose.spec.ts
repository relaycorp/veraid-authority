import fastify from 'fastify';
import type { Connection } from 'mongoose';

import { mockSpy } from '../../testUtils/jest.ts';

import fastifyMongoose from './fastifyMongoose.ts';

const MOCK_MONGOOSE_CONNECTION = { close: mockSpy(jest.fn()) } as any as Connection;

test('Plugin registration should fail if connection is missing', async () => {
  const app = fastify();

  await expect(app.register(fastifyMongoose)).rejects.toThrowWithMessage(
    Error,
    'Mongoose connection is missing from fastify-mongoose plugin registration',
  );
});

test('Connection should be added to fastify instance', async () => {
  const app = fastify();
  await app.register(fastifyMongoose, { connection: MOCK_MONGOOSE_CONNECTION });

  expect(app).toHaveProperty('mongoose', MOCK_MONGOOSE_CONNECTION);
});

test('Connection should be closed when fastify ends', async () => {
  const app = fastify();
  await app.register(fastifyMongoose, { connection: MOCK_MONGOOSE_CONNECTION });
  expect(MOCK_MONGOOSE_CONNECTION.close).not.toHaveBeenCalled();

  await app.close();

  expect(MOCK_MONGOOSE_CONNECTION.close).toHaveBeenCalled();
});
