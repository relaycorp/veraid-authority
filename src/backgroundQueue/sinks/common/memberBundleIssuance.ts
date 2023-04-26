import { getModelForClass } from '@typegoose/typegoose';

import { postToAwala } from '../../../awala.js';
import { generateMemberBundle } from '../../../memberBundle.js';
import { MemberBundleRequestModelSchema } from '../../../models/MemberBundleRequest.model.js';

import type { SinkOptions } from './../sinkTypes.js';

export async function memberBundleIssuance(
  eventData: {
    eventId: string,
    awalaPda: string,
    memberPublicKeyId: string
  },
  options: SinkOptions,
  postJSONToAwala: boolean,
): Promise<void> {

  const memberBundle = await generateMemberBundle(eventData.memberPublicKeyId, options);
  if (!memberBundle.didSucceed && memberBundle.reason.shouldRetry) {
    return;
  }

  if (memberBundle.didSucceed) {
    options.logger.debug(
      { eventId: eventData.eventId, memberPublicKeyId: eventData.memberPublicKeyId },
      'Sending member bundle to Awala',
    );
    const awalaResponse = await postToAwala(
      postJSONToAwala?memberBundle.result: JSON.stringify({
        memberBundle: Buffer.from(memberBundle.result).toString('base64'),
        publicKeyId: eventData.memberPublicKeyId
      }),
      eventData.awalaPda,
      options.awalaMiddlewareEndpoint,
    );

    if (!awalaResponse.didSucceed) {
      options.logger.info(
        { eventId: eventData.eventId, reason: awalaResponse.reason },
        'Posting to awala failed',
      );
      return;
    }
  }

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.deleteMany({
    publicKeyId: eventData.memberPublicKeyId,
  });
  options.logger.info(
    { eventId: eventData.eventId, publicKeyId: eventData.memberPublicKeyId },
    'Removed Bundle Request',
  );
}
