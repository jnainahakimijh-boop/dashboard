/** Job handlers for background and scheduled work. */
import { and, lt } from 'drizzle-orm';
import { purgeExpiredSessions } from '../auth/session';
import { auditLogs, factRows, geoMeasurements, jobs as jobsTable, organizations, reportRuns } from '../db/schema';
import { evaluateAlertRules } from '../insights/alerts';
import { generateRecommendations } from '../insights/recommendations';
import { runGeoMeasurements, syncAllConnected, syncConnection } from '../connectors/sync';
import { runCrawlJob } from '../seo/crawler';
import { runReportSchedule } from '../reports/service';
import type { JobQueue } from './queue';

export function registerJobHandlers(q: JobQueue): void {
  q.register('alerts.evaluate', async (_job, app) => evaluateAlertRules(app));
  q.register('recommendations.generate', async (_job, app) => generateRecommendations(app));
  q.register('connector.sync', async (job, app) => {
    const p = job.payload as { connectionId: string; from?: string; to?: string };
    return syncConnection(app, p.connectionId, p.from && p.to ? { from: p.from, to: p.to } : undefined);
  });
  q.register('connectors.sync_all', async (_job, app) => syncAllConnected(app));
  q.register('crawl.run', async (job, app) => runCrawlJob(app, String((job.payload as { crawlId: string }).crawlId)));
  q.register('geo.measure', async (job, app) => {
    const p = job.payload as { connectionId: string; promptKeys: string[] };
    return runGeoMeasurements(app, p.connectionId, p.promptKeys);
  });
  q.register('report.scheduled', async (job, app) => runReportSchedule(app, String((job.payload as { reportScheduleId: string }).reportScheduleId)));
  q.register('maintenance.cleanup', async (_job, app) => {
    await purgeExpiredSessions(app);
    const [org] = await app.db.select().from(organizations);
    const settings = (org?.settings ?? {}) as { auditRetentionMonths?: number; reportRetentionDays?: number; dataRetentionMonths?: number; geoRetentionMonths?: number };
    const monthsAgo = (m: number) => new Date(Date.now() - m * 30.44 * 86_400_000).toISOString().slice(0, 10);
    // analytics and GEO history are only purged when an administrator has set a retention period
    if (settings.dataRetentionMonths) await app.db.delete(factRows).where(lt(factRows.day, monthsAgo(settings.dataRetentionMonths)));
    if (settings.geoRetentionMonths) await app.db.delete(geoMeasurements).where(lt(geoMeasurements.measuredOn, monthsAgo(settings.geoRetentionMonths)));
    if (settings.dataRetentionMonths || settings.geoRetentionMonths) app.analytics.invalidate();
    await app.db.delete(jobsTable).where(lt(jobsTable.createdAt, new Date(Date.now() - 30 * 86_400_000)));
    await app.db.delete(reportRuns).where(lt(reportRuns.createdAt, new Date(Date.now() - (settings.reportRetentionDays ?? 180) * 86_400_000)));
    await app.db.delete(auditLogs).where(and(lt(auditLogs.createdAt, new Date(Date.now() - (settings.auditRetentionMonths ?? 24) * 30 * 86_400_000))));
    return { ok: true };
  });
}
