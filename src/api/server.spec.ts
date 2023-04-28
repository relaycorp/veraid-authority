import { jest } from '@jest/globals';
import pino from 'pino';
import { FastifyInstance, RouteOptions } from 'fastify';

import { mockSpy } from '../testUtils/jest.js';
import { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';
import { PluginDone } from '../utilities/fastify/PluginDone.js';
import { configureMockEnvVars, REQUIRED_ENV_VARS } from '../testUtils/envVars.js';
import { AWALA_MIDDLEWARE_ENDPOINT } from '../testUtils/eventing/stubs.js';

const mockFastify = Symbol('Mock server');
jest.unstable_mockModule('../utilities/fastify/server.js', () => ({
  makeFastify: jest.fn<() => Promise<any>>().mockResolvedValue(mockFastify),
}));

const mockRegisterAwalaRoute = mockSpy(jest.fn<(_fastify: FastifyTypedInstance, _opts: RouteOptions, done: PluginDone) => void>().mockImplementation((_fastify: FastifyTypedInstance, _opts: RouteOptions, done: PluginDone) => { done() }));

jest.unstable_mockModule('./routes/awala.routes.js', () => ({
  default: mockRegisterAwalaRoute
}));


const { makeApiServer, makeApiServerPlugin } = await import('./server.js');
const { makeFastify } = await import('../utilities/fastify/server.js');

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

  describe("Awala endpoints", () => {
    const mockEnvVariables = configureMockEnvVars()
    const mockRegister = mockSpy(
      jest.fn(),
    );
    const mockFastify: FastifyInstance = {
      register: mockRegister,
    } as any;


    test('Existing env variable should register awala routes', async() => {
      mockEnvVariables({...REQUIRED_ENV_VARS, AWALA_MIDDLEWARE_ENDPOINT })

      await makeApiServerPlugin(mockFastify);

      expect(mockRegister).toHaveBeenCalledWith(mockRegisterAwalaRoute)
    })

    test('Missing env variable should not register awala routes', async() => {
      mockEnvVariables({...REQUIRED_ENV_VARS, AWALA_MIDDLEWARE_ENDPOINT: undefined })

      await makeApiServerPlugin(mockFastify);

      expect(mockRegister).not.toHaveBeenCalledWith(mockRegisterAwalaRoute)
    })
  })
});
