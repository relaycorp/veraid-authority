import { jest } from '@jest/globals';
import type { KmsRsaPssProvider } from '@relaycorp/webcrypto-kms';

import { getMockContext } from '../../testUtils/jest.js';
import { MockKmsRsaPssProvider } from '../../testUtils/kms/MockKmsRsaPssProvider.js';

jest.unstable_mockModule('./provider.js', () => ({
  getKmsProvider: jest.fn(() => new MockKmsRsaPssProvider()),
}));
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Kms } = await import('./Kms.js');
const { getKmsProvider } = await import('./provider.js');

const F4 = 65_537;

async function pkc8ExportKey(key: CryptoKey, provider: MockKmsRsaPssProvider): Promise<Buffer> {
  const exportedKey = (await provider.exportKey('pkcs8', key)) as ArrayBuffer;
  return Buffer.from(exportedKey);
}

describe('Kms', () => {
  describe('generateKeyPair', () => {
    test('RSA algorithm should use PSS padding', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKeyPair();

      expect(privateKey.algorithm.name).toBe('RSA-PSS');
    });

    test('Hash algorithm should be SHA-256', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKeyPair();

      expect(privateKey.algorithm).toHaveProperty('hash.name', 'SHA-256');
    });

    test('Modulus length should be 2048', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKeyPair();

      expect(privateKey.algorithm).toHaveProperty('modulusLength', 2048);
    });

    test('Public exponent should be F4 (65537)', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKeyPair();

      const publicExponentArray = (privateKey.algorithm as RsaHashedKeyGenParams).publicExponent;
      const publicExponent = Buffer.from(publicExponentArray).readIntBE(
        0,
        publicExponentArray.length,
      );
      expect(publicExponent).toBe(F4);
    });

    test('Key should be extractable', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKeyPair();

      expect(privateKey.extractable).toBeTrue();
    });

    test('Key pair usages should only allow signing and verifying', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey, publicKey } = await kms.generateKeyPair();

      expect(privateKey.usages).toStrictEqual(['sign']);
      expect(publicKey.usages).toStrictEqual(['verify']);
    });
  });

  describe('destroyPrivateKey', () => {
    test('Specified key should be destroyed', async () => {
      const provider = new MockKmsRsaPssProvider();
      const kms = new Kms(provider);
      const { privateKey } = await kms.generateKeyPair();

      await kms.destroyPrivateKey(privateKey);

      expect(provider.destroyKey).toHaveBeenCalledWith(privateKey);
    });
  });

  describe('getPrivateKeyRef', () => {
    test('Specified key should be exported as raw', async () => {
      const provider = new MockKmsRsaPssProvider();
      const kms = new Kms(provider);
      const { privateKey } = await kms.generateKeyPair();

      const keyRef = await kms.getPrivateKeyRef(privateKey);

      const keySerialisation = await pkc8ExportKey(privateKey, provider);
      expect(keyRef).toStrictEqual(keySerialisation);
    });
  });

  describe('retrieveKeyByRef', () => {
    test('Specified key should be imported as raw', async () => {
      const provider = new MockKmsRsaPssProvider();
      const kms = new Kms(provider);
      const { privateKey } = await kms.generateKeyPair();
      const keyRef = await kms.getPrivateKeyRef(privateKey);

      const retrievedKey = await kms.retrievePrivateKeyByRef(keyRef);

      const originalKeySerialised = await pkc8ExportKey(privateKey, provider);
      const retrievedKeySerialised = await pkc8ExportKey(retrievedKey, provider);
      expect(retrievedKeySerialised).toStrictEqual(originalKeySerialised);
    });
  });

  describe('init', () => {
    test('Global provider should be passed to KMS', async () => {
      const kms = await Kms.init();

      expect(getKmsProvider).toHaveBeenCalledOnce();
      const provider = getMockContext(getKmsProvider).results[0].value as KmsRsaPssProvider;
      const generateKeySpy = jest.spyOn(provider, 'generateKey');
      await kms.generateKeyPair();
      expect(generateKeySpy).toHaveBeenCalledOnce();
    });
  });
});
