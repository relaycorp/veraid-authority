import type { RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../http.js';
import type { PluginDone } from '../types/PluginDone.js';
import { MEMBER_KEY_IMPORT_TOKEN_SCHEMA } from '../schema/memberKeyImportToken.schema.js';
import { createMemberKeyImportToken } from '../../memberKeyImportToken.js';
import type { FastifyTypedInstance } from '../types/FastifyTypedInstance.js';

const MEMBER_KEY_IMPORT_TOKEN_PARAMS = {
  type: 'object',

  properties: {
    orgName: { type: 'string' },
    memberId: { type: 'string' },
  },

  required: ['orgName', 'memberId'],
} as const;

export default function registerRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['POST'],
    url: '/',

    schema: {
      params: MEMBER_KEY_IMPORT_TOKEN_PARAMS,
      body: MEMBER_KEY_IMPORT_TOKEN_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const result = await createMemberKeyImportToken(
        request.params.memberId,
        request.body.serviceOid,
        {
          logger: this.log,
          dbConnection: this.mongoose,
        },
      );

      await reply.code(HTTP_STATUS_CODES.OK).send({
        token: result.result.id,
      });
    },
  });
  done();
}
