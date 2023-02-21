import { runFastify } from '../services/fastify.js';
import { makeServer } from '../services/server.js';

(async function startServer(): Promise<void> {
  await runFastify(await makeServer());
})();
