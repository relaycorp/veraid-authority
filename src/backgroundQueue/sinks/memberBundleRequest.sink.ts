import type { CloudEventV1 } from 'cloudevents';
import { getModelForClass } from '@typegoose/typegoose';
import { addDays } from 'date-fns';

import { CERTIFICATE_EXPIRY_DAYS, generateMemberBundle } from '../../memberBundle.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import { makeOutgoingServiceMessageEvent } from '../../events/outgoingServiceMessage.event.js';
import { VeraidContentType } from '../../utilities/veraid.js';
import type { ServiceOptions } from '../../serviceTypes.js';
import { Emitter } from '../../utilities/eventing/Emitter.js';
import { EmitterChannel } from '../../utilities/eventing/EmitterChannel.js';

export default async function memberBundleIssuance(
  event: CloudEventV1<unknown>,
  options: ServiceOptions,
): Promise<void> {
  const publicKeyId = event.id;
  const keyAwareLogger = options.logger.child({ publicKeyId });

  keyAwareLogger.debug('Starting member bundle request trigger');

  if (event.subject === undefined) {
    keyAwareLogger.info('Refusing member bundle request with missing subject');
    return;
  }

  const memberBundle = await generateMemberBundle(publicKeyId, options);
  if (!memberBundle.didSucceed && memberBundle.context.chainRetrievalFailed) {
    return;
  }

  if (memberBundle.didSucceed) {
    keyAwareLogger.debug('Emitting member bundle event');

    const now = new Date();
    const message = makeOutgoingServiceMessageEvent({
      publicKeyId,
      peerId: event.subject,
      contentType: VeraidContentType.MEMBER_BUNDLE,
      content: Buffer.from(memberBundle.result),
      creationDate: now,
      expiryDate: addDays(now, CERTIFICATE_EXPIRY_DAYS),
    });

    const emitter = await Emitter.init(EmitterChannel.AWALA_OUTGOING_MESSAGES);
    await emitter.emit(message);
  }

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.deleteOne({ publicKeyId });
  keyAwareLogger.info('Deleted bundle request');
}
