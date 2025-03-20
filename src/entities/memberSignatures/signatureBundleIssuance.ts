import { SignatureBundle, OrganisationSigner } from '@relaycorp/veraid';
import { getModelForClass } from '@typegoose/typegoose';
import { addSeconds, fromUnixTime, min, setMilliseconds } from 'date-fns';
import type { HydratedDocument } from 'mongoose';
import type { JWTPayload } from 'jose';

import { verifyJwt } from '../../credentialIssuanceAuth/jwtVerification.js';
import type { Result } from '../../utilities/result.js';
import type { ServiceOptions } from '../../utilities/serviceTypes.js';
import { makeOrgChain, type OrgChain } from '../organisations/orgChain.js';
import type { Member } from '../members/Member.model.js';
import { OrgChainCreationProblem } from '../organisations/OrgChainCreationProblem.js';

import { SignatureSpec } from './SignatureSpec.model.js';
import { SignatureBundleIssuanceProblem } from './SignatureBundleIssuanceProblem.js';

interface SignatureBundleIssuanceRequest {
  readonly jwtSerialised: string;
  readonly requiredJwtAudience: string;
  readonly signatureSpecId: string;
}

async function generateSignatureBundle(
  signatureSpec: HydratedDocument<SignatureSpec>,
  orgChain: OrgChain,
  jwt: JWTPayload,
): Promise<SignatureBundle> {
  await signatureSpec.populate('member');
  const attributedMemberName = (signatureSpec.member as Member).name;
  const signer = new OrganisationSigner(
    orgChain.dnssecChain,
    orgChain.certificate,
    attributedMemberName ?? undefined,
  );

  const now = setMilliseconds(new Date(), 0);
  const expiry = addSeconds(now, signatureSpec.ttlSeconds);
  const finalExpiry = jwt.exp === undefined ? expiry : min([fromUnixTime(jwt.exp), expiry]);

  return SignatureBundle.sign(
    signatureSpec.plaintext,
    signatureSpec.serviceOid,
    signer,
    orgChain.privateKey,
    finalExpiry,
    { shouldEncapsulatePlaintext: true },
  );
}

export async function issueSignatureBundle(
  request: SignatureBundleIssuanceRequest,
  options: ServiceOptions,
): Promise<Result<SignatureBundle, SignatureBundleIssuanceProblem>> {
  const signatureSpecModel = getModelForClass(SignatureSpec, {
    existingConnection: options.dbConnection,
  });

  const signatureSpec = await signatureSpecModel.findById(request.signatureSpecId);
  if (!signatureSpec) {
    options.logger.info({ signatureSpecId: request.signatureSpecId }, 'Signature spec not found');
    return {
      didSucceed: false,
      context: SignatureBundleIssuanceProblem.SIGNATURE_SPEC_NOT_FOUND,
    };
  }

  const jwtVerification = await verifyJwt(
    request.jwtSerialised,
    signatureSpec.auth.providerIssuerUrl,
    request.requiredJwtAudience,
    options.dbConnection,
    options.logger,
  );
  if (!jwtVerification.didSucceed) {
    return {
      didSucceed: false,
      context: jwtVerification.context as unknown as SignatureBundleIssuanceProblem,
    };
  }

  const { result: jwt } = jwtVerification;
  const orgChainResult = await makeOrgChain(signatureSpec.orgName, options);
  if (!orgChainResult.didSucceed) {
    const context =
      orgChainResult.context === OrgChainCreationProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED
        ? SignatureBundleIssuanceProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED
        : SignatureBundleIssuanceProblem.SIGNATURE_SPEC_NOT_FOUND;
    return {
      didSucceed: false,
      context,
    };
  }

  const { result: orgChain } = orgChainResult;
  const signatureBundle = await generateSignatureBundle(signatureSpec, orgChain, jwt);
  return {
    didSucceed: true,
    result: signatureBundle,
  };
}
