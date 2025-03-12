/* eslint-disable require-atomic-updates */

import { randomUUID } from 'node:crypto';

import { createConnection, type Connection, type ConnectOptions, STATES } from 'mongoose';
import { deleteModelWithClass } from '@typegoose/typegoose';

import { Org } from '../organisations/Org.model.js';
import { Member } from '../members/Member.model.js';
import { MemberPublicKey } from '../memberKeys/MemberPublicKey.model.js';
import { MemberKeyImportToken } from '../memberKeyImports/MemberKeyImportToken.model.js';
import { MemberBundleRequestModel } from '../memberKeys/MemberBundleRequest.model.js';

const MODEL_SCHEMAS = Object.values([
  Org,
  Member,
  MemberPublicKey,
  MemberBundleRequestModel,
  MemberKeyImportToken,
]).filter((schema) => typeof schema === 'function');

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,no-underscore-dangle
const BASE_MONGO_URI = (global as any).__MONGO_URI__ as string;

// Ensure every Jest worker gets its own database.
export const MONGODB_URI = `${BASE_MONGO_URI}${randomUUID()}`;

export function setUpTestDbConnection(): () => Connection {
  let connection: Connection;

  const connectionOptions: ConnectOptions = { bufferCommands: false };
  const connect = async () => createConnection(MONGODB_URI, connectionOptions).asPromise();

  beforeAll(async () => {
    connection = await connect();
  });

  beforeEach(async () => {
    if (connection.readyState === STATES.disconnected) {
      connection = await connect();
    }
  });

  afterEach(async () => {
    if (connection.readyState === STATES.disconnected) {
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
