import { jest } from '@jest/globals';
import pino from 'pino';
import type { FastifyInstance } from 'fastify';

import { mockSpy } from '../testUtils/jest.js';
import { configureMockEnvVars } from '../testUtils/envVars.js';
import { AWALA_MIDDLEWARE_ENDPOINT } from '../testUtils/eventing/stubs.js';


const mockRegisterAwalaRoute = mockSpy(jest.fn());
jest.unstable_mockModule('./routes/awala.routes.js', () => ({
  default: mockRegisterAwalaRoute,
}));

const mockFastify: FastifyInstance = {
  register: mockSpy(jest.fn()),
} as any;
jest.unstable_mockModule('../utilities/fastify/server.js', () => ({
  makeFastify: jest.fn<() => Promise<any>>().mockResolvedValue(mockFastify),
}));



const { makeApiServer, makeApiServerPlugin } = await import('./server.js');
const { makeFastify } = await import('../utilities/fastify/server.js');

describe('makeApiServer', () => {
  const mockEnvVariables = configureMockEnvVars();

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

  test('Existing env variable should register awala routes', async () => {
    mockEnvVariables({ AWALA_MIDDLEWARE_ENDPOINT });

    await makeApiServerPlugin(mockFastify);

    expect(mockFastify.register).toHaveBeenCalledWith(mockRegisterAwalaRoute);
  });

  test('Missing env variable should not register awala routes', async () => {
    mockEnvVariables({ AWALA_MIDDLEWARE_ENDPOINT: undefined });

    await makeApiServerPlugin(mockFastify);

    expect(mockFastify.register).not.toHaveBeenCalledOnceWith(mockRegisterAwalaRoute);
  });

});
