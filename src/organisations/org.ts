import { type DocumentType, getModelForClass } from '@typegoose/typegoose';
import isValidDomain from 'is-valid-domain';
import type { AnyKeys } from 'mongoose';

import type { Result } from '../utilities/result.js';
import { MONGODB_DUPLICATE_INDEX_CODE, type ServiceOptions } from '../utilities/serviceTypes.js';
import { Kms } from '../utilities/kms/Kms.js';
import { derSerialisePublicKey } from '../utilities/webcrypto.js';
import { Member, Role } from '../members/Member.model.js';
import { deleteMember } from '../members/member.js';

import { OrgProblem } from './OrgProblem.js';
import type { OrgCreationSchema, OrgReadSchema, OrgPatchSchema } from './org.schema.js';
import { Org } from './Org.model.js';

function isValidUtf8Domain(orgName: string) {
  return isValidDomain(orgName, { allowUnicode: true });
}

function validateOrgData(orgData: OrgPatchSchema, options: ServiceOptions): OrgProblem | undefined {
  if (orgData.name !== undefined && !isValidUtf8Domain(orgData.name)) {
    options.logger.info({ orgName: orgData.name }, 'Refused malformed org name');
    return OrgProblem.MALFORMED_ORG_NAME;
  }

  return undefined;
}

async function removeLastRelatedMember(
  orgName: string,
  options: ServiceOptions,
): Promise<Result<undefined, OrgProblem>> {
  const memberModel = getModelForClass(Member, {
    existingConnection: options.dbConnection,
  });

  const memberCount = await memberModel.count({ orgName });
  if (memberCount > 1) {
    options.logger.info({ orgName }, 'Refused org deletion because it contains multiple members');
    return {
      didSucceed: false,
      context: OrgProblem.EXISTING_MEMBERS,
    };
  }

  if (memberCount === 1) {
    const lastAdmin = await memberModel.findOne({ orgName, role: Role.ORG_ADMIN });
    if (lastAdmin === null) {
      options.logger.info({ orgName }, 'Refused org deletion because last member is not admin');
      return {
        didSucceed: false,
        context: OrgProblem.LAST_MEMBER_NOT_ADMIN,
      };
    }
    await deleteMember(lastAdmin._id.toString(), options);
  }

  return {
    didSucceed: true,
  };
}

export async function createOrg(
  orgData: OrgCreationSchema,
  options: ServiceOptions,
): Promise<Result<OrgReadSchema, OrgProblem>> {
  const validationFailure = validateOrgData(orgData, options);
  const orgModel = getModelForClass(Org, {
    existingConnection: options.dbConnection,
  });

  if (validationFailure !== undefined) {
    return { didSucceed: false, context: validationFailure };
  }

  const kms = await Kms.init();
  const { privateKey, publicKey } = await kms.generateKeyPair();
  const publicKeySerialised = await derSerialisePublicKey(publicKey);
  const org: AnyKeys<DocumentType<Org>> = {
    ...orgData,
    privateKeyRef: await kms.getPrivateKeyRef(privateKey),
    publicKey: publicKeySerialised,
  };
  try {
    await orgModel.create(org);
  } catch (err) {
    if ((err as { code: number }).code === MONGODB_DUPLICATE_INDEX_CODE) {
      options.logger.info({ orgName: orgData.name }, 'Refused duplicated org name');
      return {
        didSucceed: false,
        context: OrgProblem.EXISTING_ORG_NAME,
      };
    }
    throw err as Error;
  }

  options.logger.info({ orgName: orgData.name }, 'Org created');
  return {
    didSucceed: true,
    result: { name: orgData.name, publicKey: publicKeySerialised.toString('base64') },
  };
}

export async function updateOrg(
  name: string,
  orgData: OrgPatchSchema,
  options: ServiceOptions,
): Promise<Result<undefined, OrgProblem>> {
  if (orgData.name !== undefined && name !== orgData.name) {
    options.logger.info(
      { originalName: name, targetName: orgData.name },
      'Refused non matching name',
    );
    return {
      didSucceed: false,
      context: OrgProblem.INVALID_ORG_NAME,
    };
  }

  const validationFailure = validateOrgData({ ...orgData }, options);

  if (validationFailure !== undefined) {
    return { didSucceed: false, context: validationFailure };
  }

  const orgModel = getModelForClass(Org, {
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
): Promise<Result<OrgReadSchema, OrgProblem>> {
  const orgModel = getModelForClass(Org, {
    existingConnection: options.dbConnection,
  });
  const org = await orgModel.findOne({ name });

  if (org === null) {
    return {
      didSucceed: false,
      context: OrgProblem.ORG_NOT_FOUND,
    };
  }

  return {
    didSucceed: true,
    result: { name: org.name, publicKey: org.publicKey.toString('base64') },
  };
}

export async function deleteOrg(
  orgName: string,
  options: ServiceOptions,
): Promise<Result<undefined, OrgProblem>> {
  const orgModel = getModelForClass(Org, {
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
