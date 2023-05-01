import { getModelForClass } from '@typegoose/typegoose';

import type { Result } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import type { MemberBundleRequest } from './schemas/awala.schema.js';
import { MemberBundleRequestModelSchema } from './models/MemberBundleRequest.model.js';
import { MemberPublicKeyModelSchema } from './models/MemberPublicKey.model.js';
import { VeraidContentType } from './utilities/veraid.js';
import { AwalaContentType } from './utilities/awala.js';

const contentTypeHeaderName = 'content-type';
const awalaRecipientHeaderName = 'X-Awala-Recipient';

export async function createMemberBundleRequest(
  requestData: MemberBundleRequest,
  options: ServiceOptions,
): Promise<Result<undefined, undefined>> {
  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  const memberPublicKeyModel = getModelForClass(MemberPublicKeyModelSchema, {
    existingConnection: options.dbConnection,
  });
  const publicKey = await memberPublicKeyModel.findById(requestData.publicKeyId);

  if (!publicKey) {
    options.logger.info(
      { memberPublicKeyId: requestData.publicKeyId },
      'Member public key not found',
    );
    return {
      didSucceed: false,
    };
  }

  await memberBundleRequestModel.updateOne(
    {
      publicKeyId: requestData.publicKeyId,
    },
    {
      publicKeyId: requestData.publicKeyId,
      memberBundleStartDate: new Date(requestData.memberBundleStartDate),
      signature: Buffer.from(requestData.signature, 'base64'),
      awalaPda: Buffer.from(requestData.awalaPda, 'base64'),
      memberId: publicKey.memberId,
    },
    {
      upsert: true,
    },
  );

  options.logger.info(
    { memberPublicKeyId: requestData.publicKeyId },
    'Member bundle request created',
  );

  return {
    didSucceed: true,
  };
}

export async function postToAwala(
  data: BodyInit,
  awalaPda: string,
  awalaMiddlewareUrl: URL,
): Promise<Result<undefined, string>> {
  const pdaResponse = await fetch(awalaMiddlewareUrl, {
    method: 'POST',
    headers: { [contentTypeHeaderName]: AwalaContentType.PDA },
    body: awalaPda,
  });
  const { recipientId } = (await pdaResponse.json()) as {
    recipientId: string;
  };

  if (!recipientId) {
    return {
      didSucceed: false,
      reason: 'Recipient id was missing from Awala PDA import response',
    };
  }

  await fetch(awalaMiddlewareUrl, {
    body: data,
    method: 'POST',

    headers: {
      [contentTypeHeaderName]: VeraidContentType.MEMBER_BUNDLE,
      [awalaRecipientHeaderName]: recipientId,
    },
  });

  return {
    didSucceed: true,
  };
}
