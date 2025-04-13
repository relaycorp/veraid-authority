import type { FastifyReply, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES, type StatusByProblem } from '../../utilities/http.js';
import type { PluginDone } from '../../utilities/fastify/PluginDone.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

import { SignatureBundleIssuanceProblem } from './SignatureBundleIssuanceProblem.js';
import { issueSignatureBundle } from './signatureBundleIssuance.js';

const CONTENT_TYPES = {
  BINARY: 'application/vnd.veraid.signature-bundle',
  BASE64: 'application/vnd.veraid.signature-bundle+base64',
} as const;

const RESPONSE_CODE_BY_PROBLEM: StatusByProblem<SignatureBundleIssuanceProblem> = {
  [SignatureBundleIssuanceProblem.SIGNATURE_SPEC_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
  [SignatureBundleIssuanceProblem.INVALID_JWT]: HTTP_STATUS_CODES.UNAUTHORIZED,
  [SignatureBundleIssuanceProblem.EXPIRED_JWT]: HTTP_STATUS_CODES.UNAUTHORIZED,
  [SignatureBundleIssuanceProblem.JWKS_RETRIEVAL_ERROR]: HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,

  [SignatureBundleIssuanceProblem.DNSSEC_CHAIN_RETRIEVAL_FAILED]:
    HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,

  [SignatureBundleIssuanceProblem.ORG_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
} as const;

const SIGNATURE_BUNDLE_PARAMS = {
  type: 'object',

  properties: {
    specId: { type: 'string' },
  },

  required: ['specId'],
} as const;

export default function registerRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['GET'],
    url: '/credentials/signatureBundles/:specId',

    schema: {
      params: SIGNATURE_BUNDLE_PARAMS,
    },

    async handler(request, reply): Promise<FastifyReply> {
      const authHeader = request.headers.authorization ?? '';
      const [authType, jwt] = authHeader.split(' ');
      if (authType !== 'Bearer') {
        return reply.code(HTTP_STATUS_CODES.UNAUTHORIZED).send();
      }

      const { specId } = request.params;
      const requiredJwtAudience = `${request.protocol}://${request.hostname}${request.url}`;
      const result = await issueSignatureBundle(
        {
          signatureSpecId: specId,
          jwtSerialised: jwt,
          requiredJwtAudience,
        },
        {
          logger: request.log,
          dbConnection: this.mongoose,
        },
      );

      if (result.didSucceed) {
        const contentType =
          request.headers.accept === CONTENT_TYPES.BASE64
            ? CONTENT_TYPES.BASE64
            : CONTENT_TYPES.BINARY;
        const signatureBundleSerialised = Buffer.from(result.result.serialise());
        const responsePayload =
          contentType === CONTENT_TYPES.BASE64
            ? signatureBundleSerialised.toString('base64')
            : signatureBundleSerialised;

        return reply
          .code(HTTP_STATUS_CODES.OK)
          .header('Content-Type', contentType)
          .send(responsePayload);
      }

      return reply.code(RESPONSE_CODE_BY_PROBLEM[result.context]).send({ type: result.context });
    },
  });

  done();
}
