import { CloudEvent } from 'cloudevents';

export const OUTGOING_SERVICE_MESSAGE_TYPE =
  'tech.relaycorp.awala.endpoint-internet.outgoing-service-message';

export const OUTGOING_MESSAGE_SOURCE = 'https://relaycorp.tech/awala-endpoint-internet';

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
    source: OUTGOING_MESSAGE_SOURCE,
    subject: options.peerId,
    datacontenttype: options.contentType,
    data: options.content,
    time: options.creationDate.toISOString(),
    expiry: options.expiryDate.toISOString(),
  });
}
