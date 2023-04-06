import { Crypto } from '@peculiar/webcrypto';

const NODEJS_PROVIDER = new Crypto().subtle;

export async function derSerialisePublicKey(key: CryptoKey): Promise<Buffer> {
  const serialisationArray = await NODEJS_PROVIDER.exportKey('spki', key);
  return Buffer.from(serialisationArray);
}
