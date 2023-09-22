import { type DocumentType, getModelForClass } from '@typegoose/typegoose';
import isValidDomain from 'is-valid-domain';
import type { AnyKeys } from 'mongoose';

import { OrgModelSchema } from './models/Org.model.js';
import type { OrgSchema, OrgSchemaPatch } from './schemas/org.schema.js';
import type { Result } from './utilities/result.js';
import { MONGODB_DUPLICATE_INDEX_CODE, type ServiceOptions } from './serviceTypes.js';
import { OrgProblemType } from './OrgProblemType.js';
import { Kms } from './utilities/kms/Kms.js';
import { derSerialisePublicKey } from './utilities/webcrypto.js';
import { MemberModelSchema, Role } from './models/Member.model.js';
import { deleteMember } from './member.js';

function isValidUtf8Domain(orgName: string) {
  return isValidDomain(orgName, { allowUnicode: true });
}

function validateOrgData(
  orgData: OrgSchemaPatch,
  options: ServiceOptions,
): OrgProblemType | undefined {
  if (orgData.name !== undefined && !isValidUtf8Domain(orgData.name)) {
    options.logger.info({ orgName: orgData.name }, 'Refused malformed org name');
    return OrgProblemType.MALFORMED_ORG_NAME;
  }

  return undefined;
}

async function removeLastRelatedMember(
  orgName: string,
  options: ServiceOptions,
): Promise<Result<undefined, OrgProblemType>> {
  const memberModel = getModelForClass(MemberModelSchema, {
    existingConnection: options.dbConnection,
  });

  const memberCount = await memberModel.count({ orgName });
  if (memberCount > 1) {
    options.logger.info({ orgName }, 'Refused org deletion because it contains multiple members');
    return {
      didSucceed: false,
      context: OrgProblemType.EXISTING_MEMBERS,
    };
  }

  if (memberCount === 1) {
    const lastAdmin = await memberModel.findOne({ orgName, role: Role.ORG_ADMIN });
    if (lastAdmin === null) {
      options.logger.info({ orgName }, 'Refused org deletion because last member is not admin');
      return {
        didSucceed: false,
        context: OrgProblemType.LAST_MEMBER_NOT_ADMIN,
      };
    }
    await deleteMember(lastAdmin._id.toString(), options);
  }

  return {
    didSucceed: true,
  };
}

export async function createOrg(
  orgData: OrgSchema,
  options: ServiceOptions,
): Promise<Result<OrgSchema, OrgProblemType>> {
  const validationFailure = validateOrgData(orgData, options);
  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: options.dbConnection,
  });

  if (validationFailure !== undefined) {
    return { didSucceed: false, context: validationFailure };
  }

  const kms = await Kms.init();
  const { privateKey, publicKey } = await kms.generateKeyPair();
  const org: AnyKeys<DocumentType<OrgModelSchema>> = {
    ...orgData,
    privateKeyRef: await kms.getPrivateKeyRef(privateKey),
    publicKey: await derSerialisePublicKey(publicKey),
  };
  try {
    await orgModel.create(org);
  } catch (err) {
    if ((err as { code: number }).code === MONGODB_DUPLICATE_INDEX_CODE) {
      options.logger.info({ orgName: orgData.name }, 'Refused duplicated org name');
      return {
        didSucceed: false,
        context: OrgProblemType.EXISTING_ORG_NAME,
      };
    }
    throw err as Error;
  }

  options.logger.info({ orgName: orgData.name }, 'Org created');
  return {
    didSucceed: true,
    result: { name: orgData.name },
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
      context: OrgProblemType.INVALID_ORG_NAME,
    };
  }

  const validationFailure = validateOrgData({ ...orgData }, options);

  if (validationFailure !== undefined) {
    return { didSucceed: false, context: validationFailure };
  }

  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: options.dbConnection,
  });

  await orgModel.updateOne({ name }, orgData);

  options.logger.info({ orgName: orgData.name }, 'Org updated');
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
      context: OrgProblemType.ORG_NOT_FOUND,
    };
  }

  return {
    didSucceed: true,
    result: { name: org.name },
  };
}

export async function deleteOrg(
  orgName: string,
  options: ServiceOptions,
): Promise<Result<undefined, OrgProblemType>> {
  const orgModel = getModelForClass(OrgModelSchema, {
    existingConnection: options.dbConnection,
  });
  const org = await orgModel.findOne({ name: orgName });

  if (org === null) {
    options.logger.info({ orgName }, 'Ignored deletion of non-existing org');
    return {
      didSucceed: true,
    };
  }

  const memberRemovalResult = await removeLastRelatedMember(orgName, options);
  if (!memberRemovalResult.didSucceed) {
    return memberRemovalResult;
  }

  const kms = await Kms.init();
  const privateKey = await kms.retrievePrivateKeyByRef(org.privateKeyRef);
  await kms.destroyPrivateKey(privateKey);

  await org.deleteOne();

  options.logger.info({ orgName }, 'Org deleted');

  return {
    didSucceed: true,
  };
}
