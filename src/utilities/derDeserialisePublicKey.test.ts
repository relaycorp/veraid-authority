import { derSerialisePublicKey } from './webcrypto.js';
import { generateKeyPair } from '../testUtils/webcrypto.js';
import { Crypto } from '@peculiar/webcrypto';
import { createPublicKey } from 'node:crypto';
import { derDeserializePublicKey } from './derDeserialisePublicKey.js';
const NODEJS_PROVIDER = new Crypto().subtle;

describe('derDeserialisePublicKey', () => {
    test('DER key should be imported', async () => {
        const keyPair = await generateKeyPair();
        const publicKeyDer = await derSerialisePublicKey(keyPair.publicKey);

        const publicKey = await derDeserializePublicKey(publicKeyDer);

        const jwkWebCrypto = await NODEJS_PROVIDER.exportKey('jwk', publicKey);
        const publicKeyNodejs = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
        const jwkNodejs = publicKeyNodejs.export({ format: 'jwk' });
        expect(jwkWebCrypto).toStrictEqual(expect.objectContaining(jwkNodejs));
      });
  });
