import { argv } from 'node:process';

import { makeApiServer } from '../servers/api/server.js';
import { makeQueueServer } from '../servers/backgroundQueue/server.js';
import { makeAwalaServer } from '../servers/awala/server.js';
import { runFastify } from '../utilities/fastify/server.js';
import type { ServerMaker } from '../utilities/fastify/ServerMaker.js';

const SERVER_MAKERS: { [key: string]: ServerMaker } = {
  api: makeApiServer,
  queue: makeQueueServer,
  awala: makeAwalaServer,
};

const [, scriptName, serverName] = argv;
const serverMaker = SERVER_MAKERS[serverName] as ServerMaker | undefined;

if (serverMaker === undefined) {
  throw new Error(`${scriptName}: Invalid server name (${serverName})`);
}

await runFastify(await serverMaker());
