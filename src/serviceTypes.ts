import type { Connection } from 'mongoose';
import type { BaseLogger } from 'pino';

export interface ServiceOptions {
  readonly dbConnection: Connection;
  readonly logger: BaseLogger;
}
