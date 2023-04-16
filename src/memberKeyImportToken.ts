import { getModelForClass } from '@typegoose/typegoose';

import type { Result, SuccessfulResult } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberKeyImportTokenModelSchema } from './models/MemberKeyImportToken.model.js';
import type {
  MemberKeyImportTokenCreationResult,
  MemberKeyImportTokenGetResult,
} from './memberKeyImportTokenTypes.js';
import { MemberPublicKeyImportProblemType } from './MemberKeyImportTokenProblemType.js';

export async function createMemberKeyImportToken(
  memberId: string,
  serviceOid: string,
  options: ServiceOptions,
): Promise<SuccessfulResult<MemberKeyImportTokenCreationResult>> {
  const memberKeyImportTokenModel = getModelForClass(MemberKeyImportTokenModelSchema, {
    existingConnection: options.dbConnection,
  });

  const memberKeyImportToken = await memberKeyImportTokenModel.create({
    memberId,
    serviceOid,
  });

  options.logger.info({ id: memberKeyImportToken.id }, 'Member key import token created');
  return {
    didSucceed: true,

    result: {
      id: memberKeyImportToken.id,
    },
  };
}

export async function getMemberKeyImportToken(
  importToken: string,
  options: ServiceOptions,
): Promise<Result<MemberKeyImportTokenGetResult, MemberPublicKeyImportProblemType>> {
  const memberKeyImportTokenModel = getModelForClass(MemberKeyImportTokenModelSchema, {
    existingConnection: options.dbConnection,
  });

  const memberKeyImportToken = await memberKeyImportTokenModel.findById(importToken);

  if (!memberKeyImportToken) {
    return {
      didSucceed: false,
      reason: MemberPublicKeyImportProblemType.TOKEN_NOT_FOUND,
    };
  }

  return {
    didSucceed: true,

    result: {
      serviceOid: memberKeyImportToken.serviceOid,
      memberId: memberKeyImportToken.memberId,
    },
  };
}
export async function deleteMemberKeyImportToken(
  importToken: string,
  options: ServiceOptions,
): Promise<SuccessfulResult<undefined>> {
  const memberKeyImportTokenModel = getModelForClass(MemberKeyImportTokenModelSchema, {
    existingConnection: options.dbConnection,
  });

  await memberKeyImportTokenModel.findByIdAndDelete(importToken);

  options.logger.info({ id: importToken }, 'Member public key import token deleted');
  return {
    didSucceed: true,
  };
}
