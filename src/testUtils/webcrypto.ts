import { Crypto } from '@peculiar/webcrypto';

import { KEY_USAGES, RSA_PSS_CREATION_ALGORITHM } from '../utilities/kms/keyParams.js';

export const NODEJS_PROVIDER = new Crypto().subtle;

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return NODEJS_PROVIDER.generateKey(RSA_PSS_CREATION_ALGORITHM, true, KEY_USAGES);
}
