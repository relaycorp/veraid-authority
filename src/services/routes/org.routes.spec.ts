import type { InjectOptions } from 'fastify';

import { makeServer } from '../server.js';
import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import { AWALA_ENDPOINT, ORG_NAME } from '../../testUtils/stubs.js';
import type { OrgSchema } from '../schema/org.schema.js';

import { ProblemType } from './org.routes.js';

describe('org routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: '/orgs',
    };

    test('Valid parameters with non ASCII name should return success', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: 'はじめよう.みんな',
        memberAccessType: 'INVITE_ONLY',
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
      expect(response.headers['content-type']).toStartWith('application/json');
    });

    test('Valid parameters with INVITE_ONLY access type should return success', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
      expect(response.headers['content-type']).toStartWith('application/json');
    });

    test('Valid parameters with OPEN access type should return success', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'OPEN',
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
      expect(response.headers['content-type']).toStartWith('application/json');
    });

    test('Valid parameters with Awala endpoint should return success', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'OPEN',
        awalaEndpoint: AWALA_ENDPOINT,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
      expect(response.headers['content-type']).toStartWith('application/json');
    });

    test('Valid parameters with non ASCII Awala endpoint should return success', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
        awalaEndpoint: 'はじめよう.みんな',
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
      expect(response.headers['content-type']).toStartWith('application/json');
    });

    test('Invalid access type should be refused', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVALID' as any,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 400);
    });

    test('Missing access type should be refused', async () => {
      const serverInstance = await makeServer();
      const payload: Partial<OrgSchema> = {
        name: ORG_NAME,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 400);
    });

    test('Missing name should be refused', async () => {
      const serverInstance = await makeServer();
      const payload: Partial<OrgSchema> = {
        memberAccessType: 'OPEN',
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 400);
    });

    test('Malformed name should be refused', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: '192.168.0.0',
        memberAccessType: 'OPEN',
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 400);
      expect(response.json()).toHaveProperty('type', ProblemType.MALFORMED_ORG_NAME);
    });

    test('Malformed Awala endpoint should be refused', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'OPEN',
        awalaEndpoint: '192.168.0.0',
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 400);
      expect(response.json()).toHaveProperty('type', ProblemType.MALFORMED_AWALA_ENDPOINT);
    });
  });
});
