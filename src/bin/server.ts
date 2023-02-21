import { runFastify } from '../services/fastify.js';
import { makeServer } from '../services/server.js';

await runFastify(await makeServer());
