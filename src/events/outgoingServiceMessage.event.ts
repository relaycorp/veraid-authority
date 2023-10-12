import { CloudEvent } from 'cloudevents';

export const OUTGOING_SERVICE_MESSAGE_TYPE =
  'tech.relaycorp.awala.endpoint-internet.outgoing-service-message';

export const DEFAULT_ENDPOINT_ID = 'default';

export interface OutgoingServiceMessageOptions {
  readonly creationDate: Date;
  readonly expiryDate: Date;
  readonly peerId: string;
  readonly contentType: string;
  readonly content: Buffer;
}

export function makeOutgoingServiceMessageEvent(
  options: OutgoingServiceMessageOptions,
): CloudEvent<Buffer> {
  return new CloudEvent({
    specversion: '1.0',
    type: OUTGOING_SERVICE_MESSAGE_TYPE,
    source: DEFAULT_ENDPOINT_ID,
    subject: options.peerId,
    datacontenttype: options.contentType,
    data: options.content,
    time: options.creationDate.toISOString(),
    expiry: options.expiryDate.toISOString(),
  });
}
