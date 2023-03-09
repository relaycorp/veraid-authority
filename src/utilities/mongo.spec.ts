import { jest } from '@jest/globals';
import envVar from 'env-var';

import { configureMockEnvVars } from '../testUtils/envVars.js';
import { mockSpy } from '../testUtils/jest.js';

const MOCK_MONGOOSE_CONNECTION = { model: { bind: mockSpy(jest.fn()) } } as any;
const MOCK_MONGOOSE_CREATE_CONNECTION = jest.fn().mockReturnValue({
  asPromise: jest.fn<() => Promise<any>>().mockResolvedValue(MOCK_MONGOOSE_CONNECTION),
});
jest.unstable_mockModule('mongoose', () => ({
  createConnection: MOCK_MONGOOSE_CREATE_CONNECTION,
}));
const { createMongooseConnectionFromEnv } = await import('./mongo.js');

const MONGO_ENV_VARS = {
  MONGODB_URI: 'mongodb://example.com',
};
const mockEnvVars = configureMockEnvVars(MONGO_ENV_VARS);

describe('createMongooseConnectionFromEnv', () => {
  test.each(Object.getOwnPropertyNames(MONGO_ENV_VARS))(
    'Environment variable %s should be present',
    async (envVarName) => {
      mockEnvVars({ ...MONGO_ENV_VARS, [envVarName]: undefined });

      await expect(createMongooseConnectionFromEnv()).rejects.toBeInstanceOf(envVar.EnvVarError);
    },
  );

  test('Connection should use MONGODB_URI', async () => {
    await createMongooseConnectionFromEnv();

    expect(MOCK_MONGOOSE_CREATE_CONNECTION).toHaveBeenCalledWith(MONGO_ENV_VARS.MONGODB_URI);
  });

  test('Mongoose connection should be returned', async () => {
    const connection = await createMongooseConnectionFromEnv();

    expect(connection).toBe(MOCK_MONGOOSE_CONNECTION);
  });
});
