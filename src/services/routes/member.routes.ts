import type { RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../http.js';
import type { PluginDone } from '../types/PluginDone.js';
import type { FastifyTypedInstance } from '../fastify.js';
import { MEMBER_SCHEMA } from '../schema/member.schema.js';
import { createMember, deleteMember, getMember } from '../../member.js';
import { MemberProblemType } from '../../MemberProblemType.js';

const RESPONSE_CODE_BY_PROBLEM: {
  [key in MemberProblemType]: (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];
} = {
  [MemberProblemType.MALFORMED_MEMBER_NAME]: HTTP_STATUS_CODES.BAD_REQUEST,
  [MemberProblemType.EXISTING_MEMBER_NAME]: HTTP_STATUS_CODES.CONFLICT,
  [MemberProblemType.MEMBER_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
} as const;

const CREATE_MEMBER_ROUTE_PARAMS = {
  type: 'object',

  properties: {
    orgName: {
      type: 'string',
    },
  },

  required: ['orgName'],
} as const;

const MEMBER_ROUTE_PARAMS = {
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

interface MemberUrls {
  self: string;
}

function makeUrls({ orgName, memberId }: { orgName: string; memberId: string }): MemberUrls {
  return {
    self: `/orgs/${orgName}/members/${memberId}`,
  };
}

export default function registerRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['POST'],
    url: '/orgs/:orgName/members',

    schema: {
      params: CREATE_MEMBER_ROUTE_PARAMS,
      body: MEMBER_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const result = await createMember(request.params.orgName, request.body, {
        logger: this.log,
        dbConnection: this.mongoose,
      });
      if (result.didSucceed) {
        await reply.code(HTTP_STATUS_CODES.OK).send(
          makeUrls({
            memberId: result.result.id,
            orgName: request.params.orgName,
          }),
        );
        return;
      }

      await reply.code(RESPONSE_CODE_BY_PROBLEM[result.reason]).send({
        type: result.reason,
      });
    },
  });

  fastify.route({
    method: ['GET'],
    url: '/orgs/:orgName/members/:memberId',

    schema: {
      params: MEMBER_ROUTE_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { orgName, memberId } = request.params;
      const serviceOptions = {
        logger: this.log,
        dbConnection: this.mongoose,
      };

      const result = await getMember(orgName, memberId, serviceOptions);
      if (!result.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[result.reason]).send({
          type: result.reason,
        });
        return;
      }

      await reply.code(HTTP_STATUS_CODES.OK).send(result.result);
    },
  });

  fastify.route({
    method: ['DELETE'],
    url: '/orgs/:orgName/members/:memberId',

    schema: {
      params: MEMBER_ROUTE_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { orgName, memberId } = request.params;
      const serviceOptions = {
        logger: this.log,
        dbConnection: this.mongoose,
      };

      const getMemberResult = await getMember(orgName, memberId, serviceOptions);
      if (!getMemberResult.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[getMemberResult.reason]).send({
          type: getMemberResult.reason,
        });
        return;
      }

      await deleteMember(orgName, serviceOptions);

      await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
    },
  });

  done();
}
