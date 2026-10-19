import { useAnalytics, useApi } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatDate, formatPct, formatRange } from '@/lib/format';
import { spec } from '@/lib/query';
import { useTab } from '@/lib/useTab';
import { useGlobalFilters } from '@/state/filters';
import type { MetricResultMeta, ResultNote } from '@shared/filters';
import { TimeSeriesChart, SplitBar } from '@/components/charts';
import { DataModeBadge, ResultNotes, noteText, useMetricLabel } from '@/components/data';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { BreakdownCard, BreakdownTable, Grid2, KpiRow, TrendCard, useDimLabel } from '@/components/modules';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Card, CardBody, CardHeader, ErrorState, Skeleton, TabPanel, Tabs } from '@/components/ui';

const TABS = ['overview', 'acquisition', 'audience', 'content', 'conversions', 'quality'] as const;
type Tab = (typeof TABS)[number];

function SitesSplit() {
  const { t } = useI18n();
  const gf = useGlobalFilters();
  const lbl = useDimLabel();
  const q = useAnalytics(spec(gf, ['sessions'], { groupBy: 'site' }));
  const r = q.data?.results[0];
  return (
    <Card>
      <CardHeader title={t('web.sitesSplit')} badges={<DataModeBadge mode={r?.meta.mode} />} />
      <CardBody>{q.isLoading ? <Skeleton className="h-10" /> : <SplitBar ariaLabel={t('web.sitesSplit')} parts={(r?.rows ?? []).map((x) => ({ key: x.key, label: lbl('site', x.key), value: x.value ?? 0 }))} />}</CardBody>
    </Card>
  );
}

function NewReturning() {
  const { t } = useI18n();
  const gf = useGlobalFilters();
  const q = useAnalytics(spec(gf, ['users', 'new_users']));
  const [u, n] = q.data?.results ?? [];
  return (
    <Card>
      <CardHeader title={t('web.newReturning')} subtitle={t('web.returningHint')} badges={<ResultNotes meta={u?.meta} />} />
      <CardBody>
        {q.isLoading || !u ? (
          <Skeleton className="h-10" />
        ) : (
          <SplitBar
            ariaLabel={t('web.newReturning')}
            parts={[
              { key: 'new', label: t('web.newUsers'), value: n.value ?? 0 },
              { key: 'ret', label: t('web.returningUsers'), value: Math.max(0, (u.value ?? 0) - (n.value ?? 0)) },
            ]}
          />
        )}
      </CardBody>
    </Card>
  );
}

interface PagesResp {
  rows: Array<{ key: string; site: string; path: string; title: string; type: string | null; topic: string | null; updated: string | null; owner: string | null; metrics: Record<string, { value: number | null; compare: number | null }> }>;
  meta: Record<string, MetricResultMeta>;
}

function LandingPages() {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const labelOf = useMetricLabel();
  const q = useApi<PagesResp>('/api/web/pages', gf.params);
  const m = (k: string) => (r: PagesResp['rows'][number]) => r.metrics[k]?.value ?? null;
  return (
    <Card>
      <CardHeader title={t('web.pages')} subtitle={t('web.pagesHint')} badges={q.data && <DataModeBadge mode={q.data.meta.sessions?.mode} />} />
      <CardBody>
        {q.isLoading ? (
          <Skeleton className="h-72" />
        ) : q.isError ? (
          <ErrorState error={q.error} />
        ) : (
          <DataTable
            caption={t('web.pages')}
            rows={q.data!.rows}
            rowKey={(r) => r.key}
            exportTitle="landing-pages"
            exportMeta={[['Period', formatRange(gf.range, lang)], ['Data mode', q.data!.meta.sessions?.mode ?? '']]}
            initialSort={{ key: 'sessions', desc: true }}
            columns={[
              { key: 'path', header: t('web.page'), value: (r) => r.path, unit: 'text', render: (r) => <span className="block max-w-[340px] truncate" title={r.title}>{r.path}<span className="block truncate text-[11.5px] text-t3">{r.title}</span></span> },
              { key: 'type', header: t('web.type'), value: (r) => r.type, unit: 'text', hideOnMobile: true },
              { key: 'sessions', header: labelOf('sessions'), value: m('sessions'), unit: 'count' },
              { key: 'engagement_rate', header: labelOf('engagement_rate'), value: m('engagement_rate'), unit: 'percent' },
              { key: 'key_events', header: labelOf('key_events'), value: m('key_events'), unit: 'count', hideOnMobile: true },
              { key: 'organic_clicks', header: labelOf('organic_clicks'), value: m('organic_clicks'), unit: 'count', hideOnMobile: true },
              { key: 'avg_position', header: labelOf('avg_position'), value: m('avg_position'), unit: 'position', hideOnMobile: true },
              { key: 'updated', header: t('web.updated'), value: (r) => r.updated, unit: 'text', hideOnMobile: true, render: (r) => formatDate(r.updated, lang) },
            ]}
          />
        )}
      </CardBody>
    </Card>
  );
}

interface QualityResp {
  coverageBySite: Array<{ site: string; coverage: number | null; submissions: number | null; ga4Events: number | null; series: Array<{ date: string; value: number | null }> }>;
  forms: Array<{ form: string; name: { en: string; fr: string }; event: string; drupalSubmissions: number; ga4Events: number | null; coverage: number | null }>;
  untagged: Array<{ channel: string; sessions: number; untaggedSessions: number; untaggedShare: number | null }>;
  events: Array<{ id: string; name: { en: string; fr: string }; keyEvent: boolean; conversion: boolean; count: number | null; observed: boolean }>;
  notes: ResultNote[];
  mode: string;
}

function useQuality() {
  const gf = useGlobalFilters();
  return useApi<QualityResp>('/api/web/quality', gf.params);
}

function EventsTable() {
  const { t, L } = useI18n();
  const q = useQuality();
  return (
    <Card>
      <CardHeader title={t('web.events')} subtitle={t('web.eventsHint')} badges={q.data && <DataModeBadge mode={q.data.mode} />} />
      <CardBody>
        {q.isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <DataTable
            caption={t('web.events')}
            rows={q.data?.events ?? []}
            pageSize={10}
            columns={[
              { key: 'name', header: t('web.event'), value: (r) => L(r.name), unit: 'text', render: (r) => <span>{L(r.name)} <code className="ml-1 text-[11.5px] text-t3">{r.id}</code></span> },
              { key: 'key', header: t('web.keyEvent'), value: (r) => (r.keyEvent ? 1 : 0), unit: 'text', render: (r) => (r.keyEvent ? <Badge tone="info">{t('common.yes')}</Badge> : t('common.no')) },
              { key: 'conv', header: t('web.conversion'), value: (r) => (r.conversion ? 1 : 0), unit: 'text', render: (r) => (r.conversion ? <Badge tone="pos">{t('common.yes')}</Badge> : t('common.no')) },
              { key: 'count', header: t('web.count'), value: (r) => r.count, unit: 'count' },
              { key: 'obs', header: t('web.observed'), value: (r) => (r.observed ? 1 : 0), unit: 'text', render: (r) => (r.observed ? '✓' : <Badge tone="warn">{t('web.notObserved')}</Badge>) },
            ]}
          />
        )}
      </CardBody>
    </Card>
  );
}

function FormsCoverage() {
  const { t, L } = useI18n();
  const q = useQuality();
  return (
    <Card>
      <CardHeader title={t('web.formsTitle')} subtitle={t('web.formsHint')} badges={q.data && <DataModeBadge mode={q.data.mode} />} />
      <CardBody>
        <DataTable
          caption={t('web.formsTitle')}
          rows={q.data?.forms ?? []}
          pageSize={10}
          columns={[
            { key: 'form', header: t('web.form'), value: (r) => L(r.name), unit: 'text' },
            { key: 'drupal', header: t('web.drupal'), value: (r) => r.drupalSubmissions, unit: 'count' },
            { key: 'ga4', header: t('web.ga4'), value: (r) => r.ga4Events, unit: 'count' },
            { key: 'cov', header: t('web.coverage'), value: (r) => r.coverage, unit: 'percent' },
          ]}
        />
      </CardBody>
    </Card>
  );
}

function CoverageTrend() {
  const { t, lang } = useI18n();
  const lbl = useDimLabel();
  const q = useQuality();
  const series = (q.data?.coverageBySite ?? []).map((s, i) => ({ id: s.site, label: lbl('site', s.site), slot: i, unit: 'percent' as const, points: s.series.map((p) => ({ key: p.date, label: formatDate(p.date, lang, 'short'), value: p.value })) }));
  return (
    <Card>
      <CardHeader title={t('web.coverageTrend')} subtitle={t('web.coverageTrendHint')} />
      <CardBody>{q.isLoading ? <Skeleton className="h-60" /> : <TimeSeriesChart series={series} showCompare={false} ariaLabel={t('web.coverageTrend')} showLegend />}</CardBody>
    </Card>
  );
}

function QualityPanel() {
  const { t, lang } = useI18n();
  const lbl = useDimLabel();
  const q = useQuality();
  return (
    <>
      <Grid2>
        <Card>
          <CardHeader title={t('web.qualityNotes')} />
          <CardBody>
            {q.data && (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13.5px]">
                {q.data.notes.map((n, i) => (
                  <li key={i}>{noteText(n, t, lang)}</li>
                ))}
                <li>{t('web.gscNote')}</li>
                {q.data.mode === 'demo' && <li>{t('common.demoBanner')}</li>}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('web.untagged')} subtitle={t('web.untaggedHint')} />
          <CardBody>
            <ul className="flex flex-col gap-2">
              {q.data?.untagged.map((u) => (
                <li key={u.channel} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span>{lbl('channel', u.channel)}</span>
                  <span className="tnum font-medium">{formatPct(u.untaggedShare, lang, false)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </Grid2>
      <CoverageTrend />
      <Grid2>
        <FormsCoverage />
        <EventsTable />
      </Grid2>
    </>
  );
}

export default function WebPage() {
  const { t } = useI18n();
  const [tab, setTab] = useTab<Tab>(TABS, 'overview');
  return (
    <>
      <PageHeader title={t('web.title')} subtitle={t('web.subtitle')} crumbs={[{ label: t('nav.web') }]} />
      <FilterToolbar dims={['site', 'country', 'region', 'language', 'channel', 'campaign', 'bu']} extraDims={['device']} />
      <PageBody>
        <Tabs
          label={t('web.title')}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: t('web.tabOverview') },
            { id: 'acquisition', label: t('web.tabAcquisition') },
            { id: 'audience', label: t('web.tabAudience') },
            { id: 'content', label: t('web.tabContent') },
            { id: 'conversions', label: t('web.tabConversions') },
            { id: 'quality', label: t('web.tabQuality') },
          ]}
        />
        <TabPanel id={tab}>
          <div className="flex flex-col gap-[var(--gap-grid)]">
            {tab === 'overview' && (
              <>
                <KpiRow metrics={['sessions', 'users', 'engaged_sessions', 'engagement_rate', 'views_per_session', 'avg_engagement_time', 'key_events', 'conversion_rate']} />
                <TrendCard title={t('web.traffic')} metrics={['sessions']} />
                <Grid2>
                  <SitesSplit />
                  <BreakdownCard title={t('web.channels')} subtitle={t('web.channelsHint')} metric="sessions" groupBy="channel" />
                </Grid2>
              </>
            )}
            {tab === 'acquisition' && (
              <>
                <BreakdownTable title={t('web.channels')} subtitle={t('web.channelsHint')} metrics={['sessions', 'engaged_sessions', 'engagement_rate', 'key_events', 'conversion_rate']} groupBy="channel" dimHeader={t('filters.dim_channel')} />
                <BreakdownTable title={t('web.sourceMedium')} metrics={['sessions', 'engagement_rate', 'key_events']} groupBy="srcmed" dimHeader={t('web.sourceMedium')} />
                <BreakdownTable title={t('web.campaigns')} subtitle={t('web.campaignsHint')} metrics={['sessions', 'engagement_rate', 'key_events', 'conversions']} groupBy="campaign" dimHeader={t('filters.dim_campaign')} />
              </>
            )}
            {tab === 'audience' && (
              <>
                <Grid2>
                  <BreakdownCard title={t('web.countries')} metric="sessions" groupBy="country" limit={12} />
                  <BreakdownCard title={t('web.languages')} metric="sessions" groupBy="userLanguage" slot={1} />
                </Grid2>
                <Grid2>
                  <BreakdownTable title={t('web.devices')} metrics={['sessions', 'engagement_rate', 'key_events', 'conversion_rate']} groupBy="device" dimHeader={t('filters.dim_device')} />
                  <BreakdownTable title={t('web.browsers')} metrics={['sessions', 'engaged_sessions']} groupBy="browser" dimHeader={t('web.browsers')} />
                </Grid2>
                <NewReturning />
              </>
            )}
            {tab === 'content' && <LandingPages />}
            {tab === 'conversions' && (
              <>
                <KpiRow metrics={['conversions', 'conversion_rate', 'key_events', 'form_submissions', 'form_tracking_coverage', 'ev_contact_form_submit', 'ev_generate_lead', 'ev_newsletter_signup']} />
                <TrendCard title={t('web.tabConversions')} metrics={['conversions', 'form_submissions']} />
                <Grid2>
                  <FormsCoverage />
                  <BreakdownTable title={t('web.keyEvents')} metrics={['key_events', 'conversions', 'conversion_rate']} groupBy="channel" dimHeader={t('filters.dim_channel')} />
                </Grid2>
              </>
            )}
            {tab === 'quality' && <QualityPanel />}
          </div>
        </TabPanel>
      </PageBody>
    </>
  );
}
