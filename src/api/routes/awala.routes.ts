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

type ValidateTypeResult<Schema extends JSONSchema> = FromSchema<Schema> | undefined;

function validateType<Schema extends JSONSchema>(
  value: unknown,
  schema: Schema,
): ValidateTypeResult<Schema> {
  if (!ajv.validate(schema, value)) {
    return undefined;
  }

  return value as ValidateTypeResult<Schema>;
}

async function processMemberBundleRequest(
  data: unknown,
  options: ServiceOptions,
): Promise<AwalaProblemType | undefined> {
  const validData = validateType(data, MEMBER_BUNDLE_REQUEST_SCHEMA);
  if (validData === undefined) {
    return AwalaProblemType.MALFORMED_AWALA_MESSAGE_BODY;
  }

  await createMemberBundleRequest(validData, options);
  return undefined;
}

async function processMemberKeyImportRequest(
  data: unknown,
  options: ServiceOptions,
): Promise<AwalaProblemType | undefined> {
  const validData = validateType(data, MEMBER_KEY_IMPORT_REQUEST_SCHEMA);
  if (validData === undefined) {
    return AwalaProblemType.MALFORMED_AWALA_MESSAGE_BODY;
  }

  const keyTokenData = await getMemberKeyImportToken(validData.publicKeyImportToken, options);
  if (!keyTokenData.didSucceed) {
    return AwalaProblemType.ERROR_COULD_BE_IGNORED;
  }

  const craetePublicKeyResult = await createMemberPublicKey(
    keyTokenData.result.memberId,
    {
      publicKey: validData.publicKey,
      serviceOid: keyTokenData.result.serviceOid,
    },
    options,
  );

  if (!craetePublicKeyResult.didSucceed) {
    return AwalaProblemType.ERROR_COULD_BE_IGNORED;
  }

  await deleteMemberKeyImportToken(validData.publicKeyImportToken, options);

  return undefined;
}

enum AwalaRequestMessageType {
  MEMBER_BUNDLE_REQUEST = 'application/vnd.veraid.member-bundle-request',
  MEMBER_PUBLIC_KEY_IMPORT = 'application/vnd.veraid.member-public-key-import',
}
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
      if (contentType === AwalaRequestMessageType.MEMBER_BUNDLE_REQUEST) {
        const result = await processMemberBundleRequest(request.body, serviceOptions);
        if (!result) {
          await reply.code(HTTP_STATUS_CODES.ACCEPTED).send();
          return;
        }
      }

      if (contentType === AwalaRequestMessageType.MEMBER_PUBLIC_KEY_IMPORT) {
        const result = await processMemberKeyImportRequest(request.body, serviceOptions);
        if (!result) {
          // throw event here!
          await reply.code(HTTP_STATUS_CODES.ACCEPTED).send();
          return;
        }
      }

      await reply.code(HTTP_STATUS_CODES.BAD_REQUEST).send();
    },
  });
  done();
}
