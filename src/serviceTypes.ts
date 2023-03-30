import type { Connection } from 'mongoose';
import type { BaseLogger } from 'pino';

export interface ServiceOptions {
  readonly dbConnection: Connection;
  readonly logger: BaseLogger;
}

export const MONGODB_DUPLICATE_INDEX_CODE = 11_000;
