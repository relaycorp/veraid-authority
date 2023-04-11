import { argv } from 'node:process';

import type { FastifyInstance } from 'fastify';

import { makeServer } from '../api/server.js';
import { runFastify } from '../utilities/fastify/server.js';

type ServerMaker = () => Promise<FastifyInstance>;

const SERVER_MAKERS: { [key: string]: ServerMaker } = {
  api: makeServer,
};

const [, scriptName, serverName] = argv;
const serverMaker = SERVER_MAKERS[serverName] as ServerMaker | undefined;

if (serverMaker === undefined) {
  throw new Error(`${scriptName}: Invalid server name (${serverName})`);
}

await runFastify(await serverMaker());
