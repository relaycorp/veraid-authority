import { jest } from '@jest/globals';
import type { CertificateIssuanceOptions } from '@relaycorp/veraid/build/lib/lib/pki/CertificateIssuanceOptions.js';
import type { Resolver, TrustAnchor } from '@relaycorp/dnssec';

import { mockSpy } from './jest.js';



const mockedModule = {
  issueMemberCertificate:  mockSpy(
    jest.fn<
      (
        memberName: string | undefined,
        memberPublicKey: CryptoKey,
        organisationCertificate: ArrayBuffer,
        organisationPrivateKey: CryptoKey,
        expiryDate: Date,
        options?: Partial<CertificateIssuanceOptions>,
      ) => Promise<ArrayBuffer>
    >(),
  ),
  retrieveVeraDnssecChain:  mockSpy(
    jest.fn<
      (
        domainName: string,
        trustAnchors?: readonly TrustAnchor[],
        resolver?: Resolver,
      ) => Promise<ArrayBuffer>
    >(),
  ),
  selfIssueOrganisationCertificate: mockSpy(
    jest.fn<
      (
        name: string,
        keyPair: CryptoKeyPair,
        expiryDate: Date,
        options?: Partial<CertificateIssuanceOptions>,
      ) => Promise<ArrayBuffer>
    >(),
  ),
  serialiseMemberIdBundle: mockSpy(
    jest.fn<
      (
        memberCertificateSerialised: ArrayBuffer,
        orgCertificateSerialised: ArrayBuffer,
        dnssecChainSerialised: ArrayBuffer,
      ) => ArrayBuffer
    >(),
  ),
};
jest.unstable_mockModule('@relaycorp/veraid', () => mockedModule);

export const mockedVeraidModule = mockedModule;
