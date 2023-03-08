import { EnvVarError } from 'env-var';
import mongoose, { type Connection } from 'mongoose';

import { configureMockEnvVars } from '../testUtils/envVars.js';
import { mockSpy } from '../testUtils/jest.js';

import { createMongooseConnectionFromEnv } from './mongo.js';

const MOCK_MONGOOSE_CONNECTION = { model: { bind: mockSpy(jest.fn()) } } as any as Connection;
const MOCK_MONGOOSE_CREATE_CONNECTION = mockSpy(
  jest.spyOn(mongoose, 'createConnection'),
  jest.fn().mockReturnValue({ asPromise: () => MOCK_MONGOOSE_CONNECTION }),
);

const MONGO_ENV_VARS = {
  MONGO_URI: 'mongodb://example.com',
};
const mockEnvVars = configureMockEnvVars(MONGO_ENV_VARS);

describe('createMongooseConnectionFromEnv', () => {
  test.each(Object.getOwnPropertyNames(MONGO_ENV_VARS))(
    'Environment variable %s should be present',
    async (envVarName) => {
      mockEnvVars({ ...MONGO_ENV_VARS, [envVarName]: undefined });

      await expect(createMongooseConnectionFromEnv()).rejects.toBeInstanceOf(EnvVarError);
    },
  );

  test('Connection should use MONGO_URI', async () => {
    await createMongooseConnectionFromEnv();

    expect(MOCK_MONGOOSE_CREATE_CONNECTION).toHaveBeenCalledWith(
      MONGO_ENV_VARS.MONGO_URI,
      expect.anything(),
    );
  });

  test('Mongoose connection should be returned', async () => {
    const connection = await createMongooseConnectionFromEnv();

    expect(connection).toBe(MOCK_MONGOOSE_CONNECTION);
  });
});
