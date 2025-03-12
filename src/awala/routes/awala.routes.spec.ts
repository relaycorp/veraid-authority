import { jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { HTTP, CloudEvent } from 'cloudevents';
import { addDays, formatISO } from 'date-fns';

import { HTTP_STATUS_CODES } from '../../utilities/http.js';
import { mockSpy } from '../../testUtils/jest.js';
import type { Result } from '../../utilities/result.js';
import { type MockLogSet, partialPinoLog } from '../../testUtils/logging.js';
import { generateKeyPair } from '../../testUtils/webcrypto.js';
import { derSerialisePublicKey } from '../../utilities/webcrypto.js';
// eslint-disable-next-line max-len
import { MemberPublicKeyImportProblem } from '../../memberKeyImports/MemberKeyImportTokenProblem.js';
import type { MemberProblem } from '../../members/MemberProblem.js';
import {
  AWALA_PEER_ID,
  MEMBER_PUBLIC_KEY_MONGO_ID,
  MEMBER_KEY_IMPORT_TOKEN,
  SIGNATURE,
} from '../../testUtils/stubs.js';
import { CE_ID } from '../../testUtils/eventing/stubs.js';
import { INCOMING_SERVICE_MESSAGE_TYPE } from '../../events/incomingServiceMessage.event.js';
import { postEvent } from '../../testUtils/eventing/cloudEvents.js';
import type { MemberKeyImportRequest } from '../../schemas/awala.schema.js';

const mockProcessMemberKeyImportToken = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberPublicKeyImportProblem>>>(),
);
jest.unstable_mockModule('../../memberKeyImports/memberKeyImportToken.js', () => ({
  processMemberKeyImportToken: mockProcessMemberKeyImportToken,
  createMemberKeyImportToken: jest.fn(),
}));

const mockCreateMemberBundleRequest = mockSpy(
  jest.fn<() => Promise<Result<undefined, MemberProblem>>>(),
);

const mockGenerateMemberBundle = mockSpy(
  jest.fn<
    () => Promise<
      Result<
        ArrayBuffer,
        {
          shouldRetry: boolean;
        }
      >
    >
  >(),
);
jest.unstable_mockModule('../../memberKeys/memberBundle.js', () => ({
  createMemberBundleRequest: mockCreateMemberBundleRequest,
  generateMemberBundle: mockGenerateMemberBundle,
  CERTIFICATE_EXPIRY_DAYS: 90,
}));

const { setUpTestAwalaServer } = await import('../../testUtils/awalaServer.js');

const { publicKey } = await generateKeyPair();
const publicKeyBuffer = await derSerialisePublicKey(publicKey);
const publicKeyBase64 = publicKeyBuffer.toString('base64');

describe('Awala routes', () => {
  const getTestServerFixture = setUpTestAwalaServer();
  let server: FastifyInstance;
  let logs: MockLogSet;
  beforeEach(() => {
    ({ server, logs } = getTestServerFixture());
  });

  test('Invalid content type should resolve to unsupported media type error', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/',

      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'content-type': 'INVALID_CONTENT_TYPE',
      },
    });
    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
  });

  test('Content type application/json should resolve to unsupported media type error', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/',

      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'content-type': 'application/json',
      },
    });
    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
  });

  test('Missing headers should resolve into bad request', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/',
    });

    expect(response.statusCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
    expect(logs).toContainEqual(
      partialPinoLog('info', 'Refused invalid CloudEvent', {
        err: expect.objectContaining({ message: 'no cloud event detected' }),
      }),
    );
  });

  test('Invalid service message event should should be refused', async () => {
    const cloudEvent = new CloudEvent({
      id: CE_ID,
      source: AWALA_PEER_ID,
      type: 'invalid message type',
      subject: 'https://relaycorp.tech/awala-endpoint-internet',
      datacontenttype: 'application/vnd.veraid-authority.member-bundle-request',
    });

    const response = await postEvent(cloudEvent, server);

    expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
    expect(logs).toContainEqual(
      partialPinoLog('error', 'Refused invalid type', {
        parcelId: CE_ID,
      }),
    );
  });

  describe('Member bundle request', () => {
    const expiry = addDays(Date.now(), 5);
    const validMessageContent = {
      publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
      memberBundleStartDate: '2023-04-13T20:05:38.285Z',
      signature: SIGNATURE,
    };

    const cloudEvent = new CloudEvent({
      id: CE_ID,
      source: AWALA_PEER_ID,
      type: INCOMING_SERVICE_MESSAGE_TYPE,
      subject: 'https://relaycorp.tech/awala-endpoint-internet',
      datacontenttype: 'application/vnd.veraid-authority.member-bundle-request',
      expiry: formatISO(expiry),
      data: JSON.stringify(validMessageContent),
    });

    test('Valid data should be accepted', async () => {
      mockCreateMemberBundleRequest.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await postEvent(cloudEvent, server);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.ACCEPTED);
      expect(mockCreateMemberBundleRequest).toHaveBeenCalledOnceWith(
        { ...validMessageContent, peerId: AWALA_PEER_ID },
        {
          logger: expect.anything(),
          dbConnection: server.mongoose,
        },
      );
    });

    test('Malformed member bundle start date should be refused', async () => {
      const event = new CloudEvent({
        ...cloudEvent,

        data: JSON.stringify({
          ...validMessageContent,
          memberBundleStartDate: 'INVALID_DATE',
        }),
      });

      const response = await postEvent(event, server);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });

    test('Malformed content should be refused', async () => {
      const event = new CloudEvent({
        ...cloudEvent,
        data: 'MALFORMED_CONTENT',
      });

      const response = await postEvent(event, server);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(partialPinoLog('info', 'Refused invalid json format'));
    });

    test('Empty source should be refused', async () => {
      const message = HTTP.binary(cloudEvent);

      const response = await server.inject({
        method: 'POST',
        url: '/',

        headers: {
          ...message.headers,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'ce-source': '',
        },

        payload: message.body as string,
      });

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });

    test('Malformed signature should be refused', async () => {
      const event = new CloudEvent({
        ...cloudEvent,

        data: JSON.stringify({
          ...validMessageContent,
          signature: 'INVALID_BASE_64',
        }),
      });

      const response = await postEvent(event, server);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member bundle request', {
          publicKeyId: MEMBER_PUBLIC_KEY_MONGO_ID,
        }),
      );
    });
  });

  describe('Process member key import request', () => {
    const expiry = addDays(Date.now(), 5);
    const importRequest: MemberKeyImportRequest = {
      publicKeyImportToken: MEMBER_KEY_IMPORT_TOKEN,
      publicKey: publicKeyBase64,
    };

    const cloudEvent = new CloudEvent({
      id: CE_ID,
      source: AWALA_PEER_ID,
      type: INCOMING_SERVICE_MESSAGE_TYPE,
      subject: 'https://relaycorp.tech/awala-endpoint-internet',
      datacontenttype: 'application/vnd.veraid-authority.member-public-key-import',
      expiry: formatISO(expiry),
      data: JSON.stringify(importRequest),
    });

    test('Valid data should be accepted', async () => {
      mockProcessMemberKeyImportToken.mockResolvedValueOnce({
        didSucceed: true,
      });

      const response = await postEvent(cloudEvent, server);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.ACCEPTED);
      expect(mockProcessMemberKeyImportToken).toHaveBeenCalledOnceWith(
        AWALA_PEER_ID,
        importRequest,
        { logger: expect.anything(), dbConnection: server.mongoose },
      );
    });

    test('Malformed content should be refused', async () => {
      const event = new CloudEvent({
        ...cloudEvent,
        data: 'MALFORMED_CONTENT',
      });

      const response = await postEvent(event, server);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(partialPinoLog('info', 'Refused invalid json format'));
    });

    test('Missing public key import token should be refused', async () => {
      const event = new CloudEvent({
        ...cloudEvent,

        data: JSON.stringify({
          ...importRequest,
          publicKeyImportToken: undefined,
        }),
      });

      const response = await postEvent(event, server);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(logs).toContainEqual(
        partialPinoLog('info', 'Refused invalid member key import request'),
      );
    });

    test.each([
      ['Invalid public key import token', MemberPublicKeyImportProblem.NOT_FOUND],
      ['Malformed public key', MemberPublicKeyImportProblem.KEY_CREATION_ERROR],
    ])('%s should be refused', async (_type: string, reason: MemberPublicKeyImportProblem) => {
      mockProcessMemberKeyImportToken.mockResolvedValueOnce({
        didSucceed: false,
        context: reason,
      });

      const response = await postEvent(cloudEvent, server);

      expect(response).toHaveProperty('statusCode', HTTP_STATUS_CODES.BAD_REQUEST);
      expect(mockProcessMemberKeyImportToken).toHaveBeenCalledOnceWith(
        AWALA_PEER_ID,
        importRequest,
        { logger: expect.anything(), dbConnection: server.mongoose },
      );
    });
  });
});
