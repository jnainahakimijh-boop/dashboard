import { useMemo, useState } from 'react';
import { CHANNELS, DEVICES, LANDING_PAGES } from '@/data/dimensions';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { pageDaySeries, pagesBy, prevQ, toQ, webBy, webTotals, type PageTotals, type WebTotals } from '@/lib/aggregate';
import { cvr, engagementRateWeb, ratio } from '@/lib/metrics';
import { WEB_KPIS, kpiDelta } from '@/lib/kpis';
import { fmtCompact, fmtInt, fmtPct } from '@/lib/format';
import { KpiCard, KpiGrid } from '@/components/kpi/KpiCard';
import { TrendChart, type TrendPoint } from '@/components/charts/TrendChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { Card, EmptyState, MiniBar, Segmented, InfoTip } from '@/components/ui/primitives';
import { DataTable, Num, type Column } from '@/components/tables/DataTable';

type WebMetric = 'sessions' | 'users' | 'engagementRate' | 'conversions';

export default function WebPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => prevQ(q), [q]);
  const showCompare = filters.compare === 'previous';

  const now = webTotals(q);
  const prev = webTotals(p);
  const dayMap = webBy(q, 'day') as Map<string | number, WebTotals>;
  const prevDayMap = webBy(p, 'day') as Map<string | number, WebTotals>;

  const [metric, setMetric] = useState<WebMetric>('sessions');
  const isRate = metric === 'engagementRate';

  const seriesOf = (map: Map<string | number, WebTotals>, range: { from: number; to: number }): (number | null)[] => {
    const out: (number | null)[] = [];
    for (let d = range.from; d <= range.to; d++) {
      const w = map.get(d);
      if (metric === 'engagementRate') out.push(w ? engagementRateWeb(w.engaged, w.sessions) : null);
      else out.push(w ? w[metric === 'sessions' ? 'sessions' : metric === 'users' ? 'users' : 'conversions'] : 0);
    }
    return out;
  };

  const cur = seriesOf(dayMap, q);
  const prv = seriesOf(prevDayMap, p);
  const points: TrendPoint[] = cur.map((v, i) => ({ d: q.from + i, value: v, prev: prv[i] ?? null, prevD: p.from + i <= p.to ? p.from + i : null }));

  /* acquisition table */
  const byChannel = webBy(q, 'channel') as Map<string, WebTotals>;
  const byChannelPrev = webBy(p, 'channel') as Map<string, WebTotals>;
  interface ChRow {
    id: string;
    name: string;
    t: WebTotals;
    prevSessions: number | null;
  }
  const chRows: ChRow[] = CHANNELS.filter((c) => byChannel.has(c.id)).map((c) => ({
    id: c.id,
    name: lang === 'fr' ? c.nameFr : c.name,
    t: byChannel.get(c.id)!,
    prevSessions: byChannelPrev.get(c.id)?.sessions ?? null,
  }));

  const chCols: Column<ChRow>[] = [
    { id: 'name', header: t('filters.channel'), cell: (r) => <span className="text-[12px] font-medium text-t1">{r.name}</span>, sortValue: (r) => r.name, searchText: (r) => r.name },
    { id: 'sessions', header: t('kpi.sessions'), align: 'right', sortValue: (r) => r.t.sessions, cell: (r) => <Num strong>{fmtInt(r.t.sessions, lang)}</Num> },
    { id: 'users', header: t('kpi.users'), align: 'right', sortValue: (r) => r.t.users, cell: (r) => <Num>{fmtInt(r.t.users, lang)}</Num> },
    {
      id: 'er',
      header: t('kpi.engagementRate'),
      align: 'right',
      sortValue: (r) => engagementRateWeb(r.t.engaged, r.t.sessions),
      cell: (r) => <Num>{fmtPct(engagementRateWeb(r.t.engaged, r.t.sessions), lang)}</Num>,
    },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.t.conversions, cell: (r) => <Num>{fmtInt(r.t.conversions, lang)}</Num> },
    { id: 'cvr', header: t('kpi.cvr'), align: 'right', sortValue: (r) => cvr(r.t.conversions, r.t.sessions), cell: (r) => <Num>{fmtPct(cvr(r.t.conversions, r.t.sessions), lang)}</Num> },
    {
      id: 'share',
      header: t('ov.share'),
      align: 'right',
      sortValue: (r) => r.t.sessions,
      cell: (r) => {
        const s = ratio(r.t.sessions, now.sessions);
        return (
          <span className="flex items-center justify-end gap-2">
            <MiniBar pct={s === null ? 0 : s * 100} className="max-w-20" color="var(--ch-2)" />
            <Num muted>{s === null ? '—' : fmtPct(s * 100, lang)}</Num>
          </span>
        );
      },
    },
  ];

  /* landing pages */
  const pageMap = pagesBy(q, 'page') as Map<string, PageTotals>;
  interface PgRow {
    path: string;
    t: PageTotals;
    spark: number[];
  }
  const pgRows: PgRow[] = LANDING_PAGES.filter((lp) => pageMap.has(lp.path)).map((lp) => ({
    path: lp.path,
    t: pageMap.get(lp.path)!,
    spark: pageDaySeries(q, lp.path),
  }));

  const pgCols: Column<PgRow>[] = [
    {
      id: 'page',
      header: t('web.landing'),
      cell: (r) => (
        <span className="mono block max-w-56 truncate text-[11.5px] text-t1" title={r.path}>
          {r.path}
        </span>
      ),
      sortValue: (r) => r.path,
      searchText: (r) => r.path,
    },
    { id: 'sessions', header: t('kpi.sessions'), align: 'right', sortValue: (r) => r.t.sessions, cell: (r) => <Num strong>{fmtInt(r.t.sessions, lang)}</Num> },
    { id: 'users', header: t('kpi.users'), align: 'right', sortValue: (r) => r.t.users, cell: (r) => <Num>{fmtInt(r.t.users, lang)}</Num> },
    {
      id: 'er',
      header: t('kpi.engagementRate'),
      align: 'right',
      sortValue: (r) => engagementRateWeb(r.t.engaged, r.t.sessions),
      cell: (r) => <Num>{fmtPct(engagementRateWeb(r.t.engaged, r.t.sessions), lang)}</Num>,
    },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.t.conversions, cell: (r) => <Num>{fmtInt(r.t.conversions, lang)}</Num> },
    { id: 'cvr', header: t('kpi.cvr'), align: 'right', sortValue: (r) => cvr(r.t.conversions, r.t.sessions), cell: (r) => <Num>{fmtPct(cvr(r.t.conversions, r.t.sessions), lang)}</Num> },
    {
      id: 'trend',
      header: t('web.trendMetric'),
      align: 'right',
      cell: (r) => <Sparkline values={r.spark} color="var(--text-3)" label={`${r.path}: ${t('kpi.sessions')}`} />,
    },
  ];

  /* device performance — small multiples (comparing rates beats a donut) */
  const byDevice = webBy(q, 'device') as Map<string, WebTotals>;
  const devices = DEVICES.filter((d) => byDevice.has(d.id)).map((d) => ({
    id: d.id,
    name: lang === 'fr' ? d.nameFr : d.name,
    t: byDevice.get(d.id)!,
  }));
  const maxSessions = Math.max(...devices.map((d) => d.t.sessions), 1);

  /* new vs returning */
  const newShare = ratio(now.newUsers, now.users);

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-4 md:p-6">
      <KpiGrid>
        {WEB_KPIS.map((k) => (
          <KpiCard
            key={k.id}
            label={t(k.labelKey)}
            definition={t(k.defKey)}
            value={k.format(k.value(now), lang)}
            prevValue={k.format(k.value(prev), lang)}
            delta={showCompare ? kpiDelta(k, now, prev) : undefined}
            compareLabel={showCompare ? t('compare.short') : undefined}
            compareLabelFull={showCompare ? t('compare.label') : undefined}
            lang={lang}
          />
        ))}
      </KpiGrid>

      <Card
        title={t('ov.trend')}
        subtitle={t('ov.trendSub')}
        right={
          <Segmented
            ariaLabel={t('ov.trend')}
            size="sm"
            options={[
              { id: 'sessions', label: t('kpi.sessions') },
              { id: 'users', label: t('kpi.users') },
              { id: 'engagementRate', label: t('kpi.engagementRate') },
              { id: 'conversions', label: t('kpi.conversions') },
            ]}
            value={metric}
            onChange={setMetric}
          />
        }
      >
        {now.sessions > 0 ? (
          <TrendChart
            points={points}
            format={(v) => (isRate ? fmtPct(v, lang) : fmtInt(v, lang))}
            metricLabel={t(metric === 'engagementRate' ? 'kpi.engagementRate' : metric === 'sessions' ? 'kpi.sessions' : metric === 'users' ? 'kpi.users' : 'kpi.conversions')}
            deltaKind={isRate ? 'pp' : 'rel'}
            showCompare={showCompare}
            lang={lang}
            isRate={isRate}
            description={`${t('web.title')} — ${t('ov.trendSub')}`}
            height={260}
          />
        ) : (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        )}
      </Card>

      <Card title={t('web.acquisition')} subtitle={t('web.acquisitionSub')}>
        {chRows.length > 0 ? (
          <DataTable columns={chCols} rows={chRows} rowKey={(r) => r.id} defaultSort={{ id: 'sessions', dir: 'desc' }} ariaLabel={t('web.acquisition')} />
        ) : (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        )}
      </Card>

      <Card title={t('web.landing')} subtitle={t('web.landingSub')}>
        {pgRows.length > 0 ? (
          <DataTable columns={pgCols} rows={pgRows} rowKey={(r) => r.path} defaultSort={{ id: 'sessions', dir: 'desc' }} searchable pageSize={8} ariaLabel={t('web.landing')} />
        ) : (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        )}
      </Card>

      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2">
        <Card title={t('web.devices')} subtitle={t('web.devicesSub')}>
          {devices.length > 0 ? (
            <div className="flex flex-col gap-3">
              {devices.map((d) => {
                const er = engagementRateWeb(d.t.engaged, d.t.sessions);
                const cv = cvr(d.t.conversions, d.t.sessions);
                return (
                  <div key={d.id} className="rounded-[10px] border border-brd bg-card2 p-3">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-[12.5px] font-medium text-t1">{d.name}</span>
                      <span className="mono text-[11px] text-t2 tnum">
                        {fmtCompact(d.t.sessions, lang)} {t('kpi.sessions').toLowerCase()}
                      </span>
                    </div>
                    <MiniBar pct={(d.t.sessions / maxSessions) * 100} color="var(--ch-2)" />
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <div>
                        <div className="eyebrow text-[8.5px]">{t('kpi.engagementRate')}</div>
                        <div className="mono mt-0.5 text-[13px] font-medium text-t1 tnum">{fmtPct(er, lang)}</div>
                      </div>
                      <div>
                        <div className="eyebrow text-[8.5px]">{t('kpi.cvr')}</div>
                        <div className="mono mt-0.5 text-[13px] font-medium text-t1 tnum">{fmtPct(cv, lang)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
          )}
        </Card>

        <Card title={t('web.newVsReturning')} subtitle={t('web.newVsReturningSub')} right={<InfoTip text={t('def.newUsers')} />}>
          {now.users > 0 && newShare !== null ? (
            <div className="flex h-full flex-col justify-center gap-4 py-2">
              <div className="flex h-7 w-full overflow-hidden rounded-[6px]" role="img" aria-label={`${t('web.newUsers')}: ${fmtPct(newShare * 100, lang)} — ${t('web.returningUsers')}: ${fmtPct((1 - newShare) * 100, lang)}`}>
                <div style={{ width: `${newShare * 100}%`, background: 'var(--ch-3)' }} />
                <div style={{ width: `${(1 - newShare) * 100}%`, background: 'var(--ch-2)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[10px] border border-brd bg-card2 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--ch-3)' }} aria-hidden />
                    <span className="eyebrow text-[8.5px]">{t('web.newUsers')}</span>
                  </div>
                  <div className="mono mt-1 text-[19px] font-semibold text-t1 tnum">{fmtCompact(now.newUsers, lang)}</div>
                  <div className="mono text-[10.5px] text-t3 tnum">{fmtPct(newShare * 100, lang)} {t('misc.of')} {fmtCompact(now.users, lang)}</div>
                </div>
                <div className="rounded-[10px] border border-brd bg-card2 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--ch-2)' }} aria-hidden />
                    <span className="eyebrow text-[8.5px]">{t('web.returningUsers')}</span>
                  </div>
                  <div className="mono mt-1 text-[19px] font-semibold text-t1 tnum">{fmtCompact(now.users - now.newUsers, lang)}</div>
                  <div className="mono text-[10.5px] text-t3 tnum">{fmtPct((1 - newShare) * 100, lang)} {t('misc.of')} {fmtCompact(now.users, lang)}</div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
          )}
        </Card>
      </div>
    </div>
  );
}
