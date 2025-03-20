import type { FastifyReply, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES, type StatusByProblem } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { VeraidContentType } from '../../utilities/veraid.js';

import { generateMemberBundle } from './memberBundle.js';
import { MemberPublicKeyProblem } from './MemberPublicKeyProblem.js';
import {
  createMemberPublicKey,
  deleteMemberPublicKey,
  getMemberPublicKey,
} from './memberPublicKey.js';
import { MEMBER_PUBLIC_KEY_SCHEMA } from './memberPublicKey.schema.js';

const RESPONSE_CODE_BY_PROBLEM: StatusByProblem<MemberPublicKeyProblem> = {
  [MemberPublicKeyProblem.PUBLIC_KEY_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,

  [MemberPublicKeyProblem.MALFORMED_PUBLIC_KEY]: HTTP_STATUS_CODES.BAD_REQUEST,
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
    memberPublicKeyId: { type: 'string' },
  },

  required: ['orgName', 'memberId', 'memberPublicKeyId'],
} as const;

interface MemberPublicKeyUrls {
  self: string;
  bundle: string;
}

function makeUrls(
  orgName: string,
  memberId: string,
  memberPublicKeyId: string,
): MemberPublicKeyUrls {
  const self = `/orgs/${orgName}/members/${memberId}/public-keys/${memberPublicKeyId}`;
  return {
    self,
    bundle: `${self}/bundle`,
  };
}
export default function registerRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['POST'],
    url: '/',

    schema: {
      params: CREATE_MEMBER_PUBLIC_KEY_PARAMS,
      body: MEMBER_PUBLIC_KEY_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, orgName } = request.params;
      const result = await createMemberPublicKey(memberId, request.body, {
        logger: request.log,
        dbConnection: this.mongoose,
      });
      if (!result.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[result.context]).send({
          type: result.context,
        });
        return;
      }

      await reply.code(HTTP_STATUS_CODES.OK).send(makeUrls(orgName, memberId, result.result.id));
    },
  });

  fastify.route({
    method: ['DELETE'],
    url: '/:memberPublicKeyId',

    schema: {
      params: MEMBER_PUBLIC_KEY_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, memberPublicKeyId } = request.params;
      const serviceOptions = {
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const memberPublicKey = await getMemberPublicKey(memberId, memberPublicKeyId, serviceOptions);
      if (!memberPublicKey.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[memberPublicKey.context]).send({
          type: memberPublicKey.context,
        });
        return;
      }

      await deleteMemberPublicKey(memberPublicKeyId, serviceOptions);

      await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
    },
  });

  fastify.route({
    method: ['GET'],
    url: '/:memberPublicKeyId/bundle',

    schema: {
      params: MEMBER_PUBLIC_KEY_PARAMS,
    },

    async handler(request, reply): Promise<FastifyReply> {
      const result = await generateMemberBundle(request.params.memberPublicKeyId, {
        logger: request.log,
        dbConnection: this.mongoose,
      });
      if (result.didSucceed) {
        return reply
          .code(HTTP_STATUS_CODES.OK)
          .header('Content-Type', VeraidContentType.MEMBER_BUNDLE)
          .send(Buffer.from(result.result.serialise()));
      }

      if (result.context.didChainRetrievalFail) {
        return reply.code(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE).send();
      }
      return reply.code(HTTP_STATUS_CODES.NOT_FOUND).send();
    },
  });

  done();
}
