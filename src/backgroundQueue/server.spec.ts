import { CloudEvent } from 'cloudevents';
import type { FastifyInstance } from 'fastify';
import { jest } from '@jest/globals';
import envVar from 'env-var';

import { setUpTestQueueServer } from '../testUtils/queueServer.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { CE_ID, CE_SOURCE } from '../testUtils/eventing/stubs.js';
import { postEvent } from '../testUtils/eventing/cloudEvents.js';
import { configureMockEnvVars, REQUIRED_ENV_VARS } from '../testUtils/envVars.js';
import { mockSpy } from '../testUtils/jest.js';

import { QueueProblemType } from './QueueProblemType.js';
import { makeQueueServerPlugin } from './server.js';

describe('makeQueueServer', () => {
  const getTestServerFixture = setUpTestQueueServer();
  let server: FastifyInstance;
  beforeEach(() => {
    ({ server } = getTestServerFixture());
  });

  describe('GET', () => {
    test('Response should be 200 OK', async () => {
      const response = await server.inject({ method: 'GET', url: '/' });

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.OK);
      expect(response.body).toBe('It works');
    });
  });

  describe('POST', () => {
    test('Malformed CloudEvent should be refused', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { 'content-type': 'application/cloudevents+json' },
        payload: 'null',
      });

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', QueueProblemType.INVALID_EVENT);
    });

    test('Unsupported CloudEvent type should be refused', async () => {
      const event = new CloudEvent({
        type: 'net.veraid.invalid',
        id: CE_ID,
        source: CE_SOURCE,
        data: {},
      });

      const response = await postEvent(event, server);

      expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', QueueProblemType.UNSUPPORTED_EVENT);
    });

    describe('makeQueueServerPlugin', () => {
      const setEnvVars = configureMockEnvVars(REQUIRED_ENV_VARS);
      const mockFastify: FastifyInstance = {
        addContentTypeParser: jest.fn(),
        getDefaultJsonParser: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
      } as any;
      const mockDone = mockSpy(jest.fn());

      test('Valid Awala middleware endpoint in env should call done', async () => {
        await makeQueueServerPlugin(mockFastify, {}, mockDone);

        expect(mockDone).toHaveBeenCalledOnce();
      });

      test('Missing Awala middleware endpoint in env should throw error', async () => {
        setEnvVars({ ...REQUIRED_ENV_VARS, AWALA_MIDDLEWARE_ENDPOINT: undefined });

        expect(() => {
          makeQueueServerPlugin(mockFastify, {}, mockDone)}
        ).toThrowWithMessage(
          envVar.EnvVarError,
          /AWALA_MIDDLEWARE_ENDPOINT/u,
        );
      });

      test('Malformed Awala middleware endpoint in env should throw error', async () => {
        setEnvVars({ ...REQUIRED_ENV_VARS, AWALA_MIDDLEWARE_ENDPOINT: 'INVALID_URL' });

        expect(() => {
          makeQueueServerPlugin(mockFastify, {}, mockDone)}
        ).toThrowWithMessage(
          envVar.EnvVarError,
          /AWALA_MIDDLEWARE_ENDPOINT/u,
        );
      });

      test('Awala middleware error should not call done', async () => {
        setEnvVars({ ...REQUIRED_ENV_VARS, AWALA_MIDDLEWARE_ENDPOINT: undefined });

        expect(() => {
          makeQueueServerPlugin(mockFastify, {}, mockDone)}
        ).toThrow();
        expect(mockDone).not.toHaveBeenCalled();
      });


    });
  });
});
