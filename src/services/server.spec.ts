import { jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import pino from 'pino';

import fastifyMongoose from './plugins/fastifyMongoose.js';

const mockFastifyInstance = {} as unknown as FastifyInstance;
jest.unstable_mockModule('./fastify.js', () => ({
  registerDisallowedMethods: jest.fn(),

  configureFastify: jest
    .fn<() => Promise<FastifyInstance>>()
    .mockResolvedValue(mockFastifyInstance),
}));
const { configureFastify } = await import('./fastify.js');
const { makeServer } = await import('./server.js');

describe('makeServer', () => {
  test('No logger should be passed by default', async () => {
    await makeServer();

    expect(configureFastify).toHaveBeenCalledWith(expect.anything(), undefined, undefined);
  });

  test('Any explicit logger should be honored', async () => {
    const logger = pino();

    await makeServer(logger);

    expect(configureFastify).toHaveBeenCalledWith(expect.anything(), undefined, logger);
  });

  test('Fastify instance should be returned', async () => {
    await expect(makeServer()).resolves.toStrictEqual(mockFastifyInstance);
  });

  test('The fastifyMongoose plugin should be configured', async () => {
    await makeServer();

    expect(configureFastify).toHaveBeenCalledWith(
      expect.toContainValue(fastifyMongoose),
      undefined,
      undefined,
    );
  });
});
