import { generateKeyPair } from 'node:crypto';
import { promisify } from 'node:util';

const generateKeyPairAsync = promisify(generateKeyPair);
export const generatePublicKey = async () => {
  const { publicKey } = await generateKeyPairAsync('rsa-pss', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },

    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });
  return publicKey.toString();
};
