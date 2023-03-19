import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import { ORG_NAME } from '../../testUtils/stubs.js';
import type { OrgSchema } from '../schema/org.schema.js';
import type { OrgCreationResult } from '../../orgTypes.js';
import type { Result } from '../../utilities/result.js';
import { CreationProblemType } from '../../CreationProblemType.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../http.js';

const mockCreateOrg = mockSpy(
  jest.fn<() => Promise<Result<OrgCreationResult, CreationProblemType>>>(),
);
jest.unstable_mockModule('../../org.js', () => ({
  createOrg: mockCreateOrg,
}));

const { makeServer } = await import('../server.js');

describe('org routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: '/orgs',
    };

    test('Valid parameters should return URLs', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          name: 'test',
        },
      })


      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });
      expect(response).toHaveProperty('statusCode', 200);
      expect(response.headers['content-type']).toStartWith('application/json');
      expect(response.json()).toStrictEqual({
        self: '/orgs/test',
      });
    });

    test('Valid parameters with INVITE_ONLY access type should return success', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          name: 'test',
        },
      });

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
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          name: 'test',
        },
      });

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

    test('Duplicated name error should resolve into conflict status', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason: CreationProblemType.EXISTING_ORG_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.CONFLICT);
      expect(response.json()).toHaveProperty('type', CreationProblemType.EXISTING_ORG_NAME);
    });

    test('Malformed name error should resolve into bad request status', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: 'MALFORMED_NAME',
        memberAccessType: 'INVITE_ONLY',
      };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason: CreationProblemType.MALFORMED_ORG_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', CreationProblemType.MALFORMED_ORG_NAME);
    });

    test('Malformed awala endpoint error should resolve into bad request status', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
        awalaEndpoint: 'MALFORMED_AWALA_ENDPOINT',
      };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason: CreationProblemType.MALFORMED_AWALA_ENDPOINT,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', CreationProblemType.MALFORMED_AWALA_ENDPOINT);
    });
  });
});
