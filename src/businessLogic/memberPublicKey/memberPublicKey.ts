import { getModelForClass } from '@typegoose/typegoose';

import type { Result } from '../../utilities/result.js';
import type { ServiceOptions } from '../serviceTypes.js';
import { MemberPublicKeyProblemType } from './MemberPublicKeyProblemType.js';
import { MemberPublicKeyModelSchema } from '../../models/MemberPublicKey.model.js';
import { MemberPublicKeyCreationResult } from './memberPublicKeyTypes.js';
import { MemberPublicKeySchema } from '../../services/schema/memberPublicKey.schema.js';
import { PatchMemberSchema } from '../../services/schema/member.schema.js';
import { MemberProblemType } from '../member/MemberProblemType.js';
import { validateUserName } from '@relaycorp/veraid';


function validateMemberPublicKeyData(
  memberPublicKeyData: MemberPublicKeySchema,
  options: ServiceOptions,
): MemberProblemType | undefined {
  try {
    if (memberPublicKeyData.publicKey) {
      validateUserName(memberData.name);
    }
  } catch {
    options.logger.info({ name: memberData.name }, 'Refused malformed member name');
    return MemberProblemType.MALFORMED_MEMBER_NAME;
  }
  return undefined;
}

export async function createMemberPublicKey(
  memberId: string,
  memberPublicKeyData: MemberPublicKeySchema,
  options: ServiceOptions,
): Promise<Result<MemberPublicKeyCreationResult, MemberPublicKeyProblemType>> {
  const memberPublicKeyModel = getModelForClass(MemberPublicKeyModelSchema, {
    existingConnection: options.dbConnection,
  });

  const memberPublicKey = await memberPublicKeyModel.create({
    memberId,
    ...memberPublicKeyData
  });

  options.logger.info({ id: memberPublicKey.id }, 'Member public key created');
  return {
    didSucceed: true,
    result: {
      id: memberPublicKey.id
    }
  };
}

export async function deleteMemberPublicKey(
  publicKeyId: string,
  options: ServiceOptions,
): Promise<Result<undefined, MemberPublicKeyProblemType>> {
  const memberPublicKey = getModelForClass(MemberPublicKeyModelSchema, {
    existingConnection: options.dbConnection,
  });

  await memberPublicKey.findByIdAndDelete(publicKeyId);

  options.logger.info({ id: publicKeyId }, 'Member public key deleted');
  return {
    didSucceed: true,
  };
}
