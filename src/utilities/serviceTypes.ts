import type { Connection } from 'mongoose';

import type { Logger } from './logging.js';

export interface ServiceOptions {
  readonly dbConnection: Connection;
  readonly logger: Logger;
}

export const MONGODB_DUPLICATE_INDEX_CODE = 11_000;
