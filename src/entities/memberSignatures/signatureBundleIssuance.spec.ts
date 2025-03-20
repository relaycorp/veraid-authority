import { jest } from '@jest/globals';
import type { JWTPayload } from 'jose';
import type { Connection, HydratedDocument } from 'mongoose';
import { getModelForClass, mongoose } from '@typegoose/typegoose';
import {
  addDays,
  addMinutes,
  getUnixTime,
  setMilliseconds,
  addSeconds,
  subSeconds,
} from 'date-fns';
import { selfIssueOrganisationCertificate, VeraidError } from '@relaycorp/veraid';

import { makeMockLogging } from '../../testUtils/logging.js';
import { requireFailureResult, requireSuccessfulResult } from '../../testUtils/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { setUpTestDbConnection } from '../../testUtils/db.js';
import { JwtVerificationProblem } from '../../credentialIssuanceAuth/JwtVerificationProblem.js';
import { ORG_NAME, TEST_SERVICE_OID, MEMBER_NAME } from '../../testUtils/stubs.js';
import {
  OAUTH2_TOKEN_AUDIENCE,
  OAUTH2_TOKEN_ISSUER,
  OIDC_CLAIM_NAME,
  OIDC_CLAIM_VALUE,
} from '../../testUtils/authn.js';
import { ORG_CERTIFICATE_EXPIRY_DAYS, type OrgChain } from '../organisations/orgChain.js';
import { generateVeraidDnssecChain } from '../../testUtils/veraid.js';
import { generateKeyPair } from '../../testUtils/webcrypto.js';
import { Member, Role } from '../members/Member.model.js';
import { OrgChainCreationProblem } from '../organisations/OrgChainCreationProblem.js';

import { SignatureBundleIssuanceProblem } from './SignatureBundleIssuanceProblem.js';
import { SignatureSpec } from './SignatureSpec.model.js';

const mockVerifyJwt = mockSpy(jest.fn<() => Promise<any>>());
jest.unstable_mockModule('../../credentialIssuanceAuth/jwtVerification.js', () => ({
  verifyJwt: mockVerifyJwt,
}));

const mockMakeOrgChain = mockSpy(jest.fn<() => Promise<any>>());
jest.unstable_mockModule('../organisations/orgChain.js', () => ({
  makeOrgChain: mockMakeOrgChain,
}));

const { issueSignatureBundle } = await import('./signatureBundleIssuance.js');

const JWT_SERIALISED = 'jwt-serialised';
const JWT_EXPIRY = addMinutes(setMilliseconds(new Date(), 0), 1);
const JWT: JWTPayload = {
  [OIDC_CLAIM_NAME]: OIDC_CLAIM_VALUE,
  exp: getUnixTime(JWT_EXPIRY),
};

const ORG_KEY_PAIR = await generateKeyPair();
const ORG_CERTIFICATE = await selfIssueOrganisationCertificate(
  ORG_NAME,
  ORG_KEY_PAIR,
  addDays(new Date(), ORG_CERTIFICATE_EXPIRY_DAYS),
);
const { chain: DNSSEC_CHAIN, trustAnchors: TRUST_ANCHORS } = await generateVeraidDnssecChain(
  ORG_KEY_PAIR.publicKey,
);
const ORG_CHAIN: OrgChain = {
  dnssecChain: DNSSEC_CHAIN,
  certificate: ORG_CERTIFICATE,
  privateKey: ORG_KEY_PAIR.privateKey,
};

describe('issueSignatureBundle', () => {
  const mockLogging = makeMockLogging();

  const getConnection = setUpTestDbConnection();
  let connection: Connection;
  beforeEach(() => {
    connection = getConnection();

    mockVerifyJwt.mockResolvedValue({
      didSucceed: true,
      result: JWT,
    });

    mockMakeOrgChain.mockResolvedValue({
      didSucceed: true,
      result: ORG_CHAIN,
    });
  });

  async function stubSignatureSpec(
    name: string | null = MEMBER_NAME,
    ttlSeconds = 3600,
  ): Promise<HydratedDocument<SignatureSpec>> {
    const memberModel = getModelForClass(Member, {
      existingConnection: connection,
    });
    const member = await memberModel.create({
      name,
      role: Role.REGULAR,
      orgName: ORG_NAME,
    });

    const signatureSpecModel = getModelForClass(SignatureSpec, {
      existingConnection: connection,
    });
    return signatureSpecModel.create({
      member,
      orgName: ORG_NAME,

      auth: {
        type: 'oidc-discovery',
        providerIssuerUrl: new URL(OAUTH2_TOKEN_ISSUER),
        jwtSubjectClaim: OIDC_CLAIM_NAME,
        jwtSubjectValue: OIDC_CLAIM_VALUE,
      },

      serviceOid: TEST_SERVICE_OID,
      ttlSeconds,
      plaintext: Buffer.from('plaintext'),
    });
  }

  test('should refuse non-existing signature spec', async () => {
    const result = await issueSignatureBundle(
      {
        jwtSerialised: JWT_SERIALISED,
        requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
        signatureSpecId: new mongoose.Types.ObjectId().toString(),
      },
      { dbConnection: connection, logger: mockLogging.logger },
    );

    requireFailureResult(result);
    expect(result.context).toBe(SignatureBundleIssuanceProblem.SIGNATURE_SPEC_NOT_FOUND);
  });

  describe('JWT verification', () => {
    test('should verify the specified JWT', async () => {
      const spec = await stubSignatureSpec();

      await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      expect(mockVerifyJwt).toHaveBeenCalledWith(
        JWT_SERIALISED,
        expect.any(URL),
        expect.any(String),
        connection,
        expect.anything(),
      );
    });

    test('should verify the JWT against the issuer in the spec', async () => {
      const spec = await stubSignatureSpec();

      await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      expect(mockVerifyJwt).toHaveBeenCalledWith(
        expect.any(String),
        spec.auth.providerIssuerUrl,
        expect.any(String),
        expect.any(Object),
        expect.anything(),
      );
    });

    test('should verify the JWT against the specified audience', async () => {
      const spec = await stubSignatureSpec();

      await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      expect(mockVerifyJwt).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(URL),
        OAUTH2_TOKEN_AUDIENCE,
        expect.any(Object),
        expect.anything(),
      );
    });

    test('should propagate JWKS_RETRIEVAL_ERROR', async () => {
      const spec = await stubSignatureSpec();
      mockVerifyJwt.mockResolvedValue({
        didSucceed: false,
        context: JwtVerificationProblem.JWKS_RETRIEVAL_ERROR,
      });

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireFailureResult(result);
      expect(result.context).toBe(SignatureBundleIssuanceProblem.JWKS_RETRIEVAL_ERROR);
    });

    test('should propagate INVALID_JWT', async () => {
      const spec = await stubSignatureSpec();
      mockVerifyJwt.mockResolvedValue({
        didSucceed: false,
        context: JwtVerificationProblem.INVALID_JWT,
      });

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireFailureResult(result);
      expect(result.context).toBe(SignatureBundleIssuanceProblem.INVALID_JWT);
    });

    test('should propagate EXPIRED_JWT', async () => {
      const spec = await stubSignatureSpec();
      mockVerifyJwt.mockResolvedValue({
        didSucceed: false,
        context: JwtVerificationProblem.EXPIRED_JWT,
      });

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireFailureResult(result);
      expect(result.context).toBe(SignatureBundleIssuanceProblem.EXPIRED_JWT);
    });
  });

  describe('Org chain generation', () => {
    test('should generate chain for org in signature spec', async () => {
      const spec = await stubSignatureSpec();

      await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      expect(mockMakeOrgChain).toHaveBeenCalledWith(spec.orgName.toString(), {
        dbConnection: connection,
        logger: expect.anything(),
      });
    });

    test('should not generate org chain if JWT verification fails', async () => {
      const spec = await stubSignatureSpec();
      mockVerifyJwt.mockResolvedValue({
        didSucceed: false,
        context: JwtVerificationProblem.INVALID_JWT,
      });

      await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      expect(mockMakeOrgChain).not.toHaveBeenCalled();
    });

    test('should propagate DNSSEC_CHAIN_RETRIEVAL_FAILED', async () => {
      const spec = await stubSignatureSpec();
      mockMakeOrgChain.mockResolvedValue({
        didSucceed: false,
        context: OrgChainCreationProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED,
      });

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireFailureResult(result);
      expect(result.context).toBe(SignatureBundleIssuanceProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED);
    });

    test('should propagate ORG_NOT_FOUND as SIGNATURE_SPEC_NOT_FOUND', async () => {
      const spec = await stubSignatureSpec();
      mockMakeOrgChain.mockResolvedValue({
        didSucceed: false,
        context: OrgChainCreationProblem.ORG_NOT_FOUND,
      });

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireFailureResult(result);
      expect(result.context).toBe(SignatureBundleIssuanceProblem.SIGNATURE_SPEC_NOT_FOUND);
    });
  });

  describe('Signature bundle issuance', () => {
    test('should use org DNSSEC chain', async () => {
      const spec = await stubSignatureSpec();

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const { dnssecChain } = result.result;
      expect(
        Buffer.from(dnssecChain.serialise()).equals(Buffer.from(ORG_CHAIN.dnssecChain.serialise())),
      ).toBe(true);
    });

    test('should use org certificate', async () => {
      const spec = await stubSignatureSpec();

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const { orgCertificate } = result.result;
      expect(orgCertificate.isEqual(ORG_CHAIN.certificate)).toBeTrue();
    });

    test('should attribute signature to user if name is specified', async () => {
      const spec = await stubSignatureSpec();

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      const { member, wasSignedByMember } = await signatureBundle.verify(
        undefined,
        spec.serviceOid,
        new Date(),
        TRUST_ANCHORS,
      );
      expect(member.user).toBe(MEMBER_NAME);
      expect(wasSignedByMember).toBeFalse();
    });

    test('should attribute signature to bot if name is unspecified', async () => {
      const spec = await stubSignatureSpec(null);

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      const { member, wasSignedByMember } = await signatureBundle.verify(
        undefined,
        spec.serviceOid,
        new Date(),
        TRUST_ANCHORS,
      );
      expect(member.user).toBeUndefined();
      expect(wasSignedByMember).toBeFalse();
    });

    test('should sign plaintext in spec and encapsulate it in bundle', async () => {
      const spec = await stubSignatureSpec();

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      const { plaintext } = await signatureBundle.verify(
        undefined,
        spec.serviceOid,
        new Date(),
        TRUST_ANCHORS,
      );
      expect(Buffer.from(plaintext).equals(spec.plaintext)).toBeTrue();
    });

    test('should use service in spec', async () => {
      const spec = await stubSignatureSpec();

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      await expect(
        signatureBundle.verify(undefined, spec.serviceOid, new Date(), TRUST_ANCHORS),
      ).toResolve();
    });
  });

  describe('Validity period', () => {
    test('should be valid at time of issuance', async () => {
      const spec = await stubSignatureSpec();

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      await expect(
        signatureBundle.verify(undefined, spec.serviceOid, new Date(), TRUST_ANCHORS),
      ).toResolve();
    });

    test('should not be valid before issuance', async () => {
      const spec = await stubSignatureSpec();
      const startDate = setMilliseconds(new Date(), 0);

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      await expect(
        signatureBundle.verify(undefined, spec.serviceOid, subSeconds(startDate, 1), TRUST_ANCHORS),
      ).rejects.toThrowWithMessage(VeraidError, /does not overlap with required period/u);
    });

    test('should be valid until JWT expiry', async () => {
      const spec = await stubSignatureSpec();

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      await expect(
        signatureBundle.verify(undefined, spec.serviceOid, JWT_EXPIRY, TRUST_ANCHORS),
      ).toResolve();
    });

    test('should not be valid after JWT expiry', async () => {
      const spec = await stubSignatureSpec();

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      await expect(
        signatureBundle.verify(
          undefined,
          spec.serviceOid,
          addSeconds(JWT_EXPIRY, 1),
          TRUST_ANCHORS,
        ),
      ).rejects.toThrowWithMessage(VeraidError, /does not overlap with required period/u);
    });

    test("should be valid until spec TTL if JWT doesn't expire", async () => {
      const jwtWithoutExp: JWTPayload = { ...JWT, exp: undefined };
      mockVerifyJwt.mockResolvedValue({ didSucceed: true, result: jwtWithoutExp });
      const spec = await stubSignatureSpec(null, 10);
      const startTime = setMilliseconds(new Date(), 0);

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      const justBeforeExpiry = addSeconds(startTime, spec.ttlSeconds - 1);
      await expect(
        signatureBundle.verify(undefined, spec.serviceOid, justBeforeExpiry, TRUST_ANCHORS),
      ).toResolve();
    });

    test("should not be valid after spec TTL if JWT doesn't expire", async () => {
      const jwtWithoutExp: JWTPayload = { ...JWT, exp: undefined };
      mockVerifyJwt.mockResolvedValue({ didSucceed: true, result: jwtWithoutExp });
      const spec = await stubSignatureSpec();

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const expectedExpiry = addSeconds(new Date(), spec.ttlSeconds);
      const signatureBundle = result.result;
      await expect(
        signatureBundle.verify(
          undefined,
          spec.serviceOid,
          addSeconds(expectedExpiry, 1),
          TRUST_ANCHORS,
        ),
      ).rejects.toThrowWithMessage(VeraidError, /does not overlap with required period/u);
    });

    test('should not be valid after spec TTL even if JWT expires later', async () => {
      const spec = await stubSignatureSpec();
      const laterExpiry = getUnixTime(addSeconds(new Date(), spec.ttlSeconds + 5));
      const jwtWithLaterExp: JWTPayload = { ...JWT, exp: laterExpiry };
      mockVerifyJwt.mockResolvedValue({ didSucceed: true, result: jwtWithLaterExp });
      const specExpiry = addSeconds(new Date(), spec.ttlSeconds);

      const result = await issueSignatureBundle(
        {
          jwtSerialised: JWT_SERIALISED,
          requiredJwtAudience: OAUTH2_TOKEN_AUDIENCE,
          signatureSpecId: spec._id.toString(),
        },
        { dbConnection: connection, logger: mockLogging.logger },
      );

      requireSuccessfulResult(result);
      const signatureBundle = result.result;
      await expect(
        signatureBundle.verify(
          undefined,
          spec.serviceOid,
          addSeconds(specExpiry, 1),
          TRUST_ANCHORS,
        ),
      ).rejects.toThrowWithMessage(VeraidError, /does not overlap with required period/u);
    });
  });
});
