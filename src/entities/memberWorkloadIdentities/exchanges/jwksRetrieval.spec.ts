import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { jest } from '@jest/globals';
import { addMinutes } from 'date-fns';

import { mockSpy } from '../../../testUtils/jest.js';
import { setUpTestDbConnection } from '../../../testUtils/db.js';

import { fetchAndCacheJwks } from './jwksRetrieval.js';
import { CachedJwks } from './CachedJwks.model.js';

const ISSUER_URL = 'https://example.com/issuer';
const JWKS_URL = 'https://example.com/issuer/.well-known/jwks.json';
const JWKS_DOC = { keys: [{ kid: 'key1' }] };
const DISCOVERY_URL = 'https://example.com/issuer/.well-known/openid-configuration';
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

    const result = await fetchAndCacheJwks(ISSUER_URL, connection);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toMatchObject(JWKS_DOC);
  });

  describe('Discovery endpoint retrieval', () => {
    test('should retrieve provider discovery document', async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      const result = await fetchAndCacheJwks(ISSUER_URL, connection);

      expect(mockFetch).toHaveBeenNthCalledWith(1, DISCOVERY_URL, expect.anything());
      expect(result).toMatchObject(JWKS_DOC);
    });

    test('should time out after 5 seconds', async () => {
      const stubDiscoveryTimeout = Symbol('stubDiscoveryTimeout');
      mockAbortSignalTimeout.mockReturnValueOnce(stubDiscoveryTimeout as unknown as AbortSignal);
      mockAbortSignalTimeout.mockReturnValueOnce(Symbol('jwksTimeout') as unknown as AbortSignal);
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      await fetchAndCacheJwks(ISSUER_URL, connection);

      expect(mockFetch).toHaveBeenCalledWith(
        DISCOVERY_URL,
        expect.objectContaining({
          signal: stubDiscoveryTimeout,
        }),
      );
      expect(mockAbortSignalTimeout).toHaveBeenNthCalledWith(1, 5000);
    });

    test('should error out if discovery document results in 4XX-5XX error', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse('Not Found', { status: 404 }));

      await expect(fetchAndCacheJwks(ISSUER_URL, connection)).rejects.toThrow(
        /Failed to retrieve discovery document/u,
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

      await expect(fetchAndCacheJwks(ISSUER_URL, connection)).rejects.toThrow(
        /Malformed discovery document/u,
      );
    });

    test('should error out if discovery document is invalid', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse([]));

      await expect(fetchAndCacheJwks(ISSUER_URL, connection)).rejects.toThrow(
        /Invalid discovery document/u,
      );
    });
  });

  describe('JWKS retrieval', () => {
    test('should retrieve JWKS from the discovery document', async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      const result = await fetchAndCacheJwks(ISSUER_URL, connection);

      expect(mockFetch).toHaveBeenNthCalledWith(2, JWKS_URL, expect.anything());
      expect(result).toMatchObject(JWKS_DOC);
    });

    test('should time out after 5 seconds', async () => {
      mockAbortSignalTimeout.mockReturnValueOnce(Symbol('discovery') as unknown as AbortSignal);
      const stubJwksTimeout = Symbol('stubDiscoveryTimeout');
      mockAbortSignalTimeout.mockReturnValueOnce(stubJwksTimeout as unknown as AbortSignal);
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      await fetchAndCacheJwks(ISSUER_URL, connection);

      expect(mockFetch).toHaveBeenCalledWith(
        JWKS_URL,
        expect.objectContaining({
          signal: stubJwksTimeout,
        }),
      );
      expect(mockAbortSignalTimeout).toHaveBeenNthCalledWith(2, 5000);
    });

    test('should error out if JWKS results in 4XX-5XX error', async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse('Not Found', { status: 404 }));

      await expect(fetchAndCacheJwks(ISSUER_URL, connection)).rejects.toThrow(
        /Failed to retrieve JWKS/u,
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

      await expect(fetchAndCacheJwks(ISSUER_URL, connection)).rejects.toThrow(/Malformed JWKS/u);
    });

    test('should error out if JWKS document format is invalid', async () => {
      const invalidJwksDoc = { foo: 'bar' };
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(invalidJwksDoc));

      await expect(fetchAndCacheJwks(ISSUER_URL, connection)).rejects.toThrow(
        /Invalid JWKS document format/u,
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

      const result = await fetchAndCacheJwks(ISSUER_URL, connection);

      expect(result).toMatchObject(JWKS_DOC);
      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).toBeNull();
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

      const result = await fetchAndCacheJwks(ISSUER_URL, connection);

      expect(result).toMatchObject(JWKS_DOC);
      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).toBeNull();
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

      const result = await fetchAndCacheJwks(ISSUER_URL, connection);

      expect(result).toMatchObject(JWKS_DOC);
      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).toBeNull();
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

      const result = await fetchAndCacheJwks(ISSUER_URL, connection);

      expect(result).toMatchObject(JWKS_DOC);
      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).toBeNull();
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

      await fetchAndCacheJwks(ISSUER_URL, connection);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      expect(cachedJwks?.issuerUrl).toBe(ISSUER_URL);
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

      await fetchAndCacheJwks(ISSUER_URL, connection);

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

      await fetchAndCacheJwks(ISSUER_URL, connection);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      const expectedMinExpiry = new Date(startTime + discoveryMaxAge * 1000);
      const expectedMaxExpiry = new Date(Date.now() + discoveryMaxAge * 1000);
      expect(cachedJwks!.expiry).toBeBetween(expectedMinExpiry, expectedMaxExpiry);
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

      await fetchAndCacheJwks(ISSUER_URL, connection);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      const expectedMinExpiry = new Date(startTime + jwksMaxAge * 1000);
      const expectedMaxExpiry = new Date(Date.now() + jwksMaxAge * 1000);
      expect(cachedJwks!.expiry).toBeBetween(expectedMinExpiry, expectedMaxExpiry);
    });

    test('should cache document for 5 minutes if Cache-Control is missing', async () => {
      const startTime = Date.now();
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse(DISCOVERY_DOC))
        .mockResolvedValueOnce(makeJsonResponse(JWKS_DOC));

      await fetchAndCacheJwks(ISSUER_URL, connection);

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

      await fetchAndCacheJwks(ISSUER_URL, connection);

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

      await fetchAndCacheJwks(ISSUER_URL, connection);

      const cachedJwks = await cachedJwksModel.findOne({ issuerUrl: ISSUER_URL });
      expect(cachedJwks).not.toBeNull();
      const expectedMinExpiry = new Date(startTime + DEFAULT_MAX_AGE_SECONDS * 1000);
      const expectedMaxExpiry = new Date(Date.now() + DEFAULT_MAX_AGE_SECONDS * 1000);
      expect(cachedJwks!.expiry).toBeBetween(expectedMinExpiry, expectedMaxExpiry);
    });
  });
});
