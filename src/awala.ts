import { getModelForClass } from '@typegoose/typegoose';

import type { Result, SuccessfulResult } from './utilities/result.js';
import type { ServiceOptions } from './serviceTypes.js';
import type { MemberBundleRequest } from './schemas/awala.schema.js';
import { MemberBundleRequestModelSchema } from './models/MemberBundleRequest.model.js';

export async function createMemberBundleRequest(
  requestData: MemberBundleRequest,
  options: ServiceOptions,
): Promise<SuccessfulResult<undefined>> {
  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.updateOne(
    {
      publicKeyId: requestData.publicKeyId,
    },
    {
      publicKeyId: requestData.publicKeyId,
      memberBundleStartDate: new Date(requestData.memberBundleStartDate),
      signature: Buffer.from(requestData.signature, 'base64'),
      awalaPda: Buffer.from(requestData.awalaPda, 'base64'),
    },
    {
      upsert: true,
    },
  );

  options.logger.info({ publicKeyId: requestData.publicKeyId }, 'Member bundle request created');

  return {
    didSucceed: true,
  };
}

export async function postToAwala(
  data: BodyInit,
  awalaPda: string,
  awalaMiddlewareUrl: URL
): Promise<Result<undefined, string>> {
  const pdaResponse = await fetch(awalaMiddlewareUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/vnd+relaycorp.awala.pda-path' },
    body: awalaPda,
  });
  const { recipientId } = await pdaResponse.json();

  if (!recipientId) {
    return {
      didSucceed: false,
      reason: 'Recipient id was missing from Awala PDA import response',
    };
  }

  await fetch(awalaMiddlewareUrl, {
    body: data,
    headers: {
      'Content-Type': 'application/vnd.veraid.member-bundle',
      'X-Awala-Recipient': recipientId,
    },
  });

  return {
    didSucceed: true,
  };
}
