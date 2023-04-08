import { createPublicKey } from 'node:crypto';

import { generateKeyPair, NODEJS_PROVIDER } from '../testUtils/webcrypto.js';

import { derSerialisePublicKey } from './webcrypto.js';

describe('derSerialisePublicKey', () => {
  test('Specified key should be exported as DER', async () => {
    const { publicKey } = await generateKeyPair();

    const publicKeyDer = await derSerialisePublicKey(publicKey);

    const jwkWebCrypto = await NODEJS_PROVIDER.exportKey('jwk', publicKey);
    const publicKeyNodejs = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const jwkNodejs = publicKeyNodejs.export({ format: 'jwk' });
    expect(jwkWebCrypto).toStrictEqual(expect.objectContaining(jwkNodejs));
  });
});
