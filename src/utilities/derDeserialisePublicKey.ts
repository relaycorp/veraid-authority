import { Crypto } from '@peculiar/webcrypto';
import { RSA_PSS_IMPORT_ALGORITHM } from './kms/keyParams.js';
const NODEJS_PROVIDER = new Crypto().subtle;

export async function derDeserializePublicKey(key: Buffer): Promise<CryptoKey> {
  return NODEJS_PROVIDER.importKey('spki', key, RSA_PSS_IMPORT_ALGORITHM, true, ['verify']);
}
