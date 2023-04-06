import { jest } from '@jest/globals';
import env from 'env-var';
import { symbols as pinoSymbols } from 'pino';

import { configureMockEnvVars as configureMockEnvironmentVariables } from '../testUtils/envVars.js';
import { getMockInstance } from '../testUtils/jest.js';

const REQUIRED_ENV_VARS = {
  AUTHORITY_VERSION: '1.0.1',
};
const mockEnvironmentVariables = configureMockEnvironmentVariables(REQUIRED_ENV_VARS);

jest.unstable_mockModule('@relaycorp/pino-cloud', () => ({
  getPinoOptions: jest.fn().mockReturnValue({}),
}));
const { getPinoOptions } = await import('@relaycorp/pino-cloud');
const { makeLogger } = await import('./logging.js');

describe('makeLogger', () => {
  test('Log level should be info if LOG_LEVEL env var is absent', () => {
    mockEnvironmentVariables(REQUIRED_ENV_VARS);

    const logger = makeLogger();

    expect(logger).toHaveProperty('level', 'info');
  });

  test('Log level in LOG_LEVEL env var should be honoured if present', () => {
    const loglevel = 'debug';
    mockEnvironmentVariables({ ...REQUIRED_ENV_VARS, LOG_LEVEL: loglevel });

    const logger = makeLogger();

    expect(logger).toHaveProperty('level', loglevel);
  });

  test('Log level in LOG_LEVEL env var should be lower-cased if present', () => {
    const loglevel = 'DEBUG';
    mockEnvironmentVariables({ ...REQUIRED_ENV_VARS, LOG_LEVEL: loglevel });

    const logger = makeLogger();

    expect(logger).toHaveProperty('level', loglevel.toLowerCase());
  });

  test('AUTHORITY_VERSION env var should be required', () => {
    mockEnvironmentVariables({ ...REQUIRED_ENV_VARS, AUTHORITY_VERSION: undefined });

    expect(() => makeLogger()).toThrowWithMessage(env.EnvVarError, /AUTHORITY_VERSION/u);
  });

  test('Cloud logging options should be used', () => {
    const messageKey = 'foo';
    getMockInstance(getPinoOptions).mockReturnValue({ messageKey });
    const logger = makeLogger();

    expect(logger).toHaveProperty([pinoSymbols.messageKeySym], messageKey);
  });

  test('App name should be set to LOG_ENV_NAME if present', () => {
    const environmentName = 'env-name';
    mockEnvironmentVariables({ ...REQUIRED_ENV_VARS, LOG_ENV_NAME: environmentName });
    makeLogger();

    expect(getPinoOptions).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ name: environmentName }),
    );
  });

  test('App name should be "veraid-authority" if LOG_ENV_NAME if absent', () => {
    makeLogger();

    expect(getPinoOptions).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ name: 'veraid-authority' }),
    );
  });

  test('AUTHORITY_VERSION should be passed to cloud logging config', () => {
    makeLogger();

    expect(getPinoOptions).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        version: REQUIRED_ENV_VARS.AUTHORITY_VERSION,
      }),
    );
  });

  test('LOG_TARGET env var should be honoured if present', () => {
    const loggingTarget = 'the-logging-target';
    mockEnvironmentVariables({ ...REQUIRED_ENV_VARS, LOG_TARGET: loggingTarget });

    makeLogger();

    expect(getPinoOptions).toHaveBeenCalledWith(loggingTarget, expect.anything());
  });

  test('Logging target should be unset if LOG_TARGET env var is absent', () => {
    makeLogger();

    expect(getPinoOptions).toHaveBeenCalledWith(undefined, expect.anything());
  });
});
