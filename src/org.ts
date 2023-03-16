import { getModelForClass } from '@typegoose/typegoose';
import isValidDomain from 'is-valid-domain';
import type { HydratedDocument } from 'mongoose';

import { MemberAccessType, OrgModelSchema } from './models/Org.model.js';
import type { OrgSchema, OrgSchemaPatch } from './services/schema/org.schema.js';
import type { Result } from './utilities/result.js';
import type { OrgCreationResult, ServiceOptions } from './orgTypes.js';
import { OrgProblemType } from './OrgProblemType.js';

const MONGODB_DUPLICATE_INDEX_CODE = 11_000;

const MEMBER_ACCESS_TYPE_MAPPING: { [key in OrgSchema['memberAccessType']]: MemberAccessType } = {
  INVITE_ONLY: MemberAccessType.INVITE_ONLY,
  OPEN: MemberAccessType.OPEN,
} as const;

type ReversedMemberAccessType = {
  [key in MemberAccessType]: OrgSchema['memberAccessType'];
};

const REVERSE_MEMBER_ACCESS_MAPPING: ReversedMemberAccessType = {
  inviteOnly: 'INVITE_ONLY',
  open: 'OPEN',
};

function isValidUtf8Domain(orgName: string) {
  return isValidDomain(orgName, { allowUnicode: true });
}

function validateOrgData(
  orgData: OrgSchemaPatch,
  options: ServiceOptions,
): OrgProblemType | undefined {
  if (orgData.name !== undefined && !isValidUtf8Domain(orgData.name)) {
    options.logger.info({ name: orgData.name }, 'Refused malformed org name');
    return OrgProblemType.MALFORMED_ORG_NAME;
  }

  if (orgData.awalaEndpoint !== undefined && !isValidUtf8Domain(orgData.awalaEndpoint)) {
    options.logger.info(
      { awalaEndpoint: orgData.awalaEndpoint },
      'Refused malformed Awala endpoint',
    );
    return OrgProblemType.MALFORMED_AWALA_ENDPOINT;
  }

  return undefined;
}

export async function createOrg(
  orgData: OrgSchema,
  options: ServiceOptions,
): Promise<Result<OrgCreationResult, OrgProblemType>> {
  const validationFailure = validateOrgData(orgData, options);
  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: options.dbConnection,
  });

  if (validationFailure !== undefined) {
    return { didSucceed: false, reason: validationFailure };
  }

  const memberAccessType = MEMBER_ACCESS_TYPE_MAPPING[orgData.memberAccessType]!;
  let org: HydratedDocument<OrgModelSchema>;
  try {
    org = await orgModel.create({ ...orgData, memberAccessType });
  } catch (err) {
    if ((err as { code: number }).code === MONGODB_DUPLICATE_INDEX_CODE) {
      options.logger.info({ name: orgData.name }, 'Refused duplicated org name');
      return {
        didSucceed: false,
        reason: OrgProblemType.EXISTING_ORG_NAME,
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

export async function updateOrg(
  name: string,
  orgData: OrgSchemaPatch,
  options: ServiceOptions,
): Promise<Result<undefined, OrgProblemType>> {
  if (orgData.name !== undefined && name !== orgData.name) {
    return {
      didSucceed: false,
      reason: OrgProblemType.INVALID_ORG_NAME,
    };
  }

  const validationFailure = validateOrgData({ ...orgData }, options);

  if (validationFailure !== undefined) {
    return { didSucceed: false, reason: validationFailure };
  }

  const memberAccessType =
    orgData.memberAccessType && MEMBER_ACCESS_TYPE_MAPPING[orgData.memberAccessType];

  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: options.dbConnection,
  });
  try {
    await orgModel.updateOne(
      {
        name,
      },
      { ...orgData, memberAccessType },
    );
  } catch (err) {
    throw err as Error;
  }

  options.logger.info({ name: orgData.name }, 'Org updated');
  return {
    didSucceed: true,
  };
}

export async function getOrg(
  name: string,
  options: ServiceOptions,
): Promise<Result<OrgSchema, OrgProblemType>> {
  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: options.dbConnection,
  });
  let org;

  try {
    org = await orgModel.findOne({
      name,
    });
  } catch (err) {
    throw err as Error;
  }
  if (org === null) {
    return {
      didSucceed: false,
      reason: OrgProblemType.ORG_NOT_FOUND,
    };
  }

  return {
    didSucceed: true,

    // TODO : implement a mapper that transforms an OrgSchema to the OrgSchemaType object
    result: {
      name: org.name,
      memberAccessType: REVERSE_MEMBER_ACCESS_MAPPING[org.memberAccessType],
      awalaEndpoint: org.awalaEndpoint,
    },
  };
}
