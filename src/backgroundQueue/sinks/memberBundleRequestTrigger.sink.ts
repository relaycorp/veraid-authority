import { CloudEvent } from 'cloudevents';
import { addDays } from 'date-fns'
import { Types } from 'mongoose';

import { Emitter } from '../../utilities/eventing/Emitter.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';
import { MemberBundleRequestModelSchema } from '../../models/MemberBundleRequest.model.js';
import { getModelForClass } from '@typegoose/typegoose';
import { ServiceOptions } from '../../serviceTypes.js';

export default async function triggerBundleRequest(
  event: CloudEvent<unknown>,
  options: ServiceOptions,
): Promise<void> {
  options.logger.info({ source: event.source }, 'Triggering bundle request');

  const memberBundleRequestModel = getModelForClass(MemberBundleRequestModelSchema, {
    existingConnection: options.dbConnection,
  });
  const memberBundleRequests = await memberBundleRequestModel.find({
      memberBundleStartDate: {
        $lt: addDays(new Date(), 3)
      }
  })

  const emitter = Emitter.init() as Emitter<MemberBundleRequestPayload>;

  // implementation 1:
  const promises = memberBundleRequests.map((memberBundleRequest) => async function(){
    await emitter.emit(
      new CloudEvent<MemberBundleRequestPayload>({
        id: memberBundleRequest.publicKeyId,
        source: 'https://veraid.net/authority/bundle-request-trigger',
        type: BUNDLE_REQUEST_TYPE,
        data: { awalaPda: memberBundleRequest.awalaPda.toString("base64"), publicKeyId: memberBundleRequest.publicKeyId },
      }),
    );
    await memberBundleRequestModel.findByIdAndDelete(memberBundleRequest._id);
  })
  // instead Promise All we could use some external package
  // that allows running the promises in batches instead of all at once
  await Promise.all(promises);

  // implementation 2:
  const idsToDelete: Types.ObjectId[] = []
  const emitPromises = memberBundleRequests.map((memberBundleRequest) => async function(){
    await emitter.emit(
      new CloudEvent<MemberBundleRequestPayload>({
        id: memberBundleRequest.publicKeyId,
        source: 'https://veraid.net/authority/bundle-request-trigger',
        type: BUNDLE_REQUEST_TYPE,
        data: { awalaPda: memberBundleRequest.awalaPda.toString("base64"), publicKeyId: memberBundleRequest.publicKeyId },
      }),
    );
    idsToDelete.push(memberBundleRequest._id);
  })
  await Promise.all(emitPromises);
  // This way we ensure just one call to the db
  await memberBundleRequestModel.deleteMany({
    _id: idsToDelete
  });

}
