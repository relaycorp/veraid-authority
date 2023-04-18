import { CloudEvent } from 'cloudevents';
import type { BaseLogger } from 'pino';

import { Emitter } from '../../utilities/eventing/Emitter.js';
import {
  BUNDLE_REQUEST_TYPE,
  type MemberBundleRequestPayload,
} from '../../events/bundleRequest.event.js';

export default async function triggerBundleRequest(
  event: CloudEvent<unknown>,
  logger: BaseLogger,
): Promise<void> {
  logger.info({ source: event.source }, 'Triggering bundle request');

  // Retrieve the requests that should be processed from the database

  const emitter = Emitter.init() as Emitter<MemberBundleRequestPayload>;

  // You'd emit one event per bundle request.
  await emitter.emit(
    new CloudEvent<MemberBundleRequestPayload>({
      id: 'the public key id', // Really should be the key id to allow broker to dedupe requests
      source: 'https://veraid.net/authority/bundle-request-trigger',
      type: BUNDLE_REQUEST_TYPE,
      data: { awalaPda: 'PDA, base64-encoded', publicKeyId: 'the public key id' },
    }),
  );
}
