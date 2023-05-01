import { getModelForClass } from '@typegoose/typegoose';
import { CloudEvent } from 'cloudevents';

import type { Result, SuccessfulResult } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import { MemberKeyImportTokenModelSchema } from './models/MemberKeyImportToken.model.js';
import type { MemberKeyImportTokenCreationResult } from './memberKeyImportTokenTypes.js';
import { MemberPublicKeyImportProblemType } from './MemberKeyImportTokenProblemType.js';
import { createMemberPublicKey } from './memberPublicKey.js';
import type { MemberKeyImportRequest } from './schemas/awala.schema.js';
import { Emitter } from './utilities/eventing/Emitter.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from './events/bundleRequest.event.js';

export async function createMemberKeyImportToken(
  memberId: string,
  serviceOid: string,
  options: ServiceOptions,
): Promise<SuccessfulResult<MemberKeyImportTokenCreationResult>> {
  const memberKeyImportTokenModel = getModelForClass(MemberKeyImportTokenModelSchema, {
    existingConnection: options.dbConnection,
  });

  const memberKeyImportToken = await memberKeyImportTokenModel.create({
    memberId,
    serviceOid,
  });

  options.logger.info(
    { memberKeyImportTokenId: memberKeyImportToken.id },
    'Member key import token created',
  );
  return {
    didSucceed: true,

    result: {
      id: memberKeyImportToken.id,
    },
  };
}

export async function processMemberKeyImportToken(
  keyImportData: MemberKeyImportRequest,
  options: ServiceOptions,
): Promise<Result<undefined, MemberPublicKeyImportProblemType>> {
  const memberKeyImportTokenModel = getModelForClass(MemberKeyImportTokenModelSchema, {
    existingConnection: options.dbConnection,
  });

  const memberKeyImportToken = await memberKeyImportTokenModel.findById(
    keyImportData.publicKeyImportToken,
  );
  if (!memberKeyImportToken) {
    options.logger.info(
      { memberKeyImportTokenId: keyImportData.publicKeyImportToken },
      'Member public key import token not found',
    );
    return {
      didSucceed: false,
      reason: MemberPublicKeyImportProblemType.TOKEN_NOT_FOUND,
    };
  }

  const publicKeyCreationResult = await createMemberPublicKey(
    memberKeyImportToken.memberId,
    {
      publicKey: keyImportData.publicKey,
      serviceOid: memberKeyImportToken.serviceOid,
    },
    options,
  );

  if (!publicKeyCreationResult.didSucceed) {
    return {
      didSucceed: false,
      reason: MemberPublicKeyImportProblemType.KEY_CREATION_ERROR,
    };
  }

  const emitter = Emitter.init() as Emitter<MemberBundleRequestPayload>;
  const event = new CloudEvent({
    id: memberKeyImportToken.memberId,
    source: 'https://veraid.net/authority/awala-member-key-import',
    type: BUNDLE_REQUEST_TYPE,

    data: {
      publicKeyId: publicKeyCreationResult.result.id,
      awalaPda: keyImportData.awalaPda,
    },
  });
  await emitter.emit(event);

  await memberKeyImportTokenModel.findByIdAndDelete(keyImportData.publicKeyImportToken);
  options.logger.info(
    { memberKeyImportTokenId: keyImportData.publicKeyImportToken },
    'Member public key import token deleted',
  );
  return {
    didSucceed: true,
  };
}
