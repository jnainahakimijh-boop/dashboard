/** `npm run db:migrate` — applies pending SQL migrations to the configured database. */
import { loadEnv } from '../env';
import { openDb } from './client';

const env = loadEnv();
const dbh = await openDb({ databaseUrl: env.DATABASE_URL || undefined, dataDir: env.DATA_DIR });
try {
  await dbh.migrate();
  console.log(`Migrations applied (${dbh.kind}).`);
} finally {
  await dbh.close();
}
