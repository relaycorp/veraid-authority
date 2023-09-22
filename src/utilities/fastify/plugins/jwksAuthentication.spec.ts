import { jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import envVar from 'env-var';
import fastifyJwtJwks from 'fastify-jwt-jwks';

import { mockSpy } from '../../../testUtils/jest.js';
import {
  OAUTH2_JWKS_URL,
  OAUTH2_TOKEN_AUDIENCE,
  OAUTH2_TOKEN_ISSUER,
} from '../../../testUtils/authn.js';
import { configureMockEnvVars } from '../../../testUtils/envVars.js';

import jwksPlugin from './jwksAuthentication.js';

const AUTHN_ENV_VARS = {
  OAUTH2_JWKS_URL,
  OAUTH2_TOKEN_AUDIENCE,
  OAUTH2_TOKEN_ISSUER,
};

const mockEnvVars = configureMockEnvVars(AUTHN_ENV_VARS);

describe('jwks-authentication', () => {
  const mockRegister = mockSpy(jest.fn());
  const mockFastify: FastifyInstance = { register: mockRegister } as any;

  test('OAUTH2_JWKS_URL should be defined', async () => {
    mockEnvVars({ ...AUTHN_ENV_VARS, OAUTH2_JWKS_URL: undefined });

    await expect(jwksPlugin(mockFastify, {})).rejects.toThrowWithMessage(
      envVar.EnvVarError,
      /OAUTH2_JWKS_URL/u,
    );
  });

  test('OAUTH2_JWKS_URL should be honoured', async () => {
    await jwksPlugin(mockFastify, {});

    expect(mockFastify.register).toHaveBeenCalledWith(
      fastifyJwtJwks,
      expect.objectContaining({ jwksUrl: OAUTH2_JWKS_URL }),
    );
  });

  test('OAUTH2_JWKS_URL should be a well-formed URL', async () => {
    const malformedUrl = 'not a url';
    mockEnvVars({
      ...AUTHN_ENV_VARS,
      OAUTH2_JWKS_URL: malformedUrl,
    });

    await expect(jwksPlugin(mockFastify, {})).rejects.toThrowWithMessage(
      envVar.EnvVarError,
      /OAUTH2_JWKS_URL/u,
    );
  });

  test('OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set', async () => {
    mockEnvVars({
      ...AUTHN_ENV_VARS,
      OAUTH2_TOKEN_ISSUER: undefined,
      OAUTH2_TOKEN_ISSUER_REGEX: undefined,
    });

    await expect(jwksPlugin(mockFastify, {})).rejects.toThrowWithMessage(
      Error,
      'Either OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set',
    );
  });

  test('Both OAUTH2_TOKEN_ISSUER and OAUTH2_TOKEN_ISSUER_REGEX should not be set', async () => {
    mockEnvVars({
      ...AUTHN_ENV_VARS,
      OAUTH2_TOKEN_ISSUER_REGEX: OAUTH2_TOKEN_ISSUER,
    });

    await expect(jwksPlugin(mockFastify, {})).rejects.toThrowWithMessage(
      Error,
      'Either OAUTH2_TOKEN_ISSUER or OAUTH2_TOKEN_ISSUER_REGEX should be set',
    );
  });

  test('OAUTH2_TOKEN_ISSUER should be used as the issuer if set', async () => {
    await jwksPlugin(mockFastify, {});

    expect(mockFastify.register).toHaveBeenCalledWith(
      fastifyJwtJwks,
      expect.objectContaining({ issuer: OAUTH2_TOKEN_ISSUER }),
    );
  });

  test('OAUTH2_TOKEN_ISSUER should not have trailing slash appended', async () => {
    const issuer = 'https://idp.example'; // No trailing slash
    mockEnvVars({ ...AUTHN_ENV_VARS, OAUTH2_TOKEN_ISSUER: issuer });

    await jwksPlugin(mockFastify, {});

    expect(mockFastify.register).toHaveBeenCalledWith(
      fastifyJwtJwks,
      expect.objectContaining({ issuer }),
    );
  });

  test('OAUTH2_TOKEN_ISSUER_REGEX should be used as the issuer if set', async () => {
    const issuerRegex = '^this is a regex$';
    mockEnvVars({
      ...AUTHN_ENV_VARS,
      OAUTH2_TOKEN_ISSUER: undefined,
      OAUTH2_TOKEN_ISSUER_REGEX: issuerRegex,
    });

    await jwksPlugin(mockFastify, {});

    expect(mockFastify.register).toHaveBeenCalledWith(
      fastifyJwtJwks,
      expect.objectContaining({ issuer: new RegExp(issuerRegex, 'u') }),
    );
  });

  test('OAUTH2_TOKEN_ISSUER_REGEX should be a well-formed regex', async () => {
    const malformedRegex = '[';
    mockEnvVars({
      ...AUTHN_ENV_VARS,
      OAUTH2_TOKEN_ISSUER: undefined,
      OAUTH2_TOKEN_ISSUER_REGEX: malformedRegex,
    });

    await expect(jwksPlugin(mockFastify, {})).rejects.toThrowWithMessage(
      envVar.EnvVarError,
      /OAUTH2_TOKEN_ISSUER_REGEX/u,
    );
  });

  describe('OAUTH2_TOKEN_AUDIENCE', () => {
    test('should be defined', async () => {
      mockEnvVars({ ...AUTHN_ENV_VARS, OAUTH2_TOKEN_AUDIENCE: undefined });

      await expect(jwksPlugin(mockFastify, {})).rejects.toThrowWithMessage(
        envVar.EnvVarError,
        /OAUTH2_TOKEN_AUDIENCE/u,
      );
    });

    test('should be used as the audience', async () => {
      await jwksPlugin(mockFastify, {});

      const [audience] = OAUTH2_TOKEN_AUDIENCE.split(',');
      expect(mockFastify.register).toHaveBeenCalledWith(
        fastifyJwtJwks,
        expect.objectContaining({ audience: [audience] }),
      );
    });

    test('should be support multiple values', async () => {
      const audiences = ['audience1', 'audience2'];
      mockEnvVars({ ...AUTHN_ENV_VARS, OAUTH2_TOKEN_AUDIENCE: audiences.join(',') });

      await jwksPlugin(mockFastify, {});

      expect(mockFastify.register).toHaveBeenCalledWith(
        fastifyJwtJwks,
        expect.objectContaining({ audience: audiences }),
      );
    });
  });
});
