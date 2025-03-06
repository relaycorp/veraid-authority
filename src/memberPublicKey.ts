import { createPublicKey } from 'node:crypto';

import { getModelForClass } from '@typegoose/typegoose';

import type { Result } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberPublicKey } from './models/MemberPublicKey.model.js';
import type { MemberPublicKeySchema } from './schemas/memberPublicKey.schema.js';
import { MemberPublicKeyProblemType } from './MemberPublicKeyProblemType.js';
import type { MemberPublicKeyCreationResult } from './memberPublicKeyTypes.js';
import { MemberBundleRequestModel } from './models/MemberBundleRequest.model.js';

export async function createMemberPublicKey(
  memberId: string,
  memberPublicKeyData: MemberPublicKeySchema,
  options: ServiceOptions,
): Promise<Result<MemberPublicKeyCreationResult, MemberPublicKeyProblemType>> {
  const memberPublicKeyBuffer = Buffer.from(memberPublicKeyData.publicKey, 'base64');

  try {
    createPublicKey({
      key: memberPublicKeyBuffer,
      format: 'der',
      type: 'spki',
    });
  } catch {
    options.logger.info(
      { publicKey: memberPublicKeyData.publicKey },
      'Refused malformed public key',
    );
    return {
      didSucceed: false,
      context: MemberPublicKeyProblemType.MALFORMED_PUBLIC_KEY,
    };
  }

  const memberPublicKeyModel = getModelForClass(MemberPublicKey, {
    existingConnection: options.dbConnection,
  });
  const memberPublicKey = await memberPublicKeyModel.create({
    ...memberPublicKeyData,
    memberId,
    publicKey: memberPublicKeyBuffer,
  });

  options.logger.info({ memberPublicKeyId: memberPublicKey.id }, 'Member public key created');
  return {
    didSucceed: true,

    result: {
      id: memberPublicKey.id,
    },
  };
}

export async function deleteMemberPublicKey(
  publicKeyId: string,
  options: ServiceOptions,
): Promise<Result<undefined, MemberPublicKeyProblemType>> {
  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModel, {
    existingConnection: options.dbConnection,
  });
  const memberPublicKey = getModelForClass(MemberPublicKey, {
    existingConnection: options.dbConnection,
  });

  // Defer the key deletion until the end to make retries possible, in case we fail to delete dependant records.
  await memberBundleRequestModel.deleteOne({
    publicKeyId,
  });
  await memberPublicKey.findByIdAndDelete(publicKeyId);

  options.logger.info({ memberPublicKeyId: publicKeyId }, 'Member public key deleted');
  return {
    didSucceed: true,
  };
}

export async function getMemberPublicKey(
  memberId: string,
  publicKeyId: string,
  options: ServiceOptions,
): Promise<Result<MemberPublicKeySchema, MemberPublicKeyProblemType>> {
  const memberPublicKeyModel = getModelForClass(MemberPublicKey, {
    existingConnection: options.dbConnection,
  });

  const memberPublicKey = await memberPublicKeyModel.findById(publicKeyId);

  if (memberPublicKey === null || memberPublicKey.memberId !== memberId) {
    return {
      didSucceed: false,
      context: MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND,
    };
  }
  return {
    didSucceed: true,

    result: {
      publicKey: memberPublicKey.publicKey.toString('base64'),
      serviceOid: memberPublicKey.serviceOid,
    },
  };
}
