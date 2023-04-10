import { makeServer, runFastify } from '../services/server.js';

await runFastify(await makeServer());
