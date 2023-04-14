import envVar from 'env-var';
import { type Connection, createConnection } from 'mongoose';

export function createMongooseConnectionFromEnv(): Connection {
  const mongoUri = envVar.get('MONGODB_URI').required().asString();

  return createConnection(mongoUri);
}
