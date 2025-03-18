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
  signatureSpecData: SignatureSpecSchema,
  options: ServiceOptions,
): Promise<Result<SignatureSpecCreationResult, SignatureSpecProblem>> {
  if (
    signatureSpecData.veraidSignatureTtlSeconds !== undefined &&
    (signatureSpecData.veraidSignatureTtlSeconds < 1 ||
      signatureSpecData.veraidSignatureTtlSeconds > MAX_TTL_SECONDS)
  ) {
    options.logger.info(
      { ttl: signatureSpecData.veraidSignatureTtlSeconds },
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
    memberId,

    veraidSignaturePlaintext: Buffer.from(signatureSpecData.veraidSignaturePlaintext, 'base64'),
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

  if (signatureSpec === null || signatureSpec.memberId !== memberId) {
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
        openidProviderIssuerUrl: signatureSpec.auth.openidProviderIssuerUrl,
        jwtSubjectClaim: signatureSpec.auth.jwtSubjectClaim,
        jwtSubjectValue: signatureSpec.auth.jwtSubjectValue,
      },

      veraidServiceOid: signatureSpec.veraidServiceOid,
      veraidSignatureTtlSeconds: signatureSpec.veraidSignatureTtlSeconds,
      veraidSignaturePlaintext: signatureSpec.veraidSignaturePlaintext.toString('base64'),
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
