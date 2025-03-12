import type { FastifyBaseLogger } from 'fastify';
import type { Connection } from 'mongoose';

export interface ServiceOptions {
  readonly dbConnection: Connection;
  readonly logger: FastifyBaseLogger;
}

export const MONGODB_DUPLICATE_INDEX_CODE = 11_000;
