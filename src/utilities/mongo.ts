import envVar from 'env-var';
import { type Connection, createConnection } from 'mongoose';

export async function createMongooseConnectionFromEnv(): Promise<Connection> {
  const mongoUri = envVar.get('MONGODB_URI').required().asString();

  return createConnection(mongoUri).asPromise();
}
