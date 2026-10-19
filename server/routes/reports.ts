/** Reporting Center: templates, on-demand generation, run history with downloads, schedules; table exports. */
import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { can } from '@shared/rbac';
import { requirePermission } from '../auth/middleware';
import { audit } from '../audit';
import { HttpError, currentUser, type HonoEnv } from '../context';
import { reportRuns, reportSchedules, reportTemplates, users } from '../db/schema';
import { frequencySchema, nextRun, describeFrequency, type Frequency } from '../jobs/schedule';
import { REPORT_TYPES, reportConfigSchema, type ReportType } from '../reports/build';
import { renderTable } from '../reports/render';
import { generateReportRun, reportMime, runReportSchedule, type ReportFormat } from '../reports/service';
import { body, notFound, uuidParam } from './util';

const FORMATS = ['pdf', 'xlsx', 'csv'] as const;

export function reportRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('analytics.view'));

  r.get('/templates', async (c) => c.json(await c.get('app').db.select().from(reportTemplates).orderBy(reportTemplates.type, reportTemplates.name)));

  r.post('/templates', requirePermission('reports.create'), async (c) => {
    const app = c.get('app');
    const d = await body(c, z.object({ type: z.enum(REPORT_TYPES), name: z.string().trim().min(2).max(120), config: reportConfigSchema }));
    const [row] = await app.db.insert(reportTemplates).values({ orgId: app.orgId, type: d.type, name: d.name, config: d.config, createdBy: currentUser(c).id }).returning();
    await audit(c, { action: 'report.template.create', entityType: 'report_template', entityId: row.id, details: { name: d.name, type: d.type } });
    return c.json(row, 201);
  });

  r.patch('/templates/:id', requirePermission('reports.create'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const user = currentUser(c);
    const [cur] = await app.db.select().from(reportTemplates).where(eq(reportTemplates.id, id));
    if (!cur) notFound('Template');
    if (cur.createdBy !== user.id && !can(user.role, 'reports.schedule')) throw new HttpError(403, 'Only the author or a report manager can edit this template', 'forbidden');
    const d = await body(c, z.object({ name: z.string().trim().min(2).max(120).optional(), config: reportConfigSchema.optional() }));
    const [row] = await app.db.update(reportTemplates).set({ ...d, updatedAt: new Date() }).where(eq(reportTemplates.id, id)).returning();
    await audit(c, { action: 'report.template.update', entityType: 'report_template', entityId: id });
    return c.json(row);
  });

  r.delete('/templates/:id', requirePermission('reports.schedule'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const used = await app.db.select({ id: reportSchedules.id }).from(reportSchedules).where(eq(reportSchedules.templateId, id));
    if (used.length) throw new HttpError(409, 'This template is used by a schedule; delete the schedule first', 'conflict');
    await app.db.delete(reportTemplates).where(eq(reportTemplates.id, id));
    await audit(c, { action: 'report.template.delete', entityType: 'report_template', entityId: id });
    return c.json({ ok: true });
  });

  r.post('/generate', requirePermission('reports.create'), async (c) => {
    const app = c.get('app');
    const user = currentUser(c);
    const d = await body(c, z.object({ templateId: z.string().uuid().optional(), type: z.enum(REPORT_TYPES).optional(), config: reportConfigSchema.partial().optional(), format: z.enum(FORMATS).default('pdf') }));
    let type: ReportType = d.type ?? 'custom';
    let config = d.config ?? {};
    if (d.templateId) {
      const [tpl] = await app.db.select().from(reportTemplates).where(eq(reportTemplates.id, d.templateId));
      if (!tpl) notFound('Template');
      type = tpl.type as ReportType;
      config = { ...(tpl.config as object), ...config };
    }
    const { run } = await generateReportRun(app, { type, config, format: d.format, user, templateId: d.templateId ?? null, generatedBy: user.name });
    await audit(c, { action: 'report.generate', entityType: 'report_run', entityId: run.id, details: { type, format: d.format } });
    return c.json(run, 201);
  });

  r.get('/runs', async (c) => {
    const rows = await c
      .get('app')
      .db.select({
        id: reportRuns.id,
        title: reportRuns.title,
        status: reportRuns.status,
        format: reportRuns.format,
        fileName: reportRuns.fileName,
        sizeBytes: reportRuns.sizeBytes,
        metadata: reportRuns.metadata,
        deliveryStatus: reportRuns.deliveryStatus,
        deliveryLog: reportRuns.deliveryLog,
        error: reportRuns.error,
        createdAt: reportRuns.createdAt,
        scheduleId: reportRuns.scheduleId,
        templateId: reportRuns.templateId,
        createdByName: users.name,
      })
      .from(reportRuns)
      .leftJoin(users, eq(users.id, reportRuns.createdBy))
      .orderBy(desc(reportRuns.createdAt))
      .limit(200);
    return c.json(rows);
  });

  r.get('/runs/:id/download', async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const [run] = await app.db.select().from(reportRuns).where(eq(reportRuns.id, id));
    if (!run || !run.fileBytes) notFound('Report file');
    await audit(c, { action: 'report.download', entityType: 'report_run', entityId: id, details: { format: run.format } });
    return new Response(new Uint8Array(run.fileBytes), {
      headers: { 'content-type': reportMime(run.format as ReportFormat), 'content-disposition': `attachment; filename="${(run.fileName ?? 'report').replace(/[^\w.-]/g, '_')}"`, 'cache-control': 'no-store' },
    });
  });

  r.get('/schedules', async (c) => {
    const rows = await c.get('app').db.select().from(reportSchedules).orderBy(reportSchedules.name);
    return c.json(rows.map((s) => ({ ...s, frequencyLabel: { en: describeFrequency(s.frequency as Frequency, 'en'), fr: describeFrequency(s.frequency as Frequency, 'fr') }, emailConfigured: c.get('app').env.smtpConfigured })));
  });

  const scheduleSchema = z.object({
    templateId: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    frequency: frequencySchema,
    format: z.enum(FORMATS),
    recipients: z.array(z.string().email().max(200)).max(50),
    enabled: z.boolean().default(true),
  });

  r.post('/schedules', requirePermission('reports.schedule'), async (c) => {
    const app = c.get('app');
    const d = await body(c, scheduleSchema);
    const [row] = await app.db.insert(reportSchedules).values({ orgId: app.orgId, ...d, nextRunAt: d.enabled ? nextRun(d.frequency, new Date()) : null, createdBy: currentUser(c).id }).returning();
    await audit(c, { action: 'report.schedule.create', entityType: 'report_schedule', entityId: row.id, details: { name: d.name, recipients: d.recipients.length, frequency: d.frequency } });
    return c.json(row, 201);
  });

  r.patch('/schedules/:id', requirePermission('reports.schedule'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, scheduleSchema.partial());
    const [cur] = await app.db.select().from(reportSchedules).where(eq(reportSchedules.id, id));
    if (!cur) notFound('Schedule');
    const freq = (d.frequency ?? cur.frequency) as Frequency;
    const enabled = d.enabled ?? cur.enabled;
    const [row] = await app.db.update(reportSchedules).set({ ...d, nextRunAt: enabled ? nextRun(freq, new Date()) : null }).where(eq(reportSchedules.id, id)).returning();
    await audit(c, { action: 'report.schedule.update', entityType: 'report_schedule', entityId: id, details: { ...d, recipients: d.recipients?.length } });
    return c.json(row);
  });

  r.delete('/schedules/:id', requirePermission('reports.schedule'), async (c) => {
    const id = uuidParam(c);
    await c.get('app').db.delete(reportSchedules).where(eq(reportSchedules.id, id));
    await audit(c, { action: 'report.schedule.delete', entityType: 'report_schedule', entityId: id });
    return c.json({ ok: true });
  });

  r.post('/schedules/:id/run', requirePermission('reports.schedule'), async (c) => {
    const id = uuidParam(c);
    const res = await runReportSchedule(c.get('app'), id);
    await audit(c, { action: 'report.schedule.run', entityType: 'report_schedule', entityId: id, details: res });
    return c.json(res);
  });

  return r;
}

export function exportRoutes() {
  const r = new Hono<HonoEnv>();
  r.post('/table', requirePermission('analytics.export'), async (c) => {
    const d = await body(
      c,
      z.object({
        format: z.enum(['csv', 'xlsx']),
        title: z.string().max(120),
        columns: z.array(z.object({ key: z.string().max(80), label: z.string().max(120), unit: z.enum(['count', 'percent', 'currency', 'seconds', 'minutes', 'position', 'decimal', 'text']).optional() })).min(1).max(60),
        rows: z.array(z.record(z.union([z.string().max(2000), z.number(), z.null(), z.boolean()]))).max(50_000),
        meta: z.array(z.tuple([z.string().max(80), z.string().max(2000)])).max(30).default([]),
      }),
    );
    const user = currentUser(c);
    const meta: Array<[string, string]> = [...d.meta, ['Exported by', user.name], ['Exported at (UTC)', new Date().toISOString()]];
    const file = await renderTable({ title: d.title, columns: d.columns, rows: d.rows, meta }, d.format);
    await audit(c, { action: 'export.table', details: { title: d.title, format: d.format, rows: d.rows.length } });
    const name = `${d.title.replace(/[^\w-]+/g, '_').slice(0, 60) || 'export'}.${d.format}`;
    return new Response(new Uint8Array(file), { headers: { 'content-type': d.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${name}"` } });
  });
  return r;
}
