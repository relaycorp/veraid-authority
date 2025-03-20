/* eslint-disable @typescript-eslint/prefer-literal-enum-member */
import { JwtVerificationProblem } from '../../credentialIssuanceAuth/JwtVerificationProblem.js';
import { OrgChainCreationProblem } from '../organisations/OrgChainCreationProblem.js';

export enum SignatureBundleIssuanceProblem {
  SIGNATURE_SPEC_NOT_FOUND = 'https://veraid.net/problems/signature-bundle-issuance-spec-not-found',
  JWKS_RETRIEVAL_ERROR = JwtVerificationProblem.JWKS_RETRIEVAL_ERROR,
  INVALID_JWT = JwtVerificationProblem.INVALID_JWT,
  EXPIRED_JWT = JwtVerificationProblem.EXPIRED_JWT,
  DNSSEC_CHAIN_RETRIEVAL_FAILED = OrgChainCreationProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED,
  ORG_NOT_FOUND = OrgChainCreationProblem.ORG_NOT_FOUND,
}
