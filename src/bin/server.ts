import { makeServer } from '../services/server.js';
import { runFastify } from '../utilities/fastify/server.js';

await runFastify(await makeServer());
