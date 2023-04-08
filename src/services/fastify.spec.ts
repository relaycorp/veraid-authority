import { jest } from '@jest/globals';
import envVar from 'env-var';
import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import fastifyOauth2Verify from 'fastify-auth0-verify';
import pino from 'pino';

import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../testUtils/envVars.js';
import { getMockContext, getMockInstance, mockSpy } from '../testUtils/jest.js';
import { OAUTH2_JWKS_URL, OAUTH2_TOKEN_AUDIENCE, OAUTH2_TOKEN_ISSUER } from '../testUtils/authn.js';

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
jest.unstable_mockModule('../utilities/logging.js', () => ({ makeLogger: mockMakeLogger }));

const mockExitHandler = jest.fn().mockReturnValue({});
jest.unstable_mockModule('../utilities/exitHandling.js', () => ({
  configureExitHandling: mockExitHandler,
}));

const dummyRoutes: FastifyPluginCallback = () => null;
const mockEnvVars = configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);

const { configureFastify, runFastify } = await import('./fastify.js');
const { fastify } = await import('fastify');

afterAll(() => {
  jest.restoreAllMocks();
});

describe('configureFastify', () => {
  test('Logger should be enabled by default', async () => {
    await configureFastify([dummyRoutes]);

    expect(mockMakeLogger).toHaveBeenCalledWith();
    const logger = getMockContext(mockMakeLogger).results[0].value;
    expect(fastify).toHaveBeenCalledWith(expect.objectContaining({ logger }));

    expect(mockExitHandler).toHaveBeenCalledWith(logger);
  });

  test('Custom logger should be honoured', async () => {
    const customLogger = pino();
    await configureFastify([dummyRoutes], undefined, customLogger);

    expect(fastify).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: customLogger,
      }),
    );
    expect(mockExitHandler).toHaveBeenCalledWith(customLogger);
  });

  test('X-Request-Id should be the default request id header', async () => {
    await configureFastify([dummyRoutes]);

    const [[fastifyCallArguments]] = getMockContext(fastify).calls;
    expect(fastifyCallArguments).toHaveProperty('requestIdHeader', 'x-request-id');
  });

  test('Custom request id header can be set via REQUEST_ID_HEADER variable', async () => {
    const requestIdHeader = 'X-Id';
    mockEnvVars({ ...REQUIRED_SERVER_ENV_VARS, REQUEST_ID_HEADER: requestIdHeader });

    await configureFastify([dummyRoutes]);

    const [[fastifyCallArguments]] = getMockInstance(fastify).mock.calls;
    expect(fastifyCallArguments).toHaveProperty('requestIdHeader', requestIdHeader.toLowerCase());
  });

  test('Proxy request headers should be trusted', async () => {
    await configureFastify([dummyRoutes]);

    const [[fastifyCallArguments]] = getMockContext(fastify).calls;
    expect(fastifyCallArguments).toHaveProperty('trustProxy', true);
  });

  test('Routes should be loaded', async () => {
    await configureFastify([dummyRoutes]);

    expect(mockFastify.register).toHaveBeenCalledWith(dummyRoutes, undefined);
  });

  test('Routes should be "awaited" for', async () => {
    const error = new Error('Denied');
    mockRegister.mockImplementation((plugin) => {
      if (plugin === dummyRoutes) {
        throw error;
      }
    });

    await expect(configureFastify([dummyRoutes])).rejects.toStrictEqual(error);
  });

  test('Any route options should be passed when registering the route', async () => {
    const options = { foo: 'oof' };

    await configureFastify([dummyRoutes], options);

    expect(mockFastify.register).toHaveBeenCalledWith(dummyRoutes, options);
  });

  test('It should wait for the Fastify server to be ready', async () => {
    await configureFastify([dummyRoutes]);

    expect(mockReady).toHaveBeenCalledTimes(1);
  });

  test('Server instance should be returned', async () => {
    const serverInstance = await configureFastify([dummyRoutes]);

    expect(serverInstance).toBe(mockFastify);
  });

  describe('OAuth2 plugin', () => {
    test('OAUTH2_JWKS_URL should be defined', async () => {
      mockEnvVars({ ...REQUIRED_SERVER_ENV_VARS, OAUTH2_JWKS_URL: undefined });

      await expect(configureFastify([dummyRoutes])).rejects.toThrowWithMessage(
        envVar.EnvVarError,
        /OAUTH2_JWKS_URL/u,
      );
    });

    test('OAUTH2_JWKS_URL should be used as the domain', async () => {
      await configureFastify([dummyRoutes]);

      expect(mockFastify.register).toHaveBeenCalledWith(
        fastifyOauth2Verify,
        expect.objectContaining({ domain: OAUTH2_JWKS_URL }),
      );
    });

    test('OAUTH2_JWKS_URL should be a well-formed URL', async () => {
      const malformedUrl = 'not a url';
      mockEnvVars({
        ...REQUIRED_SERVER_ENV_VARS,
        OAUTH2_JWKS_URL: malformedUrl,
      });

      await expect(configureFastify([dummyRoutes])).rejects.toThrowWithMessage(
        envVar.EnvVarError,
        /OAUTH2_JWKS_URL/u,
      );
    });

    test('OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set', async () => {
      mockEnvVars({
        ...REQUIRED_SERVER_ENV_VARS,
        OAUTH2_TOKEN_ISSUER: undefined,
        OAUTH2_TOKEN_ISSUER_REGEX: undefined,
      });

      await expect(configureFastify([dummyRoutes])).rejects.toThrowWithMessage(
        Error,
        'Either OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set',
      );
    });

    test('Both OAUTH2_TOKEN_ISSUER and OAUTH2_TOKEN_ISSUER_REGEX should not be set', async () => {
      mockEnvVars({
        ...REQUIRED_SERVER_ENV_VARS,
        OAUTH2_TOKEN_ISSUER_REGEX: OAUTH2_TOKEN_ISSUER,
      });

      await expect(configureFastify([dummyRoutes])).rejects.toThrowWithMessage(
        Error,
        'Either OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set',
      );
    });

    test('OAUTH2_TOKEN_ISSUER should be used as the issuer if set', async () => {
      await configureFastify([dummyRoutes]);

      expect(mockFastify.register).toHaveBeenCalledWith(
        fastifyOauth2Verify,
        expect.objectContaining({ issuer: OAUTH2_TOKEN_ISSUER }),
      );
    });

    test('OAUTH2_TOKEN_ISSUER should be a well-formed URL', async () => {
      const malformedUrl = 'not a url';
      mockEnvVars({
        ...REQUIRED_SERVER_ENV_VARS,
        OAUTH2_TOKEN_ISSUER: malformedUrl,
      });

      await expect(configureFastify([dummyRoutes])).rejects.toThrowWithMessage(
        envVar.EnvVarError,
        /OAUTH2_TOKEN_ISSUER/u,
      );
    });

    test('OAUTH2_TOKEN_ISSUER_REGEX should be used as the issuer if set', async () => {
      const issuerRegex = '^this is a regex$';
      mockEnvVars({
        ...REQUIRED_SERVER_ENV_VARS,
        OAUTH2_TOKEN_ISSUER: undefined,
        OAUTH2_TOKEN_ISSUER_REGEX: issuerRegex,
      });

      await configureFastify([dummyRoutes]);

      expect(mockFastify.register).toHaveBeenCalledWith(
        fastifyOauth2Verify,
        expect.objectContaining({ issuer: new RegExp(issuerRegex, 'u') }),
      );
    });

    test('OAUTH2_TOKEN_ISSUER_REGEX should be a well-formed regex', async () => {
      const malformedRegex = '[';
      mockEnvVars({
        ...REQUIRED_SERVER_ENV_VARS,
        OAUTH2_TOKEN_ISSUER: undefined,
        OAUTH2_TOKEN_ISSUER_REGEX: malformedRegex,
      });

      await expect(configureFastify([dummyRoutes])).rejects.toThrowWithMessage(
        envVar.EnvVarError,
        /OAUTH2_TOKEN_ISSUER_REGEX/u,
      );
    });

    test('OAUTH2_TOKEN_AUDIENCE should be defined', async () => {
      mockEnvVars({ ...REQUIRED_SERVER_ENV_VARS, OAUTH2_TOKEN_AUDIENCE: undefined });

      await expect(configureFastify([dummyRoutes])).rejects.toThrowWithMessage(
        envVar.EnvVarError,
        /OAUTH2_TOKEN_AUDIENCE/u,
      );
    });

    test('OAUTH2_TOKEN_AUDIENCE should be used as the audience', async () => {
      await configureFastify([dummyRoutes]);

      expect(mockFastify.register).toHaveBeenCalledWith(
        fastifyOauth2Verify,
        expect.objectContaining({ audience: OAUTH2_TOKEN_AUDIENCE }),
      );
    });
  });
});

describe('runFastify', () => {
  test('Server returned by makeServer() should be used', async () => {
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
