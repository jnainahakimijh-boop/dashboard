import { useMemo, useState } from 'react';
import { DEVICES, MARKETS } from '@/data/dimensions';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { prevQ, toQ, webBy, type WebTotals } from '@/lib/aggregate';
import { cvr, engagementRateWeb, ratio, relChange } from '@/lib/metrics';
import { fmtCompact, fmtInt, fmtPct, fmtRelDelta } from '@/lib/format';
import { Card, EmptyState, InfoTip, MiniBar } from '@/components/ui/primitives';
import { DataTable, Num, type Column } from '@/components/tables/DataTable';
import { RankedList } from '@/components/charts/RankedList';
import { Segmented } from '@/components/ui/primitives';

type ViewMode = 'country' | 'region' | 'language';

interface MarketRow {
  id: string;
  name: string;
  t: WebTotals;
  growth: number | null;
  opportunity: number | null;
}

export default function AudiencePage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => prevQ(q), [q]);
  const [mode, setMode] = useState<ViewMode>('country');

  const byMarket = webBy(q, 'market') as Map<string, WebTotals>;
  const byMarketPrev = webBy(p, 'market') as Map<string, WebTotals>;

  /* group markets according to the selected view */
  const groups = useMemo(() => {
    const acc = new Map<string, { name: string; t: WebTotals; prev: WebTotals }>();
    const zero = (): WebTotals => ({ sessions: 0, users: 0, newUsers: 0, engaged: 0, conversions: 0, engTime: 0 });
    for (const m of MARKETS) {
      const cur = byMarket.get(m.id);
      if (!cur) continue;
      const prev = byMarketPrev.get(m.id);
      const key = mode === 'country' ? m.id : mode === 'region' ? m.region : m.lang.toUpperCase();
      const name =
        mode === 'country'
          ? lang === 'fr'
            ? m.nameFr
            : m.name
          : mode === 'region'
            ? m.region
            : m.lang.toUpperCase();
      let g = acc.get(key);
      if (!g) acc.set(key, (g = { name, t: zero(), prev: zero() }));
      (Object.keys(g.t) as Array<keyof WebTotals>).forEach((k) => {
        g!.t[k] += cur[k];
        if (prev) g!.prev[k] += prev[k];
      });
    }
    return acc;
  }, [byMarket, byMarketPrev, mode, lang]);

  const rows: MarketRow[] = useMemo(() => {
    const list = [...groups.entries()].map(([id, g]) => ({
      id,
      name: g.name,
      t: g.t,
      growth: g.prev.sessions > 0 ? relChange(g.t.sessions, g.prev.sessions) : null,
    }));
    /* Opportunity score (documented): growth 40% + CVR headroom vs best 40% + ER 20%, each normalised 0–1 */
    const growths = list.map((r) => r.growth ?? 0);
    const gMin = Math.min(...growths, 0);
    const gMax = Math.max(...growths, 1);
    const cvrs = list.map((r) => cvr(r.t.conversions, r.t.sessions) ?? 0);
    const bestCvr = Math.max(...cvrs, 0.001);
    const ers = list.map((r) => engagementRateWeb(r.t.engaged, r.t.sessions) ?? 0);
    const bestEr = Math.max(...ers, 0.001);
    return list
      .map((r, i) => {
        const gNorm = gMax > gMin ? ((r.growth ?? 0) - gMin) / (gMax - gMin) : 0.5;
        const headroom = 1 - cvrs[i] / bestCvr; // room to grow conversion vs best group
        const erNorm = ers[i] / bestEr;
        const score = r.t.sessions > 0 ? Math.round((0.4 * gNorm + 0.4 * headroom + 0.2 * erNorm) * 100) : null;
        return { ...r, opportunity: score };
      })
      .sort((a, b) => b.t.sessions - a.t.sessions);
  }, [groups]);

  const totalSessions = rows.reduce((s, r) => s + r.t.sessions, 0);

  const cols: Column<MarketRow>[] = [
    {
      id: 'name',
      header: t(mode === 'country' ? 'aud.byCountry' : mode === 'region' ? 'aud.byRegion' : 'aud.byLanguage'),
      cell: (r) => <span className="text-[13px] font-medium text-t1">{r.name}</span>,
      sortValue: (r) => r.name,
      searchText: (r) => r.name,
    },
    { id: 'users', header: t('kpi.users'), align: 'right', sortValue: (r) => r.t.users, cell: (r) => <Num>{fmtInt(r.t.users, lang)}</Num> },
    { id: 'sessions', header: t('kpi.sessions'), align: 'right', sortValue: (r) => r.t.sessions, cell: (r) => <Num strong>{fmtInt(r.t.sessions, lang)}</Num> },
    {
      id: 'share',
      header: t('ov.share'),
      align: 'right',
      sortValue: (r) => r.t.sessions,
      cell: (r) => {
        const s = ratio(r.t.sessions, totalSessions);
        return (
          <span className="flex items-center justify-end gap-2">
            <MiniBar pct={s === null ? 0 : s * 100} className="max-w-16" color="var(--ch-2)" />
            <Num muted>{s === null ? '—' : fmtPct(s * 100, lang)}</Num>
          </span>
        );
      },
    },
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
      id: 'growth',
      header: t('aud.growth'),
      align: 'right',
      sortValue: (r) => r.growth,
      cell: (r) =>
        r.growth === null ? (
          <Num muted>—</Num>
        ) : (
          <span className={`mono text-[11.5px] tnum ${r.growth >= 0 ? 'text-pos' : 'text-neg'}`}>{fmtRelDelta(r.growth, lang)}</span>
        ),
    },
    {
      id: 'opp',
      header: t('aud.opportunity'),
      align: 'right',
      headerTitle: t('aud.opportunityTip'),
      sortValue: (r) => r.opportunity,
      cell: (r) =>
        r.opportunity === null ? (
          <Num muted>—</Num>
        ) : (
          <span className="flex items-center justify-end gap-2">
            <MiniBar pct={r.opportunity} className="max-w-14" color="var(--ch-4)" />
            <Num>{r.opportunity}</Num>
          </span>
        ),
    },
  ];

  /* devices */
  const byDevice = webBy(q, 'device') as Map<string, WebTotals>;
  const devTotal = [...byDevice.values()].reduce((s, v) => s + v.sessions, 0);
  const deviceRows = DEVICES.filter((d) => byDevice.has(d.id))
    .map((d) => {
      const v = byDevice.get(d.id)!;
      const share = ratio(v.sessions, devTotal);
      return {
        id: d.id,
        label: lang === 'fr' ? d.nameFr : d.name,
        sub: `CVR ${fmtPct(cvr(v.conversions, v.sessions), lang)}`,
        value: v.sessions,
        valueLabel: fmtCompact(v.sessions, lang),
        share: share === null ? null : share * 100,
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-5 md:p-8">
      <Card
        title={t('aud.markets')}
        subtitle={t('aud.marketsSub')}
        right={
          <span className="flex items-center gap-2">
            <Segmented
              ariaLabel={t('aud.markets')}
              size="sm"
              options={[
                { id: 'country', label: t('aud.byCountry') },
                { id: 'region', label: t('aud.byRegion') },
                { id: 'language', label: t('aud.byLanguage') },
              ]}
              value={mode}
              onChange={setMode}
            />
            <InfoTip text={t('aud.opportunityTip')} />
          </span>
        }
      >
        {rows.length > 0 ? (
          <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} defaultSort={{ id: 'sessions', dir: 'desc' }} ariaLabel={t('aud.markets')} />
        ) : (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        )}
      </Card>

      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2">
        <Card title={t('aud.devices')} subtitle={t('web.devicesSub')}>
          {deviceRows.length > 0 ? <RankedList rows={deviceRows} lang={lang} ariaLabel={t('aud.devices')} /> : <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />}
        </Card>
        <Card title={t('aud.opportunity')} subtitle={t('aud.opportunityTip')}>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {[...rows]
              .filter((r) => r.opportunity !== null)
              .sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))
              .slice(0, 4)
              .map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 rounded-[10px] border border-brd bg-card2 px-3 py-2.5">
                  <span className="mono text-[11px] text-t3 tnum">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 text-[13px] font-medium text-t1">{r.name}</span>
                  <MiniBar pct={r.opportunity ?? 0} className="max-w-28" color="var(--ch-4)" />
                  <Num strong>{r.opportunity}</Num>
                </li>
              ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
