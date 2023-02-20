import { jest } from '@jest/globals';
import env from 'env-var';

import { configureMockEnvVars as configureMockEnvironmentVariables } from '../testUtils/envVars.js';
import { mockSpy } from '../testUtils/jest.js';

const MOCK_MONGOOSE_CONNECTION = { model: { bind: mockSpy(jest.fn()) } } as any as Connection;
const MOCK_MONGOOSE_CREATE_CONNECTION = mockSpy(
  jest.fn().mockReturnValue({ asPromise: () => MOCK_MONGOOSE_CONNECTION }),
);
jest.unstable_mockModule('mongoose', () => ({
  createConnection: MOCK_MONGOOSE_CREATE_CONNECTION,
}));
import type { Connection } from 'mongoose';
import { createConnectionFromEnvironment } from './mongo.js';

const MONGO_ENV_VARS = {
  MONGO_DB: 'the_db',
  MONGO_PASSWORD: 'letmein',
  MONGO_URI: 'mongodb://example.com',
  MONGO_USER: 'alicia',
};
const mockEnvironmentVariables = configureMockEnvironmentVariables(MONGO_ENV_VARS);

describe('createMongooseConnectionFromEnv', () => {
  test.each(Object.getOwnPropertyNames(MONGO_ENV_VARS))(
    'Environment variable %s should be present',
    async (environmentVariableName) => {
      mockEnvironmentVariables({ ...MONGO_ENV_VARS, [environmentVariableName]: undefined });

      await expect(createConnectionFromEnvironment()).rejects.toBeInstanceOf(env.EnvVarError);
    },
  );

  test('Connection should use MONGO_URI', async () => {
    await createConnectionFromEnvironment();

    expect(MOCK_MONGOOSE_CREATE_CONNECTION).toHaveBeenCalledWith(
      MONGO_ENV_VARS.MONGO_URI,
      expect.anything(),
    );
  });

  test('Connection should use MONGO_DB', async () => {
    await createConnectionFromEnvironment();

    expect(MOCK_MONGOOSE_CREATE_CONNECTION).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dbName: MONGO_ENV_VARS.MONGO_DB }),
    );
  });

  test('Connection should use MONGO_USER', async () => {
    await createConnectionFromEnvironment();

    expect(MOCK_MONGOOSE_CREATE_CONNECTION).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user: MONGO_ENV_VARS.MONGO_USER }),
    );
  });

  test('Connection should use MONGO_PASSWORD', async () => {
    await createConnectionFromEnvironment();

    expect(MOCK_MONGOOSE_CREATE_CONNECTION).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pass: MONGO_ENV_VARS.MONGO_PASSWORD }),
    );
  });

  test('Mongoose connection should be returned', async () => {
    const connection = await createConnectionFromEnvironment();

    expect(connection).toBe(MOCK_MONGOOSE_CONNECTION);
  });
});
