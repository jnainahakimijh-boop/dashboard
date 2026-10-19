import clsx from 'clsx';
import { AlertTriangle, CalendarClock, Download, Eye, FileText, Lock, Mail, Play, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { L10n } from '@shared/catalog';
import type { Unit } from '@shared/metrics';
import { METRICS } from '@shared/metrics';
import { download } from '@/api/client';
import { useApi, useApiMutation } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatBytes, formatDate, formatDateTime, formatDelta, formatPct, formatRange, formatValue, relativeTime } from '@/lib/format';
import { useTab } from '@/lib/useTab';
import { useGlobalFilters } from '@/state/filters';
import { useSession } from '@/state/session';
import { TimeSeriesChart } from '@/components/charts';
import { DataModeBadge, useMetricLabel } from '@/components/data';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, ErrorState, Field, Input, Modal, MultiSelect, Select, Skeleton, Switch, TabPanel, Tabs, Textarea, useToast } from '@/components/ui';

const TABS = ['builder', 'history', 'schedules', 'templates'] as const;
type Tab = (typeof TABS)[number];
type Format = 'pdf' | 'xlsx' | 'csv';
type ReportType = 'executive' | 'website' | 'social' | 'seo' | 'geo' | 'ads' | 'content' | 'custom';

interface CatalogEntry {
  type: ReportType;
  sections: Array<{ id: string; label: L10n; required: boolean }>;
  defaultSections: string[];
  defaultKpis: string[];
}

interface ReportConfig {
  preset?: string;
  from?: string;
  to?: string;
  compare?: string;
  filters?: Record<string, string[]>;
  sections?: string[];
  metrics?: string[];
  chartMetrics?: string[];
  groupBy?: string;
  language?: 'en' | 'fr';
  title?: string;
  commentary?: string;
}

interface Template {
  id: string;
  type: ReportType;
  name: string;
  config: ReportConfig;
  createdBy: string | null;
  updatedAt: string;
}

interface Run {
  id: string;
  title: string;
  status: string;
  format: Format;
  fileName: string | null;
  sizeBytes: number | null;
  metadata: { type?: string; period?: { from: string; to: string }; dataModes?: string[] } | null;
  deliveryStatus: 'not_requested' | 'sent' | 'not_sent_no_provider' | 'failed';
  deliveryLog: Array<{ at: string; recipients: number; status: string; error: string | null; message: string | null }>;
  error: string | null;
  createdAt: string;
  scheduleId: string | null;
  createdByName: string | null;
}

type Frequency = { kind: 'daily'; time: string } | { kind: 'weekly'; weekday: number; time: string } | { kind: 'monthly'; day: number; time: string } | { kind: 'quarterly'; day: number; time: string };

interface Schedule {
  id: string;
  templateId: string;
  name: string;
  frequency: Frequency;
  frequencyLabel: L10n;
  format: Format;
  recipients: string[];
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  emailConfigured: boolean;
}

interface Preview {
  title: string;
  period: { from: string; to: string };
  comparePeriod: { from: string; to: string } | null;
  asOf: string;
  dataModes: string[];
  sources: string[];
  notes: string[];
  generatedBy: string;
  sections: Array<{
    id: string;
    title: string;
    appendix?: boolean;
    items?: Array<{ text: string; tone: 'positive' | 'negative' | 'neutral' | 'warning' }>;
    quote?: { author: string; body: string };
    kpis?: Array<{ metric: string; label: string; unit: Unit; value: number | null; compare: number | null; delta: number | null; deltaPct: number | null; showPct: boolean; mode: string; notes: string[] }>;
    tables?: Array<{ title: string; columns: Array<{ key: string; label: string; unit?: Unit | 'text' }>; rows: Array<Record<string, string | number | null>>; note?: string }>;
    charts?: Array<{ title: string; unit: Unit; points: Array<{ label: string; value: number | null; compare: number | null }> }>;
    text?: string[];
  }>;
}

const TYPE_ORDER: ReportType[] = ['executive', 'website', 'social', 'seo', 'geo', 'ads', 'content', 'custom'];

/* ---------------- preview ---------------- */

function ReportPreview({ p }: { p: Preview }) {
  const { t, lang } = useI18n();
  const fmt = (v: number | null, unit: Unit | 'text' | undefined) => (v === null ? '—' : formatValue(v, unit === 'text' ? undefined : unit, lang));
  const dot = { positive: 'bg-pos', negative: 'bg-neg', warning: 'bg-warn', neutral: 'bg-t3' } as const;
  return (
    <article aria-label={t('reports.previewOf', { title: p.title })} className="overflow-hidden rounded-lg border border-brd bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 bg-[var(--side-bg)] px-5 py-4 text-white">
        <div>
          <h3 className="text-[18px] font-semibold">{p.title}</h3>
          <p className="text-[12.5px] opacity-80">{formatRange(p.period, lang)}</p>
        </div>
        {p.dataModes.includes('demo') && <DataModeBadge mode="demo" />}
      </header>
      <div className="flex flex-col gap-5 px-5 py-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-[12.5px] text-t2 sm:grid-cols-2">
          <div>
            <dt className="inline text-t3">{t('common.period')}</dt>
            {t('common.colon')} <dd className="inline">{formatRange(p.period, lang)}</dd>
          </div>
          <div>
            <dt className="inline text-t3">{t('common.comparison')}</dt>
            {t('common.colon')} <dd className="inline">{p.comparePeriod ? formatRange(p.comparePeriod, lang) : t('common.none')}</dd>
          </div>
          <div>
            <dt className="inline text-t3">{t('common.freshness')}</dt>
            {t('common.colon')} <dd className="inline">{p.asOf}</dd>
          </div>
          <div>
            <dt className="inline text-t3">{t('common.sources')}</dt>
            {t('common.colon')} <dd className="inline">{p.sources.join(', ')}</dd>
          </div>
        </dl>
        {p.notes.map((n) => (
          <p key={n} className="rounded-md bg-warnsoft px-3 py-2 text-[12.5px] font-medium text-warn">
            {n}
          </p>
        ))}
        {p.sections.map((s) => (
          <section key={s.id} aria-labelledby={`pv-${s.id}`}>
            <h4 id={`pv-${s.id}`} className={clsx('mb-2 border-b border-brd pb-1 font-semibold', s.appendix ? 'text-[14px] text-t2' : 'text-[15px] text-t1')}>
              {s.title}
            </h4>
            {s.items && (
              <ul className="flex flex-col gap-1">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed">
                    <span className={clsx('mt-2 size-1.5 shrink-0 rounded-full', dot[it.tone])} aria-hidden />
                    {it.text}
                  </li>
                ))}
              </ul>
            )}
            {s.quote && (
              <blockquote className="border-l-2 border-brds pl-3 text-[13.5px]">
                <p className="whitespace-pre-line">{s.quote.body}</p>
                <footer className="mt-1 text-[12px] text-t3 italic">{t('reports.writtenBy', { name: s.quote.author })}</footer>
              </blockquote>
            )}
            {s.kpis && s.kpis.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <caption className="sr-only">{s.title}</caption>
                  <thead className="text-left text-t2">
                    <tr>
                      <th scope="col" className="py-1.5 pr-3 font-semibold">{t('reports.indicator')}</th>
                      <th scope="col" className="py-1.5 pr-3 text-right font-semibold">{t('common.value')}</th>
                      <th scope="col" className="py-1.5 pr-3 text-right font-semibold">{t('common.comparison')}</th>
                      <th scope="col" className="py-1.5 text-right font-semibold">{t('common.change')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.kpis.map((k) => (
                      <tr key={k.metric} className="border-t border-brd align-top">
                        <td className="py-1.5 pr-3">
                          {k.label}
                          {k.notes.length > 0 && <span className="block text-[11.5px] text-t3">{k.notes.join(' · ')}</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-right tnum">{fmt(k.value, k.unit)}</td>
                        <td className="py-1.5 pr-3 text-right tnum">{fmt(k.compare, k.unit)}</td>
                        <td className="py-1.5 text-right tnum">{k.delta === null ? '—' : k.showPct && k.deltaPct !== null ? formatPct(k.deltaPct, lang) : formatDelta(k.delta, k.unit, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.charts?.map((c) => (
              <div key={c.title} className="mt-3">
                <p className="mb-1 text-[12.5px] font-medium text-t2">{c.title}</p>
                <TimeSeriesChart
                  height={180}
                  ariaLabel={c.title}
                  series={[{ id: c.title, label: c.title, slot: 0, unit: c.unit, points: c.points.map((pt) => ({ key: pt.label, label: /^\d{4}-\d{2}-\d{2}$/.test(pt.label) ? formatDate(pt.label, lang, 'short') : pt.label, value: pt.value, compare: pt.compare })) }]}
                />
              </div>
            ))}
            {s.tables?.map((tb, i) => (
              <div key={i} className="mt-2 overflow-x-auto">
                {tb.title && <p className="mb-1 text-[12px] text-t3 italic">{tb.title}</p>}
                <table className="w-full text-[13px]">
                  <caption className="sr-only">{tb.title || s.title}</caption>
                  <thead className="text-left text-t2">
                    <tr>
                      {tb.columns.map((c) => (
                        <th key={c.key} scope="col" className={clsx('py-1.5 pr-3 font-semibold', c.unit && c.unit !== 'text' && 'text-right')}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tb.rows.slice(0, 15).map((r, j) => (
                      <tr key={j} className="border-t border-brd">
                        {tb.columns.map((c) => (
                          <td key={c.key} className={clsx('py-1.5 pr-3', c.unit && c.unit !== 'text' && 'text-right tnum')}>
                            {typeof r[c.key] === 'number' ? fmt(r[c.key] as number, c.unit) : (r[c.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tb.note && <p className="mt-1 text-[12px] text-t3">{tb.note}</p>}
              </div>
            ))}
            {s.text?.map((x) => (
              <p key={x} className="mt-2 text-[12.5px] text-t3 italic">
                {x}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}

/* ---------------- builder ---------------- */

function Builder({ initial }: { initial: Template | null }) {
  const { t, L, lang } = useI18n();
  const gf = useGlobalFilters();
  const toast = useToast();
  const labelOf = useMetricLabel();
  const catalog = useApi<CatalogEntry[]>('/api/reports/catalog');
  const [type, setType] = useState<ReportType>(initial?.type ?? 'executive');
  const [sections, setSections] = useState<string[] | null>(initial?.config.sections ?? null);
  const [kpis, setKpis] = useState<string[] | null>(initial?.config.metrics ?? null);
  const [charts, setCharts] = useState<string[]>(initial?.config.chartMetrics ?? []);
  const [language, setLanguage] = useState<'en' | 'fr'>(initial?.config.language ?? lang);
  const [title, setTitle] = useState(initial?.config.title ?? '');
  const [commentary, setCommentary] = useState(initial?.config.commentary ?? '');
  const [format, setFormat] = useState<Format>('pdf');
  const [saveName, setSaveName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewM = useApiMutation<{ type: ReportType; config: ReportConfig }, Preview>('POST', '/api/reports/preview');
  const generate = useApiMutation<{ type: ReportType; config: ReportConfig; format: Format }, Run>('POST', '/api/reports/generate', ['/api/reports/runs']);
  const saveTpl = useApiMutation<{ type: ReportType; name: string; config: ReportConfig }>('POST', '/api/reports/templates', ['/api/reports/templates']);

  useEffect(() => {
    if (!initial) return;
    setType(initial.type);
    setSections(initial.config.sections?.length ? initial.config.sections : null);
    setKpis(initial.config.metrics ?? null);
    setCharts(initial.config.chartMetrics ?? []);
    setLanguage(initial.config.language ?? lang);
    setTitle(initial.config.title ?? '');
    setCommentary(initial.config.commentary ?? '');
    if (initial.config.preset) gf.applyState({ preset: initial.config.preset as never, from: initial.config.from, to: initial.config.to, compare: initial.config.compare as never, filters: initial.config.filters });
    setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const entry = catalog.data?.find((c) => c.type === type);
  const curSections = sections ?? entry?.defaultSections ?? [];
  const curKpis = kpis ?? entry?.defaultKpis ?? [];
  const metricOptions = useMemo(() => METRICS.map((m) => ({ value: m.id, label: labelOf(m.id), group: m.module })), [labelOf]);
  const config = (): ReportConfig => ({
    preset: gf.preset,
    ...(gf.preset === 'custom' ? { from: gf.range.from, to: gf.range.to } : {}),
    compare: gf.compare,
    filters: gf.filters as Record<string, string[]>,
    sections: curSections,
    metrics: curKpis,
    chartMetrics: charts.length ? charts : undefined,
    language,
    title: title.trim() || undefined,
    commentary: commentary.trim() || undefined,
  });
  const run = async (kind: 'preview' | 'generate') => {
    try {
      if (kind === 'preview') setPreview(await previewM.mutateAsync({ type, config: config() }));
      else {
        const r = await generate.mutateAsync({ type, config: config(), format });
        toast(t('reports.generated'), 'pos');
        await download(`/api/reports/runs/${r.id}/download`, undefined, r.fileName ?? 'report');
      }
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  const save = async () => {
    try {
      await saveTpl.mutateAsync({ type, name: saveName.trim(), config: config() });
      toast(t('reports.templateSaved'), 'pos');
      setSaveOpen(false);
      setSaveName('');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  if (catalog.isLoading) return <Skeleton className="h-96" />;
  if (catalog.isError) return <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />;
  return (
    <div className="grid grid-cols-1 gap-[var(--gap-grid)] xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card>
        <CardHeader title={t('reports.builderTitle')} subtitle={t('reports.builderHint')} />
        <CardBody>
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium">{t('reports.type')}</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {TYPE_ORDER.map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    aria-pressed={type === ty}
                    onClick={() => (setType(ty), setSections(null), setKpis(null), setPreview(null))}
                    className={clsx('rounded-md border px-2.5 py-2 text-left text-[13px] transition-colors hover:border-brds', type === ty ? 'border-acc bg-accsoft font-medium text-t1' : 'border-brd')}
                  >
                    {t(`reports.type_${ty}`)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-t3">{t(`reports.typeHint_${type}`)}</p>
            </fieldset>
            <div className="rounded-md bg-card2 p-3 text-[12.5px] text-t2">
              <p className="font-medium text-t1">{t('reports.periodFromToolbar')}</p>
              <p className="tnum">
                {formatRange(gf.range, lang)} · {gf.compare === 'none' ? t('common.noComparison') : gf.compare === 'yoy' ? t('common.vsYoy') : t('common.vsPrevious')}
              </p>
              <p className="mt-1">{t('reports.periodShortcuts')}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(
                  [
                    ['last7', 'weekly'],
                    ['prevMonth', 'monthly'],
                    ['prevQuarter', 'quarterly'],
                  ] as const
                ).map(([p, k]) => (
                  <Button key={p} size="sm" variant={gf.preset === p ? 'primary' : 'secondary'} onClick={() => gf.setPreset(p)}>
                    {t(`reports.period_${k}`)}
                  </Button>
                ))}
              </div>
            </div>
            <fieldset>
              <legend className="mb-1 text-[13px] font-medium">{t('reports.sections')}</legend>
              {type === 'executive' && <p className="mb-1 text-[12px] text-t3">{t('reports.executiveStructure')}</p>}
              <div className="flex flex-col">
                {entry?.sections.map((s) => (
                  <Checkbox
                    key={s.id}
                    checked={s.required || curSections.includes(s.id)}
                    disabled={s.required}
                    onChange={(c) => setSections(c ? [...curSections, s.id] : curSections.filter((x) => x !== s.id))}
                    label={
                      <span className="inline-flex items-center gap-1">
                        {L(s.label)}
                        {s.required && <Lock className="size-3 text-t3" aria-label={t('reports.required')} />}
                      </span>
                    }
                  />
                ))}
              </div>
            </fieldset>
            <MultiSelect label={t('reports.kpis')} placeholderAll={t('reports.defaultKpis')} options={metricOptions} value={curKpis} onChange={(v) => setKpis(v.slice(0, 30))} />
            <MultiSelect label={t('reports.charts')} placeholderAll={t('reports.defaultCharts')} options={metricOptions} value={charts} onChange={(v) => setCharts(v.slice(0, 6))} />
            <p className="-mt-2 text-[12px] text-t3">{t('reports.chartsHint')}</p>
            <Field label={t('reports.reportTitle')} htmlFor="rb-title" hint={t('reports.reportTitleHint')}>
              <Input id="rb-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label={t('reports.commentary')} htmlFor="rb-comment" hint={t('reports.commentaryHint')}>
              <Textarea id="rb-comment" value={commentary} maxLength={4000} onChange={(e) => setCommentary(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('reports.language')} htmlFor="rb-lang">
                <Select id="rb-lang" value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'fr')}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <Field label={t('reports.format')} htmlFor="rb-format">
                <Select id="rb-format" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                  <option value="pdf">PDF</option>
                  <option value="xlsx">XLSX</option>
                  <option value="csv">CSV</option>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Eye className="size-3.5" />} loading={previewM.isPending} onClick={() => run('preview')}>
                {t('reports.preview')}
              </Button>
              <Button variant="primary" icon={<Download className="size-3.5" />} loading={generate.isPending} onClick={() => run('generate')}>
                {t('reports.generate')}
              </Button>
              <Button variant="ghost" icon={<Save className="size-3.5" />} onClick={() => (setSaveName(title || t(`reports.type_${type}`)), setSaveOpen(true))}>
                {t('reports.saveTemplate')}
              </Button>
            </div>
            <p className="text-[12px] text-t3">{t('reports.pngHint')}</p>
          </div>
        </CardBody>
      </Card>
      <div className="min-w-0">
        {preview ? (
          <ReportPreview p={preview} />
        ) : (
          <Card>
            <CardBody>
              <EmptyState icon={<FileText className="size-6" />} title={t('reports.noPreview')} hint={t('reports.noPreviewHint')} />
            </CardBody>
          </Card>
        )}
      </div>
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={t('reports.saveTemplate')}
        size="sm"
        footer={
          <>
            <Button onClick={() => setSaveOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={saveName.trim().length < 2} loading={saveTpl.isPending} onClick={save}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('common.name')} htmlFor="tpl-name" hint={t('reports.saveTemplateHint')}>
          <Input id="tpl-name" value={saveName} maxLength={120} onChange={(e) => setSaveName(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

/* ---------------- history ---------------- */

function DeliveryBadge({ run }: { run: Run }) {
  const { t } = useI18n();
  switch (run.deliveryStatus) {
    case 'sent':
      return (
        <Badge tone="pos">
          <Mail className="size-3" aria-hidden /> {t('reports.delivery_sent')}
        </Badge>
      );
    case 'not_sent_no_provider':
      return (
        <Badge tone="warn" title={t('reports.noProviderHint')}>
          <AlertTriangle className="size-3" aria-hidden /> {t('reports.delivery_not_sent_no_provider')}
        </Badge>
      );
    case 'failed':
      return (
        <Badge tone="neg">
          <AlertTriangle className="size-3" aria-hidden /> {t('reports.delivery_failed')}
        </Badge>
      );
    default:
      return <span className="text-t3">{t('reports.delivery_not_requested')}</span>;
  }
}

function History() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const q = useApi<Run[]>('/api/reports/runs');
  const dl = async (r: Run) => {
    try {
      await download(`/api/reports/runs/${r.id}/download`, undefined, r.fileName ?? 'report');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  if (q.isLoading) return <Skeleton className="h-72" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <Card>
      <CardHeader title={t('reports.historyTitle')} subtitle={t('reports.historyHint')} />
      <CardBody>
        <DataTable
          rows={q.data ?? []}
          caption={t('reports.historyTitle')}
          rowKey={(r) => r.id}
          initialSort={{ key: 'created', desc: true }}
          empty={<EmptyState title={t('reports.noRuns')} />}
          columns={[
            {
              key: 'title',
              header: t('reports.report'),
              value: (r) => r.title,
              unit: 'text',
              render: (r) => (
                <span className="flex flex-col">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-[12px] text-t3">
                    {r.metadata?.period ? formatRange(r.metadata.period, lang) : '—'} {r.metadata?.dataModes?.includes('demo') && <DataModeBadge mode="demo" />}
                  </span>
                  {r.error && <span className="text-[12px] text-neg">{r.error}</span>}
                </span>
              ),
            },
            { key: 'format', header: t('reports.format'), value: (r) => r.format.toUpperCase(), unit: 'text' },
            { key: 'created', header: t('reports.generatedAt'), value: (r) => r.createdAt, unit: 'text', render: (r) => <span title={formatDateTime(r.createdAt, lang)}>{relativeTime(r.createdAt, lang)}</span> },
            { key: 'by', header: t('reports.by'), value: (r) => r.createdByName ?? (r.scheduleId ? t('reports.bySchedule') : '—'), unit: 'text', hideOnMobile: true },
            { key: 'size', header: t('reports.size'), value: (r) => r.sizeBytes, render: (r) => formatBytes(r.sizeBytes), hideOnMobile: true },
            { key: 'delivery', header: t('reports.delivery'), value: (r) => r.deliveryStatus, unit: 'text', render: (r) => <DeliveryBadge run={r} /> },
            {
              key: 'dl',
              header: '',
              value: () => null,
              sortable: false,
              render: (r) =>
                r.status === 'failed' ? (
                  <Badge tone="neg">{t('reports.failed')}</Badge>
                ) : (
                  <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} onClick={() => dl(r)} aria-label={`${t('common.download')}: ${r.title}`}>
                    {t('common.download')}
                  </Button>
                ),
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

/* ---------------- schedules ---------------- */

const EMPTY_SCHEDULE = { name: '', templateId: '', kind: 'monthly' as Frequency['kind'], time: '08:00', weekday: 0, day: 2, format: 'pdf' as Format, recipients: '', enabled: true };

function ScheduleModal({ open, onClose, editing, templates }: { open: boolean; onClose: () => void; editing: Schedule | null; templates: Template[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState(EMPTY_SCHEDULE);
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const fr = editing.frequency;
      setF({ name: editing.name, templateId: editing.templateId, kind: fr.kind, time: fr.time, weekday: fr.kind === 'weekly' ? fr.weekday : 0, day: fr.kind === 'monthly' || fr.kind === 'quarterly' ? fr.day : 2, format: editing.format, recipients: editing.recipients.join('\n'), enabled: editing.enabled });
    } else setF({ ...EMPTY_SCHEDULE, templateId: templates[0]?.id ?? '' });
  }, [open, editing, templates]);
  const save = useApiMutation<Record<string, unknown>>(editing ? 'PATCH' : 'POST', editing ? `/api/reports/schedules/${editing.id}` : '/api/reports/schedules', ['/api/reports/schedules']);
  const recipients = f.recipients.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const invalid = recipients.filter((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  const frequency = (): Frequency => (f.kind === 'daily' ? { kind: 'daily', time: f.time } : f.kind === 'weekly' ? { kind: 'weekly', weekday: f.weekday, time: f.time } : { kind: f.kind, day: f.day, time: f.time });
  const submit = async () => {
    try {
      await save.mutateAsync({ name: f.name.trim(), templateId: f.templateId, frequency: frequency(), format: f.format, recipients, enabled: f.enabled });
      toast(t('common.saved'), 'pos');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  const days = t('reports.weekdays').split(',');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('reports.editSchedule') : t('reports.newSchedule')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={f.name.trim().length < 2 || !f.templateId || invalid.length > 0} loading={save.isPending} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t('common.name')} htmlFor="sc-name" required>
            <Input id="sc-name" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('reports.template')} htmlFor="sc-tpl" required>
            <Select id="sc-tpl" value={f.templateId} onChange={(e) => setF({ ...f, templateId: e.target.value })}>
              {templates.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({t(`reports.type_${x.type}`)})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t('reports.frequency')} htmlFor="sc-kind">
          <Select id="sc-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Frequency['kind'] })}>
            {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map((k) => (
              <option key={k} value={k}>
                {t(`reports.freq_${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('reports.time')} htmlFor="sc-time" hint="Europe/Paris">
          <Input id="sc-time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </Field>
        {f.kind === 'weekly' && (
          <Field label={t('reports.weekday')} htmlFor="sc-wd">
            <Select id="sc-wd" value={f.weekday} onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })}>
              {days.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {(f.kind === 'monthly' || f.kind === 'quarterly') && (
          <Field label={t('reports.dayOfMonth')} htmlFor="sc-day" hint={f.kind === 'quarterly' ? t('reports.quarterlyHint') : undefined}>
            <Input id="sc-day" type="number" min={1} max={28} value={f.day} onChange={(e) => setF({ ...f, day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} />
          </Field>
        )}
        <Field label={t('reports.format')} htmlFor="sc-format">
          <Select id="sc-format" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value as Format })}>
            <option value="pdf">PDF</option>
            <option value="xlsx">XLSX</option>
            <option value="csv">CSV</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('reports.recipients')} htmlFor="sc-rcp" hint={t('reports.recipientsHint')} error={invalid.length ? t('reports.invalidEmails', { list: invalid.join(', ') }) : undefined}>
            <Textarea id="sc-rcp" value={f.recipients} onChange={(e) => setF({ ...f, recipients: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Switch checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={t('common.enabled')} />
        </div>
      </div>
    </Modal>
  );
}

function Schedules() {
  const { t, lang, L } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const q = useApi<Schedule[]>('/api/reports/schedules');
  const tpls = useApi<Template[]>('/api/reports/templates');
  const [modal, setModal] = useState<{ open: boolean; editing: Schedule | null }>({ open: false, editing: null });
  const runNow = useApiMutation<{ id: string }, { delivery: string }>('POST', (b) => `/api/reports/schedules/${b.id}/run`, ['/api/reports/runs', '/api/reports/schedules']);
  const del = useApiMutation<{ id: string }>('DELETE', (b) => `/api/reports/schedules/${b.id}`, ['/api/reports/schedules']);
  const toggle = useApiMutation<{ id: string; enabled: boolean }>('PATCH', (b) => `/api/reports/schedules/${b.id}`, ['/api/reports/schedules']);
  const manage = can('reports.schedule');
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok, 'pos');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  if (q.isLoading) return <Skeleton className="h-72" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const emailConfigured = q.data?.[0]?.emailConfigured ?? false;
  return (
    <>
      {!emailConfigured && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warnsoft px-3 py-2 text-[13px] text-t1">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          {t('reports.noProviderBanner')}
        </p>
      )}
      <Card>
        <CardHeader
          title={t('reports.schedulesTitle')}
          subtitle={t('reports.schedulesHint')}
          actions={
            manage && (
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setModal({ open: true, editing: null })}>
                {t('reports.newSchedule')}
              </Button>
            )
          }
        />
        <CardBody>
          {!q.data?.length ? (
            <EmptyState icon={<CalendarClock className="size-6" />} title={t('reports.noSchedules')} />
          ) : (
            <ul className="flex flex-col divide-y divide-brd">
              {q.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                      {s.name}
                      <Badge tone={s.enabled ? 'pos' : 'neutral'}>{s.enabled ? t('common.enabled') : t('common.disabled')}</Badge>
                      <Badge>{s.format.toUpperCase()}</Badge>
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-t2">
                      {L(s.frequencyLabel)} · {tpls.data?.find((x) => x.id === s.templateId)?.name ?? '—'}
                    </p>
                    <p className="mt-0.5 text-[12px] text-t3 tnum">
                      {t('reports.nextRun')}
                      {t('common.colon')} {s.nextRunAt ? formatDateTime(s.nextRunAt, lang) : '—'} · {t('reports.recipientsCount', { n: s.recipients.length })}
                    </p>
                  </div>
                  {manage && (
                    <div className="flex flex-wrap items-center gap-1">
                      <Switch checked={s.enabled} onChange={(v) => act(() => toggle.mutateAsync({ id: s.id, enabled: v }), t('common.saved'))} label={`${t('common.enabled')}: ${s.name}`} hideLabel />
                      <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} loading={runNow.isPending && runNow.variables?.id === s.id} onClick={() => act(() => runNow.mutateAsync({ id: s.id }), emailConfigured ? t('reports.ranNow') : t('reports.ranNowNoEmail'))}>
                        {t('reports.runNow')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, editing: s })}>
                        {t('common.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label={`${t('common.delete')}: ${s.name}`} onClick={() => window.confirm(t('common.areYouSure')) && act(() => del.mutateAsync({ id: s.id }), t('common.saved'))} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      {manage && <ScheduleModal open={modal.open} editing={modal.editing} templates={tpls.data ?? []} onClose={() => setModal({ open: false, editing: null })} />}
    </>
  );
}

/* ---------------- templates ---------------- */

function Templates({ onLoad }: { onLoad: (t: Template) => void }) {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const q = useApi<Template[]>('/api/reports/templates');
  const del = useApiMutation<{ id: string }>('DELETE', (b) => `/api/reports/templates/${b.id}`, ['/api/reports/templates']);
  const gen = useApiMutation<{ templateId: string; format: Format }, Run>('POST', '/api/reports/generate', ['/api/reports/runs']);
  const generate = async (tpl: Template, format: Format) => {
    try {
      const r = await gen.mutateAsync({ templateId: tpl.id, format });
      await download(`/api/reports/runs/${r.id}/download`, undefined, r.fileName ?? 'report');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  if (q.isLoading) return <Skeleton className="h-72" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <Card>
      <CardHeader title={t('reports.templatesTitle')} subtitle={t('reports.templatesHint')} />
      <CardBody>
        <DataTable
          rows={q.data ?? []}
          caption={t('reports.templatesTitle')}
          rowKey={(x) => x.id}
          columns={[
            { key: 'name', header: t('common.name'), value: (x) => x.name, unit: 'text', render: (x) => <span className="font-medium">{x.name}</span> },
            { key: 'type', header: t('reports.type'), value: (x) => t(`reports.type_${x.type}`), unit: 'text' },
            { key: 'period', header: t('common.period'), value: (x) => x.config.preset ?? '', unit: 'text', render: (x) => t(`reports.preset_${x.config.preset ?? 'last30'}`), hideOnMobile: true },
            { key: 'updated', header: t('common.updated'), value: (x) => x.updatedAt, unit: 'text', render: (x) => relativeTime(x.updatedAt, lang), hideOnMobile: true },
            {
              key: 'act',
              header: '',
              value: () => null,
              sortable: false,
              render: (x) => (
                <span className="flex flex-wrap justify-end gap-1">
                  {can('reports.create') && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => onLoad(x)}>
                        {t('reports.openInBuilder')}
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} loading={gen.isPending && gen.variables?.templateId === x.id} onClick={() => generate(x, 'pdf')}>
                        PDF
                      </Button>
                    </>
                  )}
                  {can('reports.schedule') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="size-3.5" />}
                      aria-label={`${t('common.delete')}: ${x.name}`}
                      onClick={async () => {
                        if (!window.confirm(t('common.areYouSure'))) return;
                        try {
                          await del.mutateAsync({ id: x.id });
                        } catch (e) {
                          toast((e as Error).message, 'neg');
                        }
                      }}
                    />
                  )}
                </span>
              ),
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

export default function ReportsPage() {
  const { t } = useI18n();
  const { can } = useSession();
  const canCreate = can('reports.create');
  const tabs = TABS.filter((x) => canCreate || x === 'history' || x === 'schedules');
  const [tab, setTab] = useTab<Tab>(tabs, canCreate ? 'builder' : 'history');
  const [loaded, setLoaded] = useState<Template | null>(null);
  return (
    <>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} crumbs={[{ label: t('nav.reports') }]} />
      {tab === 'builder' && <FilterToolbar />}
      <PageBody>
        {!canCreate && <p className="rounded-lg border border-brd bg-card px-3 py-2 text-[13px] text-t2">{t('reports.viewerNote')}</p>}
        <Tabs label={t('reports.title')} value={tab} onChange={setTab} tabs={tabs.map((id) => ({ id, label: t(`reports.tab_${id}`) }))} />
        <TabPanel id={tab}>
          <div className="flex flex-col gap-[var(--gap-grid)]">
            {tab === 'builder' && <Builder initial={loaded} />}
            {tab === 'history' && <History />}
            {tab === 'schedules' && <Schedules />}
            {tab === 'templates' && (
              <Templates
                onLoad={(x) => {
                  setLoaded({ ...x });
                  setTab('builder');
                }}
              />
            )}
          </div>
        </TabPanel>
      </PageBody>
    </>
  );
}

