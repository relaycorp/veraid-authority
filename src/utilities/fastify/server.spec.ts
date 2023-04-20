import { jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import pino from 'pino';

import { configureMockEnvVars } from '../../testUtils/envVars.js';
import { getMockContext, getMockInstance, mockSpy } from '../../testUtils/jest.js';

import fastifyMongoose from './plugins/fastifyMongoose.js';
import notFoundHandler from './plugins/notFoundHandler.js';

const mockListen = mockSpy(jest.fn<() => Promise<string>>());
const mockRegister = mockSpy(jest.fn());
const mockReady = mockSpy(jest.fn<() => Promise<undefined>>());
const mockFastify: FastifyInstance = {
  listen: mockListen,
  ready: mockReady,
  register: mockRegister,
} as any;
jest.unstable_mockModule('fastify', () => ({
  fastify: jest.fn().mockImplementation(() => mockFastify),
}));

const mockMakeLogger = jest.fn().mockReturnValue({});
jest.unstable_mockModule('../../utilities/logging.js', () => ({ makeLogger: mockMakeLogger }));

const mockExitHandler = jest.fn().mockReturnValue({});
jest.unstable_mockModule('../../utilities/exitHandling.js', () => ({
  configureExitHandling: mockExitHandler,
}));

const { makeFastify, runFastify } = await import('./server.js');
const { fastify } = await import('fastify');

const mockEnvVars = configureMockEnvVars();

afterAll(() => {
  jest.restoreAllMocks();
});

describe('makeFastify', () => {
  const mockPlugin = jest.fn<() => Promise<void>>();

  test('No logger should be passed by default', async () => {
    await makeFastify(mockPlugin);

    expect(mockMakeLogger).toHaveBeenCalledWith();
    const logger = getMockContext(mockMakeLogger).results[0].value;
    expect(fastify).toHaveBeenCalledWith(expect.objectContaining({ logger }));
    expect(mockExitHandler).toHaveBeenCalledWith(logger);
  });

  test('Any explicit logger should be honored', async () => {
    const logger = pino();

    await makeFastify(mockPlugin, logger);

    expect(fastify).toHaveBeenCalledWith(expect.objectContaining({ logger }));
    expect(mockExitHandler).toHaveBeenCalledWith(logger);
  });

  test('It should wait for the Fastify server to be ready', async () => {
    await makeFastify(mockPlugin);

    expect(mockReady).toHaveBeenCalledTimes(1);
  });

  test('Specified plugin should be registered', async () => {
    await makeFastify(mockPlugin);

    expect(mockFastify.register).toHaveBeenCalledWith(mockPlugin);
  });

  test('Server instance should be returned', async () => {
    const serverInstance = await makeFastify(mockPlugin);

    expect(serverInstance).toBe(mockFastify);
  });

  test('X-Request-Id should be the default request id header', async () => {
    await makeFastify(mockPlugin);

    const [[fastifyCallArguments]] = getMockContext(fastify).calls;
    expect(fastifyCallArguments).toHaveProperty('requestIdHeader', 'x-request-id');
  });

  test('Custom request id header can be set via REQUEST_ID_HEADER variable', async () => {
    const requestIdHeader = 'X-Id';
    mockEnvVars({ REQUEST_ID_HEADER: requestIdHeader });

    await makeFastify(mockPlugin);

    const [[fastifyCallArguments]] = getMockInstance(fastify).mock.calls;
    expect(fastifyCallArguments).toHaveProperty('requestIdHeader', requestIdHeader.toLowerCase());
  });

  test('Proxy request headers should be trusted', async () => {
    await makeFastify(mockPlugin);

    const [[fastifyCallArguments]] = getMockContext(fastify).calls;
    expect(fastifyCallArguments).toHaveProperty('trustProxy', true);
  });

  test('fastifyMongoose plugin should be configured', async () => {
    await makeFastify(mockPlugin);

    expect(mockFastify.register).toHaveBeenCalledWith(fastifyMongoose);
  });

  test('notFoundHandler plugin should be configured', async () => {
    await makeFastify(mockPlugin);

    expect(mockFastify.register).toHaveBeenCalledWith(notFoundHandler);
  });
});

describe('runFastify', () => {
  test('Server returned by makeFastify() should be used', async () => {
    await runFastify(mockFastify);

    expect(mockListen).toHaveBeenCalledTimes(1);
  });

  test('Server should listen on port 8080', async () => {
    await runFastify(mockFastify);

    const [[listenCallArguments]] = getMockContext(mockListen).calls;
    expect(listenCallArguments).toHaveProperty('port', 8080);
  });

  test('Server should listen on 0.0.0.0', async () => {
    await runFastify(mockFastify);

    expect(mockListen).toHaveBeenCalledTimes(1);
    const [[listenCallArguments]] = getMockContext(mockListen).calls;
    expect(listenCallArguments).toHaveProperty('host', '0.0.0.0');
  });

  test('listen() call should be "awaited" for', async () => {
    const error = new Error('Denied');
    mockListen.mockImplementation(() => {
      throw error;
    });

    await expect(runFastify(mockFastify)).rejects.toStrictEqual(error);
  });
});
