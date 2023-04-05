import { generateKeyPair } from 'node:crypto';
import { promisify } from 'node:util';


const generateKeyPairAsync = promisify(generateKeyPair);

const { publicKey } = await generateKeyPairAsync('rsa-pss', {
  modulusLength: 2048,
  publicKeyEncoding: {type: 'spki', format: 'der'},
});

console.log("asdasd");
