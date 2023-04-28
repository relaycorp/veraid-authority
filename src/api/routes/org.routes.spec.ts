/* eslint-disable unicorn/text-encoding-identifier-case */
import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { NON_ASCII_ORG_NAME, ORG_NAME } from '../../testUtils/stubs.js';
import type { OrgSchema, OrgSchemaPatch } from '../../schemas/org.schema.js';
import type { OrgCreationResult } from '../../orgTypes.js';
import type { Result, SuccessfulResult } from '../../utilities/result.js';
import { OrgProblemType } from '../../OrgProblemType.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';

const mockCreateOrg = mockSpy(jest.fn<() => Promise<Result<OrgCreationResult, OrgProblemType>>>());
const mockUpdateOrg = mockSpy(jest.fn<() => Promise<Result<undefined, OrgProblemType>>>());
const mockGetOrg = mockSpy(jest.fn<() => Promise<Result<OrgSchema, OrgProblemType>>>());
const mockDeleteOrg = mockSpy(jest.fn<() => Promise<Result<undefined, OrgProblemType>>>());
jest.unstable_mockModule('../../org.js', () => ({
  createOrg: mockCreateOrg,
  updateOrg: mockUpdateOrg,
  getOrg: mockGetOrg,
  deleteOrg: mockDeleteOrg,
}));

const { makeTestApiServer, testOrgRouteAuth } = await import('../../testUtils/apiServer.js');

describe('org routes', () => {
  const getTestServerFixture = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    const fixture = getTestServerFixture();
    serverInstance = fixture.server;
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: '/orgs',
    };

    describe('Auth', () => {
      const payload: OrgSchema = { name: ORG_NAME };
      testOrgRouteAuth('ORG_BULK', { ...injectionOptions, payload }, getTestServerFixture, {
        spy: mockCreateOrg,
        result: { name: ORG_NAME },
      });
    });

    test.each([
      ['ASCII', ORG_NAME],
      ['Non ASCII', NON_ASCII_ORG_NAME],
    ])('%s name should return URLs', async (_type, name: string) => {
      const payload: OrgSchema = { name };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          name,
        },
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.headers['content-type']).toStartWith('application/json');
      expect(response.json()).toStrictEqual({
        self: `/orgs/${name}`,
        members: `/orgs/${name}/members`,
      });
    });

    test('Duplicated name error should resolve into conflict status', async () => {
      const payload: OrgSchema = { name: ORG_NAME };
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

    test('Malformed name should resolve into bad request status', async () => {
      const payload: OrgSchema = { name: 'MALFORMED_NAME' };
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
  });

  describe('update', () => {
    const injectionOptions: InjectOptions = {
      method: 'PATCH',
      url: `/orgs/${ORG_NAME}`,
    };
    const getOrgSuccessResponse = {
      didSucceed: true,
      result: { name: ORG_NAME },
    } as const;

    describe('Auth', () => {
      beforeEach(() => {
        mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);
      });

      testOrgRouteAuth('ORG', { ...injectionOptions, payload: {} }, getTestServerFixture, {
        spy: mockUpdateOrg,
      });
    });

    test('Empty parameters should be accepted', async () => {
      const payload: OrgSchemaPatch = {};
      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);
      mockUpdateOrg.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Name matching the url parameter should be accepted', async () => {
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

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Non-matching name should be refused', async () => {
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

    test('Non existing name should resolve into not found status', async () => {
      const payload: OrgSchemaPatch = {};
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason: OrgProblemType.ORG_NOT_FOUND,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(mockUpdateOrg).not.toHaveBeenCalled();
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', OrgProblemType.ORG_NOT_FOUND);
    });
  });

  describe('get by name', () => {
    const injectionOptions: InjectOptions = {
      method: 'GET',
    };

    describe('Auth', () => {
      testOrgRouteAuth(
        'ORG',
        { ...injectionOptions, url: `/orgs/${ORG_NAME}` },
        getTestServerFixture,
        { spy: mockGetOrg, result: { name: ORG_NAME } },
      );
    });

    test.each([
      ['ASCII', ORG_NAME],
      ['Non ASCII', NON_ASCII_ORG_NAME],
    ])('%s name should return an org', async (_type, name: string) => {
      const getOrgSuccessResponse: SuccessfulResult<OrgSchema> = {
        didSucceed: true,
        result: { name },
      };

      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);

      const response = await serverInstance.inject({
        ...injectionOptions,
        url: `/orgs/${name}`,
      });

      expect(mockGetOrg).toHaveBeenCalledWith(name, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.headers['content-type']).toStartWith('application/json');
      expect(response.json()).toStrictEqual(getOrgSuccessResponse.result);
    });

    test('Non existing name should resolve into not found status', async () => {
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason: OrgProblemType.ORG_NOT_FOUND,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        url: `/orgs/${ORG_NAME}`,
      });

      expect(mockGetOrg).toHaveBeenCalledWith(ORG_NAME, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', OrgProblemType.ORG_NOT_FOUND);
    });
  });

  describe('delete', () => {
    const injectionOptions: InjectOptions = {
      method: 'DELETE',
    };

    describe('Auth', () => {
      beforeEach(() => {
        mockGetOrg.mockResolvedValueOnce({
          didSucceed: true,
          result: { name: ORG_NAME },
        });
      });

      testOrgRouteAuth(
        'ORG',
        { ...injectionOptions, url: `/orgs/${ORG_NAME}` },
        getTestServerFixture,
        { spy: mockDeleteOrg },
      );
    });

    test('Valid name should be accepted', async () => {
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: true,
        result: { name: ORG_NAME },
      });
      mockDeleteOrg.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        url: `/orgs/${ORG_NAME}`,
      });

      expect(mockDeleteOrg).toHaveBeenCalledWith(ORG_NAME, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Non existing name should resolve into not found status', async () => {
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason: OrgProblemType.ORG_NOT_FOUND,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        url: `/orgs/${ORG_NAME}`,
      });

      expect(mockDeleteOrg).not.toHaveBeenCalled();
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', OrgProblemType.ORG_NOT_FOUND);
    });

    test.each([
      ['Existing org members', OrgProblemType.EXISTING_MEMBERS],
      ['Last member not admin', OrgProblemType.LAST_MEMBER_NOT_ADMIN],
    ])('%s should should be refused', async (_type, reason) => {
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: true,
        result: { name: ORG_NAME },
      });
      mockDeleteOrg.mockResolvedValueOnce({
        didSucceed: false,
        reason,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        url: `/orgs/${ORG_NAME}`,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.FAILED_DEPENDENCY);
      expect(response.json()).toHaveProperty('type', reason);
    });
  });
});
