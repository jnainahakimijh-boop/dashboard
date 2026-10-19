import { eq } from 'drizzle-orm';
import type { AppContext, SessionUser } from '../context';
import { reportRuns, reportSchedules, reportTemplates } from '../db/schema';
import { sendMail } from '../mail';
import { safeErrorMessage } from '../security/redact';
import { buildReport, type ReportConfig, type ReportType } from './build';
import { renderCsv, renderPdf, renderXlsx } from './render';

export type ReportFormat = 'pdf' | 'xlsx' | 'csv';
const MIME: Record<ReportFormat, string> = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv; charset=utf-8' };
export const reportMime = (f: ReportFormat) => MIME[f];

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

export async function generateReportRun(
  app: AppContext,
  opts: { type: ReportType; config: Partial<ReportConfig>; format: ReportFormat; user: SessionUser | null; templateId?: string | null; scheduleId?: string | null; generatedBy: string },
) {
  try {
    const content = await buildReport(app, opts.user, opts.type, opts.config, opts.generatedBy);
    const file = opts.format === 'pdf' ? await renderPdf(content) : opts.format === 'xlsx' ? await renderXlsx(content) : renderCsv(content);
    const fileName = `${slug(content.title)}_${content.period.from}_${content.period.to}.${opts.format}`;
    const [run] = await app.db
      .insert(reportRuns)
      .values({
        orgId: app.orgId,
        templateId: opts.templateId ?? null,
        scheduleId: opts.scheduleId ?? null,
        title: content.title,
        status: 'succeeded',
        format: opts.format,
        fileName,
        fileBytes: file,
        sizeBytes: file.length,
        metadata: { type: opts.type, period: content.period, comparePeriod: content.comparePeriod, filters: content.filters, dataModes: content.dataModes, sources: content.sources, sections: content.sections.map((s) => s.id), language: content.language, generatedAt: content.generatedAt },
        createdBy: opts.user?.id ?? null,
      })
      .returning({ id: reportRuns.id, fileName: reportRuns.fileName, sizeBytes: reportRuns.sizeBytes, title: reportRuns.title });
    return { run, file };
  } catch (err) {
    const [run] = await app.db
      .insert(reportRuns)
      .values({ orgId: app.orgId, templateId: opts.templateId ?? null, scheduleId: opts.scheduleId ?? null, title: `${opts.type} report`, status: 'failed', format: opts.format, error: safeErrorMessage(err), createdBy: opts.user?.id ?? null })
      .returning({ id: reportRuns.id, fileName: reportRuns.fileName, sizeBytes: reportRuns.sizeBytes, title: reportRuns.title });
    throw Object.assign(new Error(`Report generation failed: ${safeErrorMessage(err)}`), { runId: run.id });
  }
}

/** Runs a report schedule: generate, then attempt delivery (recorded honestly when no e-mail provider exists). */
export async function runReportSchedule(app: AppContext, scheduleId: string) {
  const [sch] = await app.db.select().from(reportSchedules).where(eq(reportSchedules.id, scheduleId));
  if (!sch) throw new Error('Schedule not found');
  const [tpl] = await app.db.select().from(reportTemplates).where(eq(reportTemplates.id, sch.templateId));
  if (!tpl) throw new Error('Template not found');
  const { run, file } = await generateReportRun(app, { type: tpl.type as ReportType, config: tpl.config as Partial<ReportConfig>, format: sch.format as ReportFormat, user: null, templateId: tpl.id, scheduleId: sch.id, generatedBy: `Schedule: ${sch.name}` });
  const res = await sendMail(app, {
    to: sch.recipients,
    subject: `[Veolia Digital Intelligence] ${run.title}`,
    text: `${run.title}\n\nThis report was generated automatically. / Ce rapport a été généré automatiquement.`,
    attachments: [{ filename: run.fileName ?? 'report', content: file, contentType: reportMime(sch.format as ReportFormat) }],
  });
  const log = [{ at: new Date().toISOString(), recipients: sch.recipients.length, status: res.status, error: res.error ?? null, message: res.status === 'not_sent_no_provider' ? 'No e-mail provider is configured (SMTP). The report is available for download in the Reporting Center.' : null }];
  await app.db.update(reportRuns).set({ deliveryStatus: res.status, deliveryLog: log }).where(eq(reportRuns.id, run.id));
  return { runId: run.id, delivery: res.status };
}
