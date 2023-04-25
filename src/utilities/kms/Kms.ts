import type { KmsRsaPssProvider } from '@relaycorp/webcrypto-kms';

import { bufferToArrayBuffer } from '../buffer.js';

import { getKmsProvider } from './provider.js';
import { KEY_USAGES, RSA_PSS_CREATION_ALGORITHM, RSA_PSS_IMPORT_ALGORITHM } from './keyParams.js';

export class Kms {
  public static async init(): Promise<Kms> {
    const provider = await getKmsProvider();
    return new Kms(provider);
  }

  public constructor(protected readonly provider: KmsRsaPssProvider) {}

  public async generateKeyPair(): Promise<CryptoKeyPair> {
    return this.provider.generateKey(RSA_PSS_CREATION_ALGORITHM, true, KEY_USAGES);
  }

  public async destroyPrivateKey(key: CryptoKey): Promise<void> {
    return this.provider.destroyKey(key);
  }

  public async getPrivateKeyRef(key: CryptoKey): Promise<Buffer> {
    const keyRaw = (await this.provider.exportKey('raw', key)) as ArrayBuffer;
    return Buffer.from(keyRaw);
  }

  public async retrievePrivateKeyByRef(ref: Buffer): Promise<CryptoKey> {
    const keyRaw = bufferToArrayBuffer(ref);
    return this.provider.importKey('raw', keyRaw, RSA_PSS_IMPORT_ALGORITHM, true, KEY_USAGES);
  }
}
