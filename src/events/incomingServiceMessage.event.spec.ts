import { addDays, formatISO, parseISO, subDays } from 'date-fns';
import { CloudEvent } from 'cloudevents';

import { AWALA_PEER_ID } from '../testUtils/stubs.js';
import {
  CE_ID,
  CE_SERVICE_MESSAGE_CONTENT,
  CE_SERVICE_MESSAGE_CONTENT_TYPE,
  CE_SOURCE,
} from '../testUtils/eventing/stubs.js';
import { makeMockLogging, partialPinoLog } from '../testUtils/logging.js';
import { assertNull } from '../testUtils/assertions.js';

import {
  getIncomingServiceMessageEvent,
  INCOMING_SERVICE_MESSAGE_TYPE,
} from './incomingServiceMessage.event.js';

describe('getIncomingServiceMessageEvent', () => {
  const mockLogging = makeMockLogging();
  const creationDate = new Date();
  const expiry = addDays(creationDate, 5);
  const cloudEvent = new CloudEvent({
    specversion: '1.0',
    id: CE_ID,
    source: AWALA_PEER_ID,
    type: INCOMING_SERVICE_MESSAGE_TYPE,
    subject: CE_SOURCE,
    datacontenttype: CE_SERVICE_MESSAGE_CONTENT_TYPE,
    expiry: formatISO(expiry),
    time: formatISO(creationDate),
    data: CE_SERVICE_MESSAGE_CONTENT,
  });

  test('Parcel id should be the same as event id', () => {
    const { parcelId } = getIncomingServiceMessageEvent(cloudEvent, mockLogging.logger)!;

    expect(parcelId).toBe(cloudEvent.id);
  });

  test('Sender id should be the same as source', () => {
    const { senderId } = getIncomingServiceMessageEvent(cloudEvent, mockLogging.logger)!;

    expect(senderId).toBe(cloudEvent.source);
  });

  test('Recipient id should be the same as subject', () => {
    const { recipientId } = getIncomingServiceMessageEvent(cloudEvent, mockLogging.logger)!;

    expect(recipientId).toBe(cloudEvent.subject);
  });

  test('Content type should be the same as datacontenttype', () => {
    const { contentType } = getIncomingServiceMessageEvent(cloudEvent, mockLogging.logger)!;

    expect(contentType).toBe(cloudEvent.datacontenttype);
  });

  test('Content should be event data', () => {
    const { content } = getIncomingServiceMessageEvent(cloudEvent, mockLogging.logger)!;

    expect(content).toStrictEqual(CE_SERVICE_MESSAGE_CONTENT);
  });

  test('Content should be buffer even if Content Type is JSON', () => {
    const data = { foo: 'bar' };
    const jsonEvent = cloudEvent.cloneWith({ data, datacontenttype: 'application/json' });

    const { content } = getIncomingServiceMessageEvent(jsonEvent, mockLogging.logger)!;

    expect(content).toStrictEqual(Buffer.from(JSON.stringify(data)));
  });

  test('Missing data should be accepted', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    const event = cloudEvent.cloneWith({ data: undefined, data_base64: undefined });

    const result = getIncomingServiceMessageEvent(event, mockLogging.logger);

    expect(result?.content).toStrictEqual(Buffer.from('', 'base64'));
  });

  test('Creation date should be taken from event time', () => {
    const { creationDate: creation } = getIncomingServiceMessageEvent(
      cloudEvent,
      mockLogging.logger,
    )!;

    expect(creation).toStrictEqual(parseISO(cloudEvent.time!));
  });

  test('Expiry date should be taken from event expiry', () => {
    const { expiryDate } = getIncomingServiceMessageEvent(cloudEvent, mockLogging.logger)!;

    expect(expiryDate).toStrictEqual(parseISO(cloudEvent.expiry as string));
  });

  describe('Failure', () => {
    test('Invalid type should be refused', () => {
      const event = new CloudEvent({
        ...cloudEvent,
        type: 'INVALID',
      });

      const result = getIncomingServiceMessageEvent(event, mockLogging.logger);

      assertNull(result);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('error', 'Refused invalid type', { parcelId: event.id, type: event.type }),
      );
    });

    test('Missing subject should be refused', () => {
      const event = new CloudEvent({
        ...cloudEvent,
        subject: undefined,
      });

      const result = getIncomingServiceMessageEvent(event, mockLogging.logger);

      assertNull(result);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused missing subject', { parcelId: event.id }),
      );
    });

    test('Missing datacontenttype should be refused', () => {
      const event = new CloudEvent({
        ...cloudEvent,
        datacontenttype: undefined,
      });

      const result = getIncomingServiceMessageEvent(event, mockLogging.logger);

      assertNull(result);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused missing data content type', { parcelId: event.id }),
      );
    });

    test('Missing expiry should be refused', () => {
      const { expiry: ignore, ...eventData } = cloudEvent;
      const event = new CloudEvent(eventData);

      const result = getIncomingServiceMessageEvent(event, mockLogging.logger);

      assertNull(result);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused missing expiry', { parcelId: event.id }),
      );
    });

    test('Non string expiry should be refused', () => {
      const event = new CloudEvent({
        ...cloudEvent,
        expiry: {},
      });

      const result = getIncomingServiceMessageEvent(event, mockLogging.logger);

      assertNull(result);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed expiry', { parcelId: event.id }),
      );
    });

    test('Malformed expiry should be refused', () => {
      const event = new CloudEvent({
        ...cloudEvent,
        expiry: 'INVALID DATE',
      });

      const result = getIncomingServiceMessageEvent(event, mockLogging.logger);

      assertNull(result);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused malformed expiry', { parcelId: event.id }),
      );
    });

    test('Expiry less than time should be refused', () => {
      const time = new Date();
      const past = subDays(time, 10);
      const event = new CloudEvent({
        ...cloudEvent,
        expiry: past.toISOString(),
      });

      const result = getIncomingServiceMessageEvent(event, mockLogging.logger);

      assertNull(result);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused expiry less than time', { parcelId: event.id }),
      );
    });
  });
});
