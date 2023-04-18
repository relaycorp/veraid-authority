import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import {
  MEMBER_MONGO_ID,
  MEMBER_KEY_IMPORT_TOKEN,
  ORG_NAME,
  TEST_SERVICE_OID,
} from '../../testUtils/stubs.js';
import type { SuccessfulResult } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { MemberKeyImportTokenCreationResult } from '../../memberKeyImportTokenTypes.js';
import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import type { MemberKeyImportTokenSchema } from '../../schemas/memberKeyImportToken.schema.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';

const mockCreateMemberKeyImportToken = mockSpy(
  jest.fn<() => Promise<SuccessfulResult<MemberKeyImportTokenCreationResult>>>(),
);
jest.unstable_mockModule('../../memberKeyImportToken.js', () => ({
  createMemberKeyImportToken: mockCreateMemberKeyImportToken,
  processMemberKeyImportToken: jest.fn(),
}));
const { makeTestApiServer } = await import('../../testUtils/apiServer.js');

describe('member key import token routes', () => {
  const getTestServer = makeTestApiServer();
  let serverInstance: FastifyTypedInstance;
  beforeEach(() => {
    serverInstance = getTestServer();
  });

  describe('creation', () => {
    const injectionOptions: InjectOptions = {
      method: 'POST',
      url: `/orgs/${ORG_NAME}/members/${MEMBER_MONGO_ID}/public-key-import-tokens`,
    };

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

      expect(mockCreateMemberKeyImportToken).toHaveBeenCalledOnceWith(
        MEMBER_MONGO_ID,
        TEST_SERVICE_OID,
        {
          logger: serverInstance.log,
          dbConnection: serverInstance.mongoose,
        },
      );
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
