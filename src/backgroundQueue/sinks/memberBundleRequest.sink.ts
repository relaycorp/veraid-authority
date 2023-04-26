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

  const validatedData = validateMessage(event.data, MEMBER_BUNDLE_REQUEST_PAYLOAD);
  if (typeof validatedData === 'string') {
    options.logger.info(
      { eventId: event.id, validationError: validatedData },
      'Malformed event data',
    );
    return;
  }

  const memberBundle = await generateMemberBundle(validatedData.publicKeyId, options);
  if (!memberBundle.didSucceed && memberBundle.reason.shouldRetry) {
    return;
  }

  if (memberBundle.didSucceed) {
    options.logger.debug(
      { eventId: event.id, memberPublicKeyId: validatedData.publicKeyId },
      'Sending member bundle to Awala',
    );
    const awalaResponse = await postToAwala(
      memberBundle.result,
      validatedData.awalaPda,
      options.awalaMiddlewareEndpoint,
    );

    if (!awalaResponse.didSucceed) {
      options.logger.info(
        { eventId: event.id, reason: awalaResponse.reason },
        'Posting to awala failed',
      );
      return;
    }
  }

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.deleteMany({
    publicKeyId: validatedData.publicKeyId,
  });
  options.logger.info(
    { eventId: event.id, publicKeyId: validatedData.publicKeyId },
    'Removed Bundle Request',
  );
}
