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
import { assertNotNull, assertNull } from '../testUtils/assertions.js';

import {
  type IncomingServiceMessageOptions,
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
    // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
    data_base64: CE_SERVICE_MESSAGE_CONTENT.toString('base64'),
  });

  let incomingServiceMessageOptions: IncomingServiceMessageOptions;
  beforeEach(() => {
    const result = getIncomingServiceMessageEvent(cloudEvent, mockLogging.logger);
    assertNotNull(result);
    incomingServiceMessageOptions = result;
  });

  test('Parcel id should be the same as event id', () => {
    const { parcelId } = incomingServiceMessageOptions;

    expect(parcelId).toBe(cloudEvent.id);
  });

  test('Sender id should be the same as source', () => {
    const { senderId } = incomingServiceMessageOptions;

    expect(senderId).toBe(cloudEvent.source);
  });

  test('Recipient id should be the same as subject', () => {
    const { recipientId } = incomingServiceMessageOptions;

    expect(recipientId).toBe(cloudEvent.subject);
  });

  test('Content type should be the same as datacontenttype', () => {
    const { contentType } = incomingServiceMessageOptions;

    expect(contentType).toBe(cloudEvent.datacontenttype);
  });

  test('Content should be a buffer with the content of data_base64', () => {
    const { content } = incomingServiceMessageOptions;

    expect(content).toStrictEqual(CE_SERVICE_MESSAGE_CONTENT);
  });

  test('Missing data_base64 should be accepted', () => {
    const event = new CloudEvent({
      ...cloudEvent,
      // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
      data_base64: undefined,
      data: undefined,
    });

    const result = getIncomingServiceMessageEvent(event, mockLogging.logger);

    expect(result?.content).toStrictEqual(Buffer.from('', 'base64'));
  });

  test('Creation date should be taken from event time', () => {
    const { creationDate: creation } = incomingServiceMessageOptions;

    expect(creation).toStrictEqual(parseISO(cloudEvent.time!));
  });

  test('Expiry date should be taken from event expiry', () => {
    const { expiryDate } = incomingServiceMessageOptions;

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

    test('Missing data should be refused', () => {
      const event = new CloudEvent({
        ...cloudEvent,
        // eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
        data_base64: undefined,
        data: undefined,
      });

      const result = getIncomingServiceMessageEvent(
        { ...event, data: Buffer.from('') },
        mockLogging.logger,
      );

      assertNull(result);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Got textual data instead of binary', { parcelId: event.id }),
      );
    });
  });
});
