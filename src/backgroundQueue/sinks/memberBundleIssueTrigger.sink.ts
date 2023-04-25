import type { CloudEvent } from 'cloudevents';

import type { MemberBundleRequestPayload } from '../../events/bundleRequest.event.js';
import { postToAwala } from '../../awala.js';
import { generateMemberBundle } from '../../memberBundle.js';
import { SinkOptions } from './sinkTypes.js';
import { getModelForClass } from '@typegoose/typegoose';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';

export default async function triggerBundleRequest(
  event: CloudEvent<MemberBundleRequestPayload>,
  options: SinkOptions,
): Promise<void> {
  options.logger.debug({ eventId: event.id }, 'Starting member bundle request trigger');

  // use json schema to validate
  if (!event.data?.publicKeyId) {
    options.logger.debug({ eventId: event.id }, 'Empty event data in member bundle issuer trigger');
    return;
  }


  const memberBundle = await generateMemberBundle(event.data.publicKeyId, options);
  if(!memberBundle.didSucceed && memberBundle.reason.shouldRetry){
    return;
  }

  if (memberBundle.didSucceed) {
    await postToAwala(memberBundle.result, event.data.awalaPda,  options.awalaMiddlewareEndpoint);
  }



  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.findByIdAndDelete(event.data.publicKeyId);
}
