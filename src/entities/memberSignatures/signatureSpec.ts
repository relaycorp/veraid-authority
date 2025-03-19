import { getModelForClass } from '@typegoose/typegoose';

import type { Result } from '../../utilities/result.js';
import type { ServiceOptions } from '../../utilities/serviceTypes.js';

import { SignatureSpec } from './SignatureSpec.model.js';
import type { SignatureSpecSchema } from './SignatureSpec.schema.js';
import { SignatureSpecProblem } from './SignatureSpecProblem.js';
import type { SignatureSpecCreationResult } from './SignatureSpecTypes.js';

const MAX_TTL_SECONDS = 3600;

export async function createSignatureSpec(
  memberId: string,
  orgName: string,
  signatureSpecData: SignatureSpecSchema,
  options: ServiceOptions,
): Promise<Result<SignatureSpecCreationResult, SignatureSpecProblem>> {
  if (
    signatureSpecData.ttlSeconds !== undefined &&
    (signatureSpecData.ttlSeconds < 1 || signatureSpecData.ttlSeconds > MAX_TTL_SECONDS)
  ) {
    options.logger.info(
      { ttl: signatureSpecData.ttlSeconds },
      'Refused invalid TTL for signature spec',
    );
    return {
      didSucceed: false,
      context: SignatureSpecProblem.INVALID_TTL,
    };
  }

  const signatureSpecModel = getModelForClass(SignatureSpec, {
    existingConnection: options.dbConnection,
  });
  const signatureSpec = await signatureSpecModel.create({
    ...signatureSpecData,
    member: memberId,
    orgName,
    plaintext: Buffer.from(signatureSpecData.plaintext, 'base64'),
  });

  options.logger.info({ signatureSpecId: signatureSpec.id }, 'Signature spec created');
  return {
    didSucceed: true,

    result: {
      id: signatureSpec.id,
    },
  };
}

export async function getSignatureSpec(
  memberId: string,
  signatureSpecId: string,
  options: ServiceOptions,
): Promise<Result<SignatureSpecSchema, SignatureSpecProblem>> {
  const signatureSpecModel = getModelForClass(SignatureSpec, {
    existingConnection: options.dbConnection,
  });

  const signatureSpec = await signatureSpecModel.findById(signatureSpecId);

  if (signatureSpec === null || signatureSpec.member._id.toString() !== memberId) {
    return {
      didSucceed: false,
      context: SignatureSpecProblem.NOT_FOUND,
    };
  }
  return {
    didSucceed: true,

    result: {
      auth: {
        type: 'oidc-discovery',
        providerIssuerUrl: signatureSpec.auth.providerIssuerUrl,
        jwtSubjectClaim: signatureSpec.auth.jwtSubjectClaim,
        jwtSubjectValue: signatureSpec.auth.jwtSubjectValue,
      },

      serviceOid: signatureSpec.serviceOid,
      ttlSeconds: signatureSpec.ttlSeconds,
      plaintext: signatureSpec.plaintext.toString('base64'),
    },
  };
}

export async function deleteSignatureSpec(
  signatureSpecId: string,
  options: ServiceOptions,
): Promise<Result<undefined, SignatureSpecProblem>> {
  const signatureSpecModel = getModelForClass(SignatureSpec, {
    existingConnection: options.dbConnection,
  });

  await signatureSpecModel.findByIdAndDelete(signatureSpecId);

  options.logger.info({ signatureSpecId }, 'Signature spec deleted');
  return {
    didSucceed: true,
  };
}
