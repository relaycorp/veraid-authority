import type { RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../http.js';
import type { PluginDone } from '../types/PluginDone.js';
import { ORG_SCHEMA } from '../schema/org.schema.js';
import type { FastifyTypedInstance } from '../fastify.js';
import { createOrg } from '../../org.js';
import { CreationProblemType } from '../../CreationProblemType.js';

const RESPONSE_CODE_BY_PROBLEM: {
  [key in CreationProblemType]: (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];
} = {
  [CreationProblemType.EXISTING_ORG_NAME]: HTTP_STATUS_CODES.CONFLICT,
  [CreationProblemType.MALFORMED_AWALA_ENDPOINT]: HTTP_STATUS_CODES.BAD_REQUEST,
  [CreationProblemType.MALFORMED_ORG_NAME]: HTTP_STATUS_CODES.BAD_REQUEST,
} as const;

interface OrgUrls {
  self: string;
}

const makeUrls = (name: string): OrgUrls => ({
  self: `/orgs/${name}`,
});

export default function registerRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['POST'],
    url: '/orgs',

    schema: {
      body: ORG_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const result = await createOrg(request.body, {
        logger: this.log,
        dbConnection: this.mongoose,
      });
      if (result.didSucceed) {
        await reply.code(HTTP_STATUS_CODES.OK).send(makeUrls(result.result.name));
        return;
      }

      await reply.code(RESPONSE_CODE_BY_PROBLEM[result.reason]).send({
        type: result.reason,
      });
    },
  });

  done();
}
