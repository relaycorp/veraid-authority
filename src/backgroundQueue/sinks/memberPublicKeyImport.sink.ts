import type { CloudEvent } from 'cloudevents';

import { validateMessage } from '../../utilities/validateMessage.js';

import type { SinkOptions } from './sinkTypes.js';
import { memberBundleIssuance } from './common/memberBundleIssuance.js';
import { MEMBER_KEY_IMPORT_PAYLOAD } from '../../events/memberPublicKeyImport.event.js';

export default async function memberBundleKeyImportHandler(
  event: CloudEvent<unknown>,
  options: SinkOptions,
): Promise<void> {
  options.logger.debug({ eventId: event.id }, 'Starting member bundle request trigger');

  const validatedData = validateMessage(event.data, MEMBER_KEY_IMPORT_PAYLOAD);
  if (typeof validatedData === 'string') {
    options.logger.info(
      { eventId: event.id, validationError: validatedData },
      'Malformed event data',
    );
    return;
  }
  await memberBundleIssuance({
    eventId: event.id,
    memberPublicKeyId: validatedData.publicKeyId,
    awalaPda: validatedData.awalaPda
  }, options, false)
}
