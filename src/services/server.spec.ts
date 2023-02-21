import pino from 'pino';

import { mockSpy } from '../testUtils/jest.js';

import * as fastifyUtils from './fastify.js';
import { makeServer } from './server.js';

jest.mock('../utilities/exitHandling.js');

const mockFastifyInstance = {};
const mockConfigureFastify = mockSpy(
  jest.spyOn(fastifyUtils, 'configureFastify'),
  () => mockFastifyInstance,
);

describe('makeServer', () => {
  test('No logger should be passed by default', async () => {
    await makeServer();

    expect(mockConfigureFastify).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      undefined,
    );
  });

  test('Any explicit logger should be honored', async () => {
    const logger = pino();

    await makeServer(logger);

    expect(mockConfigureFastify).toHaveBeenCalledWith(expect.anything(), expect.anything(), logger);
  });

  test('Fastify instance should be returned', async () => {
    await expect(makeServer()).resolves.toStrictEqual(mockFastifyInstance);
  });
});
