import { jest } from '@jest/globals';
import { type JWTPayload, SignJWT, exportJWK, generateKeyPair } from 'jose';
import { setMilliseconds, subSeconds } from 'date-fns';
import type { Connection } from 'mongoose';

import { makeMockLogging, partialPinoLog } from '../../../testUtils/logging.js';
import { requireSuccessfulResult, requireFailureResult } from '../../../testUtils/result.js';
import { mockSpy } from '../../../testUtils/jest.js';
import { setUpTestDbConnection } from '../../../testUtils/db.js';

import { JwtVerificationProblem } from './JwtVerificationProblem.js';
import type { JwksDocumentSchema } from './jwksDocument.schema.js';

const mockFetchAndCacheJwks = mockSpy(jest.fn<() => Promise<JwksDocumentSchema>>());
jest.unstable_mockModule('./jwksRetrieval.js', () => ({
  fetchAndCacheJwks: mockFetchAndCacheJwks,
}));

const { verifyJwt } = await import('./jwtVerification.js');

const ISSUER = new URL('https://example.com/issuer');
const ISSUER_KEY_PAIR: CryptoKeyPair = await generateKeyPair('RS256');
const ISSUER_PUBLIC_KEY_JWK = await exportJWK(ISSUER_KEY_PAIR.publicKey);
const JWKS: JwksDocumentSchema = { keys: [ISSUER_PUBLIC_KEY_JWK as any] };
const AUDIENCE = 'urn:example:audience';
const PAYLOAD: JWTPayload = { foo: 'bar' };
const JWT = await new SignJWT(PAYLOAD)
  .setProtectedHeader({ alg: 'RS256' })
  .setIssuedAt()
  .setIssuer(ISSUER.toString())
  .setAudience(AUDIENCE)
  .setExpirationTime('5m')
  .sign(ISSUER_KEY_PAIR.privateKey);

describe('verifyJwt', () => {
  const mockLogging = makeMockLogging();

  const getConnection = setUpTestDbConnection();
  let connection: Connection;
  beforeEach(() => {
    connection = getConnection();
  });

  test('should retrieve JWKS document', async () => {
    mockFetchAndCacheJwks.mockResolvedValue(JWKS);

    const result = await verifyJwt(JWT, ISSUER, AUDIENCE, connection, mockLogging.logger);

    requireSuccessfulResult(result);
    expect(result.result).toMatchObject(PAYLOAD);
    expect(mockFetchAndCacheJwks).toHaveBeenCalledWith(ISSUER, connection, expect.anything());
  });

  test('should report failure to retrieve JKWS document', async () => {
    const err = new Error('Failed to retrieve JWKS');
    mockFetchAndCacheJwks.mockRejectedValue(err);

    const result = await verifyJwt(JWT, ISSUER, AUDIENCE, connection, mockLogging.logger);

    requireFailureResult(result);
    expect(result.context).toBe(JwtVerificationProblem.JWKS_RETRIEVAL_ERROR);
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'Failed to retrieve JWKS document', {
        issuerUrl: ISSUER,

        err: expect.objectContaining({
          message: err.message,
        }),
      }),
    );
  });

  test('should return payload if JWT validates against JWKS', async () => {
    mockFetchAndCacheJwks.mockResolvedValue(JWKS);

    const result = await verifyJwt(JWT, ISSUER, AUDIENCE, connection, mockLogging.logger);

    requireSuccessfulResult(result);
    expect(result.result).toMatchObject(PAYLOAD);
  });

  test('should fail if payload does not validate against JWKS', async () => {
    const differentKeyPair = await generateKeyPair('RS256');
    const differentPublicKeyJwk = await exportJWK(differentKeyPair.publicKey);
    mockFetchAndCacheJwks.mockResolvedValue({ keys: [differentPublicKeyJwk as any] });

    const result = await verifyJwt(JWT, ISSUER, AUDIENCE, connection, mockLogging.logger);

    requireFailureResult(result);
    expect(result.context).toBe(JwtVerificationProblem.INVALID_JWT);
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'JWT failed verification', {
        err: expect.objectContaining({
          code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
        }),
      }),
    );
  });

  test('should fail if issuer is different', async () => {
    mockFetchAndCacheJwks.mockResolvedValue(JWKS);
    const differentIssuer = new URL(`${ISSUER.toString()}-not`);

    const result = await verifyJwt(JWT, differentIssuer, AUDIENCE, connection, mockLogging.logger);

    requireFailureResult(result);
    expect(result.context).toBe(JwtVerificationProblem.INVALID_JWT);
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'JWT failed verification', {
        err: expect.objectContaining({
          claim: 'iss',
          code: 'ERR_JWT_CLAIM_VALIDATION_FAILED',
        }),
      }),
    );
  });

  test('should fail if audience is different', async () => {
    mockFetchAndCacheJwks.mockResolvedValue(JWKS);
    const differentAudience = `${AUDIENCE}-not`;

    const result = await verifyJwt(JWT, ISSUER, differentAudience, connection, mockLogging.logger);

    requireFailureResult(result);
    expect(result.context).toBe(JwtVerificationProblem.INVALID_JWT);
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'JWT failed verification', {
        err: expect.objectContaining({
          claim: 'aud',
          code: 'ERR_JWT_CLAIM_VALIDATION_FAILED',
        }),
      }),
    );
  });

  test('should fail if JWT is expired', async () => {
    mockFetchAndCacheJwks.mockResolvedValue(JWKS);
    const now = setMilliseconds(new Date(), 0);
    const expiredJwt = await new SignJWT(PAYLOAD)
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt(subSeconds(now, 2))
      .setIssuer(ISSUER.toString())
      .setAudience(AUDIENCE)
      .setExpirationTime(subSeconds(now, 1))
      .sign(ISSUER_KEY_PAIR.privateKey);

    const result = await verifyJwt(expiredJwt, ISSUER, AUDIENCE, connection, mockLogging.logger);

    requireFailureResult(result);
    expect(result.context).toBe(JwtVerificationProblem.INVALID_JWT);
    expect(mockLogging.logs).toContainEqual(
      partialPinoLog('info', 'JWT failed verification', {
        err: expect.objectContaining({
          claim: 'exp',
          code: 'ERR_JWT_EXPIRED',
        }),
      }),
    );
  });
});
