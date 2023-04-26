import { jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { Result } from '../../utilities/result.js';
import { type MockLogSet, partialPinoLog } from '../../testUtils/logging.js';
import { generateKeyPair } from '../../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../../utilities/webcrypto.js';
import { MemberPublicKeyImportProblemType } from '../../MemberKeyImportTokenProblemType.js';
import type { MemberProblemType } from '../../MemberProblemType.js';
import {
  AWALA_PDA,
  MEMBER_PUBLIC_KEY_MONGO_ID,
  MEMBER_KEY_IMPORT_TOKEN,
  SIGNATURE,
} from '../../testUtils/stubs.js';

const mockProcessMemberKeyImportToken = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberPublicKeyImportProblemType>>>(),
);
jest.unstable_mockModule('../../memberKeyImportToken.js', () => ({
  processMemberKeyImportToken: mockProcessMemberKeyImportToken,
  createMemberKeyImportToken: jest.fn(),
}));

const mockCreateMemberBundleRequest = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberProblemType>>>(),
);
jest.unstable_mockModule('../../awala.js', () => ({
  createMemberBundleRequest: mockCreateMemberBundleRequest,
}));

const { makeTestApiServer } = await import('../../testUtils/apiServer.js');

const { publicKey } = await generateKeyPair();
const publicKeyBuffer = await derSerialisePublicKey(publicKey);
const publicKeyBase64 = publicKeyBuffer.toString('base64');

describe('awala routes', () => {
  const getTestServerFixture = makeTestApiServer();
  let server: FastifyInstance;
  let logs: MockLogSet;
  beforeEach(() => {
    ({ server, logs } = getTestServerFixture());
  });

  test('Invalid content type should resolve to unsupported media type error', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/awala',

      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'content-type': 'INVALID_CONTENT_TYPE',
      },
    });
    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.UNSUPPORTED_MEDIA_TYPE);
  });

  test('Content type application/json should resolve to unsupported media type error', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/awala',

      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'content-type': 'application/json',
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
      const response = await server.inject({
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
        logger: server.log,
        dbConnection: server.mongoose,
      });
    });

    test('Malformed date should be refused', async () => {
      const methodPayload = {
        ...validPayload,
        memberBundleStartDate: 'INVALID_DATE',
      };

      const response = await server.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: methodPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          reason: expect.stringContaining('memberBundleStartDate'),
        }),
      );
    });

    test('Malformed Awala PDA should be refused', async () => {
      const methodPayload = {
        ...validPayload,
        awalaPda: 'INVALID_BASE_64',
      };

      const response = await server.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: methodPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          reason: expect.stringContaining('awalaPda'),
        }),
      );
    });

    test('Malformed signature should be refused', async () => {
      const methodPayload = {
        ...validPayload,
        signature: 'INVALID_BASE_64',
      };

      const response = await server.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: methodPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
          reason: expect.stringContaining('signature'),
        }),
      );
    });
  });

  describe('Process member key import request', () => {
    const validPayload = {
      publicKeyImportToken: MEMBER_KEY_IMPORT_TOKEN,
      publicKey: publicKeyBase64,
      awalaPda: AWALA_PDA,
    };
    const validHeaders = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'content-type': 'application/vnd.veraid.member-public-key-import',
    };

    test('Valid data should be accepted', async () => {
      mockProcessMemberKeyImportToken.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: validPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.ACCEPTED);
      expect(mockProcessMemberKeyImportToken).toHaveBeenCalledOnceWith(validPayload, {
        logger: server.log,
        dbConnection: server.mongoose,
      });
    });

    test('Malformed Awala PDA should be refused', async () => {
      const methodPayload = {
        ...validPayload,
        awalaPda: 'INVALID_BASE_64',
      };

      const response = await server.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: methodPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          reason: expect.stringContaining('awalaPda'),
        }),
      );
    });

    test('Missing public key import token should be refused', async () => {
      const methodPayload = {
        ...validPayload,
        publicKeyImportToken: undefined,
      };

      const response = await server.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: methodPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          reason: expect.stringContaining('publicKeyImportToken'),
        }),
      );
    });

    test.each([
      ['Invalid public key import token', MemberPublicKeyImportProblemType.TOKEN_NOT_FOUND],
      ['Malformed public key', MemberPublicKeyImportProblemType.KEY_CREATION_ERROR],
    ])('%s should be refused', async (_type: string, reason: MemberPublicKeyImportProblemType) => {
      mockProcessMemberKeyImportToken.mockResolvedValueOnce({
        didSucceed: false,
        reason,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/awala',
        headers: validHeaders,
        payload: validPayload,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(mockProcessMemberKeyImportToken).toHaveBeenCalledOnceWith(validPayload, {
        logger: server.log,
        dbConnection: server.mongoose,
      });
    });
  });
});
