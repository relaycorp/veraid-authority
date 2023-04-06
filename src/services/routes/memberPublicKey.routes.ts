import type { RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../http.js';
import type { PluginDone } from '../types/PluginDone.js';
import type { FastifyTypedInstance } from '../fastify.js';
import { MemberPublicKeyProblemType } from '../../businessLogic/memberPublicKey/MemberPublicKeyProblemType.js';
import {
  createMemberPublicKey,
  deleteMemberPublicKey,
  getMemberPublicKey,
} from '../../businessLogic/memberPublicKey/memberPublicKey.js';
import { MEMBER_PUBLIC_KEY_SCHEMA } from '../schema/memberPublicKey.schema.js';

const RESPONSE_CODE_BY_PROBLEM: {
  [key in MemberPublicKeyProblemType]: (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];
} = {
  [MemberPublicKeyProblemType.PUBLIC_KEY_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,

  [MemberPublicKeyProblemType.MALFORMED_PUBLIC_KEY]: HTTP_STATUS_CODES.BAD_REQUEST,
} as const;

const CREATE_MEMBER_PUBLIC_KEY_PARAMS = {
  type: 'object',

  properties: {
    orgName: { type: 'string' },
    memberId: { type: 'string' },
  },

  required: ['orgName', 'memberId'],
} as const;

const MEMBER_PUBLIC_KEY_PARAMS = {
  type: 'object',

  properties: {
    orgName: { type: 'string' },
    memberId: { type: 'string' },
    memberPrivateKey: { type: 'string' },
  },

  required: ['orgName', 'memberId', 'memberPrivateKey'],
} as const;

interface MemberPublicKeyUrls {
  self: string;
}

function makeUrls(
  orgName: string,
  memberId: string,
  memberPublicKeyId: string,
): MemberPublicKeyUrls {
  return {
    self: `/orgs/${orgName}/members/${memberId}/public-keys/${memberPublicKeyId}`,
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
      params: CREATE_MEMBER_PUBLIC_KEY_PARAMS,
      body: MEMBER_PUBLIC_KEY_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, orgName } = request.params;
      const result = await createMemberPublicKey(memberId, request.body, {
        logger: this.log,
        dbConnection: this.mongoose,
      });
      if (!result.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[result.reason]).send({
          type: result.reason,
        });
        return;
      }

      await reply.code(HTTP_STATUS_CODES.OK).send(makeUrls(orgName, memberId, result.result.id));
    },
  });

  fastify.route({
    method: ['DELETE'],
    url: '/orgs/:orgName/members/:memberId/public-keys/:memberPrivateKey',

    schema: {
      params: MEMBER_PUBLIC_KEY_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, memberPrivateKey } = request.params;
      const serviceOptions = {
        logger: this.log,
        dbConnection: this.mongoose,
      };

      const memberPublicKey = await getMemberPublicKey(memberId, memberPrivateKey, serviceOptions);
      if (!memberPublicKey.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[memberPublicKey.reason]).send({
          type: memberPublicKey.reason,
        });
        return;
      }

      await deleteMemberPublicKey(memberPrivateKey, serviceOptions);

      await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
    },
  });

  done();
}
