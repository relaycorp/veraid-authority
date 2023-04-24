import { CloudEvent } from 'cloudevents';

import {
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import type { ServiceOptions } from '../../serviceTypes.js';
import { postToAwala } from '../../awala.js';
import { generateMemberBundle } from '../../memberBundle.js';


export default async function triggerBundleRequest(
  event: CloudEvent<MemberBundleRequestPayload>,
  options: ServiceOptions,
): Promise<void> {
  options.logger.debug({ eventId: event.id }, 'Starting member bundle request trigger');
  if(!event.data){
    options.logger.debug({ eventId: event.id }, 'Empty event data in member bundle issuer trigger');
    return;
  }

  const memberBundle = await generateMemberBundle(event.data.publicKeyId, options);
  if(memberBundle.didSucceed){
    postToAwala(memberBundle.result, event.data.awalaPda);
  }
}
