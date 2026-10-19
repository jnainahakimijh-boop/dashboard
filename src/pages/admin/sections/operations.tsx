import { AlertTriangle, CheckCircle2, Download, FileUp, RefreshCw, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, download } from '@/api/client';
import { useApi } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatBytes, formatDateTime, formatValue, relativeTime } from '@/lib/format';
import { useSession } from '@/state/session';
import { DataModeBadge } from '@/components/data';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, ErrorState, Field, Input, Select, Skeleton, Switch, Textarea, useToast } from '@/components/ui';
import { ReadOnlyNote, TypedConfirm, useAction } from '../shared';

/* ---------------- data management ---------------- */

interface Spec {
  dataset: string;
  provider: string;
  label: string;
  columns: Array<{ name: string; type: string; required: boolean; enum: string[] | null }>;
}

interface ImportRow {
  id: string;
  dataset: string;
  fileName: string;
  fileType: string;
  status: string;
  rowsTotal: number;
  rowsAccepted: number;
  rowsRejected: number;
  dateFrom: string | null;
  dateTo: string | null;
  createdAt: string;
  userName: string | null;
  rejectedPreview: Array<{ row: number; errors: string[] }>;
}

interface DryRun {
  status: 'validated';
  total: number;
  accepted: number;
  rejected: Array<{ row: number; errors: string[] }>;
  from: string | null;
  to: string | null;
  entities: string[];
  schema: { unknownColumns: string[]; missingOptional: string[] };
  missingValues: Record<string, number>;
  duplicates: number;
  existingRows: number;
  mapping: Array<{ column: string; target: string }>;
  preview: Array<{ day: string; dims: Record<string, string>; measures: Record<string, number> }>;
}

interface SystemInfo {
  health: { status: string; uptimeSeconds: number; database: string; node: string; jobsEnabled: boolean; worker: string; demoMode: boolean; asOf: string };
  storage: { databaseBytes: number | null; reportFilesBytes: number };
  datasets: Array<{ id: string; origin: string; rows: number; coverage: { from: string; to: string } | null; freshness: string | null; missingEntities: Array<{ entity: string; days: number }> | string[] }>;
  warehouseRows: Record<string, number> | Array<{ dataset: string; n: number }>;
  jobsByStatus: Array<{ status: string; n: number }>;
  recentJobs: Array<{ id: string; type: string; status: string; attempts: number; maxAttempts: number; lastError: string | null; createdAt: string; finishedAt: string | null }>;
  syncExecutions: Array<{ id: string; connectionName: string | null; status: string; kind: string; startedAt: string; rowsWritten: number; error: string | null }>;
  systemEvents: Array<{ id: string; level: string; source: string; message: string; createdAt: string }>;
  schedules: Array<{ id: string; name: string; jobType: string; frequency: Record<string, unknown>; enabled: boolean; lastRunAt: string | null; nextRunAt: string | null }>;
  failedImports: Array<{ id: string; dataset: string; fileName: string; status: string; rowsRejected: number; createdAt: string }>;
  rateLimited: Array<{ name: string; lastError: string }>;
}

export function DataSection() {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const specs = useApi<Spec[]>('/api/admin/imports/specs');
  const list = useApi<ImportRow[]>('/api/admin/imports');
  const sys = useApi<SystemInfo>(can('system.view') ? '/api/admin/system' : null);
  const [dataset, setDataset] = useState('web');
  const [file, setFile] = useState<File | null>(null);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const del = useAction<{ id: string }>('DELETE', (b) => `/api/admin/imports/${b.id}`, ['/api/admin/imports', 'meta', 'analytics']);
  const canImport = can('data.import');
  useEffect(() => {
    setDry(null);
    setConfirm(false);
  }, [dataset, file]);
  const spec = specs.data?.find((s) => s.dataset === dataset);
  const send = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('dataset', dataset);
      fd.set('file', file);
      fd.set('dryRun', String(dryRun));
      fd.set('replace', 'true');
      fd.set('confirmReplace', String(confirm));
      const res = await api.upload<DryRun & { id?: string; rejected: number | DryRun['rejected'] }>('/api/admin/imports', fd);
      if (dryRun) setDry(res);
      else {
        toast(t('admin.importDone', { accepted: res.accepted, rejected: typeof res.rejected === 'number' ? res.rejected : res.rejected.length }), 'pos');
        setFile(null);
        setDry(null);
        if (fileRef.current) fileRef.current.value = '';
        await list.refetch();
      }
    } catch (e) {
      toast((e as Error).message, 'neg');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="data.import" />
      {canImport && (
        <Card>
          <CardHeader title={t('admin.importTitle')} subtitle={t('admin.importHint')} />
          <CardBody>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-3">
                <Field label={t('admin.dataset')} htmlFor="imp-ds">
                  <Select id="imp-ds" value={dataset} onChange={(e) => setDataset(e.target.value)}>
                    {specs.data?.map((s) => (
                      <option key={s.dataset} value={s.dataset}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileRef} id="imp-file" type="file" accept=".csv,.xlsx" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <Button icon={<FileUp className="size-3.5" />} onClick={() => fileRef.current?.click()}>
                    {file ? file.name : t('admin.chooseFile')}
                  </Button>
                  <Button variant="ghost" icon={<Download className="size-3.5" />} onClick={() => download(`/api/admin/imports/template/${dataset}`, undefined, `template_${dataset}.csv`).catch((e: Error) => toast(e.message, 'neg'))}>
                    {t('admin.downloadTemplate')}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!file} loading={busy && !dry} onClick={() => send(true)}>
                    {t('admin.validatePreview')}
                  </Button>
                  <Button variant="primary" disabled={!dry || dry.accepted === 0 || (dry.existingRows > 0 && !confirm)} loading={busy && !!dry} onClick={() => send(false)}>
                    {t('admin.import')}
                  </Button>
                </div>
              </div>
              {spec && (
                <div className="rounded-lg bg-card2 p-3 text-[12.5px]">
                  <p className="mb-1 font-medium">{t('admin.expectedColumns')}</p>
                  <p className="leading-relaxed">
                    {spec.columns
                      .filter((c) => !c.name.startsWith('event_'))
                      .map((c) => (
                        <span key={c.name} className="mr-2 inline-block">
                          <code className={c.required ? 'font-semibold' : 'text-t2'}>{c.name}</code>
                          <span className="text-t3"> ({c.type}{c.required ? `, ${t('common.required').toLowerCase()}` : ''})</span>
                        </span>
                      ))}
                    {spec.columns.some((c) => c.name.startsWith('event_')) && <span className="text-t3">{t('admin.eventColumns')}</span>}
                  </p>
                </div>
              )}
            </div>
            {dry && (
              <div className="mt-4 flex flex-col gap-3 border-t border-brd pt-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {(
                    [
                      [t('admin.rowsTotal'), dry.total],
                      [t('admin.rowsAccepted'), dry.accepted],
                      [t('admin.rowsRejected'), dry.rejected.length],
                      [t('admin.duplicates'), dry.duplicates],
                      [t('admin.existingRows'), dry.existingRows],
                    ] as Array<[string, number]>
                  ).map(([l, v]) => (
                    <div key={l} className="rounded-lg border border-brd p-2">
                      <span className="block text-[12px] text-t2">{l}</span>
                      <span className="text-[18px] font-semibold tnum">{formatValue(v, 'count', lang)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[12.5px] text-t2">
                  {t('admin.period')}
                  {t('common.colon')} {dry.from ?? '—'} → {dry.to ?? '—'} · {t('admin.entities')}
                  {t('common.colon')} {dry.entities.join(', ') || '—'}
                </p>
                {(dry.schema.unknownColumns.length > 0 || dry.schema.missingOptional.length > 0) && (
                  <p className="rounded-md bg-warnsoft px-2 py-1.5 text-[12.5px] text-t1">
                    <AlertTriangle className="mr-1 inline size-3.5 text-warn" aria-hidden />
                    {dry.schema.unknownColumns.length > 0 && t('admin.unknownColumns', { list: dry.schema.unknownColumns.join(', ') })} {dry.schema.missingOptional.length > 0 && t('admin.missingOptional', { list: dry.schema.missingOptional.join(', ') })}
                  </p>
                )}
                {Object.keys(dry.missingValues).length > 0 && (
                  <p className="text-[12.5px] text-t2">
                    {t('admin.missingValues')}
                    {t('common.colon')} {Object.entries(dry.missingValues).map(([k, n]) => `${k} (${n})`).join(', ')}
                  </p>
                )}
                <details className="rounded-lg border border-brd p-2 text-[12.5px]">
                  <summary className="cursor-pointer font-medium">{t('admin.mappingPreview')}</summary>
                  <ul className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                    {dry.mapping.map((m) => (
                      <li key={m.column}>
                        <code>{m.column}</code> → <code className="text-t2">{m.target}</code>
                      </li>
                    ))}
                  </ul>
                  <pre className="mt-2 max-h-56 overflow-auto rounded bg-card2 p-2 text-[11.5px]">{JSON.stringify(dry.preview, null, 2)}</pre>
                </details>
                {dry.rejected.length > 0 && (
                  <details className="rounded-lg border border-brd p-2 text-[12.5px]" open>
                    <summary className="cursor-pointer font-medium">{t('admin.rejectedRows', { n: dry.rejected.length })}</summary>
                    <ul className="mt-2 max-h-56 overflow-auto">
                      {dry.rejected.slice(0, 50).map((r) => (
                        <li key={r.row}>
                          <span className="tnum text-t3">{t('admin.row', { n: r.row })}</span> — {r.errors.join('; ')}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {dry.existingRows > 0 && (
                  <div className="rounded-lg border border-warn/40 bg-warnsoft p-3 text-[13px]">
                    <p className="font-medium">{t('admin.overwriteTitle')}</p>
                    <p className="mt-0.5 text-t2">{t('admin.overwriteBody', { n: dry.existingRows, from: dry.from ?? '', to: dry.to ?? '' })}</p>
                    <div className="mt-2">
                      <Checkbox checked={confirm} onChange={setConfirm} label={t('admin.overwriteConfirm')} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}
      <Card>
        <CardHeader title={t('admin.importHistory')} subtitle={t('admin.importHistoryHint')} />
        <CardBody>
          {list.isLoading ? (
            <Skeleton className="h-40" />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <DataTable
              rows={list.data ?? []}
              caption={t('admin.importHistory')}
              rowKey={(x) => x.id}
              columns={[
                { key: 'file', header: t('admin.file'), value: (x) => x.fileName, unit: 'text', render: (x) => <span className="flex flex-col"><span className="font-medium">{x.fileName}</span><span className="text-[12px] text-t3">{x.dataset} · {x.userName ?? '—'}</span></span> },
                { key: 'when', header: t('admin.when'), value: (x) => x.createdAt, unit: 'text', render: (x) => relativeTime(x.createdAt, lang) },
                { key: 'period', header: t('admin.period'), value: (x) => x.dateFrom ?? '', unit: 'text', render: (x) => (x.dateFrom ? `${x.dateFrom} → ${x.dateTo}` : '—'), hideOnMobile: true },
                { key: 'acc', header: t('admin.rowsAccepted'), value: (x) => x.rowsAccepted, unit: 'count' },
                { key: 'rej', header: t('admin.rowsRejected'), value: (x) => x.rowsRejected, unit: 'count' },
                { key: 'status', header: t('common.status'), value: (x) => x.status, unit: 'text', render: (x) => <Badge tone={x.status === 'completed' ? 'pos' : x.status === 'partial' ? 'warn' : x.status === 'deleted' ? 'neutral' : 'neg'}>{t(`admin.importStatus_${x.status}`)}</Badge> },
                {
                  key: 'act',
                  header: '',
                  value: () => null,
                  sortable: false,
                  render: (x) => (
                    <span className="flex justify-end gap-1">
                      {x.rowsRejected > 0 && (
                        <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} onClick={() => download(`/api/admin/imports/${x.id}/rejected.csv`, undefined, `rejected_${x.dataset}.csv`).catch((e: Error) => toast(e.message, 'neg'))}>
                          {t('admin.rejectedCsv')}
                        </Button>
                      )}
                      {canImport && x.status !== 'deleted' && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label={`${t('admin.deleteImport')}: ${x.fileName}`} onClick={() => window.confirm(t('admin.deleteImportConfirm')) && del.run({ id: x.id })} />}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
      {sys.data && (
        <Card>
          <CardHeader title={t('admin.datasets')} subtitle={t('admin.datasetsHint')} />
          <CardBody>
            <DataTable
              rows={sys.data.datasets}
              caption={t('admin.datasets')}
              rowKey={(d) => d.id}
              columns={[
                { key: 'id', header: t('admin.dataset'), value: (d) => d.id, unit: 'text', render: (d) => <code>{d.id}</code> },
                { key: 'origin', header: t('admin.origin'), value: (d) => d.origin, unit: 'text', render: (d) => <DataModeBadge mode={d.origin === 'demo' ? 'demo' : 'connected'} /> },
                { key: 'rows', header: t('admin.rows'), value: (d) => d.rows, unit: 'count' },
                { key: 'cov', header: t('admin.coverage'), value: (d) => d.coverage?.to ?? '', unit: 'text', render: (d) => (d.coverage ? `${d.coverage.from} → ${d.coverage.to}` : '—') },
                { key: 'fresh', header: t('common.freshness'), value: (d) => d.freshness ?? '', unit: 'text', render: (d) => (d.freshness ? relativeTime(d.freshness, lang) : '—'), hideOnMobile: true },
                { key: 'gaps', header: t('admin.gaps'), value: (d) => d.missingEntities.length, unit: 'count', hideOnMobile: true },
              ]}
            />
            <p className="mt-2 text-[12px] text-t3">{t('admin.reprocessNote')}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* ---------------- reporting administration ---------------- */

export function ReportingAdminSection() {
  const { t, lang, L } = useI18n();
  const runs = useApi<Array<{ id: string; title: string; status: string; format: string; deliveryStatus: string; error: string | null; createdAt: string; createdByName: string | null }>>('/api/reports/runs');
  const schedules = useApi<Array<{ id: string; name: string; enabled: boolean; recipients: string[]; frequencyLabel: { en: string; fr: string }; nextRunAt: string | null; emailConfigured: boolean }>>('/api/reports/schedules');
  const templates = useApi<Array<{ id: string; name: string; type: string }>>('/api/reports/templates');
  const failed = (runs.data ?? []).filter((r) => r.status === 'failed' || r.deliveryStatus === 'failed');
  const notSent = (runs.data ?? []).filter((r) => r.deliveryStatus === 'not_sent_no_provider').length;
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {(
          [
            [t('reports.tab_templates'), templates.data?.length ?? '—', '/reports?tab=templates'],
            [t('reports.tab_schedules'), schedules.data?.length ?? '—', '/reports?tab=schedules'],
            [t('admin.failedReports'), failed.length, '/reports?tab=history'],
            [t('admin.notSentReports'), notSent, '/reports?tab=history'],
          ] as Array<[string, number | string, string]>
        ).map(([l, v, to]) => (
          <Link key={l} to={to} className="rounded-lg border border-brd bg-card p-3 hover:border-brds">
            <span className="block text-[12.5px] text-t2">{l}</span>
            <span className="text-[22px] font-semibold tnum">{v}</span>
          </Link>
        ))}
      </div>
      {schedules.data && !schedules.data[0]?.emailConfigured && <p className="rounded-lg border border-warn/30 bg-warnsoft px-3 py-2 text-[13px]">{t('reports.noProviderBanner')}</p>}
      <Card>
        <CardHeader title={t('admin.recipientsOverview')} subtitle={t('admin.recipientsOverviewHint')} actions={<Link to="/reports?tab=schedules" className="text-[13px] font-medium text-acctext hover:underline">{t('admin.manage')} →</Link>} />
        <CardBody>
          <ul className="flex flex-col divide-y divide-brd text-[13px]">
            {(schedules.data ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>
                  <span className="font-medium">{s.name}</span> <span className="text-t3">· {L(s.frequencyLabel)}</span>
                </span>
                <span className="text-t2">{s.recipients.length ? s.recipients.join(', ') : t('admin.noRecipients')}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.failedReportJobs')} />
        <CardBody>
          {!failed.length ? (
            <p className="flex items-center gap-2 text-[13px] text-t2">
              <CheckCircle2 className="size-4 text-pos" aria-hidden /> {t('admin.noFailures')}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-brd text-[13px]">
              {failed.map((r) => (
                <li key={r.id} className="py-1.5">
                  <span className="font-medium">{r.title}</span> · <span className="text-t3">{formatDateTime(r.createdAt, lang)}</span>
                  {r.error && <span className="block text-neg">{r.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.reportAccess')} />
        <CardBody>
          <p className="text-[13px] text-t2">{t('admin.reportAccessText')}</p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------- AI administration ---------------- */

interface AiAdmin {
  settings: { enabled: boolean; provider: 'none' | 'anthropic' | 'openai' | 'azure_openai'; model: string | null; baseUrl: string | null; externalProcessingApproved: boolean; approvedAt: string | null; maxOutputTokens: number; temperature: number; monthlyTokenBudget: number | null; allowedFeatures: string[]; requireHumanReview: boolean };
  key: { hasSecret: boolean; secretUpdatedAt?: string | null };
  templates: Array<{ id: string; key: string; version: number; body: string; active: boolean; createdAt: string }>;
  executions: Array<{ id: string; purpose: string; provider: string; model: string | null; status: string; inputTokens: number | null; outputTokens: number | null; latencyMs: number | null; error: string | null; createdAt: string }>;
  status: { available: boolean; reason: string; provider: string; model: string | null };
  dataPolicy: string;
}

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
  openai: ['gpt-4.1', 'gpt-4.1-mini'],
  azure_openai: [],
  none: [],
};

export function AiSection() {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const q = useApi<AiAdmin>('/api/admin/ai');
  const conns = useApi<Array<{ id: string; provider: string }>>('/api/admin/integrations');
  const [f, setF] = useState<AiAdmin['settings'] | null>(null);
  const [key, setKey] = useState('');
  const [approve, setApprove] = useState(false);
  const [tpl, setTpl] = useState<{ key: string; body: string } | null>(null);
  useEffect(() => {
    if (q.data) setF(q.data.settings);
  }, [q.data]);
  const save = useAction<Record<string, unknown>>('PATCH', '/api/admin/ai', ['/api/admin/ai', '/api/insights/summary']);
  const approval = useAction<{ approved: boolean; confirmation?: string }>('POST', '/api/admin/ai/approval', ['/api/admin/ai', '/api/insights/summary']);
  const aiConn = conns.data?.find((c) => c.provider === 'ai_provider');
  const putKey = useAction<{ values: Record<string, string> }>('PUT', `/api/admin/integrations/${aiConn?.id}/secret`, ['/api/admin/ai']);
  const newVersion = useAction<{ key: string; body: string }>('POST', '/api/admin/ai/templates', ['/api/admin/ai']);
  if (q.isLoading || !f) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const edit = can('ai.manage');
  const active = d.templates.filter((x) => x.active);
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="ai.manage" />
      <Card>
        <CardHeader title={t('admin.aiStatus')} />
        <CardBody>
          <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
            <Badge tone={d.status.available ? 'pos' : 'neutral'}>{d.status.available ? t('admin.aiAvailable') : t('admin.aiUnavailable')}</Badge>
            {t(`admin.aiReason_${d.status.reason}`)}
          </p>
          <p className="mt-2 text-[12.5px] text-t2">{t('admin.aiDeterministic')}</p>
          <p className="mt-1 text-[12.5px] text-t2">{t('admin.aiDataPolicy')}</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.aiProvider')} subtitle={t('admin.aiProviderHint')} />
        <CardBody>
          <fieldset disabled={!edit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-3">
              <Switch checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={t('admin.aiEnabled')} description={t('admin.aiEnabledHint')} />
            </div>
            <Field label={t('admin.provider')} htmlFor="ai-prov">
              <Select id="ai-prov" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value as AiAdmin['settings']['provider'] })}>
                <option value="none">{t('admin.providerNone')}</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="azure_openai">Azure OpenAI</option>
              </Select>
            </Field>
            <Field label={t('admin.model')} htmlFor="ai-model" hint={MODEL_SUGGESTIONS[f.provider].length ? t('admin.modelHint', { list: MODEL_SUGGESTIONS[f.provider].join(', ') }) : undefined}>
              <Input id="ai-model" list="ai-models" value={f.model ?? ''} onChange={(e) => setF({ ...f, model: e.target.value || null })} />
              <datalist id="ai-models">
                {MODEL_SUGGESTIONS[f.provider].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label={t('admin.baseUrl')} htmlFor="ai-base" hint={t('admin.baseUrlHint')}>
              <Input id="ai-base" value={f.baseUrl ?? ''} placeholder="https://" onChange={(e) => setF({ ...f, baseUrl: e.target.value || null })} />
            </Field>
            <Field label={t('admin.maxOutputTokens')} htmlFor="ai-max">
              <Input id="ai-max" type="number" min={100} max={4000} value={f.maxOutputTokens} onChange={(e) => setF({ ...f, maxOutputTokens: Number(e.target.value) })} />
            </Field>
            <Field label={t('admin.temperature')} htmlFor="ai-temp">
              <Input id="ai-temp" type="number" min={0} max={1} step={0.1} value={f.temperature} onChange={(e) => setF({ ...f, temperature: Number(e.target.value) })} />
            </Field>
            <Field label={t('admin.monthlyBudget')} htmlFor="ai-budget" hint={t('admin.monthlyBudgetHint')}>
              <Input id="ai-budget" type="number" min={1000} value={f.monthlyTokenBudget ?? ''} onChange={(e) => setF({ ...f, monthlyTokenBudget: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
            <fieldset className="md:col-span-2">
              <legend className="mb-1 text-[13px] font-medium">{t('admin.allowedFeatures')}</legend>
              {['executive_summary'].map((x) => (
                <Checkbox key={x} checked={f.allowedFeatures.includes(x)} onChange={(c) => setF({ ...f, allowedFeatures: c ? [...f.allowedFeatures, x] : f.allowedFeatures.filter((y) => y !== x) })} label={t(`admin.feature_${x}`)} />
              ))}
            </fieldset>
            <Switch checked={f.requireHumanReview} onChange={(v) => setF({ ...f, requireHumanReview: v })} label={t('admin.humanReview')} description={t('admin.humanReviewHint')} />
          </fieldset>
          {edit && (
            <div className="mt-3 flex justify-end">
              <Button variant="primary" loading={save.pending} onClick={() => save.run({ enabled: f.enabled, provider: f.provider, model: f.model, baseUrl: f.baseUrl, maxOutputTokens: f.maxOutputTokens, temperature: f.temperature, monthlyTokenBudget: f.monthlyTokenBudget, allowedFeatures: f.allowedFeatures, requireHumanReview: f.requireHumanReview })}>
                {t('common.save')}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.aiKeyAndApproval')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-[13px]">{d.key.hasSecret ? t('admin.secretStored', { date: d.key.secretUpdatedAt ? formatDateTime(d.key.secretUpdatedAt, lang) : '—' }) : t('admin.secretNone')}</p>
              {edit && aiConn && (
                <div className="mt-2 flex items-end gap-2">
                  <Field label={t('admin.apiKey')} htmlFor="ai-key" hint={t('admin.writeOnly')}>
                    <Input id="ai-key" type="password" autoComplete="new-password" value={key} placeholder={d.key.hasSecret ? '••••••••' : ''} onChange={(e) => setKey(e.target.value)} />
                  </Field>
                  <Button disabled={!key.trim()} loading={putKey.pending} onClick={async () => (await putKey.run({ values: { apiKey: key.trim() } })) !== undefined && setKey('')}>
                    {t('common.save')}
                  </Button>
                </div>
              )}
            </div>
            <div>
              <p className="flex items-center gap-2 text-[13px]">
                {d.settings.externalProcessingApproved ? <ShieldCheck className="size-4 text-pos" aria-hidden /> : <ShieldOff className="size-4 text-t3" aria-hidden />}
                {d.settings.externalProcessingApproved ? t('admin.approvedOn', { date: d.settings.approvedAt ? formatDateTime(d.settings.approvedAt, lang) : '—' }) : t('admin.notApproved')}
              </p>
              {edit && (
                <div className="mt-2">
                  {d.settings.externalProcessingApproved ? (
                    <Button variant="ghost" icon={<ShieldOff className="size-3.5" />} onClick={() => approval.run({ approved: false })}>
                      {t('admin.revokeApproval')}
                    </Button>
                  ) : (
                    <Button icon={<ShieldCheck className="size-3.5" />} onClick={() => setApprove(true)}>
                      {t('admin.recordApproval')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.promptTemplates')} subtitle={t('admin.promptTemplatesHint')} />
        <CardBody>
          <ul className="flex flex-col gap-2">
            {active.map((x) => (
              <li key={x.id} className="rounded-lg border border-brd p-3 text-[12.5px]">
                <p className="flex flex-wrap items-center gap-2">
                  <code className="font-semibold">{x.key}</code>
                  <Badge>v{x.version}</Badge>
                  <span className="text-t3">{relativeTime(x.createdAt, lang)}</span>
                  {edit && (
                    <Button size="sm" variant="ghost" onClick={() => setTpl({ key: x.key, body: x.body })}>
                      {t('admin.newVersion')}
                    </Button>
                  )}
                </p>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-card2 p-2 whitespace-pre-wrap">{x.body}</pre>
              </li>
            ))}
          </ul>
          {tpl && (
            <div className="mt-3 flex flex-col gap-2">
              <Field label={t('admin.templateBody', { key: tpl.key })} htmlFor="tpl-body" hint={t('admin.templateBodyHint')}>
                <Textarea id="tpl-body" value={tpl.body} className="min-h-[160px] font-mono text-[12px]" onChange={(e) => setTpl({ ...tpl, body: e.target.value })} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setTpl(null)}>{t('common.cancel')}</Button>
                <Button variant="primary" loading={newVersion.pending} disabled={tpl.body.length < 20} onClick={async () => (await newVersion.run(tpl)) !== undefined && setTpl(null)}>
                  {t('admin.saveVersion')}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.aiExecutions')} subtitle={t('admin.aiExecutionsHint')} />
        <CardBody>
          <DataTable
            rows={d.executions}
            caption={t('admin.aiExecutions')}
            rowKey={(x) => x.id}
            empty={<p className="py-6 text-center text-[13px] text-t2">{t('admin.noExecutions')}</p>}
            columns={[
              { key: 'when', header: t('admin.when'), value: (x) => x.createdAt, unit: 'text', render: (x) => formatDateTime(x.createdAt, lang) },
              { key: 'purpose', header: t('admin.purpose'), value: (x) => x.purpose, unit: 'text' },
              { key: 'model', header: t('admin.model'), value: (x) => `${x.provider} ${x.model ?? ''}`, unit: 'text' },
              { key: 'status', header: t('common.status'), value: (x) => x.status, unit: 'text', render: (x) => <Badge tone={x.status === 'succeeded' ? 'pos' : 'neg'}>{x.status}</Badge> },
              { key: 'tokens', header: t('admin.tokens'), value: (x) => (x.inputTokens ?? 0) + (x.outputTokens ?? 0), unit: 'count' },
              { key: 'lat', header: t('admin.latency'), value: (x) => x.latencyMs, render: (x) => (x.latencyMs === null ? '—' : `${x.latencyMs} ms`), hideOnMobile: true },
            ]}
          />
          <p className="mt-2 text-[12px] text-t3">
            {t('admin.recSchedule')}{' '}
            <Link to="/admin?section=system" className="font-medium text-acctext hover:underline">
              {t('admin.schedulesLink')} →
            </Link>
          </p>
        </CardBody>
      </Card>
      <TypedConfirm
        open={approve}
        onClose={() => setApprove(false)}
        title={t('admin.recordApproval')}
        word="APPROVE"
        pending={approval.pending}
        body={<p>{t('admin.approvalBody', { provider: f.provider })}</p>}
        onConfirm={async (typed) => (await approval.run({ approved: true, confirmation: typed })) !== undefined && setApprove(false)}
      />
    </div>
  );
}

/* ---------------- system monitoring ---------------- */

export function SystemSection() {
  const { t, lang } = useI18n();
  const q = useApi<SystemInfo>('/api/admin/system', undefined, { refetchInterval: 30_000 });
  const retry = useAction<{ id: string }>('POST', (b) => `/api/admin/system/jobs/${b.id}/retry`, ['/api/admin/system']);
  const toggle = useAction<{ id: string; enabled: boolean }>('PATCH', (b) => `/api/admin/system/schedules/${b.id}`, ['/api/admin/system']);
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const jobs = Object.fromEntries(d.jobsByStatus.map((j) => [j.status, Number(j.n)]));
  const errors = d.systemEvents.filter((e) => e.level === 'error').length;
  const hours = Math.floor(d.health.uptimeSeconds / 3600);
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-lg border border-brd bg-card p-3">
          <span className="block text-[12.5px] text-t2">{t('admin.appHealth')}</span>
          <Badge tone={d.health.status === 'ok' ? 'pos' : 'neg'}>{d.health.status === 'ok' ? t('admin.ok') : t('admin.attention')}</Badge>
          <span className="mt-1 block text-[12px] text-t3">
            {t('admin.uptime', { h: hours })} · Node {d.health.node}
          </span>
        </div>
        <div className="rounded-lg border border-brd bg-card p-3">
          <span className="block text-[12.5px] text-t2">{t('admin.database')}</span>
          <span className="text-[16px] font-semibold">{d.health.database === 'pglite' ? t('admin.dbEmbedded') : 'PostgreSQL'}</span>
          <span className="block text-[12px] text-t3">{d.storage.databaseBytes !== null ? formatBytes(d.storage.databaseBytes) : '—'} · {t('admin.reportFiles', { size: formatBytes(d.storage.reportFilesBytes) })}</span>
        </div>
        <div className="rounded-lg border border-brd bg-card p-3">
          <span className="block text-[12.5px] text-t2">{t('admin.queue')}</span>
          <span className="text-[16px] font-semibold tnum">
            {jobs.queued ?? 0} / {jobs.running ?? 0} / {jobs.failed ?? 0}
          </span>
          <span className="block text-[12px] text-t3">{t('admin.queueLegend')} · {d.health.jobsEnabled ? t('admin.workerOn') : t('admin.workerOff')}</span>
        </div>
        <div className="rounded-lg border border-brd bg-card p-3">
          <span className="block text-[12.5px] text-t2">{t('admin.recentErrors')}</span>
          <span className="text-[22px] font-semibold tnum">{errors}</span>
          <span className="block text-[12px] text-t3">{t('admin.dataAsOf', { date: d.health.asOf })}</span>
        </div>
      </div>
      {d.health.database === 'pglite' && <p className="rounded-lg border border-warn/30 bg-warnsoft px-3 py-2 text-[13px]">{t('admin.pgliteWarning')}</p>}
      {d.rateLimited.length > 0 && (
        <Card>
          <CardHeader title={t('admin.rateLimitWarnings')} />
          <CardBody>
            <ul className="text-[13px]">
              {d.rateLimited.map((r) => (
                <li key={r.name}>
                  <span className="font-medium">{r.name}</span> — {r.lastError}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      <Card>
        <CardHeader title={t('admin.scheduledJobs')} subtitle={t('admin.scheduledJobsHint')} />
        <CardBody>
          <ul className="flex flex-col divide-y divide-brd text-[13px]">
            {d.schedules.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{s.name}</span> <code className="text-[11.5px] text-t3">{s.jobType}</code>
                  <span className="block text-[12px] text-t3">
                    {t('admin.lastRun')}
                    {t('common.colon')} {s.lastRunAt ? relativeTime(s.lastRunAt, lang) : t('admin.never')} · {t('reports.nextRun')}
                    {t('common.colon')} {s.nextRunAt ? formatDateTime(s.nextRunAt, lang) : '—'}
                  </span>
                </span>
                <Switch checked={s.enabled} onChange={(v) => toggle.run({ id: s.id, enabled: v })} label={`${t('common.enabled')}: ${s.name}`} hideLabel />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <div className="grid grid-cols-1 gap-[var(--gap-grid)] xl:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.recentJobs')} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-brd text-[12.5px]">
              {d.recentJobs.slice(0, 15).map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <code>{j.type}</code> <span className="text-t3">· {relativeTime(j.createdAt, lang)} · {j.attempts}/{j.maxAttempts}</span>
                    {j.lastError && <span className="block truncate text-neg">{j.lastError}</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <Badge tone={j.status === 'succeeded' ? 'pos' : j.status === 'failed' ? 'neg' : 'neutral'}>{j.status}</Badge>
                    {j.status === 'failed' && <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} aria-label={`${t('admin.retry')}: ${j.type}`} onClick={() => retry.run({ id: j.id })} />}
                  </span>
                </li>
              ))}
              {!d.recentJobs.length && <li className="py-2 text-t3">{t('admin.noJobs')}</li>}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('admin.errorLog')} subtitle={t('admin.errorLogHint')} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-brd text-[12.5px]">
              {d.systemEvents.map((e) => (
                <li key={e.id} className="py-1.5">
                  <Badge tone={e.level === 'error' ? 'neg' : e.level === 'warn' ? 'warn' : 'neutral'}>{e.level}</Badge> <code>{e.source}</code> — {e.message} <span className="text-t3">· {relativeTime(e.createdAt, lang)}</span>
                </li>
              ))}
              {!d.systemEvents.length && <li className="py-2 text-t3">{t('admin.noEvents')}</li>}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('admin.connectorHealth')} actions={<Link to="/admin?section=integrations" className="text-[13px] font-medium text-acctext hover:underline">{t('admin.integrations')} →</Link>} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-brd text-[12.5px]">
              {d.syncExecutions.slice(0, 12).map((x) => (
                <li key={x.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>
                    {x.connectionName ?? '—'} <span className="text-t3">· {x.kind} · {relativeTime(x.startedAt, lang)}</span>
                    {x.error && <span className="block text-neg">{x.error}</span>}
                  </span>
                  <Badge tone={x.status === 'succeeded' ? 'pos' : x.status === 'failed' ? 'neg' : 'neutral'}>{x.status}</Badge>
                </li>
              ))}
              {!d.syncExecutions.length && <li className="py-2 text-t3">{t('admin.noSyncs')}</li>}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('admin.failedImports')} actions={<Link to="/admin?section=data" className="text-[13px] font-medium text-acctext hover:underline">{t('admin.openDataManagement')} →</Link>} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-brd text-[12.5px]">
              {d.failedImports.map((x) => (
                <li key={x.id} className="py-1.5">
                  {x.fileName} <span className="text-t3">· {x.dataset} · {relativeTime(x.createdAt, lang)}</span> · {t('admin.rejectedCount', { n: x.rowsRejected })}
                </li>
              ))}
              {!d.failedImports.length && <li className="py-2 text-t3">{t('admin.noFailures')}</li>}
            </ul>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title={t('admin.freshnessTitle')} />
        <CardBody>
          <DataTable
            rows={d.datasets}
            caption={t('admin.freshnessTitle')}
            rowKey={(x) => x.id}
            dense
            columns={[
              { key: 'id', header: t('admin.dataset'), value: (x) => x.id, unit: 'text' },
              { key: 'origin', header: t('admin.origin'), value: (x) => x.origin, unit: 'text', render: (x) => <DataModeBadge mode={x.origin === 'demo' ? 'demo' : 'connected'} /> },
              { key: 'to', header: t('admin.coverage'), value: (x) => x.coverage?.to ?? '', unit: 'text', render: (x) => (x.coverage ? `${x.coverage.from} → ${x.coverage.to}` : '—') },
              { key: 'rows', header: t('admin.rows'), value: (x) => x.rows, unit: 'count' },
            ]}
          />
          <p className="mt-2 text-[12px] text-t3">{t('admin.notRealtime', { n: formatValue(d.datasets.length, 'count', lang) })}</p>
        </CardBody>
      </Card>
    </div>
  );
}
