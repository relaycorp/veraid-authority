import { getModelForClass } from '@typegoose/typegoose';
import { validateUserName } from '@relaycorp/veraid';
import type { HydratedDocument } from 'mongoose';

import type { Result } from './utilities/result.js';
import { MONGODB_DUPLICATE_INDEX_CODE, type ServiceOptions } from './serviceTypes.js';
import type { MemberSchema, PatchMemberSchema } from './services/schema/member.schema.js';
import { MemberProblemType } from './MemberProblemType.js';

import { MemberPublicKeySchema } from './models/PublicKey.model.js';

function validateMemberData(
  memberData: PatchMemberSchema,
  options: ServiceOptions,
): MemberProblemType | undefined {
  try {
    if (memberData.name !== undefined && memberData.name !== null) {
      validateUserName(memberData.name);
    }
  } catch {
    options.logger.info({ name: memberData.name }, 'Refused malformed member name');
    return MemberProblemType.MALFORMED_MEMBER_NAME;
  }
  return undefined;
}

export async function createPublicKey(
  memberId: string,
  publicKey: string,
  options: ServiceOptions,
): Promise<Result<undefined, MemberProblemType>> {
  const memberModel = getModelForClass(MemberPublicKeySchema, {
    existingConnection: options.dbConnection,
  });

  await memberModel.create({
    memberId,
    publicKey
  });

  options.logger.info({ id: memberId }, 'Public key created');
  return {
    didSucceed: true,
  };
}

export async function removePublicKey(
  memberId: string,
  publicKey: string,
  options: ServiceOptions,
): Promise<Result<undefined, MemberProblemType>> {
  const memberModel = getModelForClass(MemberPublicKeySchema, {
    existingConnection: options.dbConnection,
  });

  await memberModel.deleteOne({
    memberId,
    publicKey
  });

  options.logger.info({ memberId, publicKey }, 'Public key deleted');
  return {
    didSucceed: true,
  };
}
