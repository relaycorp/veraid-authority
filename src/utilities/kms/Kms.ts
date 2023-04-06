import type { KmsRsaPssProvider } from '@relaycorp/webcrypto-kms';

import { bufferToArrayBuffer } from '../buffer.js';

import { getKmsProvider } from './provider.js';

const RSA_PSS_IMPORT_ALGORITHM: RsaHashedImportParams = {
  name: 'RSA-PSS',
  hash: { name: 'SHA-256' },
};
const F4_ARRAY = new Uint8Array([1, 0, 1]);
const RSA_PSS_CREATION_ALGORITHM: RsaHashedKeyGenParams = {
  ...RSA_PSS_IMPORT_ALGORITHM,
  modulusLength: 2048,
  publicExponent: F4_ARRAY,
};
const KEY_USAGES: KeyUsage[] = ['sign', 'verify'];

export class Kms {
  public static async init(): Promise<Kms> {
    const provider = await getKmsProvider();
    return new Kms(provider);
  }

  public constructor(protected readonly provider: KmsRsaPssProvider) {}

  public async generateKey(): Promise<CryptoKeyPair> {
    return this.provider.generateKey(RSA_PSS_CREATION_ALGORITHM, true, KEY_USAGES);
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
    return this.provider.importKey('raw', keyRaw, RSA_PSS_IMPORT_ALGORITHM, true, KEY_USAGES);
  }
}
