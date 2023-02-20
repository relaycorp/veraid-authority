import type { FastifyInstance, HTTPMethods } from 'fastify';

import { HTTP_METHODS } from '../services/fastify.js';

export function testDisallowedMethods(
  allowedMethods: readonly HTTPMethods[],
  endpointUrl: string,
  initFastify: () => Promise<FastifyInstance>,
): void {
  const allowedMethodsString = allowedMethods.join(', ');

  const disallowedMethods = HTTP_METHODS.filter(
    (method) => !allowedMethods.includes(method) && method !== 'OPTIONS',
  );

  test.each(disallowedMethods)('%s requests should be refused', async (method) => {
    const fastify = await initFastify();

    const response = await fastify.inject({ method: method as any, url: endpointUrl });

    expect(response).toHaveProperty('statusCode', 405);
    expect(response).toHaveProperty('headers.allow', allowedMethodsString);
  });

  test('OPTIONS requests should list the allowed methods', async () => {
    const fastify = await initFastify();

    const response = await fastify.inject({ method: 'OPTIONS', url: endpointUrl });

    expect(response).toHaveProperty('statusCode', 204);
    expect(response).toHaveProperty('headers.allow', allowedMethodsString);
  });
}
