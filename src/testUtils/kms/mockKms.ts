import { jest } from '@jest/globals';
import { Kms } from '../../utilities/kms/Kms.js';
import { MockKmsRsaPssProvider } from './MockKmsRsaPssProvider.js';

interface KeyPairRef {
  privateKeyRef: Buffer;
  publicKey: CryptoKey;
}

export class MockKms extends Kms {
  public readonly generatedKeyPairRefs: KeyPairRef[] = [];

  public readonly destroyedPrivateKeyRefs: Buffer[] = [];

  public constructor() {
    super(new MockKmsRsaPssProvider());
  }

  public override async generateKeyPair(): Promise<CryptoKeyPair> {
    const keyPair = await super.generateKeyPair();

    const privateKeyRef = await this.getPrivateKeyRef(keyPair.privateKey);
    this.generatedKeyPairRefs.push({ privateKeyRef, publicKey: keyPair.publicKey });

    return keyPair;
  }

  public override async destroyPrivateKey(key: CryptoKey): Promise<void> {
    await super.destroyPrivateKey(key);

    const keyRef = await this.getPrivateKeyRef(key);
    this.destroyedPrivateKeyRefs.push(keyRef);
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
