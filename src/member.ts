import { getModelForClass } from '@typegoose/typegoose';
import { validateUserName } from '@relaycorp/veraid';
import validator from 'validator';
import type { Result } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberSchema } from './services/schema/member.schema.js';
import { MemberProblemType } from './MemberProblemType.js';
import { MemberModelSchema } from './models/Member.model.js';
import { type MemberCreationResult, ROLE_MAPPING } from './memberTypes.js';


function validateMemberData(
  memberData: MemberSchema,
  options: ServiceOptions,
): MemberProblemType | undefined {

  try {
    memberData.name !== undefined && validateUserName(memberData.name);
  } catch (e) {
    options.logger.info(
      { name: memberData.name },
      'Refused malformed member name',
    );
    return MemberProblemType.MALFORMED_MEMBER_NAME;
  }

  if (memberData.email !== undefined && !validator.isEmail(memberData.email)) {
    options.logger.info(
      { email: memberData.email },
      'Refused malformed member email',
    );
    return MemberProblemType.MALFORMED_EMAIL;
  }

  return undefined;
}

export async function createMember(
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
  const member = await memberModel.create({ ...memberData, role });

  options.logger.info({ name: memberData.name }, 'Member created');
  return {
    didSucceed: true,
    result: { id: member.id },
  };
}
