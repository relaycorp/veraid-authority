import { getModelForClass } from '@typegoose/typegoose';

import type { Result } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberJwksDelegatedSignatureModelSchema as DelegatedSignatureModel } from './models/MemberJwksDelegatedSignature.model.js';
import type { MemberJwksDelegatedSignatureSchema as DelegatedSignatureSchema } from './schemas/memberJwksDelegatedSignature.schema.js';
import { MemberJwksDelegatedSignatureProblemType as ProblemType } from './MemberJwksDelegatedSignatureProblemType.js';
import type { MemberJwksDelegatedSignatureCreationResult as CreationResult } from './memberJwksDelegatedSignatureTypes.js';

const MAX_TTL_SECONDS = 3600;

export async function createJwksDelegatedSignature(
  memberId: string,
  delegatedSignatureData: DelegatedSignatureSchema,
  options: ServiceOptions,
): Promise<Result<CreationResult, ProblemType>> {
  if (
    delegatedSignatureData.veraidSignatureTtlSeconds !== undefined &&
    (delegatedSignatureData.veraidSignatureTtlSeconds < 1 ||
      delegatedSignatureData.veraidSignatureTtlSeconds > MAX_TTL_SECONDS)
  ) {
    options.logger.info(
      { ttl: delegatedSignatureData.veraidSignatureTtlSeconds },
      'Refused invalid TTL for JWKS delegated signature',
    );
    return {
      didSucceed: false,
      context: ProblemType.INVALID_TTL,
    };
  }

  const delegatedSignatureModel = getModelForClass(DelegatedSignatureModel, {
    existingConnection: options.dbConnection,
  });
  const delegatedSignature = await delegatedSignatureModel.create({
    ...delegatedSignatureData,
    memberId,

    veraidSignaturePlaintext: Buffer.from(
      delegatedSignatureData.veraidSignaturePlaintext,
      'base64',
    ),
  });

  options.logger.info(
    { memberJwksDelegatedSignatureId: delegatedSignature.id },
    'Member JWKS delegated signature created',
  );
  return {
    didSucceed: true,

    result: {
      id: delegatedSignature.id,
    },
  };
}

export async function getJwksDelegatedSignature(
  memberId: string,
  delegatedSignatureId: string,
  options: ServiceOptions,
): Promise<Result<DelegatedSignatureSchema, ProblemType>> {
  const delegatedSignatureModel = getModelForClass(DelegatedSignatureModel, {
    existingConnection: options.dbConnection,
  });

  const delegatedSignature = await delegatedSignatureModel.findById(delegatedSignatureId);

  if (delegatedSignature === null || delegatedSignature.memberId !== memberId) {
    return {
      didSucceed: false,
      context: ProblemType.DELEGATED_SIGNATURE_NOT_FOUND,
    };
  }
  return {
    didSucceed: true,

    result: {
      jwksUrl: delegatedSignature.jwksUrl,
      jwtSubjectField: delegatedSignature.jwtSubjectField,
      jwtSubjectValue: delegatedSignature.jwtSubjectValue,
      veraidServiceOid: delegatedSignature.veraidServiceOid,
      veraidSignatureTtlSeconds: delegatedSignature.veraidSignatureTtlSeconds,
      veraidSignaturePlaintext: delegatedSignature.veraidSignaturePlaintext.toString('base64'),
    },
  };
}

export async function deleteJwksDelegatedSignature(
  delegatedSignatureId: string,
  options: ServiceOptions,
): Promise<Result<undefined, ProblemType>> {
  const delegatedSignatureModel = getModelForClass(DelegatedSignatureModel, {
    existingConnection: options.dbConnection,
  });

  await delegatedSignatureModel.findByIdAndDelete(delegatedSignatureId);

  options.logger.info(
    { memberJwksDelegatedSignatureId: delegatedSignatureId },
    'Member JWKS delegated signature deleted',
  );
  return {
    didSucceed: true,
  };
}
