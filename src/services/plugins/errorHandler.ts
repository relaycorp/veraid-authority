import { type FastifyInstance, type RouteOptions } from 'fastify';
import type { PluginDone } from '../types/PluginDone.js';

export default function notFoundHandler(
  fastify: FastifyInstance,
  _opts: RouteOptions,
  done: PluginDone,
): void {
  fastify.setErrorHandler(function (error, _request, reply) {
    console.log(1111)
      // fastify will use parent error handler to handle this
      reply.send(error)
  })

  // fastify.setNotFoundHandler(async (request, reply): Promise<void> => {
  //   const allowedMethods =
  //     fastify.routes
  //       .get(request.url)
  //       ?.map((route) => route.method)
  //       .flat() ?? [];
  //
  //   if (allowedMethods.length === 0) {
  //     await reply.code(HTTP_STATUS_CODES.NOT_FOUND).send();
  //     return;
  //   }
  //   const allowedMethodsString = allowedMethods.join(', ');
  //   const statusCode =
  //     request.method === 'OPTIONS'
  //       ? HTTP_STATUS_CODES.NO_CONTENT
  //       : HTTP_STATUS_CODES.METHOD_NOT_ALLOWED;
  //   await reply.code(statusCode).header('Allow', allowedMethodsString).send();
  // });
  done();
}
