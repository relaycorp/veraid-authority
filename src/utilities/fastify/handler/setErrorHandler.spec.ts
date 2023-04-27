import { jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

import fastifyRoutes from '@fastify/routes';
import { makeMockLogging, partialPinoLog } from '../../../testUtils/logging.js';
import { HTTP_STATUS_CODES } from '../../http.js';
import { configureMockEnvVars } from '../../../testUtils/envVars.js';

import { fastify } from 'fastify';
import setErrorHandler from './setErrorHandler.js';

describe('set Error Handler', () => {
  const mockLogging = makeMockLogging();
  configureMockEnvVars();
  let serverInstance: FastifyInstance;
  beforeEach(async () => {
    serverInstance = fastify({
      logger: mockLogging.logger,
    });
    await serverInstance.register(fastifyRoutes);
    setErrorHandler(serverInstance);
  })

  test('Thrown error should be handled gracefully and logged', async () => {
    serverInstance.route({
      method: ['POST'],
      url: '/5xx',

      handler(): void {
        throw new Error('ERROR_MESSAGE');
      },
    });
    serverInstance.ready();

    const response = await serverInstance.inject({ method: 'POST', url: '/5xx' });

    expect(response.headers['content-type']).toStartWith('text/plain');
    expect(response.body).toBe('Internal server error');
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('error', 'Internal server error', {
        err: expect.objectContaining({
          message: 'ERROR_MESSAGE',
          stack: expect.toStartWith('Error: '),
        }),
      }),
    );
    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
  });

  test('Client error should be logged', async () => {
    serverInstance.route({
      method: ['POST'],
      url: '/4xx',

      schema: {
        body: {
          type: 'object',

          properties: {
            test: { type: 'string' },
          },

          required: ['test'],
        } as const,
      },

      handler: jest.fn(),
    });

    const response = await serverInstance.inject({
      method: 'POST',
      url: '/4xx',
      payload: {},
    });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'Client error', {
        err: expect.objectContaining({
          message: "body must have required property 'test'",
          stack: expect.toStartWith('Error: '),
        }),
      }),
    );
  });
});
