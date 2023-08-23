import { CloudEvent, type CloudEventV1 } from 'cloudevents';
import { addDays } from 'date-fns';
import { getModelForClass } from '@typegoose/typegoose';
import type { HydratedDocument } from 'mongoose';

import { Emitter } from '../../utilities/eventing/Emitter.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import type { ServiceOptions } from '../../serviceTypes.js';
import { EmitterChannel } from '../../utilities/eventing/EmitterChannel.js';

async function triggerMemberBundleIssuance(
  memberBundleRequest: HydratedDocument<MemberBundleRequestModelSchema>,
  emitter: Emitter<MemberBundleRequestPayload>,
): Promise<void> {
  await emitter.emit(
    new CloudEvent<MemberBundleRequestPayload>({
      id: memberBundleRequest.publicKeyId,
      source: 'https://veraid.net/authority/bundle-request-trigger',
      type: BUNDLE_REQUEST_TYPE,
      subject: memberBundleRequest.peerId,
    }),
  );
}

export const BUNDLE_REQUEST_DATE_RANGE = 3;

export default async function triggerBundleRequest(
  event: CloudEventV1<unknown>,
  options: ServiceOptions,
): Promise<void> {
  options.logger.debug({ eventId: event.id }, 'Starting member bundle request trigger');

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  const memberBundleRequests = await memberBundleRequestModel.find({
    memberBundleStartDate: {
      $lt: addDays(new Date(), BUNDLE_REQUEST_DATE_RANGE),
    },
  });

  const emitter = await Emitter.init(EmitterChannel.BACKGROUND_QUEUE);
  for (const memberBundleRequest of memberBundleRequests) {
    // eslint-disable-next-line no-await-in-loop
    await triggerMemberBundleIssuance(memberBundleRequest, emitter);
    options.logger.info(
      {
        eventId: event.id,
        eventType: event.type,
        memberBundleRequestId: memberBundleRequest._id.toString(),
      },
      'Emitted bundle request',
    );
  }
}
