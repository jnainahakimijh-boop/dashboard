/** `npm run db:seed` — migrates, then creates the organisation, users and reference data if the database is empty. */
import { bootstrap, shutdown } from '../bootstrap';
import { loadEnv } from '../env';

const env = loadEnv();
const app = await bootstrap({ env, startJobs: false });
console.log(`Database ready (${app.dbh.kind}). An existing organisation is never overwritten; use db:reset to start again.`);
await shutdown(app);
