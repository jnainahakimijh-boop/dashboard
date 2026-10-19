/** Builds the application context: config, database, migrations, seed, services and jobs. */
import type { AppContext } from './context';
import { openDb } from './db/client';
import { seedIfEmpty } from './db/seed';
import { loadEnv, type Env } from './env';
import { createLogger, type Logger } from './logger';
import { SecretBox } from './security/crypto';
import { AnalyticsService } from './analytics/service';
import { JobQueue } from './jobs/queue';
import { registerJobHandlers } from './jobs/handlers';
import { ensureSystemSchedules } from './jobs/system';
import { initialiseDerivedData } from './insights/bootstrap';

export interface BootstrapOptions {
  env?: Env;
  memoryDb?: boolean;
  log?: Logger;
  startJobs?: boolean;
}

export async function bootstrap(opts: BootstrapOptions = {}): Promise<AppContext> {
  const env = opts.env ?? loadEnv();
  const log = opts.log ?? createLogger();
  const dbh = await openDb({ databaseUrl: env.DATABASE_URL || undefined, dataDir: env.DATA_DIR, memory: opts.memoryDb });
  await dbh.migrate();
  const { orgId, created } = await seedIfEmpty(dbh.db, env, (m) => log.info(`seed: ${m}`));
  const addedSchedules = await ensureSystemSchedules(dbh.db, orgId);
  if (addedSchedules) log.info('system schedules added', { count: addedSchedules });
  const jobs = new JobQueue();
  const app: AppContext = {
    env,
    dbh,
    db: dbh.db,
    secrets: new SecretBox(env.encryptionKey),
    orgId,
    analytics: new AnalyticsService({ db: dbh.db, orgId, envDemoMode: env.DEMO_MODE }),
    jobs,
    log,
    startedAt: new Date(),
  };
  jobs.bind(app);
  registerJobHandlers(jobs);
  if (created) await initialiseDerivedData(app);
  if (opts.startJobs ?? env.JOBS_ENABLED) jobs.start();
  return app;
}

export async function shutdown(app: AppContext): Promise<void> {
  await app.jobs.stop();
  await app.dbh.close();
}
