import { createPublicKey } from 'node:crypto';

import { getModelForClass } from '@typegoose/typegoose';

import type { Result } from '../utilities/result.js';
import type { ServiceOptions } from '../utilities/serviceTypes.js';

import { MemberBundleRequestModel } from './MemberBundleRequest.model.js';
import { MemberPublicKey } from './MemberPublicKey.model.js';
import type { MemberPublicKeySchema } from './memberPublicKey.schema.js';
import { MemberPublicKeyProblem } from './MemberPublicKeyProblem.js';
import type { MemberPublicKeyCreationResult } from './memberPublicKeyTypes.js';

export async function createMemberPublicKey(
  memberId: string,
  memberPublicKeyData: MemberPublicKeySchema,
  options: ServiceOptions,
): Promise<Result<MemberPublicKeyCreationResult, MemberPublicKeyProblem>> {
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
      context: MemberPublicKeyProblem.MALFORMED_PUBLIC_KEY,
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
): Promise<Result<undefined, MemberPublicKeyProblem>> {
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
): Promise<Result<MemberPublicKeySchema, MemberPublicKeyProblem>> {
  const memberPublicKeyModel = getModelForClass(MemberPublicKey, {
    existingConnection: options.dbConnection,
  });

  const memberPublicKey = await memberPublicKeyModel.findById(publicKeyId);

  if (memberPublicKey === null || memberPublicKey.memberId !== memberId) {
    return {
      didSucceed: false,
      context: MemberPublicKeyProblem.PUBLIC_KEY_NOT_FOUND,
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
