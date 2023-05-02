import type { FastifyInstance } from 'fastify';

import { HTTP_STATUS_CODES } from '../../http.js';

export default function setErrorHandler(fastify: FastifyInstance): void {
  const internalServerError = 'Internal server error';
  fastify.setErrorHandler(async (error, _request, reply) => {
    if (
      error.statusCode !== undefined &&
      error.statusCode < HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ) {
      fastify.log.info(error, 'Client error');
      await reply.send(error);
      return;
    }

    fastify.log.error(error, internalServerError);
    await reply.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).send(internalServerError);
  });
}
