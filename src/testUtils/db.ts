/* eslint-disable require-atomic-updates */
import { createConnection, type Connection, type ConnectOptions } from 'mongoose';
import { deleteModelWithClass } from '@typegoose/typegoose';

import { OrgModelSchema } from '../models/Org.model.js';
import { MemberModelSchema } from '../models/Member.model.js';
import { MemberPublicKeyModelSchema } from '../models/MemberPublicKey.model.js';

const MODEL_SCHEMAS = Object.values([
  OrgModelSchema,
  MemberModelSchema,
  MemberPublicKeyModelSchema,
]).filter((schema) => typeof schema === 'function');

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,no-underscore-dangle
export const MONGODB_URI = (global as any).__MONGO_URI__ as string;

export function setUpTestDbConnection(): () => Connection {
  let connection: Connection;

  const connectionOptions: ConnectOptions = { bufferCommands: false };
  const connect = async () => createConnection(MONGODB_URI, connectionOptions).asPromise();

  beforeAll(async () => {
    connection = await connect();
  });

  beforeEach(async () => {
    if (connection.readyState === 0) {
      connection = await connect();
    }
  });

  afterEach(async () => {
    if (connection.readyState === 0) {
      // The test closed the connection, so we shouldn't just reconnect, but also purge TypeGoose'
      // model cache because every item there is bound to the old connection.
      MODEL_SCHEMAS.forEach(deleteModelWithClass);
      connection = await connect();
    }

    await Promise.all(
      Object.values(connection.collections).map(async (collection) => collection.deleteMany({})),
    );
  });

  afterAll(async () => {
    await connection.close(true);
  });

  return () => connection;
}
