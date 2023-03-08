import { get as getEnvVar } from 'env-var';
import { type Connection, createConnection } from 'mongoose';

export async function createMongooseConnectionFromEnv(): Promise<Connection> {
  const mongoUri = getEnvVar('MONGODB_URI').required().asString();

  return createConnection(mongoUri).asPromise();
}
