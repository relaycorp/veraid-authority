import type { RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import {
  MEMBER_BUNDLE_REQUEST_SCHEMA,
  MEMBER_KEY_IMPORT_REQUEST_SCHEMA,
  type MemberBundleRequest,
  type MemberKeyImportRequest,
} from '../../schemas/awala.schema.js';
import type { ServiceOptions } from '../../serviceTypes.js';
import { processMemberKeyImportToken } from '../../memberKeyImportToken.js';
import { validateMessage } from '../../utilities/validateMessage.js';
import { createMemberBundleRequest } from '../../memberBundle.js';

async function processMemberBundleRequest(
  data: unknown,
  options: ServiceOptions,
): Promise<boolean> {
  const validationResult = validateMessage(data, MEMBER_BUNDLE_REQUEST_SCHEMA);
  if (typeof validationResult === 'string') {
    options.logger.info(
      {
        publicKeyId: (data as MemberBundleRequest).publicKeyId,
        reason: validationResult,
      },
      'Refused invalid member bundle request',
    );
    return false;
  }

  await createMemberBundleRequest(validationResult, options);
  return true;
}

async function processMemberKeyImportRequest(
  data: unknown,
  options: ServiceOptions,
): Promise<boolean> {
  const validationResult = validateMessage(data, MEMBER_KEY_IMPORT_REQUEST_SCHEMA);
  if (typeof validationResult === 'string') {
    options.logger.info(
      {
        publicKeyImportToken: (data as MemberKeyImportRequest).publicKeyImportToken,

        reason: validationResult,
      },
      'Refused invalid member bundle request',
    );
    return false;
  }

  const result = await processMemberKeyImportToken(
    {
      publicKey: validationResult.publicKey,
      publicKeyImportToken: validationResult.publicKeyImportToken,
      awalaPda: validationResult.awalaPda,
    },
    options,
  );
  return result.didSucceed;
}

enum AwalaRequestMessageType {
  MEMBER_BUNDLE_REQUEST = 'application/vnd.veraid.member-bundle-request',
  MEMBER_PUBLIC_KEY_IMPORT = 'application/vnd.veraid.member-public-key-import',
}

const awalaEventToProcessor: {
  [key in AwalaRequestMessageType]: (data: unknown, options: ServiceOptions) => Promise<boolean>;
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
    {
      parseAs: 'string',
    },
    fastify.getDefaultJsonParser('ignore', 'ignore'),
  );

  fastify.route({
    method: ['POST'],
    url: '/awala',

    async handler(request, reply): Promise<void> {
      const contentType = awalaRequestMessageTypeList.find(
        (messageType) => messageType === request.headers['content-type'],
      );

      const serviceOptions = {
        logger: this.log,
        dbConnection: this.mongoose,
      };

      const processor = awalaEventToProcessor[contentType!];

      const didSucceed = await processor(request.body, serviceOptions);

      if (didSucceed) {
        await reply.code(HTTP_STATUS_CODES.ACCEPTED).send();
        return;
      }

      await reply.code(HTTP_STATUS_CODES.BAD_REQUEST).send();
    },
  });
  done();
}
