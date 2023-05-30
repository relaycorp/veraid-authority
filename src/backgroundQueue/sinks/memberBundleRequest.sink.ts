import type { CloudEvent } from 'cloudevents';
import { getModelForClass } from '@typegoose/typegoose';

import {
  MEMBER_BUNDLE_REQUEST_PAYLOAD,
} from '../../events/bundleRequest.event.js';
import { CERTIFICATE_EXPIRY_DAYS, generateMemberBundle } from '../../memberBundle.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import { validateMessage } from '../../utilities/validateMessage.js';

import type { SinkOptions } from './sinkTypes.js';
import { Emitter } from '../../utilities/eventing/Emitter.js';
import { makeOutgoingServiceMessageEvent } from '../../events/outgoingServiceMessage.event.js';
import { VeraidContentType } from '../../utilities/veraid.js';
import { addDays } from 'date-fns';

export default async function memberBundleIssuance(
  event: CloudEvent<unknown>,
  options: SinkOptions,
): Promise<void> {
  options.logger.debug({ eventId: event.id }, 'Starting member bundle request trigger');

  const validatedData = validateMessage(event.data, MEMBER_BUNDLE_REQUEST_PAYLOAD);
  if (typeof validatedData === 'string') {
    options.logger.info(
      { eventId: event.id, validationError: validatedData },
      'Refusing malformed member bundle request event',
    );
    return;
  }

  const memberBundle = await generateMemberBundle(validatedData.publicKeyId, options);
  if (!memberBundle.didSucceed && memberBundle.context.shouldRetry) {
    return;
  }

  if (memberBundle.didSucceed) {
    options.logger.debug(
      { eventId: event.id, memberPublicKeyId: validatedData.publicKeyId },
      'Sending member bundle to Awala',
    );

    const now = new Date();
    const message = makeOutgoingServiceMessageEvent({
      publicKeyId: validatedData.publicKeyId,
      peerId: validatedData.peerId,
      contentType: VeraidContentType.MEMBER_BUNDLE,
      content:  Buffer.from(memberBundle.result),
      creationDate: now,
      expiryDate: addDays(now, CERTIFICATE_EXPIRY_DAYS)
    })
    const emitter = Emitter.init();

    await emitter.emit(message,);
  }

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  await memberBundleRequestModel.deleteOne({
    publicKeyId: validatedData.publicKeyId,
  });
  options.logger.info(
    { eventId: event.id, memberPublicKeyId: validatedData.publicKeyId },
    'Removed Bundle Request',
  );
}
