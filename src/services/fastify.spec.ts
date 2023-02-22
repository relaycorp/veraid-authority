import { jest } from '@jest/globals';
import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import pino from 'pino';

import { configureMockEnvVars } from '../testUtils/envVars.js';
import { getMockContext, getMockInstance, mockSpy } from '../testUtils/jest.js';

const mockFastify: FastifyInstance = {
  listen: mockSpy(jest.fn()),
  ready: mockSpy(jest.fn()),
  register: mockSpy(jest.fn()),
} as any;
jest.unstable_mockModule('fastify', () => ({
  fastify: jest.fn().mockImplementation(() => mockFastify),
}));

const mockMakeLogger = jest.fn().mockReturnValue({});
jest.unstable_mockModule('../utilities/logging.js', () => ({ makeLogger: mockMakeLogger }));

const mockExitHandler = jest.fn().mockReturnValue({});
jest.unstable_mockModule('../utilities/exitHandling.js', () => ({
  configureExitHandling: mockExitHandler,
}));

const dummyRoutes: FastifyPluginCallback = () => null;
const mockEnvironmentVariables = configureMockEnvVars();

const { configureFastify, runFastify } = await import('./fastify.js');
const { fastify } = await import('fastify');

afterAll(() => {
  jest.restoreAllMocks();
});

describe('configureFastify', () => {
  test('Logger should be enabled by default', async () => {
    await configureFastify([dummyRoutes]);

    expect(mockMakeLogger).toHaveBeenCalledWith();
    const logger = getMockContext(mockMakeLogger).results[0].value;
    expect(fastify).toHaveBeenCalledWith(expect.objectContaining({ logger }));

    expect(mockExitHandler).toHaveBeenCalledWith(logger);
  });

  test('Custom logger should be honoured', async () => {
    const customLogger = pino();
    await configureFastify([dummyRoutes], undefined, customLogger);

    expect(fastify).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: customLogger,
      }),
    );
    expect(mockExitHandler).toHaveBeenCalledWith(customLogger);
  });

  test('X-Request-Id should be the default request id header', async () => {
    await configureFastify([dummyRoutes]);

    const [[fastifyCallArguments]] = getMockContext(fastify).calls;
    expect(fastifyCallArguments).toHaveProperty('requestIdHeader', 'x-request-id');
  });

  test('Custom request id header can be set via REQUEST_ID_HEADER variable', async () => {
    const requestIdHeader = 'X-Id';
    mockEnvironmentVariables({ REQUEST_ID_HEADER: requestIdHeader });

    await configureFastify([dummyRoutes]);

    const [[fastifyCallArguments]] = getMockContext(fastify).calls;
    expect(fastifyCallArguments).toHaveProperty('requestIdHeader', requestIdHeader.toLowerCase());
  });

  test('Proxy request headers should be trusted', async () => {
    await configureFastify([dummyRoutes]);

    const [[fastifyCallArguments]] = getMockContext(fastify).calls;
    expect(fastifyCallArguments).toHaveProperty('trustProxy', true);
  });

  test('Routes should be loaded', async () => {
    await configureFastify([dummyRoutes]);

    expect(mockFastify.register).toHaveBeenCalledWith(dummyRoutes, undefined);
  });

  test('Routes should be "awaited" for', async () => {
    const error = new Error('Denied');
    getMockInstance(mockFastify.register).mockImplementation((plugin) => {
      if (plugin === dummyRoutes) {
        throw error;
      }
    });

    await expect(configureFastify([dummyRoutes])).rejects.toEqual(error);
  });

  test('Any route options should be passed when registering the route', async () => {
    const options = { foo: 'oof' };

    await configureFastify([dummyRoutes], options);

    expect(mockFastify.register).toHaveBeenCalledWith(dummyRoutes, options);
  });

  test('It should wait for the Fastify server to be ready', async () => {
    await configureFastify([dummyRoutes]);

    expect(mockFastify.ready).toHaveBeenCalledTimes(1);
  });

  test('Server instance should be returned', async () => {
    const serverInstance = await configureFastify([dummyRoutes]);

    expect(serverInstance).toBe(mockFastify);
  });
});

describe('runFastify', () => {
  test('Server returned by makeServer() should be used', async () => {
    await runFastify(mockFastify);

    expect(mockFastify.listen).toHaveBeenCalledTimes(1);
  });

  test('Server should listen on port 8080', async () => {
    await runFastify(mockFastify);

    const [[listenCallArguments]] = getMockContext(mockFastify.listen).calls;
    expect(listenCallArguments).toHaveProperty('port', 8080);
  });

  test('Server should listen on 0.0.0.0', async () => {
    await runFastify(mockFastify);

    expect(mockFastify.listen).toHaveBeenCalledTimes(1);
    const [[listenCallArguments]] = getMockContext(mockFastify.listen).calls;
    expect(listenCallArguments).toHaveProperty('host', '0.0.0.0');
  });

  test('listen() call should be "awaited" for', async () => {
    const error = new Error('Denied');
    getMockInstance(mockFastify.listen).mockRejectedValueOnce(error);

    await expect(runFastify(mockFastify)).rejects.toStrictEqual(error);
  });
});
