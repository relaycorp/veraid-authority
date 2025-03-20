import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import { addSeconds, secondsInDay } from 'date-fns';
import type { Connection } from 'mongoose';

import type { Logger } from '../utilities/logging.js';

import { CachedJwks } from './CachedJwks.model.js';
import { validateDiscoveryDocument } from './discoveryDocument.schema.js';
import { type JwksDocumentSchema, validateJwksDocument } from './jwksDocument.schema.js';

const REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_SECONDS = 300;
const MAX_CACHE_TTL_DAYS = 7;
const MAX_CACHE_TTL_SECONDS = MAX_CACHE_TTL_DAYS * secondsInDay;

const DISCOVERY_ENDPOINT_PATH = '/.well-known/openid-configuration';

function getCacheTtlFromResponse(response: Response, logger: Logger): number {
  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl === null || cacheControl === '') {
    return DEFAULT_CACHE_TTL_SECONDS;
  }

  const directives = cacheControl.split(',').map((directive) => directive.trim());

  if (directives.includes('no-store')) {
    return 0;
  }

  const maxAgeDirective = directives.find((directive) => directive.startsWith('max-age='));
  if (maxAgeDirective !== undefined) {
    const [, maxAgeValue] = maxAgeDirective.split('=');
    if (maxAgeValue && maxAgeValue.length !== 0) {
      const parsedMaxAge = Number.parseInt(maxAgeValue, 10);
      if (Number.isNaN(parsedMaxAge)) {
        logger.info({ cacheControlMaxAge: maxAgeValue }, 'Malformed Cache-Control maxAge');
        return DEFAULT_CACHE_TTL_SECONDS;
      }
      return Math.min(parsedMaxAge, MAX_CACHE_TTL_SECONDS);
    }
  }

  return DEFAULT_CACHE_TTL_SECONDS;
}

function sanitiseJwksUri(jwksUri: string, logger: Logger): URL {
  try {
    return new URL(jwksUri);
  } catch (err) {
    logger.info({ jwksUri, err }, 'Malformed JWKS URI');
    throw new Error('Malformed JWKS URI');
  }
}

async function fetchDiscoveryDocument(
  issuerUrl: URL,
  logger: Logger,
): Promise<{ jwksUri: URL; discoveryResponse: Response }> {
  const discoveryUrl = new URL(`${issuerUrl.toString()}${DISCOVERY_ENDPOINT_PATH}`);
  let discoveryResponse;
  try {
    discoveryResponse = await fetch(discoveryUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.info({ err }, 'Discovery document retrieval failed');
    throw err as Error;
  }

  if (!discoveryResponse.ok) {
    logger.info({ httpStatus: discoveryResponse.status }, 'Discovery document retrieval failed');
    throw new Error(`Failed to retrieve discovery document: ${discoveryResponse.status}`);
  }

  let discoveryDocument;
  try {
    discoveryDocument = await discoveryResponse.json();
  } catch (err) {
    logger.info({ err }, 'Got malformed discovery document');
    throw new Error('Malformed discovery document');
  }

  if (!validateDiscoveryDocument(discoveryDocument)) {
    logger.info('Got invalid discovery document');
    throw new Error('Invalid discovery document: missing or invalid jwksUri');
  }

  const jwksUri = sanitiseJwksUri(discoveryDocument.jwks_uri, logger);

  return {
    jwksUri,
    discoveryResponse,
  };
}

async function fetchJwksDocument(
  jwksUri: URL,
  logger: Logger,
): Promise<{ jwksDocument: JwksDocumentSchema; jwksResponse: Response }> {
  let jwksResponse;
  try {
    jwksResponse = await fetch(jwksUri, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.info({ err }, 'JWKS document retrieval failed');
    throw err as Error;
  }

  if (!jwksResponse.ok) {
    logger.info({ httpStatus: jwksResponse.status }, 'JWKS document retrieval failed');
    throw new Error(`Failed to retrieve JWKS: ${jwksResponse.status}`);
  }

  let jwksDocument;
  try {
    jwksDocument = await jwksResponse.json();
  } catch (err) {
    logger.info({ err }, 'Got malformed JWKS document');
    throw new Error('Malformed JWKS');
  }

  if (!validateJwksDocument(jwksDocument)) {
    logger.info('Got invalid JWKS document');
    throw new Error('Invalid JWKS document format');
  }

  logger.debug('Retrieved JWKS document');
  return { jwksDocument, jwksResponse };
}

async function cacheJwksIfAllowed(
  jwksDocument: JwksDocumentSchema,
  issuerUrl: URL,
  discoveryResponse: Response,
  jwksResponse: Response,
  cachedJwksModel: ReturnModelType<typeof CachedJwks>,
  logger: Logger,
): Promise<void> {
  const discoveryMaxAge = getCacheTtlFromResponse(discoveryResponse, logger);
  const jwksMaxAge = getCacheTtlFromResponse(jwksResponse, logger);
  const maxAgeSeconds = Math.min(discoveryMaxAge, jwksMaxAge, MAX_CACHE_TTL_SECONDS);

  if (maxAgeSeconds > 0) {
    const expiry = addSeconds(new Date(), maxAgeSeconds);
    await cachedJwksModel.findOneAndUpdate(
      { issuerUrl },
      { issuerUrl, document: jwksDocument, expiry },
      { upsert: true },
    );
    logger.debug(
      {
        maxAgeSeconds,
        discoveryMaxAge,
        jwksMaxAge,
      },
      'Cached JWKS document',
    );
  } else {
    logger.debug('Cache-Control prevented caching of JWKS document');
  }
}

export async function fetchAndCacheJwks(
  issuerUrl: URL,
  connection: Connection,
  logger: Logger,
): Promise<JwksDocumentSchema> {
  const issuerAwareLogger = logger.child({ issuerUrl });

  const cachedJwksModel = getModelForClass(CachedJwks, { existingConnection: connection });
  const cachedJwks = await cachedJwksModel.findOne({ issuerUrl });
  if (cachedJwks) {
    issuerAwareLogger.debug('JWKS cache hit');
    return cachedJwks.document;
  }

  issuerAwareLogger.debug('JWKS cache missed');

  const { jwksUri, discoveryResponse } = await fetchDiscoveryDocument(issuerUrl, issuerAwareLogger);

  const jwksAwareLogger = issuerAwareLogger.child({ jwksUri });
  const { jwksDocument, jwksResponse } = await fetchJwksDocument(jwksUri, jwksAwareLogger);

  await cacheJwksIfAllowed(
    jwksDocument,
    issuerUrl,
    discoveryResponse,
    jwksResponse,
    cachedJwksModel,
    jwksAwareLogger,
  );

  return jwksDocument;
}
