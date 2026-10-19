/** `npm run db:reset -- --yes` — deletes ALL data and re-creates the demo organisation. Refused in production. */
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { bootstrap, shutdown } from '../bootstrap';
import { loadEnv } from '../env';
import { openDb } from './client';

const env = loadEnv();
if (env.isProduction) {
  console.error('db:reset is disabled when NODE_ENV=production.');
  process.exit(1);
}
if (!process.argv.includes('--yes')) {
  console.error('This deletes every user, setting, import, report and audit entry. Re-run with --yes to confirm.');
  process.exit(1);
}
if (env.DATABASE_URL) {
  const dbh = await openDb({ databaseUrl: env.DATABASE_URL });
  await dbh.db.execute(sql`drop schema if exists public cascade`);
  await dbh.db.execute(sql`drop schema if exists drizzle cascade`);
  await dbh.db.execute(sql`create schema public`);
  await dbh.close();
} else {
  rmSync(resolve(env.DATA_DIR, 'pgdata'), { recursive: true, force: true });
}
const app = await bootstrap({ env, startJobs: false });
console.log(`Database reset and re-seeded (${app.dbh.kind}).`);
await shutdown(app);
