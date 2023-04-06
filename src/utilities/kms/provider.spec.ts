import { jest } from '@jest/globals';
import envVar from 'env-var';

import { configureMockEnvVars } from '../../testUtils/envVars.js';
import { getMockInstance } from '../../testUtils/jest.js';

jest.unstable_mockModule('@relaycorp/webcrypto-kms', () => ({
  initKmsProviderFromEnv: jest.fn<any>(),
}));
const { initKmsProviderFromEnv } = await import('@relaycorp/webcrypto-kms');
const { clearProviderForTesting, getKmsProvider } = await import('./provider.js');

const mockKmsProvider = Symbol('Mock KMS provider');
beforeEach(() => {
  const mockInitProvider = getMockInstance(initKmsProviderFromEnv);
  mockInitProvider.mockReset();
  mockInitProvider.mockResolvedValue(mockKmsProvider);

  clearProviderForTesting();
});

describe('getKmsProvider', () => {
  const kmsAdapter = 'adapter name';

  const mockEnvVars = configureMockEnvVars({ KMS_ADAPTER: kmsAdapter });

  test('KMS_ADAPTER should be defined', async () => {
    mockEnvVars({});

    await expect(getKmsProvider()).rejects.toThrowWithMessage(envVar.EnvVarError, /KMS_ADAPTER/u);
  });

  test('Specified KMS_ADAPTER should be used', async () => {
    await getKmsProvider();

    expect(initKmsProviderFromEnv).toHaveBeenCalledWith(kmsAdapter);
  });

  test('Provider should be returned', async () => {
    const provider = await getKmsProvider();

    expect(provider).toBe(mockKmsProvider);
  });

  test('Provider should be cached', async () => {
    const provider1 = await getKmsProvider();
    const provider2 = await getKmsProvider();

    expect(provider1).toBe(provider2);
    expect(initKmsProviderFromEnv).toHaveBeenCalledTimes(1);
  });
});
