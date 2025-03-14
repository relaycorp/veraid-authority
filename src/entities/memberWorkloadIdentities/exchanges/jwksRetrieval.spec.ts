import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { jest } from '@jest/globals';
import { addMinutes } from 'date-fns';

import { mockSpy } from '../../../testUtils/jest.js';
import { setUpTestDbConnection } from '../../../testUtils/db.js';
import { makeMockLogging, partialPinoLog } from '../../../testUtils/logging.js';

import { fetchAndCacheJwks } from './jwksRetrieval.js';
import { CachedJwks } from './CachedJwks.model.js';

const ISSUER_URL = new URL('https://example.com/issuer');
const JWKS_URL = `${ISSUER_URL.toString()}/.well-known/jwks.json`;
const JWKS_DOC = { keys: [{ kid: 'key1' }] };
const DISCOVERY_URL = `${ISSUER_URL.toString()}/.well-known/openid-configuration`;
// eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
const DISCOVERY_DOC = { jwks_uri: JWKS_URL };
const DEFAULT_MAX_AGE_SECONDS = 300;

const mockFetch = mockSpy(jest.spyOn(global, 'fetch'));

const mockAbortSignalTimeout = mockSpy(jest.spyOn(AbortSignal, 'timeout'));
const mockTimeoutSignal = Symbol('mockTimeoutSignal');
beforeEach(() => {
  mockAbortSignalTimeout.mockReturnValue(mockTimeoutSignal as unknown as AbortSignal);
});

function makeJsonResponse(
  body: unknown,
  {
    status = 200,
    additionalHeaders = {},
  }: { status?: number; additionalHeaders?: { [key: string]: string } } = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    headers: { 'Content-Type': 'application/json', ...additionalHeaders },
  });
}

describe('fetchAndCacheJwks', () => {
  const getConnection = setUpTestDbConnection();
  const mockLogging = makeMockLogging();

  let connection: Connection;
  let cachedJwksModel: ReturnModelType<typeof CachedJwks>;

  beforeEach(() => {
    connection = getConnection();
    cachedJwksModel = getModelForClass(CachedJwks, { existingConnection: connection });
  });

  test('should return cache if found', async () => {
    const expiry = addMinutes(new Date(), 1);
    await cachedJwksModel.create({
      issuerUrl: ISSUER_URL,
      document: JWKS_DOC,
      expiry,
    });

    const result = await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toMatchObject(JWKS_DOC);
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('debug', 'JWKS cache hit', {
        issuerUrl: ISSUER_URL,
      }),
    );
  });

  describe('Discovery endpoint retrieval', () => {
    test('should retrieve provider discovery document', async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      const result = await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      expect(mockFetch).toHaveBeenNthCalledWith(1, DISCOVERY_URL, expect.anything());
      expect(result).toMatchObject(JWKS_DOC);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('debug', 'JWKS cache missed', {
          issuerUrl: ISSUER_URL,
        }),
      );
    });

    test('should time out after 5 seconds', async () => {
      const stubDiscoveryTimeout = Symbol('stubDiscoveryTimeout');
      mockAbortSignalTimeout.mockReturnValueOnce(stubDiscoveryTimeout as unknown as AbortSignal);
      mockAbortSignalTimeout.mockReturnValueOnce(Symbol('jwksTimeout') as unknown as AbortSignal);
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      expect(mockFetch).toHaveBeenCalledWith(
        DISCOVERY_URL,
        expect.objectContaining({
          signal: stubDiscoveryTimeout,
        }),
      );
      expect(mockAbortSignalTimeout).toHaveBeenNthCalledWith(1, 5000);
    });

    test('should log connection errors', async () => {
      const error = new Error('Network error');
      mockFetch.mockRejectedValueOnce(error);

      await expect(fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger)).rejects.toThrow(
        error,
      );

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Discovery document retrieval failed', {
          issuerUrl: ISSUER_URL,

          err: expect.objectContaining({
            message: error.message,
          }),
        }),
      );
    });

    test('should error out if discovery document results in 4XX-5XX error', async () => {
      const httpStatus = 404;
      mockFetch.mockResolvedValueOnce(makeJsonResponse('Not Found', { status: httpStatus }));

      await expect(fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger)).rejects.toThrow(
        /Failed to retrieve discovery document/u,
      );

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Discovery document retrieval failed', {
          issuerUrl: ISSUER_URL,
          httpStatus,
        }),
      );
    });

    test('should error out if discovery document is malformed', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('not valid json', {
          status: 200,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger)).rejects.toThrow(
        /Malformed discovery document/u,
      );

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Got malformed discovery document', {
          issuerUrl: ISSUER_URL,

          err: expect.objectContaining({
            message: expect.stringMatching(/is not valid JSON/u),
          }),
        }),
      );
    });

    test('should error out if discovery document is invalid', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse([]));

      await expect(fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger)).rejects.toThrow(
        /Invalid discovery document/u,
      );

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Got invalid discovery document', {
          issuerUrl: ISSUER_URL,
        }),
      );
    });
  });

  describe('JWKS retrieval', () => {
    test('should retrieve JWKS from the discovery document', async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      const result = await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      expect(mockFetch).toHaveBeenNthCalledWith(2, JWKS_URL, expect.anything());
      expect(result).toMatchObject(JWKS_DOC);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('debug', 'Retrieved JWKS document', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,
        }),
      );
    });

    test('should time out after 5 seconds', async () => {
      mockAbortSignalTimeout.mockReturnValueOnce(Symbol('discovery') as unknown as AbortSignal);
      const stubJwksTimeout = Symbol('stubDiscoveryTimeout');
      mockAbortSignalTimeout.mockReturnValueOnce(stubJwksTimeout as unknown as AbortSignal);
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      expect(mockFetch).toHaveBeenCalledWith(
        JWKS_URL,
        expect.objectContaining({
          signal: stubJwksTimeout,
        }),
      );
      expect(mockAbortSignalTimeout).toHaveBeenNthCalledWith(2, 5000);
    });

    test('should log connection errors', async () => {
      const error = new Error('Network error');
      mockFetch.mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC)).mockRejectedValueOnce(error);

      await expect(fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger)).rejects.toThrow(
        error,
      );

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'JWKS document retrieval failed', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,

          err: expect.objectContaining({
            message: error.message,
          }),
        }),
      );
    });

    test('should error out if JWKS results in 4XX-5XX error', async () => {
      const httpStatus = 404;
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse('Not Found', { status: httpStatus }));

      await expect(fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger)).rejects.toThrow(
        /Failed to retrieve JWKS/u,
      );

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'JWKS document retrieval failed', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,
          httpStatus,
        }),
      );
    });

    test('should error out if JWKS is malformed', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC)).mockResolvedValueOnce(
        new Response('not valid json', {
          status: 200,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger)).rejects.toThrow(
        /Malformed JWKS/u,
      );

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Got malformed JWKS document', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,

          err: expect.objectContaining({
            message: expect.stringMatching(/is not valid JSON/u),
          }),
        }),
      );
    });

    test('should error out if JWKS document format is invalid', async () => {
      const invalidJwksDoc = { foo: 'bar' };
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(invalidJwksDoc));

      await expect(fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger)).rejects.toThrow(
        /Invalid JWKS document format/u,
      );

      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Got invalid JWKS document', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,
        }),
      );
    });
  });

  describe('Caching', () => {
    test('should return but not cache if discovery had no-store in Cache-Control', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'no-store',
            },
          }),
        )
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      const result = await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      expect(result).toMatchObject(JWKS_DOC);
      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('debug', 'Cache-Control prevented caching of JWKS document', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,
        }),
      );
    });

    test('should return but not cache if discovery had max-age=0 in Cache-Control', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=0',
            },
          }),
        )
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      const result = await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      expect(result).toMatchObject(JWKS_DOC);
      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('debug', 'Cache-Control prevented caching of JWKS document', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,
        }),
      );
    });

    test('should return but not cache if it had no-store in Cache-Control', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=3600',
            },
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(JWKS_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'no-store',
            },
          }),
        );

      const result = await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      expect(result).toMatchObject(JWKS_DOC);
      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('debug', 'Cache-Control prevented caching of JWKS document', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,
        }),
      );
    });

    test('should return but not cache if it had max-age=0 in Cache-Control', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=3600',
            },
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(JWKS_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=0',
            },
          }),
        );

      const result = await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      expect(result).toMatchObject(JWKS_DOC);
      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).toBeNull();
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('debug', 'Cache-Control prevented caching of JWKS document', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,
        }),
      );
    });

    test('should set issuerUrl to that of issuer if caching is allowed', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=3600',
            },
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(JWKS_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=3600',
            },
          }),
        );

      await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      expect(cachedJwks?.issuerUrl).toMatchObject(ISSUER_URL);
    });

    test('should set document to JWKS if caching is allowed', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=3600',
            },
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(JWKS_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=3600',
            },
          }),
        );

      await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      expect(cachedJwks?.document).toMatchObject(JWKS_DOC);
    });

    test('should calculate expiry from max-age of discovery response if lower', async () => {
      const discoveryMaxAge = 1800; // 30 minutes
      const jwksMaxAge = 3600; // 1 hour
      const startTime = Date.now();
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': `max-age=${discoveryMaxAge}`,
            },
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(JWKS_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': `max-age=${jwksMaxAge}`,
            },
          }),
        );

      await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      const expectedMinExpiry = new Date(startTime + discoveryMaxAge * 1000);
      const expectedMaxExpiry = new Date(Date.now() + discoveryMaxAge * 1000);
      expect(cachedJwks!.expiry).toBeBetween(expectedMinExpiry, expectedMaxExpiry);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('debug', 'Cached JWKS document', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,
          maxAgeSeconds: discoveryMaxAge,
          discoveryMaxAge,
          jwksMaxAge,
        }),
      );
    });

    test('should calculate expiry from max-age of JWKS response if lower', async () => {
      const discoveryMaxAge = 20;
      const jwksMaxAge = 10;
      const startTime = Date.now();
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': `max-age=${discoveryMaxAge}`,
            },
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(JWKS_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': `max-age=${jwksMaxAge}`,
            },
          }),
        );

      await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      const expectedMinExpiry = new Date(startTime + jwksMaxAge * 1000);
      const expectedMaxExpiry = new Date(Date.now() + jwksMaxAge * 1000);
      expect(cachedJwks!.expiry).toBeBetween(expectedMinExpiry, expectedMaxExpiry);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('debug', 'Cached JWKS document', {
          issuerUrl: ISSUER_URL,
          jwksUri: JWKS_URL,
          maxAgeSeconds: jwksMaxAge,
          discoveryMaxAge,
          jwksMaxAge,
        }),
      );
    });

    test('should cache document for 5 minutes if Cache-Control is missing', async () => {
      const startTime = Date.now();
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      const expectedMinExpiry = new Date(startTime + DEFAULT_MAX_AGE_SECONDS * 1000);
      const expectedMaxExpiry = new Date(Date.now() + DEFAULT_MAX_AGE_SECONDS * 1000);
      expect(cachedJwks!.expiry).toBeBetween(expectedMinExpiry, expectedMaxExpiry);
    });

    test('should cache document for 5 minutes if Cache-Control allows undefined TTL', async () => {
      const startTime = Date.now();
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'private',
            },
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(JWKS_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'public',
            },
          }),
        );

      await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      const expectedMinExpiry = new Date(startTime + DEFAULT_MAX_AGE_SECONDS * 1000);
      const expectedMaxExpiry = new Date(Date.now() + DEFAULT_MAX_AGE_SECONDS * 1000);
      expect(cachedJwks!.expiry).toBeBetween(expectedMinExpiry, expectedMaxExpiry);
    });

    test('should cache document for 5 minutes if max-age is invalid', async () => {
      const startTime = Date.now();
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse(DISCOVERY_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=invalid',
            },
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(JWKS_DOC, {
            additionalHeaders: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Cache-Control': 'max-age=invalid',
            },
          }),
        );

      await fetchAndCacheJwks(ISSUER_URL, connection, mockLogging.logger);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      const expectedMinExpiry = new Date(startTime + DEFAULT_MAX_AGE_SECONDS * 1000);
      const expectedMaxExpiry = new Date(Date.now() + DEFAULT_MAX_AGE_SECONDS * 1000);
      expect(cachedJwks!.expiry).toBeBetween(expectedMinExpiry, expectedMaxExpiry);
      expect(mockLogging.logs).toContainEqual(
        partialPinoLog('info', 'Malformed Cache-Control maxAge', {
          issuerUrl: ISSUER_URL,
          cacheControlMaxAge: 'invalid',
        }),
      );
    });
  });
});
