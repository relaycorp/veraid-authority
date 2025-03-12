import { getModelForClass } from '@typegoose/typegoose';

import type { Result } from '../../utilities/result.js';
import type { ServiceOptions } from '../../utilities/serviceTypes.js';

import { MemberWorkloadIdentity } from './MemberWorkloadIdentity.model.js';
import type { MemberWorkloadIdentitySchema } from './memberWorkloadIdentity.schema.js';
import { MemberWorkloadIdentityProblem } from './MemberWorkloadIdentityProblem.js';
import type { MemberWorkloadIdentityCreationResult } from './memberWorkloadIdentityTypes.js';

const MAX_TTL_SECONDS = 3600;

export async function createWorkloadIdentity(
  memberId: string,
  workloadIdentityData: MemberWorkloadIdentitySchema,
  options: ServiceOptions,
): Promise<Result<MemberWorkloadIdentityCreationResult, MemberWorkloadIdentityProblem>> {
  if (
    workloadIdentityData.veraidSignatureTtlSeconds !== undefined &&
    (workloadIdentityData.veraidSignatureTtlSeconds < 1 ||
      workloadIdentityData.veraidSignatureTtlSeconds > MAX_TTL_SECONDS)
  ) {
    options.logger.info(
      { ttl: workloadIdentityData.veraidSignatureTtlSeconds },
      'Refused invalid TTL for workload identity',
    );
    return {
      didSucceed: false,
      context: MemberWorkloadIdentityProblem.INVALID_TTL,
    };
  }

  const workloadIdentityModel = getModelForClass(MemberWorkloadIdentity, {
    existingConnection: options.dbConnection,
  });
  const workloadIdentity = await workloadIdentityModel.create({
    ...workloadIdentityData,
    memberId,

    veraidSignaturePlaintext: Buffer.from(workloadIdentityData.veraidSignaturePlaintext, 'base64'),
  });

  options.logger.info(
    { memberWorkloadIdentityId: workloadIdentity.id },
    'Member workload identity created',
  );
  return {
    didSucceed: true,

    result: {
      id: workloadIdentity.id,
    },
  };
}

export async function getWorkloadIdentity(
  memberId: string,
  workloadIdentityId: string,
  options: ServiceOptions,
): Promise<Result<MemberWorkloadIdentitySchema, MemberWorkloadIdentityProblem>> {
  const workloadIdentityModel = getModelForClass(MemberWorkloadIdentity, {
    existingConnection: options.dbConnection,
  });

  const workloadIdentity = await workloadIdentityModel.findById(workloadIdentityId);

  if (workloadIdentity === null || workloadIdentity.memberId !== memberId) {
    return {
      didSucceed: false,
      context: MemberWorkloadIdentityProblem.NOT_FOUND,
    };
  }
  return {
    didSucceed: true,

    result: {
      jwksUrl: workloadIdentity.jwksUrl,
      jwtSubjectField: workloadIdentity.jwtSubjectField,
      jwtSubjectValue: workloadIdentity.jwtSubjectValue,
      veraidServiceOid: workloadIdentity.veraidServiceOid,
      veraidSignatureTtlSeconds: workloadIdentity.veraidSignatureTtlSeconds,
      veraidSignaturePlaintext: workloadIdentity.veraidSignaturePlaintext.toString('base64'),
    },
  };
}

export async function deleteWorkloadIdentity(
  workloadIdentityId: string,
  options: ServiceOptions,
): Promise<Result<undefined, MemberWorkloadIdentityProblem>> {
  const workloadIdentityModel = getModelForClass(MemberWorkloadIdentity, {
    existingConnection: options.dbConnection,
  });

  await workloadIdentityModel.findByIdAndDelete(workloadIdentityId);

  options.logger.info(
    { memberWorkloadIdentityId: workloadIdentityId },
    'Member workload identity deleted',
  );
  return {
    didSucceed: true,
  };
}
