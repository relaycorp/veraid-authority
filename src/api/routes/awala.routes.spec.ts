import { jest } from '@jest/globals';

import type { FastifyTypedInstance } from '../../utilities/fastify/FastifyTypedInstance.js';
import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { Result } from '../../utilities/result.js';
import type { MemberProblemType } from '../../MemberProblemType.js';
import { AWALA_PDA, MEMBER_PUBLIC_KEY_MONGO_ID, SIGNATURE } from '../../testUtils/stubs.js';
import { makeMockLogging, partialPinoLog } from '../../testUtils/logging.js';
import { BASE_64_REGEX } from '../../schemas/validation.js';

const mockCreateMemberBundleRequest = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberProblemType>>>(),
);

jest.unstable_mockModule('../../awala.js', () => ({
  createMemberBundleRequest: mockCreateMemberBundleRequest,
}));

const { makeTestApiServer } = await import('../../testUtils/apiServer.js');

describe('awala routes', () => {
  const mockLogging = makeMockLogging();
  const getTestApiServer = makeTestApiServer(mockLogging.logger);
  let serverInstance: FastifyTypedInstance;

  beforeEach(() => {
    serverInstance = getTestApiServer();
  });

  test('Invalid content type should resolve to unsupported media type error', async () => {
    const response = await serverInstance.inject({
      method: 'POST',
      url: '/awala',

      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'content-type': 'INVALID_CONTENT_TYPE',
      },
    });
    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.UNSUPPORTED_MEDIA_TYPE);
  });

  describe('Member bundle request', () => {
    const validPayload = {
      publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      memberBundleStartDate: '2023-04-13T20:05:38.285Z',
      awalaPda: AWALA_PDA,
      signature: SIGNATURE,
    };
    const validHeaders = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'content-type': 'application/vnd.veraid.member-bundle-request',
    };

    test('Valid data should be accepted', async () => {
      const response = await serverInstance.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: validPayload,
      });

      mockCreateMemberBundleRequest.mockResolvedValueOnce({
        didSucceed: true,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.ACCEPTED);
      expect(mockCreateMemberBundleRequest).toHaveBeenCalledOnceWith(validPayload, {
        logger: serverInstance.log,
        dbConnection: serverInstance.mongoose,
      });
    });

    test('Malformed date should be refused', async () => {
      const methodPayload = {
        ...validPayload,
        memberBundleStartDate: 'INVALID_DATE',
      };

      const response = await serverInstance.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: methodPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          reason: 'data/memberBundleStartDate must match format "date-time"',
        }),
      );
    });

    test('Malformed signature should be refused', async () => {
      const methodPayload = {
        ...validPayload,
        signature: 'INVALID_BASE_64',
      };

      const response = await serverInstance.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: methodPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          reason: `data/signature must match pattern "${BASE_64_REGEX}"`,
        }),
      );
    });

    test('Malformed Awala Pda should be refused', async () => {
      const methodPayload = {
        ...validPayload,
        awalaPda: 'INVALID_BASE_64',
      };

      const response = await serverInstance.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: methodPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          reason: `data/awalaPda must match pattern "${BASE_64_REGEX}"`,
        }),
      );
    });
  });
});
