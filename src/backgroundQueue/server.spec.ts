import { CloudEvent } from 'cloudevents';
import type { FastifyInstance } from 'fastify';
import { jest } from '@jest/globals';
import envVar from 'env-var';

import { setUpTestQueueServer } from '../testUtils/queueServer.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';
import { CE_ID, CE_SOURCE } from '../testUtils/eventing/stubs.js';
import { postEvent } from '../testUtils/eventing/cloudEvents.js';
import { type EnvVarMocker, REQUIRED_ENV_VARS } from '../testUtils/envVars.js';
import { mockSpy } from '../testUtils/jest.js';

import { QueueProblemType } from './QueueProblemType.js';
import { makeQueueServerPlugin } from './server.js';

describe('makeQueueServer', () => {
  const getTestServerFixture = setUpTestQueueServer();
  let server: FastifyInstance;
  let envVarMocker: EnvVarMocker;
  beforeEach(() => {
    ({ server, envVarMocker } = getTestServerFixture());
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
      const mockFastify: FastifyInstance = {
        addContentTypeParser: jest.fn(),
        getDefaultJsonParser: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
      } as any;
      const mockDone = mockSpy(jest.fn());

      test('Valid Awala middleware endpoint in env should call done', () => {
        makeQueueServerPlugin(mockFastify, {}, mockDone);

        expect(mockDone).toHaveBeenCalledOnce();
      });

      test('Missing PoHTTP TLS in env should throw error', () => {
        envVarMocker({ ...REQUIRED_ENV_VARS, POHTTP_TLS_REQUIRED: undefined });

        expect(() => {
          makeQueueServerPlugin(mockFastify, {}, mockDone);
        }).toThrowWithMessage(envVar.EnvVarError, /POHTTP_TLS_REQUIRED/u);
      });

      test('Malformed PoHTTP TLS in env should throw error', () => {
        envVarMocker({ ...REQUIRED_ENV_VARS, POHTTP_TLS_REQUIRED: 'INVALID_URL' });

        expect(() => {
          makeQueueServerPlugin(mockFastify, {}, mockDone);
        }).toThrowWithMessage(envVar.EnvVarError, /POHTTP_TLS_REQUIRED/u);
      });

      test('PoHTTP TLS error should not call done', () => {
        envVarMocker({ ...REQUIRED_ENV_VARS, POHTTP_TLS_REQUIRED: undefined });

        expect(() => {
          makeQueueServerPlugin(mockFastify, {}, mockDone);
        }).toThrow(envVar.EnvVarError);
        expect(mockDone).not.toHaveBeenCalled();
      });
    });
  });
});
