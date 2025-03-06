import { getModelForClass } from '@typegoose/typegoose';

import type { Result } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberJwksDelegatedSignature } from './models/MemberJwksDelegatedSignature.model.js';
import type { MemberJwksDelegatedSignatureSchema } from './schemas/memberJwksDelegatedSignature.schema.js';
import { MemberJwksDelegatedSignatureProblem } from './MemberJwksDelegatedSignatureProblem.js';
import type { MemberJwksDelegatedSignatureCreationResult } from './memberJwksDelegatedSignatureTypes.js';

const MAX_TTL_SECONDS = 3600;

export async function createJwksDelegatedSignature(
  memberId: string,
  delegatedSignatureData: MemberJwksDelegatedSignatureSchema,
  options: ServiceOptions,
): Promise<
  Result<MemberJwksDelegatedSignatureCreationResult, MemberJwksDelegatedSignatureProblem>
> {
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
      context: MemberJwksDelegatedSignatureProblem.INVALID_TTL,
    };
  }

  const delegatedSignatureModel = getModelForClass(MemberJwksDelegatedSignature, {
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
): Promise<Result<MemberJwksDelegatedSignatureSchema, MemberJwksDelegatedSignatureProblem>> {
  const delegatedSignatureModel = getModelForClass(MemberJwksDelegatedSignature, {
    existingConnection: options.dbConnection,
  });

  const delegatedSignature = await delegatedSignatureModel.findById(delegatedSignatureId);

  if (delegatedSignature === null || delegatedSignature.memberId !== memberId) {
    return {
      didSucceed: false,
      context: MemberJwksDelegatedSignatureProblem.NOT_FOUND,
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
): Promise<Result<undefined, MemberJwksDelegatedSignatureProblem>> {
  const delegatedSignatureModel = getModelForClass(MemberJwksDelegatedSignature, {
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
