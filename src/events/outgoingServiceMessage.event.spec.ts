import { randomUUID } from 'node:crypto';

import { addMinutes } from 'date-fns';

import { AWALA_PEER_ID } from '../testUtils/stubs.js';

import {
  type OutgoingServiceMessageOptions,
  makeOutgoingServiceMessageEvent,
} from './outgoingServiceMessage.event.js';
import {
  CE_SERVICE_MESSAGE_CONTENT,
  CE_SERVICE_MESSAGE_CONTENT_TYPE,
} from '../testUtils/eventing/stubs.js';

describe('makeIncomingServiceMessageEvent', () => {
  const options: OutgoingServiceMessageOptions = {
    creationDate: new Date(),
    expiryDate: addMinutes(new Date(), 5),
    publicKeyId: randomUUID(),
    contentType: CE_SERVICE_MESSAGE_CONTENT_TYPE,
    content: CE_SERVICE_MESSAGE_CONTENT,
    peerId: AWALA_PEER_ID,
  };

  test('Event spec version should be 1.0', () => {
    const { specversion: version } = makeOutgoingServiceMessageEvent(options);

    expect(version).toBe('1.0');
  });

  test('Event id should be the parcel id', () => {
    const { id } = makeOutgoingServiceMessageEvent(options);

    expect(id).toBe(options.publicKeyId);
  });

  test('Event type should be outgoing-service-message', () => {
    const { type } = makeOutgoingServiceMessageEvent(options);

    expect(type).toBe('com.relaycorp.awala.endpoint-internet.outgoing-service-message');
  });

  test('Event source should be awala-endpoint-internet', () => {
    const { source } = makeOutgoingServiceMessageEvent(options);

    expect(source).toBe('https://relaycorp.tech/awala-endpoint-internet');
  });

  test('Event subject should be the peer id', () => {
    const { subject } = makeOutgoingServiceMessageEvent(options);

    expect(subject).toBe(options.peerId);
  });

  test('Event data content type should be that of the service message', () => {
    const { datacontenttype: contentType } = makeOutgoingServiceMessageEvent(options);

    expect(contentType).toBe(options.contentType);
  });

  test('Event data should be the service message content, base64-encoded', () => {
    const { data_base64: dataBase64 } = makeOutgoingServiceMessageEvent(options);

    expect(dataBase64).toBe(options.content.toString('base64'));
  });

  test('Event time should be parcel creation time', () => {
    const { time } = makeOutgoingServiceMessageEvent(options);

    expect(time).toBe(options.creationDate.toISOString());
  });

  test('Event expiry should be parcel expiry time', () => {
    const { expiry } = makeOutgoingServiceMessageEvent(options);

    expect(expiry).toBe(options.expiryDate.toISOString());
  });

  test('Event should be valid', () => {
    const event = makeOutgoingServiceMessageEvent(options);

    expect(event.validate()).toBeTrue();
  });
});
