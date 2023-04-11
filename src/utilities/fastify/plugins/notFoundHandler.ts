import type { FastifyInstance, RouteOptions } from 'fastify';

import { HTTP_STATUS_CODES } from '../../http.js';
import type { PluginDone } from '../PluginDone.js';

export default function notFoundHandler(
  fastify: FastifyInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.setNotFoundHandler(async (request, reply): Promise<void> => {
    const allowedMethods =
      fastify.routes
        .get(request.url)
        ?.map((route) => route.method)
        .flat() ?? [];

    if (allowedMethods.length === 0) {
      await reply.code(HTTP_STATUS_CODES.NOT_FOUND).send();
      return;
    }
    const allowedMethodsString = allowedMethods.join(', ');
    const statusCode =
      request.method === 'OPTIONS'
        ? HTTP_STATUS_CODES.NO_CONTENT
        : HTTP_STATUS_CODES.METHOD_NOT_ALLOWED;
    await reply.code(statusCode).header('Allow', allowedMethodsString).send();
  });
  done();
}
