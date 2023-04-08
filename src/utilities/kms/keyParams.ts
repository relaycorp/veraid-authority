const F4_ARRAY = new Uint8Array([1, 0, 1]);

export const RSA_PSS_IMPORT_ALGORITHM: RsaHashedImportParams = {
  name: 'RSA-PSS',
  hash: { name: 'SHA-256' },
};
export const RSA_PSS_CREATION_ALGORITHM: RsaHashedKeyGenParams = {
  ...RSA_PSS_IMPORT_ALGORITHM,
  modulusLength: 2048,
  publicExponent: F4_ARRAY,
};
export const KEY_USAGES: KeyUsage[] = ['sign', 'verify'];
