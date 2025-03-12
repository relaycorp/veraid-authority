import { getModelForClass } from '@typegoose/typegoose';
import { validateUserName } from '@relaycorp/veraid';
import type { HydratedDocument } from 'mongoose';

import type { Result } from '../utilities/result.js';
import { MONGODB_DUPLICATE_INDEX_CODE, type ServiceOptions } from '../serviceTypes.js';
import { MemberBundleRequestModel } from '../models/MemberBundleRequest.model.js';
import { MemberPublicKey } from '../memberKeys/MemberPublicKey.model.js';
import { MemberKeyImportToken } from '../memberKeyImports/MemberKeyImportToken.model.js';

import type { MemberSchema, PatchMemberSchema } from './member.schema.js';
import { Member } from './Member.model.js';
import { MemberProblem } from './MemberProblem.js';
import { type MemberCreationResult, REVERSE_ROLE_MAPPING, ROLE_MAPPING } from './memberTypes.js';

function validateMemberData(
  memberData: PatchMemberSchema,
  options: ServiceOptions,
): MemberProblem | undefined {
  try {
    if (memberData.name !== undefined && memberData.name !== null) {
      validateUserName(memberData.name);
    }
  } catch {
    options.logger.info({ name: memberData.name }, 'Refused malformed member name');
    return MemberProblem.MALFORMED_MEMBER_NAME;
  }
  return undefined;
}

export async function createMember(
  orgName: string,
  memberData: MemberSchema,
  options: ServiceOptions,
): Promise<Result<MemberCreationResult, MemberProblem>> {
  const validationFailure = validateMemberData(memberData, options);
  if (validationFailure !== undefined) {
    return { didSucceed: false, context: validationFailure };
  }
  const memberModel = getModelForClass(Member, {
    existingConnection: options.dbConnection,
  });

  const role = ROLE_MAPPING[memberData.role];
  let member: HydratedDocument<Member>;
  try {
    member = await memberModel.create({ ...memberData, role, orgName });
  } catch (err) {
    if ((err as { code: number }).code === MONGODB_DUPLICATE_INDEX_CODE) {
      options.logger.info({ name: memberData.name }, 'Refused duplicated member name');
      return {
        didSucceed: false,
        context: MemberProblem.EXISTING_MEMBER_NAME,
      };
    }
    throw err as Error;
  }

  options.logger.info(
    { orgName, userName: memberData.name, memberId: member.id },
    'Member created',
  );
  return {
    didSucceed: true,
    result: { id: member.id },
  };
}

export async function getMember(
  orgName: string,
  memberId: string,
  options: ServiceOptions,
): Promise<Result<MemberSchema, MemberProblem>> {
  const memberModel = getModelForClass(Member, {
    existingConnection: options.dbConnection,
  });
  const member = await memberModel.findById(memberId);

  if (member === null || member.orgName !== orgName) {
    return {
      didSucceed: false,
      context: MemberProblem.MEMBER_NOT_FOUND,
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
): Promise<Result<undefined, MemberProblem>> {
  const memberKeyImportToken = getModelForClass(MemberKeyImportToken, {
    existingConnection: options.dbConnection,
  });
  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModel, {
    existingConnection: options.dbConnection,
  });
  const memberPublicKey = getModelForClass(MemberPublicKey, {
    existingConnection: options.dbConnection,
  });
  const memberModel = getModelForClass(Member, {
    existingConnection: options.dbConnection,
  });

  // Defer the member deletion until the end to make retries possible, in case we fail to delete dependant records.
  await memberKeyImportToken.deleteMany({
    memberId,
  });

  // Defer public key deletion until bundle requests are deleted
  await memberBundleRequestModel.deleteMany({
    memberId,
  });

  await memberPublicKey.deleteMany({
    memberId,
  });

  await memberModel.findByIdAndDelete(memberId);

  options.logger.info({ memberId }, 'Member deleted');
  return {
    didSucceed: true,
  };
}

export async function updateMember(
  memberId: string,
  memberData: PatchMemberSchema,
  options: ServiceOptions,
): Promise<Result<undefined, MemberProblem>> {
  const validationFailure = validateMemberData(memberData, options);
  if (validationFailure !== undefined) {
    return { didSucceed: false, context: validationFailure };
  }

  const memberModel = getModelForClass(Member, {
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
        context: MemberProblem.EXISTING_MEMBER_NAME,
      };
    }
    throw err as Error;
  }

  options.logger.info({ memberId }, 'Member updated');
  return {
    didSucceed: true,
  };
}
