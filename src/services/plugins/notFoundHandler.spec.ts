import type { HTTPMethods } from 'fastify';

import { makeServer } from '../server.js';
import { configureMockEnvVars } from '../../testUtils/envVars.js';
import { HTTP_STATUS_CODES } from '../http.js';
import { HTTP_METHODS } from '../fastify.js';

describe('notFoundHandler', () => {
  configureMockEnvVars({ AUTHORITY_VERSION: '1.2.3' });

  const allowedMethods: HTTPMethods[] = ['HEAD', 'GET'];

  const allowedMethodsString = allowedMethods.join(', ');

  const disallowedMethods = HTTP_METHODS.filter(
    (method) => !allowedMethods.includes(method) && method !== 'OPTIONS',
  );

  const endpointUrl = '/';

  test('An existing method should be routed to the handler', async () => {
    const serverInstance = await makeServer();

    const response = await serverInstance.inject({ method: 'GET', url: endpointUrl });

    expect(response).toHaveProperty('statusCode', 200);
    expect(response).toHaveProperty('headers.content-type', 'text/plain');
  });

  test.each(disallowedMethods)('%s requests should be refused', async (method) => {
    const serverInstance = await makeServer();

    const response = await serverInstance.inject({ method: method as any, url: endpointUrl });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.METHOD_NOT_ALLOWED);
    expect(response).toHaveProperty('headers.allow', allowedMethodsString);
  });

  test('OPTIONS requests should list the allowed methods', async () => {
    const serverInstance = await makeServer();

    const response = await serverInstance.inject({ method: 'OPTIONS', url: endpointUrl });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    expect(response).toHaveProperty('headers.allow', allowedMethodsString);
  });

  test('Non existing path should result in 404 error', async () => {
    const serverInstance = await makeServer();

    const response = await serverInstance.inject({
      method: 'OPTIONS',
      url: '/NonExistingPath',
    });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
    expect(response).not.toHaveProperty('headers.allow');
  });
});
