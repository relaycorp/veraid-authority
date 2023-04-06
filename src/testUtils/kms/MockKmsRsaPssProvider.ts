import { KmsRsaPssProvider } from '@relaycorp/webcrypto-kms';
import { jest } from '@jest/globals';

import { NODEJS_PROVIDER } from '../webcrypto.js';

type SupportedFormat = Exclude<KeyFormat, 'jwk'>;

function getFinalFormat(format: SupportedFormat): SupportedFormat {
  return format === 'raw' ? 'pkcs8' : format;
}

export class MockKmsRsaPssProvider extends KmsRsaPssProvider {
  public readonly close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

  public readonly destroyKey = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

  public async onSign(
    algorithm: RsaPssParams,
    key: CryptoKey,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    return NODEJS_PROVIDER.sign(algorithm, key, data);
  }

  public async onVerify(
    algorithm: RsaPssParams,
    key: CryptoKey,
    signature: ArrayBuffer,
    data: ArrayBuffer,
  ): Promise<boolean> {
    return NODEJS_PROVIDER.verify(algorithm, key, signature, data);
  }

  public async onGenerateKey(
    algorithm: RsaHashedKeyGenParams,
    isExtractable: boolean,
    keyUsages: KeyUsage[],
  ): Promise<CryptoKeyPair> {
    return NODEJS_PROVIDER.generateKey(algorithm, isExtractable, keyUsages);
  }

  public async onExportKey(format: SupportedFormat, key: CryptoKey): Promise<ArrayBuffer> {
    const finalFormat = getFinalFormat(format);
    return NODEJS_PROVIDER.exportKey(finalFormat, key);
  }

  public async onImportKey(
    format: SupportedFormat,
    keyData: ArrayBuffer,
    algorithm: RsaHashedImportParams,
    isExtractable: boolean,
    keyUsages: KeyUsage[],
  ): Promise<CryptoKey> {
    const finalFormat = getFinalFormat(format);
    return NODEJS_PROVIDER.importKey(finalFormat, keyData, algorithm, isExtractable, keyUsages);
  }
}
