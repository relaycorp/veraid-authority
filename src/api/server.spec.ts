import { jest } from '@jest/globals';
import pino from 'pino';

import { configureMockEnvVars } from '../testUtils/envVars.js';

const mockFastify = Symbol('Mock server');
jest.unstable_mockModule('../utilities/fastify/server.js', () => ({
  makeFastify: jest.fn<() => Promise<any>>().mockResolvedValue(mockFastify),
}));

const mockMakeLogger = jest.fn().mockReturnValue({});
jest.unstable_mockModule('../utilities/logging.js', () => ({ makeLogger: mockMakeLogger }));

const { makeApiServer } = await import('./server.js');
const { makeFastify } = await import('../utilities/fastify/server.js');
const { REQUIRED_API_ENV_VARS } = await import('../testUtils/apiServer.js');

configureMockEnvVars(REQUIRED_API_ENV_VARS);

afterAll(() => {
  jest.restoreAllMocks();
});

describe('makeApiServer', () => {
  test('No logger should be passed by default', async () => {
    await makeApiServer();

    expect(makeFastify).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  test('Any explicit logger should be honored', async () => {
    const logger = pino();

    await makeApiServer(logger);

    expect(makeFastify).toHaveBeenCalledWith(expect.anything(), logger);
  });

  test('Server instance should be returned', async () => {
    const serverInstance = await makeApiServer();

    expect(serverInstance).toBe(mockFastify);
  });
});
