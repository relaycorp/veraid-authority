/* eslint-disable unicorn/text-encoding-identifier-case */
import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';
import { generateTxtRdata } from '@relaycorp/veraid';

import { NON_ASCII_ORG_NAME, ORG_NAME } from '../../testUtils/stubs.js';
import type { Result, SuccessfulResult } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { generateKeyPair } from '../../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../../utilities/webcrypto.js';

import { OrgProblem } from './OrgProblem.js';
import type { OrgCreationSchema, OrgPatchSchema, OrgReadSchema } from './org.schema.js';

const mockCreateOrg = mockSpy(jest.fn<() => Promise<Result<OrgReadSchema, OrgProblem>>>());
const mockUpdateOrg = mockSpy(jest.fn<() => Promise<Result<undefined, OrgProblem>>>());
const mockGetOrg = mockSpy(jest.fn<() => Promise<Result<OrgReadSchema, OrgProblem>>>());
const mockDeleteOrg = mockSpy(jest.fn<() => Promise<Result<undefined, OrgProblem>>>());
jest.unstable_mockModule('./org.js', () => ({
  createOrg: mockCreateOrg,
  updateOrg: mockUpdateOrg,
  getOrg: mockGetOrg,
  deleteOrg: mockDeleteOrg,
}));

const { makeTestApiServer, testOrgRouteAuth } = await import('../../testUtils/apiServer.js');

const { publicKey: PUBLIC_KEY } = await generateKeyPair();
const PUBLIC_KEY_SERIALISED = await derSerialisePublicKey(PUBLIC_KEY);
const PUBLIC_KEY_BASE64 = PUBLIC_KEY_SERIALISED.toString('base64');

const TXT_RECORD_RDATA = await generateTxtRdata(PUBLIC_KEY, 3600);

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
      const payload: OrgCreationSchema = { name: ORG_NAME };
      testOrgRouteAuth('ORG_BULK', { ...injectionOptions, payload }, getTestServerFixture, {
        spy: mockCreateOrg,
        result: { name: ORG_NAME, publicKey: PUBLIC_KEY_BASE64, txtRecordRdata: TXT_RECORD_RDATA },
      });
    });

    test.each([
      ['ASCII', ORG_NAME],
      ['Non ASCII', NON_ASCII_ORG_NAME],
    ])('%s name should return URLs', async (_type, name: string) => {
      const payload: OrgCreationSchema = { name };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: true,
        result: { name, publicKey: PUBLIC_KEY_BASE64, txtRecordRdata: TXT_RECORD_RDATA },
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.headers['content-type']).toStartWith('application/json');
      expect(response.json()).toMatchObject({
        self: `/orgs/${name}`,
        members: `/orgs/${name}/members`,
      });
    });

    test('Response should include public key', async () => {
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: true,
        result: { name: ORG_NAME, publicKey: PUBLIC_KEY_BASE64, txtRecordRdata: TXT_RECORD_RDATA },
      });
      const payload: OrgCreationSchema = { name: ORG_NAME };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });
      expect(response.json()).toHaveProperty('publicKey', PUBLIC_KEY_BASE64);
    });

    test('Response should include TXT record rdata', async () => {
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: true,
        result: { name: ORG_NAME, publicKey: PUBLIC_KEY_BASE64, txtRecordRdata: TXT_RECORD_RDATA },
      });
      const payload: OrgCreationSchema = { name: ORG_NAME };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });
      expect(response.json()).toHaveProperty('txtRecordRdata', TXT_RECORD_RDATA);
    });

    test('Duplicated name error should resolve into conflict status', async () => {
      const payload: OrgCreationSchema = { name: ORG_NAME };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: false,
        context: OrgProblem.EXISTING_ORG_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.CONFLICT);
      expect(response.json()).toHaveProperty('type', OrgProblem.EXISTING_ORG_NAME);
    });

    test('Malformed name should resolve into bad request status', async () => {
      const payload: OrgCreationSchema = { name: 'MALFORMED_NAME' };
      mockCreateOrg.mockResolvedValueOnce({
        didSucceed: false,
        context: OrgProblem.MALFORMED_ORG_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', OrgProblem.MALFORMED_ORG_NAME);
    });
  });

  describe('update', () => {
    const injectionOptions: InjectOptions = {
      method: 'PATCH',
      url: `/orgs/${ORG_NAME}`,
    };
    const getOrgSuccessResponse = {
      didSucceed: true,
      result: { name: ORG_NAME, publicKey: PUBLIC_KEY_BASE64, txtRecordRdata: TXT_RECORD_RDATA },
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
      const payload: OrgPatchSchema = {};
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
      const payload: OrgPatchSchema = {
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
      const payload: OrgPatchSchema = {
        name: 'invalid.com',
      };
      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);
      mockUpdateOrg.mockResolvedValueOnce({
        didSucceed: false,
        context: OrgProblem.INVALID_ORG_NAME,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.json()).toHaveProperty('type', OrgProblem.INVALID_ORG_NAME);
    });

    test('Non existing name should resolve into not found status', async () => {
      const payload: OrgPatchSchema = {};
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: false,
        context: OrgProblem.ORG_NOT_FOUND,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(mockUpdateOrg).not.toHaveBeenCalled();
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', OrgProblem.ORG_NOT_FOUND);
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
        {
          spy: mockGetOrg,

          result: {
            name: ORG_NAME,
            publicKey: PUBLIC_KEY_BASE64,
            txtRecordRdata: TXT_RECORD_RDATA,
          },
        },
      );
    });

    test.each([
      ['ASCII', ORG_NAME],
      ['Non ASCII', NON_ASCII_ORG_NAME],
    ])('%s name should return an org', async (_type, name: string) => {
      const txtRecordRdata = await generateTxtRdata(PUBLIC_KEY, 3600);
      const getOrgSuccessResponse: SuccessfulResult<OrgReadSchema> = {
        didSucceed: true,
        result: { name, publicKey: PUBLIC_KEY_BASE64, txtRecordRdata },
      };

      mockGetOrg.mockResolvedValueOnce(getOrgSuccessResponse);

      const response = await serverInstance.inject({
        ...injectionOptions,
        url: `/orgs/${name}`,
      });

      expect(mockGetOrg).toHaveBeenCalledWith(name, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.headers['content-type']).toStartWith('application/json');
      expect(response.json()).toStrictEqual(getOrgSuccessResponse.result);
    });

    test('Non existing name should resolve into not found status', async () => {
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: false,
        context: OrgProblem.ORG_NOT_FOUND,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        url: `/orgs/${ORG_NAME}`,
      });

      expect(mockGetOrg).toHaveBeenCalledWith(ORG_NAME, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', OrgProblem.ORG_NOT_FOUND);
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

          result: {
            name: ORG_NAME,
            publicKey: PUBLIC_KEY_BASE64,
            txtRecordRdata: TXT_RECORD_RDATA,
          },
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
        result: { name: ORG_NAME, publicKey: PUBLIC_KEY_BASE64, txtRecordRdata: TXT_RECORD_RDATA },
      });
      mockDeleteOrg.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        url: `/orgs/${ORG_NAME}`,
      });

      expect(mockDeleteOrg).toHaveBeenCalledWith(ORG_NAME, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NO_CONTENT);
    });

    test('Non existing name should resolve into not found status', async () => {
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: false,
        context: OrgProblem.ORG_NOT_FOUND,
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        url: `/orgs/${ORG_NAME}`,
      });

      expect(mockDeleteOrg).not.toHaveBeenCalled();
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.NOT_FOUND);
      expect(response.json()).toHaveProperty('type', OrgProblem.ORG_NOT_FOUND);
    });

    test.each([
      ['Existing org members', OrgProblem.EXISTING_MEMBERS],
      ['Last member not admin', OrgProblem.LAST_MEMBER_NOT_ADMIN],
    ])('%s should should be refused', async (_type, reason) => {
      mockGetOrg.mockResolvedValueOnce({
        didSucceed: true,
        result: { name: ORG_NAME, publicKey: PUBLIC_KEY_BASE64, txtRecordRdata: TXT_RECORD_RDATA },
      });
      mockDeleteOrg.mockResolvedValueOnce({
        didSucceed: false,
        context: reason,
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
