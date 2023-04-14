import type { HTTPMethods } from 'fastify';

import { configureMockEnvVars } from '../../../testUtils/envVars.js';
import { HTTP_STATUS_CODES } from '../../http.js';
import type { FastifyTypedInstance } from '../FastifyTypedInstance.js';
import { HTTP_METHODS } from '../server.js';
import { REQUIRED_API_ENV_VARS, makeTestApiServer } from '../../../testUtils/apiServer.js';

describe('notFoundHandler', () => {
  configureMockEnvVars(REQUIRED_API_ENV_VARS);
  const getTestServer = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServer();
  });

  const allowedMethods: HTTPMethods[] = ['HEAD', 'GET'];
  const allowedMethodsString = allowedMethods.join(', ');
  const disallowedMethods = HTTP_METHODS.filter(
    (method) => !allowedMethods.includes(method) && method !== 'OPTIONS',
  );
  const endpointUrl = '/';

  test('An existing method should be routed to the handler', async () => {
    const response = await serverInstance.inject({ method: 'GET', url: endpointUrl });

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
    expect(response).toHaveProperty('headers.content-type', 'text/plain');
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
