import type { HTTPMethods } from 'fastify';

import { REQUIRED_ENV_VARS } from '../../../testUtils/envVars.js';
import { HTTP_STATUS_CODES } from '../../http.js';
import type { FastifyTypedInstance } from '../FastifyTypedInstance.js';
import { HTTP_METHODS, makeFastify } from '../server.js';
import { makeTestServer } from '../../../testUtils/server.js';

describe('notFoundHandler', () => {
  const endpointUrl = '/';
  const allowedMethods: HTTPMethods[] = ['HEAD', 'GET'];

  const getTestServerFixture = makeTestServer(
    async () =>
      makeFastify((fastify, _opts, done) => {
        fastify.route({
          method: allowedMethods,
          url: endpointUrl,

          async handler(_req, reply) {
            await reply.code(HTTP_STATUS_CODES.OK).send();
          },
        });

        done();
      }),
    REQUIRED_ENV_VARS,
  );

  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServerFixture().server;
  });

  const allowedMethodsString = allowedMethods.join(', ');
  const disallowedMethods = HTTP_METHODS.filter(
    (method) => !allowedMethods.includes(method) && method !== 'OPTIONS',
  );

  test('An existing method should be routed to the handler', async () => {
    const response = await serverInstance.inject({ method: 'GET', url: endpointUrl });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
  });

  test.each(disallowedMethods)('%s requests should be refused', async (method) => {
    const response = await serverInstance.inject({ method: method as any, url: endpointUrl });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.METHOD_NOT_ALLOWED);
    expect(response).toHaveProperty('headers.allow', allowedMethodsString);
  });

  test('OPTIONS requests should list the allowed methods', async () => {
    const response = await serverInstance.inject({
      method: 'OPTIONS',
      url: endpointUrl,
    });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    expect(response).toHaveProperty('headers.allow', allowedMethodsString);
  });

  test('Non existing path should result in 404 error', async () => {
    const response = await serverInstance.inject({ method: 'OPTIONS', url: '/NonExistingPath' });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
    expect(response).not.toHaveProperty('headers.allow');
  });
});
