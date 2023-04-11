import { jest } from '@jest/globals';
import envVar from 'env-var';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fastifyOauth2Verify from 'fastify-auth0-verify';
import pino from 'pino';

import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../testUtils/envVars.js';
import { OAUTH2_JWKS_URL, OAUTH2_TOKEN_AUDIENCE, OAUTH2_TOKEN_ISSUER } from '../testUtils/authn.js';
import { getMockContext, mockSpy } from '../testUtils/jest.js';

const mockFastify = Symbol('Mock server');
jest.unstable_mockModule('../utilities/fastify/server.js', () => ({
  makeFastify: jest.fn<() => Promise<any>>().mockResolvedValue(mockFastify),
}));

const mockMakeLogger = jest.fn().mockReturnValue({});
jest.unstable_mockModule('../utilities/logging.js', () => ({ makeLogger: mockMakeLogger }));

const mockEnvVars = configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);

const { makeServer } = await import('./server.js');
const { makeFastify } = await import('../utilities/fastify/server.js');

afterAll(() => {
  jest.restoreAllMocks();
});

describe('makeServer', () => {
  test('No logger should be passed by default', async () => {
    await makeServer();

    expect(makeFastify).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  test('Any explicit logger should be honored', async () => {
    const logger = pino();

    await makeServer(logger);

    expect(makeFastify).toHaveBeenCalledWith(expect.anything(), logger);
  });

  test('Server instance should be returned', async () => {
    const serverInstance = await makeServer();

    expect(serverInstance).toBe(mockFastify);
  });

  describe('OAuth2 plugin', () => {
    const mockFastifySubcontext: FastifyInstance = {
      register: mockSpy(jest.fn()),
    } as any;

    async function runAppPlugin(): Promise<void> {
      const [plugin] = getMockContext(makeFastify).lastCall as [FastifyPluginAsync];
      await plugin(mockFastifySubcontext, {});
    }

    test('OAUTH2_JWKS_URL should be defined', async () => {
      mockEnvVars({ ...REQUIRED_SERVER_ENV_VARS, OAUTH2_JWKS_URL: undefined });
      await makeServer();

      await expect(runAppPlugin).rejects.toThrowWithMessage(envVar.EnvVarError, /OAUTH2_JWKS_URL/u);
    });

    test('OAUTH2_JWKS_URL should be used as the domain', async () => {
      await makeServer();

      await runAppPlugin();

      expect(mockFastifySubcontext.register).toHaveBeenCalledWith(
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
      await makeServer();

      await expect(runAppPlugin()).rejects.toThrowWithMessage(
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
      await makeServer();

      await expect(runAppPlugin()).rejects.toThrowWithMessage(
        Error,
        'Either OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set',
      );
    });

    test('Both OAUTH2_TOKEN_ISSUER and OAUTH2_TOKEN_ISSUER_REGEX should not be set', async () => {
      mockEnvVars({
        ...REQUIRED_SERVER_ENV_VARS,
        OAUTH2_TOKEN_ISSUER_REGEX: OAUTH2_TOKEN_ISSUER,
      });
      await makeServer();

      await expect(runAppPlugin()).rejects.toThrowWithMessage(
        Error,
        'Either OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set',
      );
    });

    test('OAUTH2_TOKEN_ISSUER should be used as the issuer if set', async () => {
      await makeServer();

      await runAppPlugin();

      expect(mockFastifySubcontext.register).toHaveBeenCalledWith(
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
      await makeServer();

      await expect(runAppPlugin()).rejects.toThrowWithMessage(
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
      await makeServer();

      await runAppPlugin();

      expect(mockFastifySubcontext.register).toHaveBeenCalledWith(
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
      await makeServer();

      await expect(runAppPlugin()).rejects.toThrowWithMessage(
        envVar.EnvVarError,
        /OAUTH2_TOKEN_ISSUER_REGEX/u,
      );
    });

    test('OAUTH2_TOKEN_AUDIENCE should be defined', async () => {
      await makeServer();

      mockEnvVars({ ...REQUIRED_SERVER_ENV_VARS, OAUTH2_TOKEN_AUDIENCE: undefined });

      await expect(runAppPlugin()).rejects.toThrowWithMessage(
        envVar.EnvVarError,
        /OAUTH2_TOKEN_AUDIENCE/u,
      );
    });

    test('OAUTH2_TOKEN_AUDIENCE should be used as the audience', async () => {
      await makeServer();

      await runAppPlugin();

      expect(mockFastifySubcontext.register).toHaveBeenCalledWith(
        fastifyOauth2Verify,
        expect.objectContaining({ audience: OAUTH2_TOKEN_AUDIENCE }),
      );
    });
  });
});
