import { jest } from '@jest/globals';
import { fastify, type FastifyInstance, type FastifyPluginCallback } from 'fastify';
import pino from 'pino';

import { setUpTestDBConnection } from '../testUtils/db.js';
import { configureMockEnvVars as configureMockEnvironmentVariables } from '../testUtils/envVars.js';
import { getMockContext, getMockInstance, mockSpy } from '../testUtils/jest.js';
import * as exitHandling from '../utilities/exitHandling.js';
import * as logging from '../utilities/logging.js';

import { configureFastify, runFastify } from './fastify.js';
import fastifyMongoose from './fastifyMongoose.js';

const mockFastify: FastifyInstance = {
  listen: mockSpy(jest.fn()),
  ready: mockSpy(jest.fn()),
  register: mockSpy(jest.fn()),
} as any;
jest.unstable_mockModule('fastify', () => ({
  fastify: jest.fn().mockImplementation(() => mockFastify),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

const mockEnvironmentVariables = configureMockEnvironmentVariables();

const mockMakeLogger = mockSpy(jest.spyOn(logging, 'makeLogger'));

const mockExitHandler = mockSpy(jest.spyOn(exitHandling, 'configureExitHandling'));

const dummyRoutes: FastifyPluginCallback = () => null;

const getConnection = setUpTestDBConnection();

describe('configureFastify', () => {
  test('Logger should be enabled by default', () => {
    configureFastify([dummyRoutes]);

    expect(mockMakeLogger).toHaveBeenCalledWith();
    const logger = getMockContext(mockMakeLogger).results[0].value;
    expect(fastify).toHaveBeenCalledWith(expect.objectContaining({ logger }));

    expect(mockExitHandler).toHaveBeenCalledWith(logger);
  });

  test('Custom logger should be honoured', () => {
    const customLogger = pino();
    configureFastify([dummyRoutes], undefined, customLogger);

    expect(fastify).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: customLogger,
      }),
    );
    expect(mockExitHandler).toHaveBeenCalledWith(customLogger);
  });

  test('X-Request-Id should be the default request id header', () => {
    configureFastify([dummyRoutes]);

    const fastifyCallArguments = getMockContext(fastify).calls[0];
    expect(fastifyCallArguments[0]).toHaveProperty('requestIdHeader', 'x-request-id');
  });

  test('Custom request id header can be set via REQUEST_ID_HEADER variable', () => {
    const requestIdHeader = 'X-Id';
    mockEnvironmentVariables({ REQUEST_ID_HEADER: requestIdHeader });

    configureFastify([dummyRoutes]);

    const fastifyCallArguments = getMockContext(fastify).calls[0];
    expect(fastifyCallArguments[0]).toHaveProperty(
      'requestIdHeader',
      requestIdHeader.toLowerCase(),
    );
  });

  test('Proxy request headers should be trusted', () => {
    configureFastify([dummyRoutes]);

    const fastifyCallArguments = getMockContext(fastify).calls[0];
    expect(fastifyCallArguments[0]).toHaveProperty('trustProxy', true);
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

  test('The fastify-mongoose plugin should be configured', async () => {
    await configureFastify([dummyRoutes]);

    expect(mockFastify.register).toHaveBeenCalledWith(fastifyMongoose, {
      connection: getConnection(),
    });
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

    const listenCallArguments = getMockContext(mockFastify.listen).calls[0];
    expect(listenCallArguments[0]).toHaveProperty('port', 8080);
  });

  test('Server should listen on 0.0.0.0', async () => {
    await runFastify(mockFastify);

    expect(mockFastify.listen).toHaveBeenCalledTimes(1);
    const listenCallArguments = getMockContext(mockFastify.listen).calls[0];
    expect(listenCallArguments[0]).toHaveProperty('host', '0.0.0.0');
  });

  test('listen() call should be "awaited" for', async () => {
    const error = new Error('Denied');
    getMockInstance(mockFastify.listen).mockRejectedValueOnce(error);

    await expect(runFastify(mockFastify)).rejects.toEqual(error);
  });
});
