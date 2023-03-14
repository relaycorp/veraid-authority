import type { RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../http.js';
import type { PluginDone } from '../types/PluginDone.js';
import { ORG_SCHEMA } from '../schema/org.schema.js';
import type { FastifyTypedInstance } from '../fastify.js';
import { createOrg } from '../../org.js';
import { CreationProblemType } from '../../CreationProblemType.js';

const ORG_ROUTES_ERROR_MAPPING: {
  [key in CreationProblemType]: (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];
} = {
  [CreationProblemType.EXISTING_ORG_NAME]: HTTP_STATUS_CODES.CONFLICT,
  [CreationProblemType.MALFORMED_AWALA_ENDPOINT]: HTTP_STATUS_CODES.BAD_REQUEST,
  [CreationProblemType.MALFORMED_ORG_NAME]: HTTP_STATUS_CODES.BAD_REQUEST,
} as const;

interface OrgUrl {
  method: 'GET' | 'PATCH';
  path: string;
}

interface OrgUrls {
  self: OrgUrl;
}

const formUrls = (name: string): OrgUrls => ({
  self: {
    method: 'GET',
    path: `/orgs/${name}`,
  },
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
      // request.
      const result = await createOrg(request.body, {
        logger: this.log,
        dbConnection: this.mongoose,
      });
      if (result.didSucceed) {
        await reply
          .code(HTTP_STATUS_CODES.OK)
          .header('Content-Type', 'application/json')
          .send(formUrls(result.result.name));
        return;
      }

      await reply
        .code(ORG_ROUTES_ERROR_MAPPING[result.reason])
        .header('Content-Type', 'application/json')
        .send({
          type: result.reason,
        });
    },
  });

  done();
}
