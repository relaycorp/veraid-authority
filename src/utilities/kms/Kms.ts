import type { KmsRsaPssProvider } from '@relaycorp/webcrypto-kms';

import { bufferToArrayBuffer } from '../buffer.js';

import { getKmsProvider } from './provider.js';

const HASHING_ALGORITHM_NAME = 'SHA-256';
const HASHING_ALGORITHM: KeyAlgorithm = { name: HASHING_ALGORITHM_NAME };
const RSA_PSS_IMPORT_ALGORITHM: RsaHashedImportParams = {
  name: 'RSA-PSS',
  hash: HASHING_ALGORITHM,
};
const RSA_PSS_CREATION_ALGORITHM: RsaHashedKeyGenParams = {
  ...RSA_PSS_IMPORT_ALGORITHM,
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
};

export class Kms {
  public static async init(): Promise<Kms> {
    const provider = await getKmsProvider();
    return new Kms(provider);
  }

  public constructor(protected readonly provider: KmsRsaPssProvider) {}

  public async generateKey(): Promise<CryptoKeyPair> {
    return this.provider.generateKey(RSA_PSS_CREATION_ALGORITHM, true, ['sign', 'verify']);
  }

  public async destroyKey(key: CryptoKey): Promise<void> {
    return this.provider.destroyKey(key);
  }

  public async getKeyRef(key: CryptoKey): Promise<Buffer> {
    const keyRaw = (await this.provider.exportKey('raw', key)) as ArrayBuffer;
    return Buffer.from(keyRaw);
  }

  public async retrieveKeyByRef(ref: Buffer): Promise<CryptoKey> {
    const keyRaw = bufferToArrayBuffer(ref);
    return this.provider.importKey('raw', keyRaw, RSA_PSS_IMPORT_ALGORITHM, true, [
      'sign',
      'verify',
    ]);
  }
}
