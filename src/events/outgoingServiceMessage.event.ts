import { CloudEvent } from 'cloudevents';

const OUTGOING_SERVICE_MESSAGE_TYPE =
  'com.relaycorp.awala.endpoint-internet.outgoing-service-message';

const OUTGOING_SERVICE_MESSAGE_SENDER_ID =
  'https://relaycorp.tech/awala-endpoint-internet';

export interface OutgoingServiceMessageOptions {
  readonly creationDate: Date;
  readonly expiryDate: Date;
  readonly publicKeyId: string;
  readonly peerId: string;
  readonly contentType: string;
  readonly content: Buffer;
}

export function makeOutgoingServiceMessageEvent(
  options: OutgoingServiceMessageOptions,
): CloudEvent {
  return new CloudEvent({
    specversion: '1.0',
    type: OUTGOING_SERVICE_MESSAGE_TYPE,
    id: options.publicKeyId,
    source: OUTGOING_SERVICE_MESSAGE_SENDER_ID,
    subject: options.peerId,
    datacontenttype: options.contentType,
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    data_base64: options.content.toString('base64'),
    time: options.creationDate.toISOString(),
    expiry: options.expiryDate.toISOString(),
  });
}
