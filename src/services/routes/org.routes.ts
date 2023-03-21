import type { RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../http.js';
import type { PluginDone } from '../types/PluginDone.js';
import { ORG_SCHEMA, ORG_SCHEMA_PATCH } from '../schema/org.schema.js';
import type { FastifyTypedInstance } from '../fastify.js';
import { createOrg, getOrg, updateOrg } from '../../org.js';
import { OrgProblemType } from '../../OrgProblemType.js';

const RESPONSE_CODE_BY_PROBLEM: {
  [key in OrgProblemType]: (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];
} = {
  [OrgProblemType.EXISTING_ORG_NAME]: HTTP_STATUS_CODES.CONFLICT,
  [OrgProblemType.MALFORMED_AWALA_ENDPOINT]: HTTP_STATUS_CODES.BAD_REQUEST,
  [OrgProblemType.MALFORMED_ORG_NAME]: HTTP_STATUS_CODES.BAD_REQUEST,
  [OrgProblemType.ORG_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
  [OrgProblemType.INVALID_ORG_NAME]: HTTP_STATUS_CODES.BAD_REQUEST,
} as const;

const ORG_ROUTE_PARAMS = {
  type: 'object',

  properties: {
    orgName: {
      type: 'string',
    },
  },

  required: ['orgName'],
} as const;

interface OrgUrls {
  self: string;
}

function makeUrls(name: string): OrgUrls {
  return {
    self: `/orgs/${name}`,
  };
}

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

  fastify.route({
    method: ['PATCH'],
    url: '/orgs/:orgName',

    schema: {
      params: ORG_ROUTE_PARAMS,
      body: ORG_SCHEMA_PATCH,
    },

    async handler(request, reply): Promise<void> {
      const { orgName } = request.params;
      const serviceOptions = {
        logger: this.log,
        dbConnection: this.mongoose,
      };

      const getOrgResult = await getOrg(orgName, serviceOptions);
      if (!getOrgResult.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[getOrgResult.reason]).send({
          type: getOrgResult.reason,
        });
        return;
      }

      const result = await updateOrg(orgName, request.body, serviceOptions);
      if (result.didSucceed) {
        await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
        return;
      }

      await reply.code(RESPONSE_CODE_BY_PROBLEM[result.reason]).send({
        type: result.reason,
      });
    },
  });

  fastify.route({
    method: ['GET'],
    url: '/orgs/:orgName',

    schema: {
      params: ORG_ROUTE_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { orgName } = request.params;
      const serviceOptions = {
        logger: this.log,
        dbConnection: this.mongoose,
      };

      const result = await getOrg(orgName, serviceOptions);
      if (!result.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[result.reason]).send({
          type: result.reason,
        });
        return;
      }

      await reply.code(HTTP_STATUS_CODES.OK).send(result.result);
    },
  });

  done();
}
