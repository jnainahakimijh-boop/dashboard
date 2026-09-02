import React, { useMemo, useState } from 'react';
import { DEVICES, MARKETS } from '/src/data/dimensions.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { comparisonQ, toQ, webBy, webTotals } from '/src/lib/aggregate.js';
import { cvr, engagementRateWeb, ratio, relChange } from '/src/lib/metrics.js';
import { fmtCompact, fmtInt, fmtPct, fmtRelDelta } from '/src/lib/format.js';
import { Card, EmptyState, InfoTip, MiniBar, PageSection, Segmented, StatTile } from '/src/components/ui/primitives.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';
import { RankedList } from '/src/components/charts/RankedList.js';

const h = React.createElement;
const ZERO = () => ({ sessions: 0, users: 0, newUsers: 0, engaged: 0, conversions: 0, engTime: 0 });

export default function AudiencePage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const [mode, setMode] = useState('country');
  const totals = webTotals(q);
  const prevTotals = webTotals(p);
  const byMarket = webBy(q, 'market');
  const byMarketPrev = webBy(p, 'market');

  /* group markets according to the selected view */
  const groups = useMemo(() => {
    const acc = new Map();
    for (const m of MARKETS) {
      const cur = byMarket.get(m.id);
      if (!cur) continue;
      const prev = byMarketPrev.get(m.id);
      const key = mode === 'country' ? m.id : mode === 'region' ? m.region : m.lang.toUpperCase();
      const name = mode === 'country' ? (fr ? m.nameFr : m.name) : mode === 'region' ? m.region : m.lang.toUpperCase();
      let g = acc.get(key);
      if (!g) acc.set(key, (g = { name, t: ZERO(), prev: ZERO() }));
      Object.keys(g.t).forEach((k) => {
        g.t[k] += cur[k];
        if (prev) g.prev[k] += prev[k];
      });
    }
    return acc;
  }, [byMarket, byMarketPrev, mode, fr]);

  const rows = useMemo(() => {
    const list = [...groups.entries()].map(([id, g]) => ({
      id, name: g.name, t: g.t,
      growth: g.prev.sessions > 0 ? relChange(g.t.sessions, g.prev.sessions) : null,
      prevSessions: g.prev.sessions,
    }));
    /* Opportunity score (documented): growth 40% + conversion headroom vs the
       best group 40% + engagement 20%, each normalised to 0–1. */
    const growths = list.map((r) => r.growth ?? 0);
    const gMin = Math.min(...growths, 0);
    const gMax = Math.max(...growths, 1);
    const cvrs = list.map((r) => cvr(r.t.conversions, r.t.sessions) ?? 0);
    const bestCvr = Math.max(...cvrs, 0.001);
    const ers = list.map((r) => engagementRateWeb(r.t.engaged, r.t.sessions) ?? 0);
    const bestEr = Math.max(...ers, 0.001);
    return list.map((r, i) => {
      const gNorm = gMax > gMin ? ((r.growth ?? 0) - gMin) / (gMax - gMin) : 0.5;
      const headroom = 1 - cvrs[i] / bestCvr;
      const erNorm = ers[i] / bestEr;
      const score = r.t.sessions > 0 ? Math.round((0.4 * gNorm + 0.4 * headroom + 0.2 * erNorm) * 100) : null;
      return { ...r, opportunity: score };
    }).sort((a, b) => b.t.sessions - a.t.sessions);
  }, [groups]);

  const totalSessions = rows.reduce((s, r) => s + r.t.sessions, 0);
  const leader = rows[0] ?? null;
  const bestConverting = [...rows].filter((r) => r.t.sessions > 0).sort((a, b) => (cvr(b.t.conversions, b.t.sessions) ?? 0) - (cvr(a.t.conversions, a.t.sessions) ?? 0))[0] ?? null;
  const fastestGrowing = [...rows].filter((r) => r.growth != null && r.t.sessions >= totalSessions * 0.05).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0] ?? null;

  const cols = [
    {
      id: 'name',
      header: t(mode === 'country' ? 'aud.byCountry' : mode === 'region' ? 'aud.byRegion' : 'aud.byLanguage'),
      cell: (r) => h('span', { className: 'text-[12px] font-semibold text-t1' }, r.name),
      sortValue: (r) => r.name, searchText: (r) => r.name,
    },
    {
      id: 'share', header: t('ov.share'), sortValue: (r) => r.t.sessions,
      cell: (r) => {
        const s = ratio(r.t.sessions, totalSessions);
        return h('span', { className: 'flex items-center gap-2' },
          h(MiniBar, { pct: s === null ? 0 : s * 100, className: 'max-w-24', color: 'var(--ch-2)' }),
          h(Num, { muted: true }, s === null ? '—' : fmtPct(s * 100, lang)));
      },
    },
    { id: 'sessions', header: t('kpi.sessions'), align: 'right', sortValue: (r) => r.t.sessions, cell: (r) => h(Num, { strong: true }, fmtInt(r.t.sessions, lang)) },
    { id: 'users', header: t('kpi.users'), align: 'right', sortValue: (r) => r.t.users, cell: (r) => h(Num, null, fmtInt(r.t.users, lang)) },
    {
      id: 'growth', header: t('aud.growth'), align: 'right', sortValue: (r) => r.growth,
      cell: (r) => r.growth === null
        ? h(Num, { muted: true }, '—')
        : h('span', { className: `mono whitespace-nowrap text-[11.5px] tnum ${r.growth >= 0 ? 'text-pos' : 'text-neg'}` }, fmtRelDelta(r.growth, lang)),
    },
    { id: 'er', header: t('kpi.engagementRate'), align: 'right', sortValue: (r) => engagementRateWeb(r.t.engaged, r.t.sessions), cell: (r) => h(Num, null, fmtPct(engagementRateWeb(r.t.engaged, r.t.sessions), lang)) },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.t.conversions, cell: (r) => h(Num, null, fmtInt(r.t.conversions, lang)) },
    { id: 'cvr', header: t('kpi.cvr'), align: 'right', sortValue: (r) => cvr(r.t.conversions, r.t.sessions), cell: (r) => h(Num, { strong: true }, fmtPct(cvr(r.t.conversions, r.t.sessions), lang)) },
    {
      id: 'opp', header: t('aud.opportunity'), align: 'right', headerTitle: t('aud.opportunityTip'), sortValue: (r) => r.opportunity,
      cell: (r) => r.opportunity === null
        ? h(Num, { muted: true }, '—')
        : h('span', { className: 'flex items-center justify-end gap-2' },
          h(MiniBar, { pct: r.opportunity, className: 'max-w-14', color: 'var(--ch-4)' }),
          h(Num, null, r.opportunity)),
    },
  ];

  /* ---- growth ranking ---- */
  const growthRows = [...rows]
    .filter((r) => r.growth != null)
    .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))
    .map((r) => ({
      id: r.id, label: r.name,
      sub: `${fmtCompact(r.prevSessions, lang)} → ${fmtCompact(r.t.sessions, lang)} ${fr ? 'sessions' : 'sessions'}`,
      value: Math.max(0, (r.growth ?? 0) + 100),
      valueLabel: fmtRelDelta(r.growth, lang),
      share: null,
      color: (r.growth ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)',
    }));

  /* ---- device composition ---- */
  const byDevice = webBy(q, 'device');
  const devTotal = [...byDevice.values()].reduce((s, v) => s + v.sessions, 0);
  const deviceRows = DEVICES.filter((d) => byDevice.has(d.id)).map((d) => {
    const v = byDevice.get(d.id);
    const share = ratio(v.sessions, devTotal);
    return {
      id: d.id, label: fr ? d.nameFr : d.name,
      sub: `${fmtPct(engagementRateWeb(v.engaged, v.sessions), lang)} ${fr ? 'engagement' : 'engagement'} · CVR ${fmtPct(cvr(v.conversions, v.sessions), lang)}`,
      value: v.sessions, valueLabel: fmtCompact(v.sessions, lang),
      share: share === null ? null : share * 100,
    };
  }).sort((a, b) => b.value - a.value);

  const newShare = ratio(totals.newUsers, totals.users);

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    /* ---------- 1 · where performance comes from ---------- */
    h(PageSection, {
      step: 1,
      title: fr ? 'D’où vient la performance' : 'Where performance comes from',
      description: fr
        ? 'Le marché qui porte le volume, celui qui convertit le mieux, et celui qui progresse le plus vite.'
        : 'The market carrying the volume, the one converting best, and the one growing fastest.',
    },
      h('div', { className: 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4' },
        h(StatTile, {
          label: fr ? 'Marchés actifs' : 'Active markets',
          value: fmtInt(rows.length, lang),
          hint: `${fmtCompact(totalSessions, lang)} ${fr ? 'sessions au total' : 'sessions in total'}`,
        }),
        h(StatTile, {
          label: fr ? 'Premier marché' : 'Leading market',
          value: leader ? leader.name : '—',
          hint: leader ? `${fmtPct(ratio(leader.t.sessions, totalSessions) === null ? null : ratio(leader.t.sessions, totalSessions) * 100, lang)} ${fr ? 'des sessions' : 'of sessions'}` : undefined,
        }),
        h(StatTile, {
          label: fr ? 'Meilleure conversion' : 'Best converting market',
          value: bestConverting ? bestConverting.name : '—',
          tone: 'pos',
          hint: bestConverting ? `${fmtPct(cvr(bestConverting.t.conversions, bestConverting.t.sessions), lang)} CVR` : undefined,
        }),
        h(StatTile, {
          label: fr ? 'Croissance la plus forte' : 'Fastest growing market',
          value: fastestGrowing ? fastestGrowing.name : '—',
          tone: fastestGrowing && (fastestGrowing.growth ?? 0) >= 0 ? 'pos' : 'neg',
          hint: fastestGrowing ? `${fmtRelDelta(fastestGrowing.growth, lang)} ${fr ? 'de sessions' : 'sessions'}` : undefined,
        }))),

    /* ---------- 2 · market detail ---------- */
    h(PageSection, {
      step: 2,
      title: fr ? 'Détail par marché' : 'Market detail',
      description: fr
        ? 'Volume, croissance et qualité côte à côte. Basculez entre pays, région et langue sans changer de page.'
        : 'Volume, growth and quality side by side. Switch between country, region and language without leaving the page.',
      right: h('span', { className: 'flex items-center gap-2' },
        h(Segmented, {
          ariaLabel: t('aud.markets'), size: 'sm', value: mode, onChange: setMode,
          options: [
            { id: 'country', label: t('aud.byCountry') },
            { id: 'region', label: t('aud.byRegion') },
            { id: 'language', label: t('aud.byLanguage') },
          ],
        }),
        h(InfoTip, { text: t('aud.opportunityTip') })),
    },
      h(Card, { id: 'audience-markets', title: t('aud.markets'), subtitle: t('aud.marketsSub') },
        rows.length
          ? h(DataTable, { columns: cols, rows, rowKey: (r) => r.id, defaultSort: { id: 'sessions', dir: 'desc' }, ariaLabel: t('aud.markets') })
          : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }))),

    /* ---------- 3 · growth and composition ---------- */
    h(PageSection, {
      step: 3,
      title: fr ? 'Croissance et composition' : 'Growth and composition',
      description: fr
        ? 'Comment chaque marché évolue, et sur quels appareils et quelles audiences le trafic arrive.'
        : 'How each market is moving, and on which devices and audiences the traffic arrives.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-3' },
        h(Card, {
          title: fr ? 'Croissance par marché' : 'Market growth',
          subtitle: fr ? 'Évolution des sessions vs la période de comparaison.' : 'Sessions movement against the comparison period.',
        },
          growthRows.length
            ? h(RankedList, { rows: growthRows, lang, showShare: false, ariaLabel: fr ? 'Croissance par marché' : 'Market growth' })
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),
        h(Card, {
          title: t('aud.devices'),
          subtitle: fr ? 'Composition du trafic par appareil, avec la qualité associée.' : 'Traffic composition by device, with the quality that comes with it.',
        },
          deviceRows.length
            ? h(RankedList, { rows: deviceRows, lang, ariaLabel: t('aud.devices') })
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),
        h(Card, {
          title: fr ? 'Composition de l’audience' : 'Audience composition',
          subtitle: fr ? 'Part de nouveaux visiteurs et intensité d’usage sur la période.' : 'Share of first-time visitors and usage intensity over the period.',
        },
          totals.users > 0
            ? h('div', { className: 'grid gap-2' },
              h(StatTile, { label: fr ? 'Nouveaux utilisateurs' : 'New users', value: fmtCompact(totals.newUsers, lang), hint: `${fmtPct(newShare === null ? null : newShare * 100, lang)} ${fr ? 'du total' : 'of all users'}` }),
              h(StatTile, { label: fr ? 'Utilisateurs connus' : 'Returning users', value: fmtCompact(totals.users - totals.newUsers, lang), hint: `${fmtPct(newShare === null ? null : (1 - newShare) * 100, lang)} ${fr ? 'du total' : 'of all users'}` }),
              h(StatTile, { label: fr ? 'Sessions par utilisateur' : 'Sessions per user', value: (ratio(totals.sessions, totals.users) ?? 0).toFixed(2), hint: fr ? 'Fréquence de retour' : 'Return frequency' }),
              h(StatTile, {
                label: fr ? 'Croissance des utilisateurs' : 'User growth',
                value: fmtRelDelta(relChange(totals.users, prevTotals.users), lang),
                tone: (relChange(totals.users, prevTotals.users) ?? 0) >= 0 ? 'pos' : 'neg',
                hint: fr ? 'vs période de comparaison' : 'vs comparison period',
              }))
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })))),

    /* ---------- 4 · where to invest next ---------- */
    h(PageSection, {
      step: 4,
      title: fr ? 'Où investir ensuite' : 'Where to invest next',
      description: fr
        ? 'Score d’opportunité = 40 % croissance + 40 % marge de conversion face au meilleur marché + 20 % engagement.'
        : 'Opportunity score = 40% growth + 40% conversion headroom against the best market + 20% engagement.',
    },
      h(Card, { title: t('aud.opportunity'), subtitle: t('aud.opportunityTip') },
        h('ol', { className: 'm-0 flex list-none flex-col gap-2 p-0' },
          [...rows].filter((r) => r.opportunity !== null).sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0)).slice(0, 5).map((r, i) => h('li', {
            key: r.id, className: 'grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1.1fr)_auto] items-center gap-3 rounded-[6px] border border-brd bg-card2 px-3 py-2.5',
          },
            h('span', { className: 'text-[11px] font-bold text-t3 tnum' }, String(i + 1).padStart(2, '0')),
            h('div', { className: 'min-w-0' },
              h('div', { className: 'truncate text-[12.5px] font-semibold text-t1' }, r.name),
              h('div', { className: 'mt-0.5 truncate text-[10.5px] text-t3 tnum' },
                `${fmtCompact(r.t.sessions, lang)} ${fr ? 'sessions' : 'sessions'} · CVR ${fmtPct(cvr(r.t.conversions, r.t.sessions), lang)} · ${fmtRelDelta(r.growth, lang)}`)),
            h(MiniBar, { pct: r.opportunity ?? 0, color: 'var(--ch-4)' }),
            h(Num, { strong: true }, r.opportunity))))))
  );
}
