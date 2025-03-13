import { getModelForClass, type ReturnModelType } from '@typegoose/typegoose';
import { addSeconds } from 'date-fns';
import type { Connection } from 'mongoose';

import { CachedJwks } from './CachedJwks.model.js';
import { validateDiscoveryDocument } from './discoveryDocument.schema.js';
import { type JwksDocumentSchema, validateJwksDocument } from './jwksDocument.schema.js';

const REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_SECONDS = 300;

function getCacheTtlFromResponse(response: Response): number {
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
      return Number.isNaN(parsedMaxAge) ? DEFAULT_CACHE_TTL_SECONDS : parsedMaxAge;
    }
  }

  return DEFAULT_CACHE_TTL_SECONDS;
}

async function fetchDiscoveryDocument(
  issuerUrl: string,
): Promise<{ jwksUri: string; discoveryResponse: Response }> {
  const discoveryUrl = `${issuerUrl}/.well-known/openid-configuration`;
  const discoveryResponse = await fetch(discoveryUrl, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!discoveryResponse.ok) {
    throw new Error(`Failed to retrieve discovery document: ${discoveryResponse.status}`);
  }

  let discoveryDocument;
  try {
    discoveryDocument = await discoveryResponse.json();
  } catch {
    throw new Error('Malformed discovery document');
  }

  if (!validateDiscoveryDocument(discoveryDocument)) {
    throw new Error('Invalid discovery document: missing or invalid jwksUri');
  }

  return {
    jwksUri: discoveryDocument.jwks_uri,
    discoveryResponse,
  };
}

async function fetchJwksDocument(
  jwksUri: string,
): Promise<{ jwksDocument: JwksDocumentSchema; jwksResponse: Response }> {
  const jwksResponse = await fetch(jwksUri, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!jwksResponse.ok) {
    throw new Error(`Failed to retrieve JWKS: ${jwksResponse.status}`);
  }

  let jwksDocument;
  try {
    jwksDocument = await jwksResponse.json();
  } catch {
    throw new Error('Malformed JWKS');
  }

  if (!validateJwksDocument(jwksDocument)) {
    throw new Error('Invalid JWKS document format');
  }

  return { jwksDocument, jwksResponse };
}

async function cacheJwksIfAllowed(
  jwksDocument: JwksDocumentSchema,
  issuerUrl: string,
  discoveryResponse: Response,
  jwksResponse: Response,
  cachedJwksModel: ReturnModelType<typeof CachedJwks>,
): Promise<void> {
  const discoveryMaxAge = getCacheTtlFromResponse(discoveryResponse);
  const jwksMaxAge = getCacheTtlFromResponse(jwksResponse);
  const maxAgeSeconds = Math.min(discoveryMaxAge, jwksMaxAge);

  if (maxAgeSeconds > 0) {
    const expiry = addSeconds(new Date(), maxAgeSeconds);
    await cachedJwksModel.findOneAndUpdate(
      { issuerUrl },
      { issuerUrl, document: jwksDocument, expiry },
      { upsert: true },
    );
  }
}

export async function fetchAndCacheJwks(
  issuerUrl: string,
  connection: Connection,
): Promise<JwksDocumentSchema> {
  const cachedJwksModel = getModelForClass(CachedJwks, { existingConnection: connection });
  const cachedJwks = await cachedJwksModel.findOne({ issuerUrl });
  if (cachedJwks) {
    return cachedJwks.document;
  }

  const { jwksUri, discoveryResponse } = await fetchDiscoveryDocument(issuerUrl);
  const { jwksDocument, jwksResponse } = await fetchJwksDocument(jwksUri);

  await cacheJwksIfAllowed(
    jwksDocument,
    issuerUrl,
    discoveryResponse,
    jwksResponse,
    cachedJwksModel,
  );

  return jwksDocument;
}
