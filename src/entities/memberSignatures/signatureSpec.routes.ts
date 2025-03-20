import type { FastifyReply, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES, type StatusByProblem } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

import { SignatureSpecProblem } from './SignatureSpecProblem.js';
import { createSignatureSpec, deleteSignatureSpec, getSignatureSpec } from './signatureSpec.js';
import { SIGNATURE_SPEC_SCHEMA } from './SignatureSpec.schema.js';

const HTTP_OR_HTTPS_URL_REGEX = /^https?:/u;

const RESPONSE_CODE_BY_PROBLEM: StatusByProblem<SignatureSpecProblem> = {
  [SignatureSpecProblem.NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,

  [SignatureSpecProblem.MALFORMED_ISSUER_URL]: HTTP_STATUS_CODES.BAD_REQUEST,

  [SignatureSpecProblem.INVALID_TTL]: HTTP_STATUS_CODES.BAD_REQUEST,
} as const;

const CREATE_PARAMS = {
  type: 'object',

  properties: {
    orgName: { type: 'string' },
    memberId: { type: 'string' },
  },

  required: ['orgName', 'memberId'],
} as const;

const SIGNATURE_SPEC_PARAMS = {
  type: 'object',

  properties: {
    orgName: { type: 'string' },
    memberId: { type: 'string' },
    signatureSpecId: { type: 'string' },
  },

  required: ['orgName', 'memberId', 'signatureSpecId'],
} as const;

interface SignatureSpecUrls {
  self: string;
}

function makeUrls(orgName: string, memberId: string, signatureSpecId: string): SignatureSpecUrls {
  return {
    self: `/orgs/${orgName}/members/${memberId}/signature-specs/${signatureSpecId}`,
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
      body: SIGNATURE_SPEC_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, orgName } = request.params;

      if (!HTTP_OR_HTTPS_URL_REGEX.test(request.body.auth.providerIssuerUrl)) {
        await reply
          .code(HTTP_STATUS_CODES.BAD_REQUEST)
          .send({ type: SignatureSpecProblem.MALFORMED_ISSUER_URL });
        return;
      }

      const providerIssuerUrl = new URL(request.body.auth.providerIssuerUrl);
      const updatedAuth = { ...request.body.auth, providerIssuerUrl };
      const signatureSpec = { ...request.body, auth: updatedAuth };

      const result = await createSignatureSpec(memberId, orgName, signatureSpec, {
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
    url: '/:signatureSpecId',

    schema: {
      params: SIGNATURE_SPEC_PARAMS,
    },

    async handler(request, reply): Promise<void> {
      const { memberId, signatureSpecId } = request.params;
      const serviceOptions = {
        logger: request.log,
        dbConnection: this.mongoose,
      };

      const signatureSpec = await getSignatureSpec(memberId, signatureSpecId, serviceOptions);
      if (!signatureSpec.didSucceed) {
        await reply.code(RESPONSE_CODE_BY_PROBLEM[signatureSpec.context]).send({
          type: signatureSpec.context,
        });
        return;
      }

      await deleteSignatureSpec(signatureSpecId, serviceOptions);

      await reply.code(HTTP_STATUS_CODES.NO_CONTENT).send();
    },
  });

  fastify.route({
    method: ['GET'],
    url: '/:signatureSpecId',

    schema: {
      params: SIGNATURE_SPEC_PARAMS,
    },

    async handler(request, reply): Promise<FastifyReply> {
      const { memberId, signatureSpecId } = request.params;
      const result = await getSignatureSpec(memberId, signatureSpecId, {
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
