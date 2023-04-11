import type { InjectOptions } from 'fastify';
import { jest } from '@jest/globals';

import { configureMockEnvVars, REQUIRED_SERVER_ENV_VARS } from '../../testUtils/envVars.js';
import {
  MEMBER_KEY_IMPORT_TOKEN,
  MEMBER_MONGO_ID,
  ORG_NAME,
  TEST_SERVICE_OID,
} from '../../testUtils/stubs.js';
import type { SuccessfulResult } from '../../utilities/result.js';
import { mockSpy } from '../../testUtils/jest.js';
import { HTTP_STATUS_CODES } from '../http.js';
import type { MemberKeyImportTokenSchema } from '../schema/memberKeyImportToken.schema.js';
import type { MemberKeyImportTokenCreationResult } from '../../memberKeyImportTokenTypes.js';
import type { FastifyTypedInstance } from '../types/FastifyTypedInstance.js';

const mockCreateMemberKeyImportToken = mockSpy(
  jest.fn<() => Promise<SuccessfulResult<MemberKeyImportTokenCreationResult>>>(),
);

jest.unstable_mockModule('../../memberKeyImportToken.js', () => ({
  createMemberKeyImportToken: mockCreateMemberKeyImportToken,
}));
const { setUpTestServer } = await import('../../testUtils/server.js');

describe('member key import token routes', () => {
  configureMockEnvVars(REQUIRED_SERVER_ENV_VARS);
  const getTestServer = setUpTestServer();
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
