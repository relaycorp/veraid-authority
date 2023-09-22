import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import {
  ORG_CREATION_SCHEMA,
  ORG_PATCH_SCHEMA,
  type OrgCreationSchema,
} from '../../schemas/org.schema.js';
import { createOrg, deleteOrg, getOrg, updateOrg } from '../../org.js';
import { OrgProblemType } from '../../OrgProblemType.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import type { RouteOptions } from '../../utilities/fastify/RouteOptions.js';
import orgAuthPlugin from '../orgAuthPlugin.js';

import memberRoutes from './member.routes.js';

const RESPONSE_CODE_BY_PROBLEM: {
  [key in OrgProblemType]: (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];
} = {
  [OrgProblemType.EXISTING_ORG_NAME]: HTTP_STATUS_CODES.CONFLICT,
  [OrgProblemType.MALFORMED_ORG_NAME]: HTTP_STATUS_CODES.BAD_REQUEST,
  [OrgProblemType.ORG_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
  [OrgProblemType.INVALID_ORG_NAME]: HTTP_STATUS_CODES.BAD_REQUEST,
  [OrgProblemType.LAST_MEMBER_NOT_ADMIN]: HTTP_STATUS_CODES.FAILED_DEPENDENCY,
  [OrgProblemType.EXISTING_MEMBERS]: HTTP_STATUS_CODES.FAILED_DEPENDENCY,
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

function makeCreationResponse(org: OrgCreationSchema): object {
  return {
    self: `/orgs/${org.name}`,
    members: `/orgs/${org.name}/members`,
    publicKey: org.publicKey,
  };
}

export default async function registerRoutes(
  fastify: FastifyTypedInstance,
  opts: RouteOptions,
): Promise<void> {
  await fastify.register(orgAuthPlugin);

  fastify.route({
    method: ['POST'],
    url: '/orgs',

    schema: {
      body: ORG_CREATION_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const result = await createOrg(request.body, {
        logger: request.log,
        dbConnection: this.mongoose,
      });
      if (result.didSucceed) {
        await reply.code(HTTP_STATUS_CODES.OK).send(makeCreationResponse(result.result));
        return;
      }

      await reply.code(RESPONSE_CODE_BY_PROBLEM[result.context]).send({
        type: result.context,
      });
    },
  });

  fastify.route({
    method: ['PATCH'],
    url: '/orgs/:orgName',

    schema: {
      params: ORG_ROUTE_PARAMS,
      body: ORG_PATCH_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const { orgName } = request.params;
      const serviceOptions = {
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const getOrgResult = await getOrg(orgName, serviceOptions);
      if (!getOrgResult.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[getOrgResult.context]).send({
          type: getOrgResult.context,
        });
        return;
      }

      const result = await updateOrg(orgName, request.body, serviceOptions);
      if (result.didSucceed) {
        await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
        return;
      }

      await reply.code(RESPONSE_CODE_BY_PROBLEM[result.context]).send({
        type: result.context,
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
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const result = await getOrg(orgName, serviceOptions);
      if (!result.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[result.context]).send({
          type: result.context,
        });
        return;
      }

      await reply.code(HTTP_STATUS_CODES.OK).send(result.result);
    },
  });

  fastify.route({
    method: ['DELETE'],
    url: '/orgs/:orgName',

    schema: {
      params: ORG_ROUTE_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { orgName } = request.params;
      const serviceOptions = {
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const getOrgResult = await getOrg(orgName, serviceOptions);
      if (!getOrgResult.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[getOrgResult.context]).send({
          type: getOrgResult.context,
        });
        return;
      }

      const result = await deleteOrg(orgName, serviceOptions);

      if (!result.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[result.context]).send({
          type: result.context,
        });
        return;
      }

      await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
    },
  });

  await fastify.register(memberRoutes, { ...opts, prefix: '/orgs/:orgName/members' });
}
