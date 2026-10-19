/** Database connection: PostgreSQL via `pg` when DATABASE_URL is set,
 *  otherwise embedded PostgreSQL (PGlite) persisted in DATA_DIR. */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: DB;
  kind: 'pglite' | 'postgres';
  migrate(): Promise<void>;
  close(): Promise<void>;
}

function migrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, 'migrations'), resolve(here, '../server/db/migrations'), resolve(process.cwd(), 'server/db/migrations')];
  const found = candidates.find((c) => existsSync(resolve(c, 'meta/_journal.json')));
  if (!found) throw new Error('Database migrations folder not found');
  return found;
}

export async function openDb(opts: { databaseUrl?: string; dataDir?: string; memory?: boolean }): Promise<DbHandle> {
  if (opts.databaseUrl) {
    const pg = (await import('pg')).default;
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const pool = new pg.Pool({ connectionString: opts.databaseUrl, max: 10 });
    const db = drizzle(pool, { schema }) as unknown as DB;
    return {
      db,
      kind: 'postgres',
      migrate: () => migrate(db as never, { migrationsFolder: migrationsFolder() }),
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  let client: InstanceType<typeof PGlite>;
  if (opts.memory) client = new PGlite();
  else {
    const dir = resolve(opts.dataDir ?? './.data', 'pgdata');
    mkdirSync(dir, { recursive: true });
    client = new PGlite(dir);
  }
  await client.waitReady;
  const db = drizzle(client, { schema }) as unknown as DB;
  return {
    db,
    kind: 'pglite',
    migrate: () => migrate(db as never, { migrationsFolder: migrationsFolder() }),
    close: () => client.close(),
  };
}

export { schema };
