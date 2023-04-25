import type { CloudEvent } from 'cloudevents';
import { getModelForClass } from '@typegoose/typegoose';

import {
  type MemberBundleRequestPayload,
  MEMBER_BUNDLE_REQUEST_PAYLOAD,
} from '../../events/bundleRequest.event.js';
import { postToAwala } from '../../awala.js';
import { generateMemberBundle } from '../../memberBundle.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import { validateMessage } from '../../utilities/validateMessage.js';

import type { SinkOptions } from './sinkTypes.js';

export default async function memberBundleIssueRequest(
  event: CloudEvent<MemberBundleRequestPayload>,
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
    await postToAwala(
      memberBundle.result,
      validatedMessage.awalaPda,
      options.awalaMiddlewareEndpoint,
    );
  }

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.findByIdAndDelete(validatedMessage.publicKeyId);
}
