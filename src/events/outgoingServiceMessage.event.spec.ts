import { addMinutes } from 'date-fns';

import { AWALA_PEER_ID } from '../testUtils/stubs.js';
import {
  CE_SERVICE_MESSAGE_CONTENT,
  CE_SERVICE_MESSAGE_CONTENT_TYPE,
} from '../testUtils/eventing/stubs.js';

import {
  type OutgoingServiceMessageOptions,
  makeOutgoingServiceMessageEvent,
  DEFAULT_ENDPOINT_ID,
} from './outgoingServiceMessage.event.js';

describe('makeIncomingServiceMessageEvent', () => {
  const options: OutgoingServiceMessageOptions = {
    creationDate: new Date(),
    expiryDate: addMinutes(new Date(), 5),
    contentType: CE_SERVICE_MESSAGE_CONTENT_TYPE,
    content: CE_SERVICE_MESSAGE_CONTENT,
    peerId: AWALA_PEER_ID,
  };

  test('Event spec version should be 1.0', () => {
    const { specversion: version } = makeOutgoingServiceMessageEvent(options);

    expect(version).toBe('1.0');
  });

  test('Event id should be auto-generated', () => {
    const { id } = makeOutgoingServiceMessageEvent(options);

    expect(id).toBeString();
  });

  test('Event type should be outgoing-service-message', () => {
    const { type } = makeOutgoingServiceMessageEvent(options);

    expect(type).toBe('tech.relaycorp.awala.endpoint-internet.outgoing-service-message');
  });

  test('Event source should be the default endpoint', () => {
    const { source } = makeOutgoingServiceMessageEvent(options);

    expect(source).toBe(DEFAULT_ENDPOINT_ID);
  });

  test('Event subject should be the peer id', () => {
    const { subject } = makeOutgoingServiceMessageEvent(options);

    expect(subject).toBe(options.peerId);
  });

  test('Event data content type should be that of the service message', () => {
    const { datacontenttype: contentType } = makeOutgoingServiceMessageEvent(options);

    expect(contentType).toBe(options.contentType);
  });

  test('Event data should be the service message content', () => {
    const { data } = makeOutgoingServiceMessageEvent(options);

    expect(data).toBe(options.content);
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
