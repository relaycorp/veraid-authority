import { getModelForClass } from '@typegoose/typegoose';
import { CloudEvent } from 'cloudevents';

import type { Result, SuccessfulResult } from '../utilities/result.js';
import type { ServiceOptions } from '../serviceTypes.js';
import { createMemberPublicKey } from '../memberKeys/memberPublicKey.js';
import type { MemberKeyImportRequest } from '../schemas/awala.schema.js';
import { BUNDLE_REQUEST_TYPE } from '../events/bundleRequest.event.js';
import { Emitter } from '../utilities/eventing/Emitter.js';
import { EmitterChannel } from '../utilities/eventing/EmitterChannel.js';

import { MemberPublicKeyImportProblem } from './MemberKeyImportTokenProblem.js';
import type { MemberKeyImportTokenCreationResult } from './memberKeyImportTokenTypes.js';
import { MemberKeyImportToken } from './MemberKeyImportToken.model.js';

export async function createMemberKeyImportToken(
  memberId: string,
  serviceOid: string,
  options: ServiceOptions,
): Promise<SuccessfulResult<MemberKeyImportTokenCreationResult>> {
  const memberKeyImportTokenModel = getModelForClass(MemberKeyImportToken, {
    existingConnection: options.dbConnection,
  });

  const memberKeyImportToken = await memberKeyImportTokenModel.create({
    memberId,
    serviceOid,
  });

  options.logger.info({ serviceOid }, 'Member key import token created');
  return {
    didSucceed: true,

    result: {
      id: memberKeyImportToken.id,
    },
  };
}

export async function processMemberKeyImportToken(
  peerId: string,
  keyImportRequest: MemberKeyImportRequest,
  options: ServiceOptions,
): Promise<Result<undefined, MemberPublicKeyImportProblem>> {
  const memberKeyImportTokenModel = getModelForClass(MemberKeyImportToken, {
    existingConnection: options.dbConnection,
  });
  const memberKeyImportToken = await memberKeyImportTokenModel.findById(
    keyImportRequest.publicKeyImportToken,
  );
  if (!memberKeyImportToken) {
    options.logger.info(
      { memberKeyImportToken: keyImportRequest.publicKeyImportToken },
      'Member public key import token not found',
    );
    return {
      didSucceed: false,
      context: MemberPublicKeyImportProblem.NOT_FOUND,
    };
  }

  const publicKeyCreationResult = await createMemberPublicKey(
    memberKeyImportToken.memberId,
    {
      publicKey: keyImportRequest.publicKey,
      serviceOid: memberKeyImportToken.serviceOid,
    },
    options,
  );

  if (!publicKeyCreationResult.didSucceed) {
    return {
      didSucceed: false,
      context: MemberPublicKeyImportProblem.KEY_CREATION_ERROR,
    };
  }

  const event = new CloudEvent<Buffer>({
    source: 'https://veraid.net/authority/awala-member-key-import',
    type: BUNDLE_REQUEST_TYPE,
    subject: peerId,
    datacontenttype: 'text/plain',
    data: Buffer.from(publicKeyCreationResult.result.id),
  });
  const ceEmitter = await Emitter.init(EmitterChannel.BACKGROUND_QUEUE);
  await ceEmitter.emit(event);

  await memberKeyImportTokenModel.findByIdAndDelete(keyImportRequest.publicKeyImportToken);
  options.logger.info(
    { memberKeyImportToken: keyImportRequest.publicKeyImportToken },
    'Member public key import token deleted',
  );
  return {
    didSucceed: true,
  };
}
