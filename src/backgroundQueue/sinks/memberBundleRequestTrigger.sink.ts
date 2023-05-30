import { CloudEvent } from 'cloudevents';
import { addDays } from 'date-fns';
import { getModelForClass } from '@typegoose/typegoose';
import type { HydratedDocument } from 'mongoose';

import { Emitter } from '../../utilities/eventing/Emitter.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';

import type { SinkOptions } from './sinkTypes.js';

const triggerMemberBundleIssuance = async (
  memberBundleRequest: HydratedDocument<MemberBundleRequestModelSchema>,
  emitter: Emitter<MemberBundleRequestPayload>,
) => {
  await emitter.emit(
    new CloudEvent<MemberBundleRequestPayload>({
      id: memberBundleRequest.publicKeyId,
      source: 'https://veraid.net/authority/bundle-request-trigger',
      type: BUNDLE_REQUEST_TYPE,

      data: {
        peerId: memberBundleRequest.peerId,
        publicKeyId: memberBundleRequest.publicKeyId,
      },
    }),
  );
};
export const BUNDLE_REQUEST_DATE_RANGE = 3;

export default async function triggerBundleRequest(
  event: CloudEvent<unknown>,
  options: SinkOptions,
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

  const emitter = Emitter.init() as Emitter<MemberBundleRequestPayload>;

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
