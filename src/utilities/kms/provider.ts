import { initKmsProviderFromEnv, type KmsRsaPssProvider } from '@relaycorp/webcrypto-kms';
import envVar from 'env-var';

let cachedProvider: KmsRsaPssProvider | undefined;

/**
 * Get the KMS provider and cache it.
 *
 * We want to cache the provider because it's expensive to initialise (the underlying SDK will
 * make non-blocking calls to the cloud provider's API) and it's safe to use concurrently.
 *
 * Note that we don't care if a race condition causes multiple providers to be initialised
 * concurrently but only one is persisted, as the worst that could happen is that some API calls
 * would've been made for nothing. This can only happen when the process has just been started
 * and multiple requests are received at the same time.
 */
export async function getKmsProvider(): Promise<KmsRsaPssProvider> {
  const adapter = envVar.get('KMS_ADAPTER').required().asString();
  // eslint-disable-next-line require-atomic-updates
  cachedProvider ??= await initKmsProviderFromEnv(adapter);
  return cachedProvider;
}

/**
 * Clear the cached provider.
 *
 * **To be used between unit tests only.**
 */
export function clearProviderForTesting(): void {
  cachedProvider = undefined;
}
