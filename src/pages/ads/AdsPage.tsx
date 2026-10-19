import clsx from 'clsx';
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Lock } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { L10n } from '@shared/catalog';
import type { SeriesPoint as ApiPoint } from '@shared/filters';
import { useApi } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatBucket, formatDate, formatPct, formatRange, formatValue } from '@/lib/format';
import { useTab } from '@/lib/useTab';
import { useGlobalFilters } from '@/state/filters';
import { TimeSeriesChart, Legend, SLOT } from '@/components/charts';
import { ChangeLabel } from '@/components/kpi/KpiCard';
import { DataModeBadge } from '@/components/data';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { BreakdownTable, Grid2, KpiRow, TrendCard } from '@/components/modules';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Card, CardBody, CardHeader, Skeleton, TabPanel, Tabs } from '@/components/ui';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const TABS = ['overview', 'campaigns', 'pacing', 'conversions', 'landing', 'integration'] as const;
type Tab = (typeof TABS)[number];
type M = Record<string, { value: number | null; compare: number | null }>;

interface Structure {
  mode: string;
  attributionWindow: L10n;
  campaigns: Array<{ key: string; name: string; category: string; status: string; monthlyBudget: number | null; metrics: M; ga4: M; groups: Array<{ key: string; name: string; status: string; statusSince: string | null; metrics: M; ads: Array<{ key: string; name: string; headline: string | null; landingUrl: string | null; status: string; metrics: M }> }> }>;
}

const COLS: Array<{ k: string; unit: 'currency' | 'count' | 'percent'; label: string }> = [
  { k: 'ads_spend', unit: 'currency', label: 'spend' },
  { k: 'ads_impressions', unit: 'count', label: 'impressions' },
  { k: 'ads_clicks', unit: 'count', label: 'clicks' },
  { k: 'ads_ctr', unit: 'percent', label: 'ctr' },
  { k: 'ads_cpc', unit: 'currency', label: 'cpc' },
  { k: 'ads_conversions', unit: 'count', label: 'conversions' },
  { k: 'ads_cpa', unit: 'currency', label: 'cpa' },
];

function Structure() {
  const { t, lang, L } = useI18n();
  const gf = useGlobalFilters();
  const q = useApi<Structure>('/api/ads/structure', gf.params);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const cell = (m: M, k: string, unit: 'currency' | 'count' | 'percent') => <td key={k} className="px-3 py-2 text-right tnum">{m[k]?.value === null || m[k]?.value === undefined ? '—' : formatValue(m[k].value, unit, lang, { compact: true })}</td>;
  const status = (s: string) => <Badge tone={s === 'paused' ? 'warn' : 'pos'}>{t(`ads.status_${s}`)}</Badge>;
  return (
    <Card>
      <CardHeader title={t('ads.structure')} subtitle={t('ads.structureHint')} badges={q.data && <DataModeBadge mode={q.data.mode} />} />
      <CardBody>
        {!q.data ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <p className="mb-2 text-[12.5px] text-t2">{t('ads.attribution', { window: L(q.data.attributionWindow) })}</p>
            <div className="overflow-x-auto rounded-lg border border-brd">
              <table className="w-full text-[13px]">
                <caption className="sr-only">{t('ads.structure')}</caption>
                <thead className="bg-card2 text-t2">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">{t('ads.campaign')}</th>
                    {COLS.map((c) => (
                      <th key={c.k} scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                        {t(`ads.${c.label}`)}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap">{t('ads.gaSessions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.campaigns.map((c) => (
                    <Fragment key={c.key}>
                      <tr className="border-t border-brd bg-card">
                        <th scope="row" className="px-3 py-2 text-left font-medium">
                          <button type="button" className="flex items-center gap-1.5 text-left" aria-expanded={!!open[c.key]} onClick={() => setOpen({ ...open, [c.key]: !open[c.key] })}>
                            {open[c.key] ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                            <span>
                              {c.name}
                              <span className="ml-2 inline-flex gap-1">
                                <Badge>{t(`ads.category_${c.category}`)}</Badge>
                                {status(c.status)}
                              </span>
                            </span>
                          </button>
                        </th>
                        {COLS.map((col) => cell(c.metrics, col.k, col.unit))}
                        <td className="px-3 py-2 text-right tnum">{formatValue(c.ga4.ads_ga_sessions?.value ?? null, 'count', lang, { compact: true })}</td>
                      </tr>
                      {open[c.key] &&
                        c.groups.map((g) => (
                          <Fragment key={g.key}>
                            <tr className="border-t border-brd bg-card2/60">
                              <th scope="row" className="py-2 pr-3 pl-9 text-left font-normal">
                                {g.name} {status(g.status)}
                                {g.statusSince && <span className="ml-1 text-[11.5px] text-t3">({formatDate(g.statusSince, lang)})</span>}
                              </th>
                              {COLS.map((col) => cell(g.metrics, col.k, col.unit))}
                              <td />
                            </tr>
                            {g.ads.map((a) => (
                              <tr key={a.key} className="border-t border-brd">
                                <th scope="row" className="py-2 pr-3 pl-14 text-left font-normal">
                                  <span className="block">{a.name}</span>
                                  <span className="block text-[11.5px] text-t3">“{a.headline}” → {a.landingUrl?.replace('https://www.veolia.com', '')}</span>
                                  {(a.metrics.ads_conversions?.value ?? 1) === 0 && (a.metrics.ads_spend?.value ?? 0) > 0 && <Badge tone="warn">{t('ads.noConversion')}</Badge>}
                                </th>
                                {COLS.map((col) => cell(a.metrics, col.k, col.unit))}
                                <td />
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

interface Pacing {
  asOf: string;
  note: string;
  pacing: Array<{ campaign: string; name: string; monthlyBudget: number; spendMtd: number; expectedMtd: number; pacing: number | null; projectedMonth: number | null; daysElapsed: number; daysInMonth: number; mode: string }>;
  series: Array<{ campaign: string; points: Array<{ date: string; cumulative: number; budgetLine: number }> }>;
}

function PacingPanel() {
  const { t, lang } = useI18n();
  const q = useApi<Pacing>('/api/ads/pacing');
  if (!q.data) return <Skeleton className="h-64" />;
  return (
    <>
      <Card>
        <CardHeader title={t('ads.pacingTitle')} subtitle={t('ads.pacingHint')} badges={<DataModeBadge mode={q.data.pacing[0]?.mode} />} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {q.data.pacing.map((p) => {
              const over = (p.pacing ?? 0) > 1.1;
              return (
                <div key={p.campaign} className={clsx('rounded-lg border p-3', over ? 'border-neg/40 bg-negsoft' : 'border-brd')}>
                  <p className="text-[14px] font-medium">{p.name}</p>
                  <p className="mt-1 flex items-center gap-2">
                    <span className="text-[26px] font-semibold tnum">{formatPct(p.pacing, lang, false)}</span>
                    {over && <Badge tone="neg"><AlertTriangle size={12} aria-hidden="true" /> {t('ads.overpacing')}</Badge>}
                  </p>
                  <p className="text-[12.5px] text-t2 tnum">
                    {t('ads.spend')} {formatValue(p.spendMtd, 'currency', lang)} · {t('ads.expected')} {formatValue(p.expectedMtd, 'currency', lang)} · {t('ads.budget')} {formatValue(p.monthlyBudget, 'currency', lang)}
                  </p>
                  <p className="text-[12.5px] text-t2 tnum">
                    {t('ads.projected')}{t('common.colon')} {formatValue(p.projectedMonth, 'currency', lang)} · {p.daysElapsed}/{p.daysInMonth}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-t3">{t('ads.pacingNote')}</p>
        </CardBody>
      </Card>
      <Grid2>
        {q.data.series.map((s, i) => {
          const name = q.data!.pacing.find((p) => p.campaign === s.campaign)?.name ?? s.campaign;
          return (
            <Card key={s.campaign}>
              <CardHeader title={name} subtitle={t('ads.cumulative')} />
              <CardBody>
                <Legend items={[{ label: t('ads.spend'), color: SLOT(i) }, { label: t('ads.budgetLine'), color: 'var(--ch-compare)' }]} />
                <div className="mt-2 h-56" role="img" aria-label={`${name}: ${t('ads.cumulative')}`}>
                  <ResponsiveContainer>
                    <LineChart data={s.points.map((p) => ({ ...p, label: formatDate(p.date, lang, 'short') }))} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--ch-grid)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--ch-grid)' }} minTickGap={24} />
                      <YAxis tickFormatter={(v: number) => formatValue(v, 'currency', lang, { compact: true })} tickLine={false} axisLine={false} width={64} />
                      <Tooltip formatter={(v: number) => formatValue(v, 'currency', lang)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5 }} />
                      <Line dataKey="budgetLine" name={t('ads.budgetLine')} stroke="var(--ch-compare)" strokeDasharray="4 3" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                      <Line dataKey="cumulative" name={t('ads.spend')} stroke={SLOT(i)} dot={false} strokeWidth={2} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </Grid2>
    </>
  );
}

interface Conversions {
  mode: string;
  platform: { value: number | null; compare: number | null; series: ApiPoint[]; attribution: L10n };
  ga4: { value: number | null; compare: number | null; series: ApiPoint[]; sessions: number | null; attribution: L10n };
  clicks: number | null;
  clickToSessionRate: number | null;
  explanation: L10n;
}

function ConversionsPanel() {
  const { t, lang, L } = useI18n();
  const gf = useGlobalFilters();
  const q = useApi<Conversions>('/api/ads/conversions', gf.params);
  const d = q.data;
  if (!d) return <Skeleton className="h-64" />;
  const toS = (id: string, label: string, slot: number, pts: ApiPoint[]) => ({ id, label, slot, unit: 'count' as const, points: pts.map((p) => ({ key: p.key, label: formatBucket(p.key, 'week', lang), value: p.value, compare: p.compare })) });
  const block = (title: string, metric: string, x: { value: number | null; compare: number | null; series: ApiPoint[]; attribution: L10n }, slot: number) => (
    <Card>
      <CardHeader title={title} subtitle={L(x.attribution)} badges={<DataModeBadge mode={d.mode} />} />
      <CardBody>
        <p className="flex items-baseline gap-2">
          <span className="text-[26px] font-semibold tnum">{formatValue(x.value, 'count', lang)}</span>
          <ChangeLabel metric={metric} result={{ delta: x.value !== null && x.compare !== null ? x.value - x.compare : null, deltaPct: x.value !== null && x.compare ? (x.value - x.compare) / x.compare : null, compare: x.compare }} />
        </p>
        <div className="mt-3">
          <TimeSeriesChart series={[toS(metric, title, slot, x.series)]} height={180} showCompare={gf.compare !== 'none'} compareLabel={t('common.vsPrevious')} ariaLabel={title} />
        </div>
      </CardBody>
    </Card>
  );
  return (
    <>
      <div role="note" className="rounded-lg border border-brd bg-card p-4">
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          {t('ads.convTitle')} <Badge tone="info">{t('ads.neverSummed')}</Badge>
        </p>
        <p className="mt-1 text-[13.5px] text-t2">{L(d.explanation)}</p>
        <p className="mt-1 text-[12.5px] text-t3 tnum">
          {t('ads.clickToSession')}: {formatPct(d.clickToSessionRate, lang, false)}
        </p>
      </div>
      <Grid2>
        {block(t('ads.platformConv'), 'ads_conversions', d.platform, 0)}
        {block(t('ads.gaConv'), 'ads_ga_key_events', d.ga4, 1)}
      </Grid2>
    </>
  );
}

function Landing() {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const q = useApi<{ items: Array<{ url: string; site: string; ads: Array<{ key: string; name: string }>; adClicks: number; platformConversions: number; spend: number; pageSessionsAllChannels: number | null; pageEngagementRateAllChannels: number | null }>; mode: string; note: string }>('/api/ads/landing-pages', gf.params);
  return (
    <Card>
      <CardHeader title={t('ads.landingTitle')} subtitle={t('ads.landingHint')} badges={q.data && <DataModeBadge mode={q.data.mode} />} />
      <CardBody>
        <DataTable
          caption={t('ads.landingTitle')}
          rows={q.data?.items ?? []}
          exportTitle="ads-landing-pages"
          exportMeta={[['Period', formatRange(gf.range, lang)]]}
          initialSort={{ key: 'spend', desc: true }}
          columns={[
            { key: 'url', header: t('ads.url'), value: (r) => r.url, unit: 'text', render: (r) => <span className="block max-w-[320px] truncate">{r.url.replace('https://www.veolia.com', '')}<span className="block text-[11.5px] text-t3">{r.ads.map((a) => a.name).join(', ')}</span></span> },
            { key: 'spend', header: t('ads.spend'), value: (r) => r.spend, unit: 'currency' },
            { key: 'clicks', header: t('ads.clicks'), value: (r) => r.adClicks, unit: 'count' },
            { key: 'conv', header: t('ads.conversions'), value: (r) => r.platformConversions, unit: 'count' },
            { key: 'ps', header: t('ads.pageSessions'), value: (r) => r.pageSessionsAllChannels, unit: 'count', hideOnMobile: true },
            { key: 'pe', header: t('ads.pageEngagement'), value: (r) => r.pageEngagementRateAllChannels, unit: 'percent', hideOnMobile: true },
          ]}
        />
      </CardBody>
    </Card>
  );
}

function Integration() {
  const { t } = useI18n();
  const q = useApi<{ status: string; mode: string; lastSuccessAt: string | null; readOnly: boolean; writeCapabilities: string; documentation: string[] }>('/api/ads/integration');
  return (
    <Card>
      <CardHeader title={t('ads.integrationTitle')} />
      <CardBody>
        {q.data && (
          <div className="flex flex-col gap-3 text-[13.5px]">
            <p>
              {t('common.status')}: <Badge tone={q.data.status === 'connected' ? 'pos' : q.data.status === 'demo' ? 'warn' : 'neutral'}>{q.data.status}</Badge> · {t('ads.mode')}: <Badge>{q.data.mode}</Badge>
            </p>
            <p className="flex items-start gap-2 text-t2">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('ads.readOnly')}
            </p>
            <div>
              <p className="eyebrow mb-1">{t('ads.docs')}</p>
              <ul className="flex flex-col gap-1">
                {q.data.documentation.map((u) => (
                  <li key={u}>
                    <a href={u} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-acctext hover:underline">
                      {u} <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function AdsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useTab<Tab>(TABS, 'overview');
  return (
    <>
      <PageHeader title={t('ads.title')} subtitle={t('ads.subtitle')} crumbs={[{ label: t('nav.ads') }]} />
      <FilterToolbar dims={['campaign', 'site', 'language', 'bu']} extraDims={[]} />
      <PageBody>
        <p role="note" className="flex items-start gap-2 rounded-lg border border-brd bg-card px-3 py-2 text-[13px] text-t2">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('ads.readOnly')}
        </p>
        <Tabs label={t('ads.title')} value={tab} onChange={setTab} tabs={TABS.map((id) => ({ id, label: t(`ads.tab${id[0].toUpperCase()}${id.slice(1)}`) }))} />
        <TabPanel id={tab}>
          <div className="flex flex-col gap-[var(--gap-grid)]">
            {tab === 'overview' && (
              <>
                <KpiRow metrics={['ads_spend', 'ads_impressions', 'ads_clicks', 'ads_ctr', 'ads_cpc', 'ads_conversions', 'ads_cpa', 'ads_ga_sessions']} />
                <TrendCard title={t('ads.trend')} metrics={['ads_spend']} />
                <BreakdownTable title={t('ads.categories')} metrics={['ads_spend', 'ads_clicks', 'ads_ctr', 'ads_conversions', 'ads_cpa']} groupBy="adCategory" dimHeader={t('ads.category')} />
              </>
            )}
            {tab === 'campaigns' && <Structure />}
            {tab === 'pacing' && <PacingPanel />}
            {tab === 'conversions' && <ConversionsPanel />}
            {tab === 'landing' && <Landing />}
            {tab === 'integration' && <Integration />}
          </div>
        </TabPanel>
      </PageBody>
    </>
  );
}
