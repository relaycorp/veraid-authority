import { jest } from '@jest/globals';
import type { KmsRsaPssProvider } from '@relaycorp/webcrypto-kms';

import { MockKmsRsaPssProvider } from '../../testUtils/MockKmsRsaPssProvider.js';
import { getMockContext } from '../../testUtils/jest.js';

jest.unstable_mockModule('./provider.js', () => ({
  getKmsProvider: jest.fn(() => new MockKmsRsaPssProvider()),
}));
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Kms } = await import('./Kms.js');
const { getKmsProvider } = await import('./provider.js');

const F4 = 65_537;

async function rawExportKey(key: CryptoKey, provider: MockKmsRsaPssProvider): Promise<Buffer> {
  const exportedKey = (await provider.exportKey('raw', key)) as ArrayBuffer;
  return Buffer.from(exportedKey);
}

describe('Kms', () => {
  describe('generateKey', () => {
    test('RSA algorithm should use PSS padding', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKey();

      expect(privateKey.algorithm.name).toBe('RSA-PSS');
    });

    test('Hash algorithm should be SHA-256', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKey();

      expect(privateKey.algorithm).toHaveProperty('hash.name', 'SHA-256');
    });

    test('Modulus length should be 2048', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKey();

      expect(privateKey.algorithm).toHaveProperty('modulusLength', 2048);
    });

    test('Public exponent should be F4 (65537)', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKey();

      const publicExponentArray = (privateKey.algorithm as RsaHashedKeyGenParams).publicExponent;
      const publicExponent = Buffer.from(publicExponentArray).readIntBE(
        0,
        publicExponentArray.length,
      );
      expect(publicExponent).toBe(F4);
    });

    test('Key should be extractable', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey } = await kms.generateKey();

      expect(privateKey.extractable).toBeTrue();
    });

    test('Key pair usages should only allow signing and verifying', async () => {
      const kms = new Kms(new MockKmsRsaPssProvider());

      const { privateKey, publicKey } = await kms.generateKey();

      expect(privateKey.usages).toStrictEqual(['sign']);
      expect(publicKey.usages).toStrictEqual(['verify']);
    });
  });

  describe('destroyKey', () => {
    test('Specified key should be destroyed', async () => {
      const provider = new MockKmsRsaPssProvider();
      const kms = new Kms(provider);
      const { privateKey } = await kms.generateKey();

      await kms.destroyKey(privateKey);

      expect(provider.destroyKey).toHaveBeenCalledWith(privateKey);
    });
  });

  describe('getKeyRef', () => {
    test('Specified key should be exported as raw', async () => {
      const provider = new MockKmsRsaPssProvider();
      const kms = new Kms(provider);
      const { privateKey } = await kms.generateKey();

      const keyRef = await kms.getKeyRef(privateKey);

      const keySerialisation = await rawExportKey(privateKey, provider);
      expect(keyRef).toStrictEqual(keySerialisation);
    });
  });

  describe('retrieveKeyByRef', () => {
    test('Specified key should be imported as raw', async () => {
      const provider = new MockKmsRsaPssProvider();
      const kms = new Kms(provider);
      const { privateKey } = await kms.generateKey();
      const keyRef = await kms.getKeyRef(privateKey);

      const retrievedKey = await kms.retrieveKeyByRef(keyRef);

      const originalKeySerialised = await rawExportKey(privateKey, provider);
      const retrievedKeySerialised = await rawExportKey(retrievedKey, provider);
      expect(retrievedKeySerialised).toStrictEqual(originalKeySerialised);
    });
  });

  describe('init', () => {
    test('Global provider should be passed to KMS', async () => {
      const kms = await Kms.init();

      expect(getKmsProvider).toHaveBeenCalledOnce();
      const provider = getMockContext(getKmsProvider).results[0].value as KmsRsaPssProvider;
      const generateKeySpy = jest.spyOn(provider, 'generateKey');
      await kms.generateKey();
      expect(generateKeySpy).toHaveBeenCalledOnce();
    });
  });
});
