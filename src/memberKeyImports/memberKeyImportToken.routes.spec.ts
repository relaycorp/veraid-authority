import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import {
  MEMBER_ID,
  MEMBER_KEY_IMPORT_TOKEN,
  ORG_NAME,
  TEST_SERVICE_OID,
} from '../testUtils/stubs.js';
import type { SuccessfulResult } from '../utilities/result.js';
import { mockSpy } from '../testUtils/jest.js';
import type { FastifyTypedInstance } from '../utilities/fastify/FastifyTypedInstance.js';
import { HTTP_STATUS_CODES } from '../utilities/http.js';

import type { MemberKeyImportTokenCreationResult } from './memberKeyImportTokenTypes.js';
import type { MemberKeyImportTokenSchema } from './memberKeyImportToken.schema.js';

const mockCreateMemberKeyImportToken = mockSpy(
  jest.fn<() => Promise<SuccessfulResult<MemberKeyImportTokenCreationResult>>>(),
);
jest.unstable_mockModule('./memberKeyImportToken.js', () => ({
  createMemberKeyImportToken: mockCreateMemberKeyImportToken,
  processMemberKeyImportToken: jest.fn(),
}));
const { makeTestApiServer, testOrgRouteAuth } = await import('../testUtils/apiServer.js');

describe('member key import token routes', () => {
  const getTestServerFixture = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServerFixture().server;
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: `/orgs/${ORG_NAME}/members/${MEMBER_ID}/public-key-import-tokens`,
    };

    describe('Auth', () => {
      const payload: MemberKeyImportTokenSchema = { serviceOid: TEST_SERVICE_OID };
      testOrgRouteAuth('ORG_MEMBERSHIP', { ...injectionOptions, payload }, getTestServerFixture, {
        spy: mockCreateMemberKeyImportToken,
        result: { id: MEMBER_KEY_IMPORT_TOKEN },
      });
    });

    test('Valid data should be stored', async () => {
      const payload: MemberKeyImportTokenSchema = {
        serviceOid: TEST_SERVICE_OID,
      };
      mockCreateMemberKeyImportToken.mockResolvedValueOnce({
        didSucceed: true,

        result: {
          id: MEMBER_KEY_IMPORT_TOKEN,
        },
      });

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(mockCreateMemberKeyImportToken).toHaveBeenCalledOnceWith(MEMBER_ID, TEST_SERVICE_OID, {
        logger: expect.anything(),
        dbConnection: serverInstance.mongoose,
      });
      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.OK);
      expect(response.json()).toStrictEqual({
        token: MEMBER_KEY_IMPORT_TOKEN,
      });
    });

    test('Malformed service OID should be refused', async () => {
      const payload: MemberKeyImportTokenSchema = {
        serviceOid: `${TEST_SERVICE_OID}@`,
      };

      const response = await serverInstance.inject({
        ...injectionOptions,
        payload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    });
  });
});
