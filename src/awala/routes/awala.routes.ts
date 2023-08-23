import type { CloudEventV1 } from 'cloudevents';
import type { RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import {
  isMemberBundleRequest,
  isMemberKeyImportRequest,
  type MemberBundleRequest,
  type MemberKeyImportRequest,
} from '../../schemas/awala.schema.js';
import type { ServiceOptions } from '../../serviceTypes.js';
import { processMemberKeyImportToken } from '../../memberKeyImportToken.js';
import { createMemberBundleRequest } from '../../memberBundle.js';
import {
  getIncomingServiceMessageEvent,
  type IncomingServiceMessageOptions,
} from '../../events/incomingServiceMessage.event.js';
import { bufferToJson } from '../../utilities/buffer.js';
import { convertMessageToEvent } from '../../utilities/eventing/receiver.js';

async function processMemberBundleRequest(
  incomingMessage: IncomingServiceMessageOptions,
  options: ServiceOptions,
): Promise<boolean> {
  const data = bufferToJson(incomingMessage.content);
  if (!data) {
    options.logger.info('Refused invalid json format');
    return false;
  }

  const finalData = { ...data, peerId: incomingMessage.senderId };
  if (isMemberBundleRequest(finalData)) {
    await createMemberBundleRequest(finalData, options);
    return true;
  }

  options.logger.info(
    { publicKeyId: (data as MemberBundleRequest).publicKeyId },
    'Refused invalid member bundle request',
  );
  return false;
}

async function processMemberKeyImportRequest(
  incomingMessage: IncomingServiceMessageOptions,
  options: ServiceOptions,
): Promise<boolean> {
  const data = bufferToJson(incomingMessage.content);
  if (!data) {
    options.logger.info('Refused invalid json format');
    return false;
  }
  if (isMemberKeyImportRequest(data)) {
    const result = await processMemberKeyImportToken(
      incomingMessage.senderId,
      {
        publicKey: data.publicKey,
        publicKeyImportToken: data.publicKeyImportToken,
      },
      options,
    );
    return result.didSucceed;
  }
  options.logger.info(
    {
      publicKeyImportToken: (data as MemberKeyImportRequest).publicKeyImportToken,
    },
    'Refused invalid member key import request',
  );
  return false;
}

enum AwalaRequestMessageType {
  MEMBER_BUNDLE_REQUEST = 'application/vnd.veraid.member-bundle-request',
  MEMBER_PUBLIC_KEY_IMPORT = 'application/vnd.veraid.member-public-key-import',
}

const awalaEventToProcessor: {
  [key in AwalaRequestMessageType]: (
    incomingMessage: IncomingServiceMessageOptions,
    options: ServiceOptions,
  ) => Promise<boolean>;
} = {
  [AwalaRequestMessageType.MEMBER_BUNDLE_REQUEST]: processMemberBundleRequest,
  [AwalaRequestMessageType.MEMBER_PUBLIC_KEY_IMPORT]: processMemberKeyImportRequest,
};
const awalaRequestMessageTypeList: AwalaRequestMessageType[] =
  Object.values(AwalaRequestMessageType);

export default function registerRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser(
    awalaRequestMessageTypeList,
    { parseAs: 'buffer' },
    (_request, payload, next) => {
      next(null, payload);
    },
  );

  fastify.route({
    method: ['POST'],
    url: '/',

    async handler(request, reply): Promise<void> {
      let event: CloudEventV1<unknown>;
      try {
        event = convertMessageToEvent(request.headers, request.body as Buffer);
      } catch (err) {
        request.log.info({ err }, 'Refused invalid CloudEvent');
        return reply.status(HTTP_STATUS_CODES.BAD_REQUEST).send();
      }

      const parcelAwareLogger = request.log.child({
        parcelId: event.id,
      });

      const incomingMessage = getIncomingServiceMessageEvent(event, parcelAwareLogger);
      if (!incomingMessage) {
        return reply.status(HTTP_STATUS_CODES.BAD_REQUEST).send();
      }

      const contentType = event.datacontenttype as AwalaRequestMessageType;
      const processor = awalaEventToProcessor[contentType];
      const didSucceed = await processor(incomingMessage, {
        logger: parcelAwareLogger,
        dbConnection: this.mongoose,
      });

      if (didSucceed) {
        return reply.code(HTTP_STATUS_CODES.ACCEPTED).send();
      }

      return reply.code(HTTP_STATUS_CODES.BAD_REQUEST).send();
    },
  });

  done();
}
