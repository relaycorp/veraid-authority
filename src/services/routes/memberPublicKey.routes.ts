import type { RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../http.js';
import type { PluginDone } from '../types/PluginDone.js';
import { ORG_SCHEMA, ORG_SCHEMA_PATCH } from '../schema/org.schema.js';
import type { FastifyTypedInstance } from '../fastify.js';
import { createOrg, deleteOrg, getOrg, updateOrg } from '../../businessLogic/org/org.js';
import {
  MemberPublicKeyProblemType
} from '../../businessLogic/memberPublicKey/MemberPublicKeyProblemType.js';
import { createMemberPublicKey } from '../../businessLogic/memberPublicKey/memberPublicKey.js';
import { MEMBER_PUBLIC_KEY_SCHEMA } from '../schema/memberPublicKey.schema.js';

const RESPONSE_CODE_BY_PROBLEM: {
  [key in MemberPublicKeyProblemType]: (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];
} = {
  [MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
} as const;



const CREATE_MEMBER_PUBLIC_KEY_ROUTE_PARAMS = {
  type: 'object',

  properties: {
    orgName: {
      type: 'string',
    },

    memberId: {
      type: 'string',
    },
  },

  required: ['orgName', 'memberId'],
} as const;

const MEMBER_PUBLIC_KEY_ROUTE_PARAMS = {
  type: 'object',

  properties: {
    orgName: {
      type: 'string',
    },

    memberId: {
      type: 'string',
    },
  },

  required: ['orgName', 'memberId'],
} as const;


interface OrgUrls {
  self: string;
  members: string;
}

function makeUrls(orgName: string,memberId: string,memberPublicKeyId: string, ): OrgUrls {
  return {
    self: `/orgs/${name}/members/${memberId}/public-keys`,
    members: `/orgs/${name}/members`,
  };
}
export default function registerRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['POST'],
    url: '/orgs/:orgName/members/:memberId/public-keys',

    schema: {
      body: MEMBER_PUBLIC_KEY_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const result = await createMemberPublicKey(request.body, {
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
    method: ['DELETE'],
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

      const getOrgResult = await getOrg(orgName, serviceOptions);
      if (!getOrgResult.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[getOrgResult.reason]).send({
          type: getOrgResult.reason,
        });
        return;
      }

      await deleteOrg(orgName, serviceOptions);

      await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
    },
  });

  done();
}
