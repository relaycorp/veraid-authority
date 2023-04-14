import { jest } from '@jest/globals';
import fastify from 'fastify';
import type { Connection } from 'mongoose';

import { mockSpy } from '../../../testUtils/jest.js';

const mockMongooseClose = mockSpy(jest.fn());
const mockMongoose = { close: mockMongooseClose } as unknown as Connection;
jest.unstable_mockModule('../../mongo.js', () => ({
  createMongooseConnectionFromEnv: jest.fn<() => Connection>().mockReturnValue(mockMongoose),
}));
const fastifyMongoose = await import('./fastifyMongoose.js');

describe('fastifyMongoose', () => {
  test('Connection should be added to fastify instance', async () => {
    const app = fastify();
    await app.register(fastifyMongoose.default);

    expect(app).toHaveProperty('mongoose');

    expect(app.mongoose).toStrictEqual(mockMongoose);
  });

  test('Connection should be closed when fastify ends', async () => {
    const app = fastify();
    await app.register(fastifyMongoose.default);
    expect(mockMongooseClose).not.toHaveBeenCalled();

    await app.close();

    expect(mockMongooseClose).toHaveBeenCalledWith();
  });
});
