/** Executive Overview — sections A (filters) to H (AI summary), composed from the admin-configured layout. */
import clsx from 'clsx';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Download, Map as MapIcon, Settings2, Sparkles } from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { defaultGranularity, type Granularity } from '@shared/calendar';
import { METRICS, getMetric, type Unit } from '@shared/metrics';
import { api, toQuery } from '@/api/client';
import { useAnalytics, useApi, useMeta } from '@/api/hooks';
import type { AlertEvent, ExecutiveSummary, SummaryItem, WidgetConfig } from '@/api/types';
import { useI18n } from '@/i18n';
import { formatDate, formatPct, formatRange, formatValue, relativeTime } from '@/lib/format';
import { spec, toSeries } from '@/lib/query';
import { useGlobalFilters } from '@/state/filters';
import { useSession } from '@/state/session';
import { BarList, Panels, TimeSeriesChart, exportChartPng, type Series } from '@/components/charts';
import { DataModeBadge, MetricInfo, ResultNotes, SourceLine, useMetricLabel } from '@/components/data';
import { ChangeLabel, KpiCard } from '@/components/kpi/KpiCard';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, IconButton, MultiSelect, Segmented, Skeleton, severityTone, useToast } from '@/components/ui';

const WorldMap = lazy(() => import('@/components/charts/WorldMap'));

/* ---------------- B. KPI cards ---------------- */

interface Target {
  metricId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
}

function KpiGrid({ metrics }: { metrics: string[] }) {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const nav = useNavigate();
  const q = useAnalytics(spec(gf, metrics, { granularity: 'auto' }));
  const targets = useApi<Target[]>('/api/insights/targets');
  const targetFor = (m: string) => {
    const tg = targets.data?.find((x) => x.metricId === m && x.periodStart === gf.range.from && gf.range.to <= x.periodEnd);
    return tg ? { value: tg.value, periodLabel: formatRange({ from: tg.periodStart, to: tg.periodEnd }, lang) } : null;
  };
  const moduleOf: Record<string, string> = { web: '/web', search: '/seo', social: '/social', ads: '/ads', geo: '/geo', forms: '/web?tab=conversions' };
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <section aria-labelledby="kpis-title">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 id="kpis-title" className="text-[15px] font-semibold">
            {t('overview.kpis')}
          </h2>
          <p className="text-[12.5px] text-t2">{t('overview.kpisHint')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-[var(--gap-grid)] sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => {
          const r = q.data?.results.find((x) => x.metric === m);
          const mod = getMetric(m)?.module;
          return <KpiCard key={m} result={r} compare={gf.compare} loading={q.isLoading} target={targetFor(m)} onClick={mod ? () => nav(`${moduleOf[mod]}${moduleOf[mod].includes('?') ? '&' : '?'}${toQuery(gf.params as Record<string, string>)}`) : undefined} />;
        })}
      </div>
    </section>
  );
}

/* ---------------- C. Evolution ---------------- */

const EVOLUTION_CHOICES = METRICS.filter((m) => !m.internal && (m.executive || ['social_engagements', 'ads_ga_sessions', 'views', 'engaged_sessions', 'social_link_clicks'].includes(m.id)) && m.agg.kind !== 'custom').map((m) => m.id);

function Evolution({ initial }: { initial: string[] }) {
  const { t, lang, L } = useI18n();
  const gf = useGlobalFilters();
  const labelOf = useMetricLabel();
  const [metrics, setMetrics] = useState(initial.slice(0, 4));
  const [g, setG] = useState<Granularity>(defaultGranularity(gf.range));
  const [mode, setMode] = useState<'separate' | 'indexed'>('separate');
  const ref = useRef<HTMLDivElement>(null);
  const gran = gf.range.to < gf.range.from ? 'day' : g;
  const q = useAnalytics(metrics.length ? spec(gf, metrics, { granularity: gran }) : null);
  const series = (q.data?.results ?? []).map((r, i) => toSeries(r, labelOf(r.metric), i, getMetric(r.metric)!.unit, gran, lang));
  const byUnit = useMemo(() => {
    const m = new Map<Unit, Series[]>();
    for (const s of series) m.set(s.unit, [...(m.get(s.unit) ?? []), s]);
    return [...m.entries()];
  }, [series]);
  const compareLabel = gf.compare === 'none' ? undefined : t(gf.compare === 'yoy' ? 'common.vsYoy' : 'common.vsPrevious');
  return (
    <Card aria-labelledby="evo-title">
      <CardHeader
        id="evo-title"
        title={t('overview.evolution')}
        subtitle={t('overview.evolutionHint')}
        badges={<DataModeBadge mode={q.data?.results[0]?.meta.mode} />}
        actions={
          <>
            <MultiSelect label={t('overview.chooseMetrics')} placeholderAll="—" options={EVOLUTION_CHOICES.map((id) => ({ value: id, label: labelOf(id) }))} value={metrics} onChange={(v) => setMetrics(v.slice(0, 4))} />
            <Segmented size="sm" label={t('overview.granularity')} value={gran} onChange={setG} options={(['day', 'week', 'month'] as const).map((x) => ({ value: x, label: t(`overview.${x}`) }))} />
            <Segmented size="sm" label="Mode" value={mode} onChange={setMode} options={[{ value: 'separate', label: t('overview.separate') }, { value: 'indexed', label: t('overview.indexed') }]} />
            <IconButton label={t('common.exportPng')} onClick={() => exportChartPng(ref.current, 'performance-evolution')}>
              <Download className="size-4" />
            </IconButton>
          </>
        }
      />
      <CardBody>
        <div ref={ref}>
          {q.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : !series.length ? (
            <EmptyState />
          ) : mode === 'indexed' ? (
            <TimeSeriesChart series={series} indexed compareLabel={compareLabel} showCompare={false} ariaLabel={`${t('overview.evolution')} — ${t('overview.indexed')}`} showLegend />
          ) : byUnit.length === 1 ? (
            <TimeSeriesChart series={byUnit[0][1]} compareLabel={compareLabel} showCompare={gf.compare !== 'none' && byUnit[0][1].length === 1} ariaLabel={t('overview.evolution')} showLegend={byUnit[0][1].length > 1} />
          ) : (
            <Panels>
              {series.map((s) => (
                <div key={s.id}>
                  <p className="mb-1 flex items-center gap-1 text-[13px] font-medium text-t1">
                    {s.label} <MetricInfo metric={s.id} meta={q.data?.results.find((r) => r.metric === s.id)?.meta} />
                    <ResultNotes meta={q.data?.results.find((r) => r.metric === s.id)?.meta} compact />
                  </p>
                  <TimeSeriesChart series={[{ ...s, slot: s.slot }]} height={190} compareLabel={compareLabel} showCompare={gf.compare !== 'none'} ariaLabel={s.label} />
                </div>
              ))}
            </Panels>
          )}
        </div>
        <p className="mt-3 text-[12px] text-t3">
          {L({ en: 'Dashed lines: comparison period aligned by position. Gaps: no data (never drawn as zero).', fr: 'Pointillés : période de comparaison alignée par position. Interruptions : absence de données (jamais tracée à zéro).' })}
        </p>
      </CardBody>
    </Card>
  );
}

/* ---------------- D. Channel breakdown ---------------- */

interface ChannelDef {
  key: string;
  label: string;
  metrics: [string, string];
  filters: Record<string, string[]>;
  to: string;
}

function ChannelCard({ def }: { def: ChannelDef }) {
  const { lang } = useI18n();
  const gf = useGlobalFilters();
  const labelOf = useMetricLabel();
  const q = useAnalytics(spec(gf, def.metrics, { filters: def.filters }));
  const [a, b] = q.data?.results ?? [];
  const link = `${def.to}?${toQuery({ ...(gf.params as Record<string, string>), ...Object.fromEntries(Object.entries(def.filters).map(([k, v]) => [k, v.join(',')])) })}`;
  return (
    <Link to={link} className="group flex min-w-0 flex-col rounded-xl border border-brd bg-card2 p-3.5 transition-colors hover:border-brds hover:bg-card">
      <span className="flex items-center justify-between gap-2 text-[13px] font-semibold text-t1">
        {def.label}
        <ArrowUpRight className="size-3.5 text-t3 group-hover:text-t1" aria-hidden />
      </span>
      {q.isLoading || !a ? (
        <Skeleton className="mt-2 h-10 w-full" />
      ) : (
        <>
          <span className="mt-1.5 text-[11.5px] text-t3">{labelOf(a.metric)}</span>
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="tnum text-[20px] font-semibold">{formatValue(a.value, getMetric(a.metric)!.unit, lang, { compact: true })}</span>
            {gf.compare !== 'none' && <ChangeLabel metric={a.metric} result={a} compact />}
          </span>
          {b && (
            <span className="mt-1 text-[12px] text-t2">
              {labelOf(b.metric)}: <span className="tnum font-medium text-t1">{formatValue(b.value, getMetric(b.metric)!.unit, lang, { compact: true })}</span>
            </span>
          )}
          <span className="mt-1 flex items-center gap-1">
            {a.meta.mode !== 'connected' && <DataModeBadge mode={a.meta.mode} />}
            <ResultNotes meta={a.meta} compact />
          </span>
        </>
      )}
    </Link>
  );
}

function Channels() {
  const { t } = useI18n();
  const defs: ChannelDef[] = [
    { key: 'fr', label: t('overview.websiteFr'), metrics: ['sessions', 'key_events'], filters: { site: ['veolia-fr'] }, to: '/web' },
    { key: 'en', label: t('overview.websiteEn'), metrics: ['sessions', 'key_events'], filters: { site: ['veolia-en'] }, to: '/web' },
    { key: 'li', label: t('overview.linkedin'), metrics: ['social_impressions', 'social_engagement_rate'], filters: { platform: ['linkedin'] }, to: '/social' },
    { key: 'x', label: t('overview.x'), metrics: ['social_impressions', 'social_engagement_rate'], filters: { platform: ['x'] }, to: '/social' },
    { key: 'yt', label: t('overview.youtube'), metrics: ['yt_views', 'yt_watch_minutes'], filters: {}, to: '/social' },
    { key: 'seo', label: t('overview.organicSearch'), metrics: ['organic_clicks', 'avg_position'], filters: {}, to: '/seo' },
    { key: 'ai', label: t('overview.aiReferrals'), metrics: ['ai_referral_sessions', 'ai_referral_share'], filters: {}, to: '/geo' },
    { key: 'ads', label: t('overview.chatgptAds'), metrics: ['ads_spend', 'ads_conversions'], filters: {}, to: '/ads' },
  ];
  return (
    <Card aria-labelledby="ch-title">
      <CardHeader id="ch-title" title={t('overview.channels')} subtitle={t('overview.channelsHint')} />
      <CardBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {defs.map((d) => (
            <ChannelCard key={d.key} def={d} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------- E. Geography ---------------- */

function Geography() {
  const { t, L, lang } = useI18n();
  const gf = useGlobalFilters();
  const meta = useMeta();
  const [view, setView] = useState<'map' | 'table'>('map');
  const q = useAnalytics(spec(gf, ['sessions'], { groupBy: 'country' }));
  const reg = useAnalytics(spec(gf, ['sessions'], { groupBy: 'region' }));
  const r = q.data?.results[0];
  const countries = meta.data?.catalog.countries ?? [];
  const total = r?.value ?? 0;
  const rows = (r?.rows ?? []).map((x) => {
    const c = countries.find((cc) => cc.id === x.key);
    return { key: x.key, name: c ? L(c.name) : x.key, isoNum: c?.isoNum ?? '', value: x.value ?? 0, compare: x.compare, share: total ? (x.value ?? 0) / total : 0 };
  });
  return (
    <Card aria-labelledby="geo-title">
      <CardHeader
        id="geo-title"
        title={t('overview.geography')}
        subtitle={t('overview.geographyHint')}
        badges={
          <>
            <DataModeBadge mode={r?.meta.mode} />
            <ResultNotes meta={r?.meta} />
          </>
        }
        actions={<Segmented size="sm" label={t('overview.geography')} value={view} onChange={setView} options={[{ value: 'map', label: t('common.mapView') }, { value: 'table', label: t('common.tableView') }]} />}
      />
      <CardBody>
        {q.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : view === 'map' ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_240px]">
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <WorldMap data={rows.map((x) => ({ isoNum: x.isoNum, name: x.name, value: x.value }))} unit="count" ariaLabel={t('overview.geography')} />
            </Suspense>
            <div>
              <p className="eyebrow mb-2 flex items-center gap-1">
                <MapIcon className="size-3.5" aria-hidden />
                {t('overview.regionTotals')}
              </p>
              <BarList unit="count" ariaLabel={t('overview.regionTotals')} items={(reg.data?.results[0].rows ?? []).map((x) => ({ key: x.key, label: L(meta.data?.catalog.regions.find((rr) => rr.id === x.key)?.name) || x.key, value: x.value, compare: x.compare }))} />
            </div>
          </div>
        ) : (
          <DataTable
            caption={t('overview.geography')}
            rows={rows}
            exportTitle="sessions-by-country"
            exportMeta={[['Period', formatRange(gf.range, lang)], ['Data mode', r?.meta.mode ?? '']]}
            initialSort={{ key: 'value', desc: true }}
            columns={[
              { key: 'name', header: t('overview.country'), value: (x) => x.name, unit: 'text' },
              { key: 'value', header: t('overview.sessions'), value: (x) => x.value, unit: 'count' },
              { key: 'compare', header: t('common.comparison'), value: (x) => x.compare ?? null, unit: 'count', hideOnMobile: true },
              { key: 'share', header: t('overview.share'), value: (x) => x.share, unit: 'percent' },
            ]}
          />
        )}
        <div className="mt-2">
          <SourceLine meta={r?.meta} />
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------- F. Content snapshot ---------------- */

interface PostRow {
  id: string;
  accountName: string;
  platform: string;
  date: string;
  text: string;
  impressions: number;
  engagements: number;
  rate: number | null;
  rateBasis: string;
}

function ContentSnapshot() {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const pages = useAnalytics(spec(gf, ['sessions'], { groupBy: 'page', limit: 6 }));
  const posts = useApi<{ items: PostRow[]; mode: string }>('/api/social/posts', { ...gf.params, sort: 'engagements', pageSize: 4 });
  const r = pages.data?.results[0];
  return (
    <Card aria-labelledby="content-title">
      <CardHeader id="content-title" title={t('overview.contentSnapshot')} badges={<DataModeBadge mode={r?.meta.mode} />} actions={<Link to="/content" className="text-[13px] font-medium text-acctext hover:underline">{t('common.view')} →</Link>} />
      <CardBody className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">{t('overview.topPages')}</p>
          {pages.isLoading ? <Skeleton className="h-40 w-full" /> : <BarList unit="count" ariaLabel={t('overview.topPages')} items={(r?.rows ?? []).map((x) => ({ key: x.key, label: x.key.split(':').slice(1).join(':'), value: x.value, compare: x.compare }))} />}
        </div>
        <div>
          <p className="eyebrow mb-2">{t('overview.topPosts')}</p>
          <ul className="flex flex-col gap-2">
            {posts.data?.items.map((p) => (
              <li key={p.id} className="rounded-lg border border-brd p-2.5">
                <p className="line-clamp-2 text-[13px] text-t1">{p.text}</p>
                <p className="mt-1 text-[11.5px] text-t3">
                  {p.accountName} · {formatDate(p.date, lang)} · <span className="tnum">{formatValue(p.engagements, 'count', lang)}</span> engagements · <span className="tnum">{formatPct(p.rate, lang, false)}</span> / {p.rateBasis}
                </p>
              </li>
            ))}
            {posts.data && !posts.data.items.length && <EmptyState />}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------- G. Alerts ---------------- */

export function AlertList({ limit = 6, compact }: { limit?: number; compact?: boolean }) {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useApi<AlertEvent[]>('/api/insights/alerts', { status: 'open,acknowledged' });
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
  const items = (q.data ?? []).slice().sort((a, b) => order[a.severity] - order[b.severity]).slice(0, limit);
  const ack = async (id: string) => {
    try {
      await api.send('POST', `/api/insights/alerts/${id}/acknowledge`);
      await qc.invalidateQueries({ queryKey: ['/api/insights/alerts'] });
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  if (q.isLoading) return <Skeleton className="h-32 w-full" />;
  if (!items.length)
    return (
      <p className="flex items-center gap-2 py-4 text-[13px] text-t2">
        <CheckCircle2 className="size-4 text-pos" aria-hidden />
        {t('overview.noAlerts')}
      </p>
    );
  return (
    <ul className="flex flex-col divide-y divide-brd">
      {items.map((a) => (
        <li key={a.id} className="flex items-start gap-3 py-2.5">
          <AlertTriangle className={clsx('mt-0.5 size-4 shrink-0', a.severity === 'critical' || a.severity === 'high' ? 'text-neg' : 'text-warn')} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-t1">{lang === 'fr' ? a.titleFr ?? a.title : a.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-t3">
              <Badge tone={severityTone(a.severity)}>{t(`common.${a.severity}`)}</Badge>
              <span>{a.source.replace('rule:', '')}</span>
              <span>· {relativeTime(a.lastTriggeredAt, lang)}</span>
              {a.occurrences > 1 && <span>· ×{a.occurrences}</span>}
              <span>· {t(`insights.alertStatus_${a.status}`)}</span>
              {(a.evidence.mode as string) === 'demo' && <DataModeBadge mode="demo" />}
            </p>
          </div>
          {!compact && a.status === 'open' && can('alerts.ack') && (
            <Button size="sm" variant="ghost" onClick={() => ack(a.id)}>
              {t('insights.acknowledge')}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Alerts() {
  const { t } = useI18n();
  return (
    <Card aria-labelledby="alerts-title">
      <CardHeader id="alerts-title" title={t('overview.alerts')} subtitle={t('overview.alertsHint')} actions={<Link to="/insights?tab=alerts" className="text-[13px] font-medium text-acctext hover:underline">{t('common.view')} →</Link>} />
      <CardBody>
        <AlertList />
      </CardBody>
    </Card>
  );
}

/* ---------------- H. AI summary ---------------- */

function SummaryList({ title, items }: { title: string; items: SummaryItem[] }) {
  const { L } = useI18n();
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-[13px] font-semibold text-t1">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((i, k) => (
          <li key={k} className="flex gap-2 text-[13.5px] leading-relaxed text-t1">
            <span className={clsx('mt-2 size-1.5 shrink-0 rounded-full', i.tone === 'positive' ? 'bg-pos' : i.tone === 'negative' ? 'bg-neg' : i.tone === 'warning' ? 'bg-warn' : 'bg-t3')} aria-hidden />
            <span>
              {i.link ? (
                <Link to={i.link} className="hover:underline">
                  {L(i.text)}
                </Link>
              ) : (
                L(i.text)
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExecutiveSummaryCard({ metrics }: { metrics?: string[] }) {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const { can } = useSession();
  const [narrative, setNarrative] = useState(false);
  const params = { ...gf.params, metrics: metrics?.join(','), narrative: narrative ? '1' : undefined, lang };
  const q = useApi<ExecutiveSummary>('/api/insights/summary', params);
  const s = q.data;
  return (
    <Card aria-labelledby="sum-title">
      <CardHeader
        id="sum-title"
        title={t('overview.summary')}
        subtitle={t('overview.summaryHint')}
        badges={s?.modes.includes('demo') ? <DataModeBadge mode="demo" /> : undefined}
        actions={
          can('ai.generate') && (
            <Button size="sm" icon={<Sparkles className="size-3.5" />} disabled={!s?.ai.available} title={s?.ai.available ? undefined : t('overview.narrativeUnavailable')} onClick={() => setNarrative(true)}>
              {t('overview.generateNarrative')}
            </Button>
          )
        }
      />
      <CardBody>
        {q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : s ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SummaryList title={t('overview.whatChanged')} items={s.changed} />
            <SummaryList title={t('overview.drivers')} items={s.drivers} />
            <SummaryList title={t('overview.attention')} items={s.attention} />
            <SummaryList title={t('overview.recommendedActions')} items={s.actions} />
            <div className="lg:col-span-2">
              <SummaryList title={t('overview.limitations')} items={s.limitations} />
            </div>
            {s.narrative?.text && (
              <div className="rounded-lg border border-brd bg-card2 p-3 lg:col-span-2">
                <p className="eyebrow mb-1">{t('overview.narrative')}</p>
                <p className="text-[13.5px] whitespace-pre-line">{s.narrative.text}</p>
              </div>
            )}
            {!s.ai.available && <p className="text-[12px] text-t3 lg:col-span-2">{t('overview.narrativeUnavailable')}</p>}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ---------------- page ---------------- */

export default function OverviewPage() {
  const { t } = useI18n();
  const meta = useMeta();
  const { can } = useSession();
  const layout: WidgetConfig[] = meta.data?.executiveLayout ?? [];
  const kpis = layout.find((w) => w.type === 'kpi_grid')?.metrics ?? [];
  const widget = (w: WidgetConfig) => {
    if (!w.visible) return null;
    switch (w.type) {
      case 'kpi_grid':
        return <KpiGrid key={w.id} metrics={(w.metrics ?? []).filter((m) => meta.data?.metricOverrides[m]?.enabled !== false)} />;
      case 'evolution':
        return <Evolution key={w.id} initial={w.metrics ?? ['sessions']} />;
      case 'channels':
        return <Channels key={w.id} />;
      case 'geography':
        return <Geography key={w.id} />;
      case 'content_snapshot':
        return <ContentSnapshot key={w.id} />;
      case 'alerts':
        return <Alerts key={w.id} />;
      case 'ai_summary':
        return <ExecutiveSummaryCard key={w.id} metrics={kpis} />;
      default:
        return null;
    }
  };
  return (
    <>
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        actions={
          can('dashboards.edit') && (
            <Link to="/admin?section=dashboard">
              <Button size="sm" icon={<Settings2 className="size-3.5" />}>
                {t('overview.customize')}
              </Button>
            </Link>
          )
        }
      />
      <FilterToolbar />
      <PageBody>{meta.isLoading ? <Skeleton className="h-96 w-full" /> : layout.map(widget)}</PageBody>
    </>
  );
}

