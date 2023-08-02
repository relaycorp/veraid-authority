import envVar from 'env-var';
import { type Connection, createConnection } from 'mongoose';

const CONNECTION_TIMEOUT_MS = 3000;

export function createMongooseConnectionFromEnv(): Connection {
  const mongoUri = envVar.get('MONGODB_URI').required().asString();

  // eslint-disable-next-line @typescript-eslint/naming-convention
  return createConnection(mongoUri, { connectTimeoutMS: CONNECTION_TIMEOUT_MS });
}
