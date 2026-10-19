/** Reusable analytics blocks shared by every module page. */
import { Download } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { defaultGranularity, type Granularity } from '@shared/calendar';
import type { DimensionId, Filters } from '@shared/filters';
import { getMetric, type Unit } from '@shared/metrics';
import { useAnalytics, useMeta } from '@/api/hooks';
import type { Meta } from '@/api/types';
import { useI18n } from '@/i18n';
import { formatRange } from '@/lib/format';
import { spec, toSeries } from '@/lib/query';
import { useGlobalFilters } from '@/state/filters';
import { BarList, TimeSeriesChart, exportChartPng } from '@/components/charts';
import { DataModeBadge, MetricInfo, ResultNotes, SourceLine, useMetricLabel } from '@/components/data';
import { KpiCard } from '@/components/kpi/KpiCard';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, IconButton, Segmented, Skeleton } from '@/components/ui';

export function KpiRow({ metrics, filters, columns = 4 }: { metrics: string[]; filters?: Filters; columns?: 3 | 4 | 5 }) {
  const gf = useGlobalFilters();
  const q = useAnalytics(spec(gf, metrics, { granularity: 'auto', filters }));
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className={columns === 5 ? 'grid grid-cols-1 gap-[var(--gap-grid)] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5' : columns === 3 ? 'grid grid-cols-1 gap-[var(--gap-grid)] sm:grid-cols-2 lg:grid-cols-3' : 'grid grid-cols-1 gap-[var(--gap-grid)] sm:grid-cols-2 xl:grid-cols-4'}>
      {metrics.map((m) => (
        <KpiCard key={m} result={q.data?.results.find((r) => r.metric === m)} compare={gf.compare} loading={q.isLoading} />
      ))}
    </div>
  );
}

export function TrendCard({ title, subtitle, metrics, filters, height = 260 }: { title: string; subtitle?: string; metrics: string[]; filters?: Filters; height?: number }) {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const labelOf = useMetricLabel();
  const [g, setG] = useState<Granularity>(defaultGranularity(gf.range));
  const ref = useRef<HTMLDivElement>(null);
  const q = useAnalytics(spec(gf, metrics, { granularity: g, filters }));
  const results = q.data?.results ?? [];
  const units = new Set(results.map((r) => getMetric(r.metric)!.unit));
  const series = results.map((r, i) => toSeries(r, labelOf(r.metric), i, getMetric(r.metric)!.unit, g, lang));
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        badges={
          <>
            <DataModeBadge mode={results[0]?.meta.mode} />
            <ResultNotes meta={results[0]?.meta} />
          </>
        }
        actions={
          <>
            <Segmented size="sm" label={t('overview.granularity')} value={g} onChange={setG} options={(['day', 'week', 'month'] as const).map((x) => ({ value: x, label: t(`overview.${x}`) }))} />
            <IconButton label={t('common.exportPng')} onClick={() => exportChartPng(ref.current, title)}>
              <Download className="size-4" />
            </IconButton>
          </>
        }
      />
      <CardBody>
        <div ref={ref}>
          {q.isLoading ? (
            <Skeleton className="w-full" />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : units.size > 1 ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {series.map((s) => (
                <div key={s.id}>
                  <p className="mb-1 text-[13px] font-medium">{s.label}</p>
                  <TimeSeriesChart series={[s]} height={height - 60} showCompare={gf.compare !== 'none'} compareLabel={t(gf.compare === 'yoy' ? 'common.vsYoy' : 'common.vsPrevious')} ariaLabel={s.label} />
                </div>
              ))}
            </div>
          ) : (
            <TimeSeriesChart series={series} height={height} showCompare={gf.compare !== 'none' && series.length === 1} compareLabel={t(gf.compare === 'yoy' ? 'common.vsYoy' : 'common.vsPrevious')} ariaLabel={title} showLegend={series.length > 1} />
          )}
        </div>
        <div className="mt-2">
          <SourceLine meta={results[0]?.meta} />
        </div>
      </CardBody>
    </Card>
  );
}

/** Dimension label resolver shared by breakdowns. */
export function useDimLabel() {
  const { L } = useI18n();
  const meta = useMeta();
  return (dim: DimensionId, key: string): string => dimLabel(meta.data, L, dim, key);
}

const AD_CATEGORY_LABELS: Record<string, { en: string; fr: string }> = {
  industries: { en: 'Industries', fr: 'Industries' },
  collectivities: { en: 'Collectivities', fr: 'Collectivités' },
};

export function dimLabel(m: Meta | undefined, L: (v: never) => string, dim: DimensionId, key: string): string {
  const Lx = L as (v: unknown) => string;
  if (!m) return key;
  switch (dim) {
    case 'site':
      return m.sites.find((s) => s.key === key)?.name ?? key;
    case 'country':
      return Lx(m.catalog.countries.find((c) => c.id === key)?.name) || key;
    case 'region':
      return Lx(m.catalog.regions.find((c) => c.id === key)?.name) || key;
    case 'channel':
      return Lx(m.catalog.channels.find((c) => c.id === key)?.name) || key;
    case 'device':
      return Lx(m.catalog.devices.find((c) => c.id === key)?.name) || key;
    case 'campaign':
      return Lx(m.campaigns.find((c) => c.key === key || c.utm === key)?.name) || key;
    case 'bu':
      return Lx(m.catalog.businessUnits.find((c) => c.id === key)?.name) || key;
    case 'language':
    case 'userLanguage':
      return Lx(m.catalog.languages[key]) || key;
    case 'account':
      return m.accounts.find((a) => a.key === key)?.name ?? key;
    case 'platform':
      return m.catalog.platforms.find((p) => p.id === key)?.name ?? key;
    case 'page':
    case 'query':
      return key.split(':').slice(1).join(':') || key;
    case 'topic':
      return Lx(m.taxonomy.find((x) => x.kind === 'topic' && x.key === key)?.label) || key;
    case 'form':
      return Lx(m.catalog.forms.find((f) => f.id === key)?.name) || key;
    case 'adCampaign':
      return m.catalog.adCampaigns.find((c) => c.id === key)?.name ?? key;
    case 'adGroup':
      return m.catalog.adGroups.find((c) => c.id === key)?.name ?? key;
    case 'ad':
      return m.catalog.ads.find((c) => c.id === key)?.name ?? key;
    case 'adCategory':
      return Lx(AD_CATEGORY_LABELS[key]) || key;
    default:
      return key;
  }
}

export function BreakdownCard({ title, subtitle, metric, groupBy, filters, limit = 10, slot = 0 }: { title: string; subtitle?: string; metric: string; groupBy: DimensionId; filters?: Filters; limit?: number; slot?: number }) {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const lbl = useDimLabel();
  const labelOf = useMetricLabel();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const q = useAnalytics(spec(gf, [metric], { groupBy, filters }));
  const r = q.data?.results[0];
  const unit = getMetric(metric)!.unit;
  const rows = (r?.rows ?? []).map((x) => ({ key: x.key, label: lbl(groupBy, x.key), value: x.value, compare: x.compare }));
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle ?? labelOf(metric)}
        badges={
          <>
            <DataModeBadge mode={r?.meta.mode} />
            <ResultNotes meta={r?.meta} />
          </>
        }
        actions={<Segmented size="sm" label={title} value={view} onChange={setView} options={[{ value: 'chart', label: t('common.chartView') }, { value: 'table', label: t('common.tableView') }]} />}
      />
      <CardBody>
        {q.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !rows.length ? (
          <EmptyState />
        ) : view === 'chart' ? (
          <BarList unit={unit} slot={slot} ariaLabel={title} items={rows.slice(0, limit)} showDelta={gf.compare !== 'none'} />
        ) : (
          <DataTable
            caption={title}
            rows={rows}
            exportTitle={title}
            exportMeta={[['Period', formatRange(gf.range, lang)], ['Metric', labelOf(metric)], ['Data mode', r?.meta.mode ?? '']]}
            initialSort={{ key: 'value', desc: true }}
            pageSize={10}
            columns={[
              { key: 'label', header: t(`filters.dim_${groupBy}`) === `filters.dim_${groupBy}` ? groupBy : t(`filters.dim_${groupBy}`), value: (x) => x.label, unit: 'text' },
              { key: 'value', header: labelOf(metric), value: (x) => x.value, unit },
              { key: 'compare', header: t('common.comparison'), value: (x) => x.compare, unit, hideOnMobile: true },
            ]}
          />
        )}
      </CardBody>
    </Card>
  );
}

/** Multi-metric table by one dimension (e.g. channels × sessions, engagement rate, key events). */
export function BreakdownTable({ title, subtitle, metrics, groupBy, filters, dimHeader, pageSize = 12, actions }: { title: string; subtitle?: string; metrics: string[]; groupBy: DimensionId; filters?: Filters; dimHeader: string; pageSize?: number; actions?: ReactNode }) {
  const { lang } = useI18n();
  const gf = useGlobalFilters();
  const lbl = useDimLabel();
  const labelOf = useMetricLabel();
  const q = useAnalytics(spec(gf, metrics, { groupBy, filters }));
  const results = q.data?.results ?? [];
  const keys = [...new Set(results.flatMap((r) => r.rows?.map((x) => x.key) ?? []))];
  type Row = { key: string; label: string; v: Record<string, { value: number | null; compare: number | null }> };
  const rows: Row[] = keys.map((k) => ({ key: k, label: lbl(groupBy, k), v: Object.fromEntries(results.map((r) => [r.metric, { value: r.rows?.find((x) => x.key === k)?.value ?? null, compare: r.rows?.find((x) => x.key === k)?.compare ?? null }])) }));
  const cols: Column<Row>[] = [
    { key: 'label', header: dimHeader, value: (x) => x.label, unit: 'text' },
    ...metrics.map((m): Column<Row> => ({ key: m, header: labelOf(m), value: (x) => x.v[m]?.value ?? null, unit: getMetric(m)!.unit as Unit })),
  ];
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        badges={
          <>
            <DataModeBadge mode={results[0]?.meta.mode} />
            {results.map((r) => (
              <ResultNotes key={r.metric} meta={r.meta} />
            ))}
          </>
        }
        actions={
          <>
            {actions}
            {metrics.slice(0, 1).map((m) => (
              <MetricInfo key={m} metric={m} meta={results[0]?.meta} />
            ))}
          </>
        }
      />
      <CardBody>
        {q.isLoading ? <Skeleton className="h-48 w-full" /> : q.isError ? <ErrorState error={q.error} /> : <DataTable caption={title} rows={rows} columns={cols} exportTitle={title} exportMeta={[['Period', formatRange(gf.range, lang)], ['Data mode', results[0]?.meta.mode ?? '']]} initialSort={{ key: metrics[0], desc: true }} pageSize={pageSize} />}
        <div className="mt-2">
          <SourceLine meta={results[0]?.meta} />
        </div>
      </CardBody>
    </Card>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-[var(--gap-grid)] xl:grid-cols-2">{children}</div>;
}

