import { jest } from '@jest/globals';
import {
  CertificateIssuanceOptions
} from '@relaycorp/veraid/build/lib/lib/pki/CertificateIssuanceOptions.js';
import { mockSpy } from './jest.js';
import { Resolver, TrustAnchor } from '@relaycorp/dnssec';




const mockIssueMemberCertificate = mockSpy(
  jest.fn<(memberName: string | undefined, memberPublicKey: CryptoKey, organisationCertificate: ArrayBuffer, organisationPrivateKey: CryptoKey, expiryDate: Date, options?: Partial<CertificateIssuanceOptions>) => Promise<ArrayBuffer>>(),
);

const mockRetrieveVeraDnssecChain = mockSpy(
  jest.fn<(domainName: string, trustAnchors?: readonly TrustAnchor[], resolver?: Resolver) => Promise<ArrayBuffer>>(),
);

const mockSelfIssueOrganisationCertificate = mockSpy(
  jest.fn<(name: string, keyPair: CryptoKeyPair, expiryDate: Date, options?: Partial<CertificateIssuanceOptions>) => Promise<ArrayBuffer>>(),
);

const mockSerialiseMemberIdBundle = mockSpy(
  jest.fn<(memberCertificateSerialised: ArrayBuffer, orgCertificateSerialised: ArrayBuffer, dnssecChainSerialised: ArrayBuffer) => ArrayBuffer>(),
);

const mockedModule = {
  issueMemberCertificate: mockIssueMemberCertificate,
  retrieveVeraDnssecChain: mockRetrieveVeraDnssecChain,
  selfIssueOrganisationCertificate: mockSelfIssueOrganisationCertificate,
  serialiseMemberIdBundle: mockSerialiseMemberIdBundle
}
jest.unstable_mockModule('@relaycorp/veraid', () => mockedModule);



export function getVeraid() {


  beforeEach(() => {
    mockedModule.issueMemberCertificate.mockReset();
    mockedModule.retrieveVeraDnssecChain.mockReset();
    mockedModule.selfIssueOrganisationCertificate.mockReset();
    mockedModule.serialiseMemberIdBundle.mockReset();
  });

  return mockedModule;
}
