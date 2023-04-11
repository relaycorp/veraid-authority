import { makeServer } from '../api/server.js';
import { runFastify } from '../utilities/fastify/server.js';

await runFastify(await makeServer());
