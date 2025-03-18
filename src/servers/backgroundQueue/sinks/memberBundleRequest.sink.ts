import type { CloudEventV1 } from 'cloudevents';
import { getModelForClass } from '@typegoose/typegoose';
import { addDays } from 'date-fns';

import {
  MEMBER_CERTIFICATE_EXPIRY_DAYS,
  generateMemberBundle,
} from '../../../entities/memberKeys/memberBundle.js';
// eslint-disable-next-line max-len
import { MemberBundleRequestModel } from '../../../entities/memberKeys/MemberBundleRequest.model.js';
import { makeOutgoingServiceMessageEvent } from '../../../events/outgoingServiceMessage.event.js';
import { VeraidContentType } from '../../../utilities/veraid.js';
import type { ServiceOptions } from '../../../utilities/serviceTypes.js';
import { Emitter } from '../../../utilities/eventing/Emitter.js';
import { EmitterChannel } from '../../../utilities/eventing/EmitterChannel.js';

export default async function memberBundleIssuance(
  event: CloudEventV1<Buffer>,
  options: ServiceOptions,
): Promise<void> {
  const publicKeyId = event.data!.toString();
  const keyAwareLogger = options.logger.child({ publicKeyId });

  keyAwareLogger.debug('Processing member bundle request');

  if (event.subject === undefined) {
    keyAwareLogger.info('Refusing member bundle request with missing subject');
    return;
  }

  const memberBundle = await generateMemberBundle(publicKeyId, options);
  if (!memberBundle.didSucceed && memberBundle.context.didChainRetrievalFail) {
    return;
  }

  if (memberBundle.didSucceed) {
    keyAwareLogger.debug('Emitting member bundle event');

    const now = new Date();
    const message = makeOutgoingServiceMessageEvent({
      peerId: event.subject,
      contentType: VeraidContentType.MEMBER_BUNDLE,
      content: Buffer.from(memberBundle.result.serialise()),
      creationDate: now,
      expiryDate: addDays(now, MEMBER_CERTIFICATE_EXPIRY_DAYS),
    });

    const emitter = await Emitter.init(EmitterChannel.AWALA_OUTGOING_MESSAGES);
    await emitter.emit(message);
  }

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModel, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.deleteOne({ publicKeyId });
  keyAwareLogger.info('Deleted bundle request');
}
