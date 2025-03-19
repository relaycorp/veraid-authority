import { jwtVerify, createLocalJWKSet, type JWTPayload, type JSONWebKeySet } from 'jose';
import type { Connection } from 'mongoose';
import type { Logger } from 'pino';
import { fromUnixTime, setMilliseconds, subMinutes } from 'date-fns';

import type { Result } from '../../../utilities/result.js';

import { JwtVerificationProblem } from './JwtVerificationProblem.js';
import { fetchAndCacheJwks } from './jwksRetrieval.js';

const MAX_TOKEN_AGE_MINUTES = 60;

async function verifyJwtWithJwks(
  jwt: string,
  jwksKeySet: ReturnType<typeof createLocalJWKSet>,
  issuer: string,
  audience: string,
  logger: Logger,
): Promise<Result<JWTPayload, JwtVerificationProblem>> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(jwt, jwksKeySet, { issuer, audience }));
  } catch (error) {
    logger.info({ err: error }, 'JWT failed verification');

    const jwtError = error as { code?: string };
    const context =
      jwtError.code === 'ERR_JWT_EXPIRED'
        ? JwtVerificationProblem.EXPIRED_JWT
        : JwtVerificationProblem.INVALID_JWT;
    return {
      didSucceed: false,
      context,
    };
  }

  if (payload.iat !== undefined) {
    const now = setMilliseconds(new Date(), 0);
    const issuanceDate = fromUnixTime(payload.iat);
    if (issuanceDate < subMinutes(now, MAX_TOKEN_AGE_MINUTES)) {
      logger.info({ issuanceDate }, 'JWT was issued more than an hour ago');
      return {
        didSucceed: false,
        context: JwtVerificationProblem.EXPIRED_JWT,
      };
    }
  }

  return { didSucceed: true, result: payload };
}

export async function verifyJwt(
  jwt: string,
  issuerUrl: URL,
  audience: string,
  connection: Connection,
  logger: Logger,
): Promise<Result<JWTPayload, JwtVerificationProblem>> {
  let jwksDocument: JSONWebKeySet;
  try {
    jwksDocument = await fetchAndCacheJwks(issuerUrl, connection, logger);
  } catch (err) {
    logger.info({ err, issuerUrl }, 'Failed to retrieve JWKS document');
    return {
      didSucceed: false,
      context: JwtVerificationProblem.JWKS_RETRIEVAL_ERROR,
    };
  }

  const jwksKeySet = createLocalJWKSet(jwksDocument);
  return verifyJwtWithJwks(jwt, jwksKeySet, issuerUrl.toString(), audience, logger);
}
