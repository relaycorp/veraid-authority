import { HTTP_STATUS_CODES, type StatusByProblem } from '../../utilities/http.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import type { RouteOptions } from '../../utilities/fastify/RouteOptions.js';
import { requireUserToBeAdmin } from '../../servers/api/orgAuthPlugin.js';
import memberPublicKeyRoutes from '../memberKeys/memberPublicKey.routes.js';
import memberKeyImportToken from '../memberKeyImports/memberKeyImportToken.routes.js';
import signatureSpecRoutes from '../memberSignatures/signatureSpec.routes.js';

import { MemberProblem } from './MemberProblem.js';
import { createMember, deleteMember, getMember, updateMember } from './member.js';
import { MEMBER_SCHEMA, PATCH_MEMBER_SCHEMA } from './member.schema.js';

const RESPONSE_CODE_BY_PROBLEM: StatusByProblem<MemberProblem> = {
  [MemberProblem.MALFORMED_MEMBER_NAME]: HTTP_STATUS_CODES.BAD_REQUEST,
  [MemberProblem.EXISTING_MEMBER_NAME]: HTTP_STATUS_CODES.CONFLICT,
  [MemberProblem.MEMBER_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
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
  publicKeys: string;
  publicKeyImportTokens: string;
  signatureSpecs: string;
}

function makeUrls({ orgName, memberId }: { orgName: string; memberId: string }): MemberUrls {
  return {
    self: `/orgs/${orgName}/members/${memberId}`,
    publicKeys: `/orgs/${orgName}/members/${memberId}/public-keys`,
    publicKeyImportTokens: `/orgs/${orgName}/members/${memberId}/public-key-import-tokens`,
    signatureSpecs: `/orgs/${orgName}/members/${memberId}/signature-specs`,
  };
}

export default async function registerRoutes(
  fastify: FastifyTypedInstance,
  opts: RouteOptions,
): Promise<void> {
  fastify.route({
    method: ['POST'],
    url: '/',

    schema: {
      params: CREATE_MEMBER_ROUTE_PARAMS,
      body: MEMBER_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const result = await createMember(request.params.orgName, request.body, {
        logger: request.log,
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

      await reply.code(RESPONSE_CODE_BY_PROBLEM[result.context]).send({
        type: result.context,
      });
    },
  });

  fastify.route({
    method: ['GET'],
    url: '/:memberId',

    schema: {
      params: MEMBER_ROUTE_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { orgName, memberId } = request.params;
      const serviceOptions = {
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const result = await getMember(orgName, memberId, serviceOptions);
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
    url: '/:memberId',
    preParsing: requireUserToBeAdmin,

    schema: {
      params: MEMBER_ROUTE_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { orgName, memberId } = request.params;
      const serviceOptions = {
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const getMemberResult = await getMember(orgName, memberId, serviceOptions);
      if (!getMemberResult.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[getMemberResult.context]).send({
          type: getMemberResult.context,
        });
        return;
      }

      await deleteMember(memberId, serviceOptions);

      await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
    },
  });

  fastify.route({
    method: ['PATCH'],
    url: '/:memberId',
    preParsing: requireUserToBeAdmin,

    schema: {
      params: MEMBER_ROUTE_PARAMS,
      body: PATCH_MEMBER_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const { orgName, memberId } = request.params;
      const serviceOptions = {
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const getMemberResult = await getMember(orgName, memberId, serviceOptions);
      if (!getMemberResult.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[getMemberResult.context]).send({
          type: getMemberResult.context,
        });
        return;
      }

      const result = await updateMember(orgName, request.body, {
        logger: request.log,
        dbConnection: this.mongoose,
      });
      if (result.didSucceed) {
        await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
        return;
      }

      await reply.code(RESPONSE_CODE_BY_PROBLEM[result.context]).send({
        type: result.context,
      });
    },
  });

  await fastify.register(memberPublicKeyRoutes, { ...opts, prefix: '/:memberId/public-keys' });
  await fastify.register(memberKeyImportToken, {
    ...opts,
    prefix: '/:memberId/public-key-import-tokens',
  });
  await fastify.register(signatureSpecRoutes, {
    ...opts,
    prefix: '/:memberId/signature-specs',
  });
}
