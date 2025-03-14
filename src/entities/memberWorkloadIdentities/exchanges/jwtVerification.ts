import { jwtVerify, createLocalJWKSet, type JWTPayload, type JSONWebKeySet } from 'jose';
import type { Connection } from 'mongoose';
import type { Logger } from 'pino';

import type { Result } from '../../../utilities/result.js';

import { JwtVerificationProblem } from './JwtVerificationProblem.js';
import { fetchAndCacheJwks } from './jwksRetrieval.js';

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

  try {
    const { payload } = await jwtVerify(jwt, jwksKeySet, {
      issuer: issuerUrl.toString(),
      audience,
    });

    return { didSucceed: true, result: payload };
  } catch (error) {
    logger.info({ err: error }, 'JWT failed verification');
    return {
      didSucceed: false,
      context: JwtVerificationProblem.INVALID_JWT,
    };
  }
}
