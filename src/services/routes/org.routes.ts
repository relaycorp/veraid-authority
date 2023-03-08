import type { RouteOptions } from 'fastify';
import isValidDomain from 'is-valid-domain';

import { HTTP_STATUS_CODES } from '../http.js';
import type { PluginDone } from '../types/PluginDone.js';
import { ORG_SCHEMA } from '../schema/org.schema.js';
import { createOrg } from '../../org.js';
import type { FastifyTypedInstance } from '../fastify.js';

export enum ProblemType {
  MALFORMED_ORG_NAME = 'https://veraid.net/problems/malformed-org-name',
  MALFORMED_AWALA_ENDPOINT = 'https://veraid.net/problems/malformed-awala-endpoint',
}

export default function registerRoutes(
  fastify: FastifyTypedInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.route({
    method: ['POST'],
    url: '/orgs',

    schema: {
      body: ORG_SCHEMA,
    },

    async handler(request, reply): Promise<void> {
      const { name, awalaEndpoint } = request.body;

      const isNameValid = isValidDomain(name, { allowUnicode: true });
      if (!isNameValid) {
        await reply.code(HTTP_STATUS_CODES.BAD_REQUEST).send({
          type: ProblemType.MALFORMED_ORG_NAME,
        });
        return;
      }

      if (awalaEndpoint !== undefined && !isValidDomain(awalaEndpoint, { allowUnicode: true })) {
        await reply.code(HTTP_STATUS_CODES.BAD_REQUEST).send({
          type: ProblemType.MALFORMED_AWALA_ENDPOINT,
        });
        return;
      }

      await createOrg(request.body, {
        dbConnection: fastify.mongoose,
      });

      await reply
        .code(HTTP_STATUS_CODES.OK)
        .header('Content-Type', 'application/json')
        .send('Success! It works.');
    },
  });

  done();
}
