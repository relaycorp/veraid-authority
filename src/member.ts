import { getModelForClass } from '@typegoose/typegoose';
import { validateUserName } from '@relaycorp/veraid';

import type { Result } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import type { MemberSchema } from './services/schema/member.schema.js';
import { MemberProblemType } from './MemberProblemType.js';
import { MemberModelSchema } from './models/Member.model.js';
import { type MemberCreationResult, REVERSE_ROLE_MAPPING, ROLE_MAPPING } from './memberTypes.js';

function validateMemberData(
  memberData: MemberSchema,
  options: ServiceOptions,
): MemberProblemType | undefined {
  try {
    if (memberData.name !== undefined) {
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
  const member = await memberModel.create({ ...memberData, role, orgName });

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
