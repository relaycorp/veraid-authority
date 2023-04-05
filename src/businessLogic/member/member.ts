import { getModelForClass } from '@typegoose/typegoose';
import { validateUserName } from '@relaycorp/veraid';
import type { HydratedDocument } from 'mongoose';

import type { Result } from '../../utilities/result.js';
import { MONGODB_DUPLICATE_INDEX_CODE, type ServiceOptions } from '../serviceTypes.js';
import type { MemberSchema, PatchMemberSchema } from '../../services/schema/member.schema.js';
import { MemberProblemType } from './MemberProblemType.js';
import { MemberModelSchema } from '../../models/Member.model.js';
import { type MemberCreationResult, REVERSE_ROLE_MAPPING, ROLE_MAPPING } from './memberTypes.js';

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

export async function createMember(
  orgName: string,
  memberData: MemberSchema,
  options: ServiceOptions,
): Promise<Result<MemberCreationResult, MemberProblemType>> {
  const validationFailure = validateMemberData(memberData, options);
  if (validationFailure !== undefined) {
    return { didSucceed: false, reason: validationFailure };
  }
  const memberModel = getModelForClass(MemberModelSchema, {
    existingConnection: options.dbConnection,
  });

  const role = ROLE_MAPPING[memberData.role];
  let member: HydratedDocument<MemberModelSchema>;
  try {
    member = await memberModel.create({ ...memberData, role, orgName });
  } catch (err) {
    if ((err as { code: number }).code === MONGODB_DUPLICATE_INDEX_CODE) {
      options.logger.info({ name: memberData.name }, 'Refused duplicated member name');
      return {
        didSucceed: false,
        reason: MemberProblemType.EXISTING_MEMBER_NAME,
      };
    }
    throw err as Error;
  }

  options.logger.info({ orgName }, 'Member created');
  return {
    didSucceed: true,
    result: { id: member.id },
  };
}

export async function getMember(
  orgName: string,
  memberId: string,
  options: ServiceOptions,
): Promise<Result<MemberSchema, MemberProblemType>> {
  const memberModel = getModelForClass(MemberModelSchema, {
    existingConnection: options.dbConnection,
  });
  const member = await memberModel.findById(memberId);

  if (member === null || member.orgName !== orgName) {
    return {
      didSucceed: false,
      reason: MemberProblemType.MEMBER_NOT_FOUND,
    };
  }

  return {
    didSucceed: true,

    result: {
      name: member.name,
      role: REVERSE_ROLE_MAPPING[member.role],
      email: member.email,
    },
  };
}

export async function deleteMember(
  memberId: string,
  options: ServiceOptions,
): Promise<Result<undefined, MemberProblemType>> {
  const memberModel = getModelForClass(MemberModelSchema, {
    existingConnection: options.dbConnection,
  });

  await memberModel.findByIdAndDelete(memberId);

  options.logger.info({ id: memberId }, 'Member deleted');
  return {
    didSucceed: true,
  };
}

export async function updateMember(
  memberId: string,
  memberData: PatchMemberSchema,
  options: ServiceOptions,
): Promise<Result<undefined, MemberProblemType>> {
  const validationFailure = validateMemberData(memberData, options);
  if (validationFailure !== undefined) {
    return { didSucceed: false, reason: validationFailure };
  }

  const memberModel = getModelForClass(MemberModelSchema, {
    existingConnection: options.dbConnection,
  });

  const role = memberData.role && ROLE_MAPPING[memberData.role];

  try {
    await memberModel.findByIdAndUpdate(memberId, { ...memberData, role });
  } catch (err) {
    if ((err as { code: number }).code === MONGODB_DUPLICATE_INDEX_CODE) {
      options.logger.info({ name: memberData.name }, 'Refused duplicated member name');
      return {
        didSucceed: false,
        reason: MemberProblemType.EXISTING_MEMBER_NAME,
      };
    }
    throw err as Error;
  }

  options.logger.info({ id: memberId }, 'Member updated');
  return {
    didSucceed: true,
  };
}
