import { jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

import { errorAppPlugin } from '../../testUtils/errorRoutesApp.js';
import { HTTP_STATUS_CODES } from '../http.js';
import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import { makeMockLogging, type MockLogging, partialPinoLog } from '../../testUtils/logging.js';

const { makeFastify } = await import('./server.js');

afterAll(() => {
  jest.restoreAllMocks();
});

describe('makeFastify - Error handling', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);
  let mockLogging: MockLogging;
  let serverInstance: FastifyInstance;
  beforeEach(async () => {
    mockLogging = makeMockLogging();
    serverInstance = await makeFastify(errorAppPlugin, mockLogging.logger);
  });

  test('Thrown error should be handled gracefully and logged', async () => {
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
