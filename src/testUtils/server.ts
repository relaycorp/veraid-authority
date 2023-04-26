import type { FastifyInstance } from 'fastify';
import type { Connection } from 'mongoose';

import type { ServerMaker } from '../utilities/fastify/ServerMaker.js';

import { makeMockLogging, type MockLogSet } from './logging.js';
import { configureMockEnvVars, type EnvVarSet, type EnvVarMocker } from './envVars.js';
import { setUpTestDbConnection } from './db.js';

export interface TestServerFixture {
  readonly server: FastifyInstance;
  readonly dbConnection: Connection;
  readonly logs: MockLogSet;
  readonly envVarMocker: EnvVarMocker;
}

export function makeTestServer(
  serverMaker: ServerMaker,
  envVars: EnvVarSet,
): () => TestServerFixture {
  const envVarMocker = configureMockEnvVars(envVars);
  const mockLogging = makeMockLogging();
  const getConnection = setUpTestDbConnection();

  let server: FastifyInstance;
  beforeEach(async () => {
    server = await serverMaker(mockLogging.logger);
  });

  afterEach(async () => {
    await server.close();
  });

  return () => ({
    server,
    dbConnection: getConnection(),
    logs: mockLogging.logs,
    envVarMocker,
  });
}
