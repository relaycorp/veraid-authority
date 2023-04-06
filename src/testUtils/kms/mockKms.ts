import { jest } from '@jest/globals';

import { Kms } from '../../utilities/kms/Kms.js';

import { MockKmsRsaPssProvider } from './MockKmsRsaPssProvider.js';

class MockKms extends Kms {
  public readonly generatedKeyPairs: CryptoKeyPair[] = [];

  public readonly destroyedPrivateKeys: CryptoKey[] = [];

  public constructor() {
    super(new MockKmsRsaPssProvider());
  }

  public override async generateKeyPair(): Promise<CryptoKeyPair> {
    const keyPair = await super.generateKeyPair();
    this.generatedKeyPairs.push(keyPair);
    return keyPair;
  }

  public override async destroyPrivateKey(key: CryptoKey): Promise<void> {
    await super.destroyPrivateKey(key);
    this.destroyedPrivateKeys.push(key);
  }
}

export function mockKms(): () => MockKms {
  const initMock = jest.spyOn(Kms, 'init');

  let mock: MockKms;
  beforeEach(() => {
    mock = new MockKms();
    initMock.mockResolvedValue(mock);
  });

  afterAll(() => {
    initMock.mockRestore();
  });

  return () => mock;
}
