import { CloudEvent } from 'cloudevents';
import { addDays } from 'date-fns';
import { getModelForClass } from '@typegoose/typegoose';

import { Emitter } from '../../utilities/eventing/Emitter.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import type { ServiceOptions } from '../../serviceTypes.js';

export const BUNDLE_REQUEST_DATE_RANGE = 3;
export default async function triggerBundleRequest(
  event: CloudEvent<unknown>,
  options: ServiceOptions,
): Promise<void> {
  options.logger.info({ eventId: event.id, eventType: event.type }, 'Triggering bundle request');

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  const memberBundleRequests = await memberBundleRequestModel.find({
    memberBundleStartDate: {
      $lt: addDays(new Date(), BUNDLE_REQUEST_DATE_RANGE),
    },
  });

  const emitter = Emitter.init() as Emitter<MemberBundleRequestPayload>;

  /* eslint-disable no-await-in-loop */
  for (const memberBundleRequest of memberBundleRequests) {
    await emitter.emit(
      new CloudEvent<MemberBundleRequestPayload>({
        id: memberBundleRequest.publicKeyId,
        source: 'https://veraid.net/authority/bundle-request-trigger',
        type: BUNDLE_REQUEST_TYPE,

        data: {
          awalaPda: memberBundleRequest.awalaPda.toString('base64'),
          publicKeyId: memberBundleRequest.publicKeyId,
        },
      }),
    );
    await memberBundleRequestModel.findByIdAndDelete(memberBundleRequest._id);
    options.logger.info(
      {
        eventId: event.id,
        eventType: event.type,
        memberBundleRequestId: memberBundleRequest._id.toString(),
      },
      'Emitted bundle request',
    );
  }
  /* eslint-enable no-await-in-loop */
}
