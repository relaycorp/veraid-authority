import type { CloudEventV1 } from 'cloudevents';
import { differenceInSeconds, isValid, parseISO } from 'date-fns';
import type { BaseLogger } from 'pino';
import type { FastifyBaseLogger } from 'fastify';

function getExpiryDate(expiry: unknown, creationDate: Date, logger: BaseLogger) {
  if (expiry === undefined) {
    logger.info('Refused missing expiry');
    return null;
  }

  if (typeof expiry !== 'string') {
    logger.info('Refused malformed expiry');
    return null;
  }

  const expiryDate = parseISO(expiry);

  if (!isValid(expiryDate)) {
    logger.info('Refused malformed expiry');
    return null;
  }

  const difference = differenceInSeconds(expiryDate, creationDate);

  if (difference < 0) {
    logger.info('Refused expiry less than time');
    return null;
  }
  return expiryDate;
}

function encodeContent(event: CloudEventV1<unknown>) {
  let content: Buffer;
  if (event.data === undefined) {
    content = Buffer.from([]);
  } else if (Buffer.isBuffer(event.data)) {
    content = event.data;
  } else {
    content = Buffer.from(JSON.stringify(event.data));
  }
  return content;
}

export const INCOMING_SERVICE_MESSAGE_TYPE =
  'com.relaycorp.awala.endpoint-internet.incoming-service-message';

export interface IncomingServiceMessageOptions {
  readonly creationDate: Date;
  readonly expiryDate: Date;
  readonly parcelId: string;
  readonly recipientId: string;
  readonly senderId: string;
  readonly contentType: string;
  readonly content: Buffer;
}

export function getIncomingServiceMessageEvent(
  event: CloudEventV1<unknown>,
  logger: FastifyBaseLogger,
): IncomingServiceMessageOptions | null {
  const parcelAwareLogger = logger.child({
    parcelId: event.id,
  });

  if (event.type !== INCOMING_SERVICE_MESSAGE_TYPE) {
    parcelAwareLogger.error({ type: event.type }, 'Refused invalid type');
    return null;
  }

  if (event.subject === undefined) {
    parcelAwareLogger.info('Refused missing subject');
    return null;
  }

  if (event.datacontenttype === undefined) {
    parcelAwareLogger.info('Refused missing data content type');
    return null;
  }

  const creationDate = new Date(event.time!);
  const expiryDate = getExpiryDate(event.expiry, creationDate, parcelAwareLogger);

  if (expiryDate === null) {
    return null;
  }

  return {
    parcelId: event.id,
    senderId: event.source,
    recipientId: event.subject,
    contentType: event.datacontenttype,
    content: encodeContent(event),
    expiryDate,
    creationDate,
  };
}
