import type { FastifyReply, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

import { MemberWorkloadIdentityProblem } from './MemberWorkloadIdentityProblem.js';
import {
  createWorkloadIdentity,
  deleteWorkloadIdentity,
  getWorkloadIdentity,
} from './memberWorkloadIdentity.js';
import { MEMBER_WORKLOAD_IDENTITY_SCHEMA } from './memberWorkloadIdentity.schema.js';

const HTTP_OR_HTTPS_URL_REGEX = /^https?:/u;

const RESPONSE_CODE_BY_PROBLEM: {
  // eslint-disable-next-line max-len
  [key in MemberWorkloadIdentityProblem]: (typeof HTTP_STATUS_CODES)[keyof typeof HTTP_STATUS_CODES];
} = {
  [MemberWorkloadIdentityProblem.NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,

  [MemberWorkloadIdentityProblem.MALFORMED_ISSUER_URL]: HTTP_STATUS_CODES.BAD_REQUEST,

  [MemberWorkloadIdentityProblem.INVALID_TTL]: HTTP_STATUS_CODES.BAD_REQUEST,
} as const;

const CREATE_PARAMS = {
  type: 'object',

  properties: {
    orgName: { type: 'string' },
    memberId: { type: 'string' },
  },

  required: ['orgName', 'memberId'],
} as const;

const WORKLOAD_IDENTITY_PARAMS = {
  type: 'object',

  properties: {
    orgName: { type: 'string' },
    memberId: { type: 'string' },
    workloadIdentityId: { type: 'string' },
  },

  required: ['orgName', 'memberId', 'workloadIdentityId'],
} as const;

interface WorkloadIdentityUrls {
  self: string;
}

function makeUrls(
  orgName: string,
  memberId: string,
  workloadIdentityId: string,
): WorkloadIdentityUrls {
  return {
    self: `/orgs/${orgName}/members/${memberId}/workload-identities/${workloadIdentityId}`,
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
      body: MEMBER_WORKLOAD_IDENTITY_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, orgName } = request.params;

      if (!HTTP_OR_HTTPS_URL_REGEX.test(request.body.openidProviderIssuerUrl)) {
        await reply
          .code(HTTP_STATUS_CODES.BAD_REQUEST)
          .send({ type: MemberWorkloadIdentityProblem.MALFORMED_ISSUER_URL });
        return;
      }

      const openidProviderIssuerUrl = new URL(request.body.openidProviderIssuerUrl);

      const workloadIdentity = { ...request.body, openidProviderIssuerUrl };
      const result = await createWorkloadIdentity(memberId, workloadIdentity, {
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
    url: '/:workloadIdentityId',

    schema: {
      params: WORKLOAD_IDENTITY_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, workloadIdentityId } = request.params;
      const serviceOptions = {
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const workloadIdentity = await getWorkloadIdentity(
        memberId,
        workloadIdentityId,
        serviceOptions,
      );
      if (!workloadIdentity.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[workloadIdentity.context]).send({
          type: workloadIdentity.context,
        });
        return;
      }

      await deleteWorkloadIdentity(workloadIdentityId, serviceOptions);

      await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
    },
  });

  fastify.route({
    method: ['GET'],
    url: '/:workloadIdentityId',

    schema: {
      params: WORKLOAD_IDENTITY_PARAMS,
    },

    async handler(request, reply): Promise<FastifyReply> {
      const { memberId, workloadIdentityId } = request.params;
      const result = await getWorkloadIdentity(memberId, workloadIdentityId, {
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
