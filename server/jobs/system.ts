/** Recurring platform jobs. Missing ones are added at start-up, so new jobs also reach existing databases. */
import { and, eq } from 'drizzle-orm';
import type { DB } from '../db/client';
import { schedules } from '../db/schema';
import { nextRun, type Frequency } from './schedule';

export const SYSTEM_SCHEDULES: ReadonlyArray<{ name: string; jobType: string; frequency: Frequency; enabled: boolean }> = [
  { name: 'Evaluate alert rules', jobType: 'alerts.evaluate', frequency: { kind: 'daily', time: '07:00' }, enabled: true },
  { name: 'Refresh recommendations', jobType: 'recommendations.generate', frequency: { kind: 'daily', time: '07:15' }, enabled: true },
  { name: 'Synchronise connected sources', jobType: 'connectors.sync_all', frequency: { kind: 'daily', time: '05:30' }, enabled: true },
  { name: 'Purge expired sessions and old files', jobType: 'maintenance.cleanup', frequency: { kind: 'daily', time: '03:00' }, enabled: true },
  // paid provider usage and crawl traffic: off until an administrator enables them
  { name: 'Measure GEO prompts with connected providers', jobType: 'geo.measure_all', frequency: { kind: 'weekly', weekday: 0, time: '06:00' }, enabled: false },
  { name: 'Run audits of authorised crawl scopes', jobType: 'seo.crawl_all', frequency: { kind: 'monthly', day: 1, time: '04:00' }, enabled: false },
];

export async function ensureSystemSchedules(db: DB, orgId: string, now = new Date()): Promise<number> {
  let added = 0;
  for (const def of SYSTEM_SCHEDULES) {
    const [existing] = await db.select({ id: schedules.id }).from(schedules).where(and(eq(schedules.orgId, orgId), eq(schedules.jobType, def.jobType))).limit(1);
    if (existing) continue;
    await db.insert(schedules).values({ orgId, name: def.name, jobType: def.jobType, frequency: def.frequency, payload: {}, enabled: def.enabled, nextRunAt: nextRun(def.frequency, now) });
    added++;
  }
  return added;
}
