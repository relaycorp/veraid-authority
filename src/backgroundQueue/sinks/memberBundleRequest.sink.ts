import type { CloudEvent } from 'cloudevents';
import { getModelForClass } from '@typegoose/typegoose';

import { MEMBER_BUNDLE_REQUEST_PAYLOAD } from '../../events/bundleRequest.event.js';
import { postToAwala } from '../../awala.js';
import { generateMemberBundle } from '../../memberBundle.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import { validateMessage } from '../../utilities/validateMessage.js';

import type { SinkOptions } from './sinkTypes.js';

export default async function memberBundleIssuance(
  event: CloudEvent<unknown>,
  options: SinkOptions,
): Promise<void> {
  options.logger.debug({ eventId: event.id }, 'Starting member bundle request trigger');

  const validatedMessage = validateMessage(event.data, MEMBER_BUNDLE_REQUEST_PAYLOAD);
  if (typeof validatedMessage === 'string') {
    return;
  }

  const memberBundle = await generateMemberBundle(validatedMessage.publicKeyId, options);
  if (!memberBundle.didSucceed && memberBundle.reason.shouldRetry) {
    return;
  }

  if (memberBundle.didSucceed) {
    options.logger.debug({ eventId: event.id, memberPublicKeyId: validatedMessage.publicKeyId }, 'Sending member bundle to Awala');
    await postToAwala(
      memberBundle.result,
      validatedMessage.awalaPda,
      options.awalaMiddlewareEndpoint,
    );
  }

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.deleteMany({
    publicKeyId: validatedMessage.publicKeyId
  });
  options.logger.debug({ eventId: event.id, publicKeyId: validatedMessage.publicKeyId }, 'Removed Bundle Request');

}
