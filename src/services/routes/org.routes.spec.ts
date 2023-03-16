import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import { AWALA_ENDPOINT, ORG_NAME } from '../../testUtils/stubs.js';
import type { OrgSchema, OrgSchemaPatch } from '../schema/org.schema.js';
import type { OrgCreationResult } from '../../orgTypes.js';
import type { Result } from '../../utilities/result.js';
import { OrgProblemType } from '../../OrgProblemType.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../http.js';

const mockCreateOrg = mockSpy(jest.fn<() => Promise<Result<OrgCreationResult, OrgProblemType>>>());
const mockUpdateOrg = mockSpy(jest.fn<() => Promise<Result<undefined, OrgProblemType>>>());
const mockGetOrg = mockSpy(jest.fn<() => Promise<Result<OrgSchema, OrgProblemType>>>());
jest.unstable_mockModule('../../org.js', () => ({
  createOrg: mockCreateOrg,
  updateOrg: mockUpdateOrg,
  getOrg: mockGetOrg,
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
      });

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
        reason: OrgProblemType.EXISTING_ORG_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.CONFLICT);
      expect(response.json()).toHaveProperty('type', OrgProblemType.EXISTING_ORG_NAME);
    });

    test('Malformed name error should resolve into bad request status', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchema = {
        name: 'MALFORMED_NAME',
        memberAccessType: 'INVITE_ONLY',
      };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason: OrgProblemType.MALFORMED_ORG_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', OrgProblemType.MALFORMED_ORG_NAME);
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
        reason: OrgProblemType.MALFORMED_AWALA_ENDPOINT,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', OrgProblemType.MALFORMED_AWALA_ENDPOINT);
    });
  });

  describe('update', () => {
    const injectionOptions: InjectOptions = {
      method: 'PATCH',
      url: `/orgs/${ORG_NAME}`,
    };
    const getOrgSuccessResponse = {
      didSucceed: true,

      result: {
        name: ORG_NAME,
        memberAccessType: 'INVITE_ONLY',
      },
    } as const;

    test('Empty parameters should be accepted', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchemaPatch = {};
      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);
      mockUpdateOrg.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
    });

    test('name matching the url parameter should be accepted', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchemaPatch = {
        name: ORG_NAME,
      };
      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);
      mockUpdateOrg.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
    });

    test('INVITE_ONLY access type should be accepted', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchemaPatch = {
        memberAccessType: 'INVITE_ONLY',
      };
      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);
      mockUpdateOrg.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
    });

    test('OPEN access type should be accepted', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchemaPatch = {
        memberAccessType: 'OPEN',
      };
      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);
      mockUpdateOrg.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
    });

    test('awala endpoint type should be accepted', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchemaPatch = {
        awalaEndpoint: AWALA_ENDPOINT,
      };
      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);
      mockUpdateOrg.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', 200);
    });

    test('non matching name should resolve into bad request status', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchemaPatch = {
        name: 'invalid.com',
      };
      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);
      mockUpdateOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason: OrgProblemType.INVALID_ORG_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', OrgProblemType.INVALID_ORG_NAME);
    });

    test('non existing name should resolve into not found status', async () => {
      const serverInstance = await makeServer();
      const payload: OrgSchemaPatch = {};
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason: OrgProblemType.ORG_NOT_FOUND,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', OrgProblemType.ORG_NOT_FOUND);
    });
  });
});
