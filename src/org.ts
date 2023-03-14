import { getModelForClass } from '@typegoose/typegoose';
import isValidDomain from 'is-valid-domain';
import type { HydratedDocument } from 'mongoose';

import { MemberAccessType, OrgModelSchema } from './models/Org.model.js';
import type { OrgSchema } from './services/schema/org.schema.js';
import type { Result } from './utilities/result.js';
import type { OrgCreationResult, ServiceOptions } from './orgTypes.js';
import { CreationProblemType } from './CreationProblemType.js';

const MONGODB_DUPLICATE_INDEX_CODE = 11_000;

const MEMBER_ACCESS_TYPE_MAPPING: { [key in OrgSchema['memberAccessType']]: MemberAccessType } = {
  INVITE_ONLY: MemberAccessType.INVITE_ONLY,
  OPEN: MemberAccessType.OPEN,
};

function isValidUtf8Domain(orgName: string) {
  return isValidDomain(orgName, { allowUnicode: true });
}

function validateOrgData(
  orgData: OrgSchema,
  options: ServiceOptions,
): CreationProblemType | undefined {
  const isNameValid = isValidUtf8Domain(orgData.name);
  if (!isNameValid) {
    options.logger.info({ name: orgData.name }, 'Refused malformed org name');
    return CreationProblemType.MALFORMED_ORG_NAME;
  }

  if (orgData.awalaEndpoint !== undefined && !isValidUtf8Domain(orgData.awalaEndpoint)) {
    options.logger.info(
      { awalaEndpoint: orgData.awalaEndpoint },
      'Refused malformed Awala endpoint',
    );
    return CreationProblemType.MALFORMED_AWALA_ENDPOINT;
  }

  return undefined;
}

export async function createOrg(
  orgData: OrgSchema,
  options: ServiceOptions,
): Promise<Result<OrgCreationResult, CreationProblemType>> {
  const validationFailure = validateOrgData(orgData, options);
  if (validationFailure !== undefined) {
    return { didSucceed: false, reason: validationFailure };
  }

  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: options.dbConnection,
  });
  const memberAccessType = MEMBER_ACCESS_TYPE_MAPPING[orgData.memberAccessType]!;
  let org: HydratedDocument<OrgModelSchema>;
  try {
    org = await orgModel.create({ ...orgData, memberAccessType });
  } catch (err) {
    if ((err as { code: number }).code === MONGODB_DUPLICATE_INDEX_CODE) {
      options.logger.info({ name: orgData.name }, 'Refused duplicated org name');
      return {
        didSucceed: false,
        reason: CreationProblemType.EXISTING_ORG_NAME,
      };
    }
    throw err as Error;
  }

  options.logger.info({ name: orgData.name }, 'Org created');
  return {
    didSucceed: true,
    result: { name: org.name },
  };
}
