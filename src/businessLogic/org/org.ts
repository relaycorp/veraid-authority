import { getModelForClass } from '@typegoose/typegoose';
import isValidDomain from 'is-valid-domain';
import type { HydratedDocument } from 'mongoose';

import { OrgModelSchema } from '../../models/Org.model.js';
import type { OrgSchema, OrgSchemaPatch } from '../../services/schema/org.schema.js';
import type { Result } from '../../utilities/result.js';
import { MONGODB_DUPLICATE_INDEX_CODE, type ServiceOptions } from '../serviceTypes.js';

import {
  MEMBER_ACCESS_TYPE_MAPPING,
  type OrgCreationResult,
  REVERSE_MEMBER_ACCESS_MAPPING,
} from './orgTypes.js';
import { OrgProblemType } from './OrgProblemType.js';

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
    options.logger.info(
      { originalName: name, targetName: orgData.name },
      'Refused non matching name',
    );
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

  await orgModel.updateOne(
    {
      name,
    },
    { ...orgData, memberAccessType },
  );

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
  const org = await orgModel.findOne({
    name,
  });

  if (org === null) {
    return {
      didSucceed: false,
      reason: OrgProblemType.ORG_NOT_FOUND,
    };
  }

  return {
    didSucceed: true,

    result: {
      name: org.name,
      memberAccessType: REVERSE_MEMBER_ACCESS_MAPPING[org.memberAccessType],
      awalaEndpoint: org.awalaEndpoint,
    },
  };
}

export async function deleteOrg(
  name: string,
  options: ServiceOptions,
): Promise<Result<undefined, OrgProblemType>> {
  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: options.dbConnection,
  });

  await orgModel.deleteOne({
    name,
  });
  options.logger.info({ name }, 'Org deleted');

  return {
    didSucceed: true,
  };
}
