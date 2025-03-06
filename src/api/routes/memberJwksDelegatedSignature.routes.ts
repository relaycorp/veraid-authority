import type { FastifyReply, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import { MemberJwksDelegatedSignatureProblemType } from '../../MemberJwksDelegatedSignatureProblemType.js';
import {
  createJwksDelegatedSignature,
  deleteJwksDelegatedSignature,
  getJwksDelegatedSignature,
} from '../../memberJwksDelegatedSignature.js';
import { MEMBER_JWKS_DELEGATED_SIGNATURE_SCHEMA as JWKS_SCHEMA } from '../../schemas/memberJwksDelegatedSignature.schema.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

const RESPONSE_CODE_BY_PROBLEM: {
  [key in MemberJwksDelegatedSignatureProblemType]: (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];
} = {
  [MemberJwksDelegatedSignatureProblemType.DELEGATED_SIGNATURE_NOT_FOUND]:
    HTTP_STATUS_CODES.NOT_FOUND,

  [MemberJwksDelegatedSignatureProblemType.INVALID_TTL]: HTTP_STATUS_CODES.BAD_REQUEST,
} as const;

const CREATE_PARAMS = {
  type: 'object',

  properties: {
    orgName: { type: 'string' },
    memberId: { type: 'string' },
  },

  required: ['orgName', 'memberId'],
} as const;

const DELEGATED_SIGNATURE_PARAMS = {
  type: 'object',

  properties: {
    orgName: { type: 'string' },
    memberId: { type: 'string' },
    delegatedSignatureId: { type: 'string' },
  },

  required: ['orgName', 'memberId', 'delegatedSignatureId'],
} as const;

interface JwksDelegatedSignatureUrls {
  self: string;
}

function makeUrls(
  orgName: string,
  memberId: string,
  delegatedSignatureId: string,
): JwksDelegatedSignatureUrls {
  return {
    self: `/orgs/${orgName}/members/${memberId}/delegated-signatures/jwks/${delegatedSignatureId}`,
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
      params: CREATE_PARAMS,
      body: JWKS_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, orgName } = request.params;
      const result = await createJwksDelegatedSignature(memberId, request.body, {
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
    url: '/:delegatedSignatureId',

    schema: {
      params: DELEGATED_SIGNATURE_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, delegatedSignatureId } = request.params;
      const serviceOptions = {
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const delegatedSignature = await getJwksDelegatedSignature(
        memberId,
        delegatedSignatureId,
        serviceOptions,
      );
      if (!delegatedSignature.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[delegatedSignature.context]).send({
          type: delegatedSignature.context,
        });
        return;
      }

      await deleteJwksDelegatedSignature(delegatedSignatureId, serviceOptions);

      await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
    },
  });

  fastify.route({
    method: ['GET'],
    url: '/:delegatedSignatureId',

    schema: {
      params: DELEGATED_SIGNATURE_PARAMS,
    },

    async handler(request, reply): Promise<FastifyReply> {
      const { memberId, delegatedSignatureId } = request.params;
      const result = await getJwksDelegatedSignature(memberId, delegatedSignatureId, {
        logger: request.log,
        dbConnection: this.mongoose,
      });
      if (result.didSucceed) {
        return reply.code(HTTP_STATUS_CODES.OK).send(result.result);
      }

      return reply.code(RESPONSE_CODE_BY_PROBLEM[result.context]).send({
        type: result.context,
      });
    },
  });

  done();
}
