import type { Connection } from 'mongoose';
import type { Logger } from 'pino';

export interface ServiceOptions {
  readonly dbConnection: Connection;
  readonly logger: Logger;
}
