import env from 'env-var';
import { type Connection, createConnection } from 'mongoose';

export async function createConnectionFromEnvironment(): Promise<Connection> {
  const mongoUri = env.get('MONGO_URI').required().asString();
  const databaseName = env.get('MONGO_DB').required().asString();
  const user = env.get('MONGO_USER').required().asString();
  const pass = env.get('MONGO_PASSWORD').required().asString();
  const options = { dbName: databaseName, pass, user };
  return createConnection(mongoUri, options).asPromise();
}
