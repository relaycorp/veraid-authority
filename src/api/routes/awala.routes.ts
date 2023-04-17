import type { RouteOptions } from 'fastify';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema, FromSchema } from 'json-schema-to-ts';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import {
  MEMBER_BUNDLE_REQUEST_SCHEMA,
  MEMBER_KEY_IMPORT_REQUEST_SCHEMA,
} from '../../schemas/awala.schema.js';
import { AwalaProblemType } from '../../AwalaProblemType.js';
import { createMemberBundleRequest } from '../../awala.js';
import type { ServiceOptions } from '../../serviceTypes.js';
import { createMemberPublicKey } from '../../memberPublicKey.js';
import { deleteMemberKeyImportToken, getMemberKeyImportToken } from '../../memberKeyImportToken.js';

const ajv = addFormats(new Ajv());

type ValidationResult<Schema extends JSONSchema> = FromSchema<Schema> | string;

function validateMessage<Schema extends JSONSchema>(
  value: unknown,
  schema: Schema,
): ValidationResult<Schema> {
  if (!ajv.validate(schema, value)) {
    return ajv.errorsText(ajv.errors);
  }

  return value as ValidationResult<Schema>;
}

async function processMemberBundleRequest(
  data: unknown,
  options: ServiceOptions,
): Promise<AwalaProblemType | undefined> {
  const validationResult = validateMessage(data, MEMBER_BUNDLE_REQUEST_SCHEMA);
  if (typeof validationResult === 'string') {
    options.logger.info(data, validationResult);
    return AwalaProblemType.MALFORMED_AWALA_MESSAGE_BODY;
  }

  await createMemberBundleRequest(validationResult, options);
  return undefined;
}

async function processMemberKeyImportRequest(
  data: unknown,
  options: ServiceOptions,
): Promise<AwalaProblemType | undefined> {
  const validationResult = validateMessage(data, MEMBER_KEY_IMPORT_REQUEST_SCHEMA);
  if (typeof validationResult === 'string') {
    options.logger.info(data, validationResult);
    return AwalaProblemType.MALFORMED_AWALA_MESSAGE_BODY;
  }

  const keyTokenData = await getMemberKeyImportToken(validationResult.publicKeyImportToken, options);
  if (!keyTokenData.didSucceed) {
    return undefined;
  }

  const createPublicKeyResult = await createMemberPublicKey(
    keyTokenData.result.memberId,
    {
      publicKey: validationResult.publicKey,
      serviceOid: keyTokenData.result.serviceOid,
    },
    options,
  );

  if (!craetePublicKeyResult.didSucceed) {
    return undefined;
  }

  // trigger event
  await deleteMemberKeyImportToken(validationResult.publicKeyImportToken, options);

  return undefined;
}

enum AwalaRequestMessageType {
  MEMBER_BUNDLE_REQUEST = 'application/vnd.veraid.member-bundle-request',
  MEMBER_PUBLIC_KEY_IMPORT = 'application/vnd.veraid.member-public-key-import',
}

const awalaEventToProcessor: {
  [key in AwalaRequestMessageType]: (
    data: unknown,
    options: ServiceOptions,
  ) => Promise<AwalaProblemType | undefined>;
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

      const result = await awalaEventToProcessor[contentType!](request.body, serviceOptions);

      if (!result) {
        await reply.code(HTTP_STATUS_CODES.ACCEPTED).send();
        return;
      }

      await reply.code(HTTP_STATUS_CODES.BAD_REQUEST).send();
    },
  });
  done();
}
