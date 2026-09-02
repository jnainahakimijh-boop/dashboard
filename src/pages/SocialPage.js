import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { FORMATS, PLATFORMS, THEMES, weekdayOf } from '/src/data/dimensions.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { contentItems, comparisonQ, socialAttributedWebTotals, socialBy, socialMissingDays, socialTotals, toQ } from '/src/lib/aggregate.js';
import { ctr, cvr, engagementRateSocial, engagementRateWeb, ratio } from '/src/lib/metrics.js';
import { SOCIAL_KPIS, kpiDelta } from '/src/lib/kpis.js';
import { fmtCompact, fmtDayFull, fmtInt, fmtPct, fmtSignedInt } from '/src/lib/format.js';
import { KpiCard, KpiGrid } from '/src/components/kpi/KpiCard.js';
import { TrendChart } from '/src/components/charts/TrendChart.js';
import { StackedBars } from '/src/components/charts/StackedBars.js';
import { MultiMetricTrend } from '/src/components/charts/MultiMetricTrend.js';
import { HeatmapGrid } from '/src/components/charts/HeatmapGrid.js';
import { ScatterMatrix } from '/src/components/charts/ScatterMatrix.js';
import { Badge, Card, Disclosure, EmptyState, MiniBar, PageSection, Segmented, StatTile } from '/src/components/ui/primitives.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';
import { SocialVideoRetention, SocialVideoQualityByPlatform } from '/src/components/analysis/diagnostics.js';

const h = React.createElement;
const BASE_FOLLOWERS = { linkedin: 186000, instagram: 124000, youtube: 84000, x: 71000 };
const MARKET_WEIGHT = { fr: 0.26, us: 0.22, uk: 0.16, de: 0.14, es: 0.12, pl: 0.1 };

export default function SocialPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const showCompare = filters.compare !== 'none';
  const now = socialTotals(q);
  const prev = socialTotals(p);
  const attributedWeb = socialAttributedWebTotals(q);
  const dayMap = socialBy(q, 'day');
  const prevDayMap = socialBy(p, 'day');
  const xFilteredIn = filters.platforms.length === 0 || filters.platforms.includes('x');
  const missingX = xFilteredIn ? socialMissingDays(q, 'x') : [];
  const [metric, setMetric] = useState('impressions');
  const [heatMetric, setHeatMetric] = useState('er');

  /* a day with no collected rows renders as a gap (null), never as zero */
  const seriesOf = (map, range) => {
    const out = [];
    for (let d = range.from; d <= range.to; d++) {
      const s = map.get(d);
      out.push(s ? s[metric] : null);
    }
    return out;
  };
  const cur = seriesOf(dayMap, q);
  const prv = seriesOf(prevDayMap, p);
  const points = cur.map((v, i) => ({ d: q.from + i, value: v, prev: prv[i] ?? null, prevD: p.from + i <= p.to ? p.from + i : null }));
  const metricLabel = t(metric === 'impressions' ? 'kpi.impressions' : metric === 'reach' ? 'kpi.reach' : metric === 'engagements' ? 'kpi.engagements' : 'kpi.clicks');

  /* ---- platform comparison ---- */
  const byPlatform = socialBy(q, 'platform');
  const pfRows = PLATFORMS.filter((pf) => byPlatform.has(pf.id)).map((pf) => ({ id: pf.id, name: pf.name, t: byPlatform.get(pf.id) }));
  const pfCols = [
    { id: 'name', header: t('filters.platform'), cell: (r) => h('span', { className: 'text-[12px] font-semibold text-t1' }, r.name), sortValue: (r) => r.name, searchText: (r) => r.name },
    { id: 'impressions', header: t('kpi.impressions'), align: 'right', sortValue: (r) => r.t.impressions, cell: (r) => h(Num, { strong: true }, fmtCompact(r.t.impressions, lang)) },
    { id: 'reach', header: t('kpi.reach'), align: 'right', sortValue: (r) => r.t.reach, cell: (r) => h(Num, null, fmtCompact(r.t.reach, lang)) },
    { id: 'eng', header: t('kpi.engagements'), align: 'right', sortValue: (r) => r.t.engagements, cell: (r) => h(Num, null, fmtCompact(r.t.engagements, lang)) },
    { id: 'er', header: t('kpi.engagementRate'), align: 'right', sortValue: (r) => engagementRateSocial(r.t.engagements, r.t.impressions), cell: (r) => h(Num, { strong: true }, fmtPct(engagementRateSocial(r.t.engagements, r.t.impressions), lang)) },
    { id: 'clicks', header: t('kpi.clicks'), align: 'right', sortValue: (r) => r.t.clicks, cell: (r) => h(Num, null, fmtCompact(r.t.clicks, lang)) },
    { id: 'ctr', header: t('kpi.ctr'), align: 'right', sortValue: (r) => ctr(r.t.clicks, r.t.impressions), cell: (r) => h(Num, null, fmtPct(ctr(r.t.clicks, r.t.impressions), lang)) },
    { id: 'video', header: t('kpi.videoViews'), align: 'right', sortValue: (r) => r.t.videoViews, cell: (r) => h(Num, { muted: true }, r.t.videoViews > 0 ? fmtCompact(r.t.videoViews, lang) : '—') },
    { id: 'followers', header: t('kpi.followerNet'), align: 'right', sortValue: (r) => r.t.followerNet, cell: (r) => h('span', { className: `mono whitespace-nowrap text-[11.5px] tnum ${r.t.followerNet >= 0 ? 'text-pos' : 'text-neg'}` }, fmtSignedInt(r.t.followerNet, lang)) },
  ];

  const compData = pfRows.map((r) => ({ name: r.name, reactions: r.t.reactions, comments: r.t.comments, shares: r.t.shares, clicks: r.t.clicks }));

  /* ---- follower trajectory: cumulative net growth over a stable base ---- */
  const platformScope = filters.platforms.length ? PLATFORMS.filter((pf) => filters.platforms.includes(pf.id)) : PLATFORMS;
  const marketWeight = filters.markets.length ? filters.markets.reduce((sum, id) => sum + (MARKET_WEIGHT[id] ?? 0), 0) : 1;
  const followerBase = platformScope.reduce((sum, pf) => sum + (BASE_FOLLOWERS[pf.id] ?? 0), 0) * marketWeight;
  const allFollowerMap = socialBy({ ...q, from: 0, to: q.to }, 'day');
  let followerRunning = followerBase;
  const followerPoints = [];
  for (let d = 0; d <= q.to; d++) {
    followerRunning += allFollowerMap.get(d)?.followerNet ?? 0;
    if (d >= q.from) followerPoints.push({ d, followers: Math.max(0, Math.round(followerRunning)) });
  }
  const followerStart = followerPoints.length ? followerPoints[0].followers : 0;
  const followerEnd = followerPoints.length ? followerPoints[followerPoints.length - 1].followers : 0;

  /* ---- content: format and topic performance ---- */
  const items = contentItems(q);
  const groupBy = (key) => {
    const map = new Map();
    for (const it of items) {
      const cur2 = map.get(it[key]) || { imp: 0, eng: 0, clicks: 0, conv: 0, n: 0 };
      cur2.imp += it.impressions;
      cur2.eng += it.reactions + it.comments + it.shares;
      cur2.clicks += it.clicks;
      cur2.conv += it.conversions;
      cur2.n += 1;
      map.set(it[key], cur2);
    }
    return map;
  };
  const byFormat = groupBy('format');
  const formatRows = FORMATS.filter((f) => byFormat.has(f.id)).map((f) => {
    const v = byFormat.get(f.id);
    return { id: f.id, name: fr ? f.nameFr : f.name, er: engagementRateSocial(v.eng, v.imp) ?? 0, n: v.n, imp: v.imp };
  }).sort((a, b) => b.er - a.er);
  const maxFormatEr = Math.max(...formatRows.map((r) => r.er), 0.001);
  const byTheme = groupBy('theme');
  const themeRows = THEMES.filter((th) => byTheme.has(th.id)).map((th) => {
    const v = byTheme.get(th.id);
    return { id: th.id, name: fr ? th.nameFr : th.name, er: engagementRateSocial(v.eng, v.imp) ?? 0, n: v.n, imp: v.imp };
  }).sort((a, b) => b.er - a.er);
  const maxThemeEr = Math.max(...themeRows.map((r) => r.er), 0.001);

  /* ---- top-performing content ---- */
  const topPosts = useMemo(() => [...items]
    .map((c) => ({ ...c, er: engagementRateSocial(c.reactions + c.comments + c.shares, c.impressions) }))
    .sort((a, b) => (b.er ?? 0) * Math.log10(Math.max(b.impressions, 10)) - (a.er ?? 0) * Math.log10(Math.max(a.impressions, 10)))
    .slice(0, 8), [items]);
  const medianImpressions = useMemo(() => {
    if (!items.length) return 0;
    const sorted = items.map((x) => x.impressions).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [items]);
  const postAction = (r) => {
    if ((r.er ?? 0) > 4 && r.impressions > medianImpressions) return { label: t('cnt.q.amplify'), tone: 'pos' };
    if ((r.er ?? 0) > 4) return { label: t('cnt.q.distribute'), tone: 'info' };
    if (r.impressions > medianImpressions) return { label: t('cnt.q.optimise'), tone: 'warn' };
    return { label: t('cnt.q.reconsider'), tone: 'neutral' };
  };
  const postCols = [
    { id: 'title', header: t('nav.content'), cell: (r) => h('span', { className: 'block max-w-64 truncate text-[12px] font-medium text-t1', title: fr ? r.titleFr : r.title }, fr ? r.titleFr : r.title), sortValue: (r) => (fr ? r.titleFr : r.title), searchText: (r) => `${r.title} ${r.titleFr}` },
    { id: 'platform', header: t('filters.platform'), cell: (r) => h(Num, { muted: true }, PLATFORMS.find((pf) => pf.id === r.platform)?.name), sortValue: (r) => r.platform },
    { id: 'date', header: t('cnt.published'), cell: (r) => h(Num, { muted: true }, fmtDayFull(r.publishD, lang)), sortValue: (r) => r.publishD },
    { id: 'theme', header: t('filters.theme'), cell: (r) => h(Num, { muted: true }, (fr ? THEMES.find((x) => x.id === r.theme)?.nameFr : THEMES.find((x) => x.id === r.theme)?.name) ?? r.theme), sortValue: (r) => r.theme },
    { id: 'format', header: t('filters.format'), cell: (r) => h(Num, { muted: true }, (fr ? FORMATS.find((x) => x.id === r.format)?.nameFr : FORMATS.find((x) => x.id === r.format)?.name) ?? r.format), sortValue: (r) => r.format },
    { id: 'imp', header: t('kpi.impressions'), align: 'right', sortValue: (r) => r.impressions, cell: (r) => h(Num, null, fmtCompact(r.impressions, lang)) },
    { id: 'er', header: t('kpi.engagementRate'), align: 'right', sortValue: (r) => r.er, cell: (r) => h(Num, { strong: true }, fmtPct(r.er, lang)) },
    { id: 'clicks', header: t('kpi.clicks'), align: 'right', sortValue: (r) => r.clicks, cell: (r) => h(Num, null, fmtInt(r.clicks, lang)) },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.conversions, cell: (r) => h(Num, null, fmtInt(r.conversions, lang)) },
    { id: 'action', header: t('ins.action'), align: 'right', cell: (r) => { const a = postAction(r); return h(Badge, { tone: a.tone }, a.label.toUpperCase()); } },
  ];

  /* ---- publishing cadence, one point per calendar week ---- */
  const weekMap = new Map();
  for (const it of items) {
    const w = Math.floor(it.publishD / 7);
    const cur2 = weekMap.get(w) ?? { n: 0, imp: 0, eng: 0 };
    cur2.n += 1;
    cur2.imp += it.impressions;
    cur2.eng += it.reactions + it.comments + it.shares;
    weekMap.set(w, cur2);
  }
  const frequencyPoints = [...weekMap.entries()].map(([w, v]) => ({
    id: `week-${w}`, label: `${fr ? 'Semaine' : 'Week'} ${w + 1}`, x: v.n, y: engagementRateSocial(v.eng, v.imp) ?? 0, z: Math.round(v.imp / Math.max(1, v.n)),
  }));
  const freqCopy = {
    amplify: { label: fr ? 'Fréquence efficace' : 'Efficient cadence', desc: fr ? 'Volume élevé et performance élevée' : 'Higher volume with higher performance' },
    optimise: { label: fr ? 'Surcharge potentielle' : 'Possible saturation', desc: fr ? 'Volume élevé, performance plus faible' : 'Higher volume, lower performance' },
    distribute: { label: fr ? 'Marge de publication' : 'Publishing headroom', desc: fr ? 'Faible volume, bonne performance' : 'Lower volume, strong performance' },
    reconsider: { label: fr ? 'À investiguer' : 'Investigate', desc: fr ? 'Faible volume et faible performance' : 'Lower volume and lower performance' },
  };

  /* ---- best time to post ---- */
  const heatRows = ['08–10', '10–12', '12–14', '14–17', '17–20'];
  const heatCols = fr ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatAgg = new Map();
  for (const it of items) {
    const day = weekdayOf(it.publishD);
    const slot = (Number(it.id.replace(/\D/g, '')) + it.publishD) % heatRows.length;
    const k = `${slot}|${day}`;
    const a = heatAgg.get(k) ?? { imp: 0, eng: 0, clicks: 0, n: 0 };
    a.imp += it.impressions;
    a.eng += it.reactions + it.comments + it.shares;
    a.clicks += it.clicks;
    a.n += 1;
    heatAgg.set(k, a);
  }
  const heatCells = heatRows.flatMap((row, ri) => heatCols.map((col, ci) => {
    const a = heatAgg.get(`${ri}|${ci}`) ?? { imp: 0, eng: 0, clicks: 0, n: 0 };
    const value = heatMetric === 'er' ? (engagementRateSocial(a.eng, a.imp) ?? 0) : heatMetric === 'reach' ? Math.round(a.imp / Math.max(1, a.n)) : Math.round(a.clicks / Math.max(1, a.n));
    return { row, col, value };
  }));

  const socialCtr = ctr(now.clicks, now.impressions);
  const clickToSession = ratio(attributedWeb.sessions, now.clicks);

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    missingX.length > 0
      ? h('div', { role: 'status', className: 'flex items-center gap-2.5 rounded-[6px] border border-warn/30 bg-warnsoft px-3.5 py-2.5 text-[12px] text-t1' },
        h(AlertTriangle, { size: 14, className: 'shrink-0 text-warn', 'aria-hidden': true }),
        t('soc.gapNote', { n: missingX.length }))
      : null,

    /* ---------- 1 · audience and engagement ---------- */
    h(PageSection, {
      step: 1,
      title: fr ? 'Audience et engagement' : 'Audience and engagement',
      description: fr
        ? 'Portée, interactions et clics générés par les comptes corporate sur la période.'
        : 'Reach, interaction and clicks generated by the corporate accounts in the period.',
    },
      h(KpiGrid, { dense: true }, SOCIAL_KPIS.slice(0, 6).map((k) => h(KpiCard, {
        key: k.id, label: t(k.labelKey), definition: t(k.defKey),
        value: k.format(k.value(now), lang), prevValue: k.format(k.value(prev), lang),
        delta: showCompare ? kpiDelta(k, now, prev) : undefined,
        compareLabel: showCompare ? t('compare.short') : undefined,
        compareLabelFull: showCompare ? t('compare.label') : undefined,
        href: k.id === 'engagementRate' || k.id === 'engagements' ? '/social#social-engagement-composition' : '/social#social-performance-trend',
        lang,
      })))),

    /* ---------- 2 · how is it evolving ---------- */
    h(PageSection, {
      step: 2,
      title: fr ? 'Comment cela évolue' : 'How it is evolving',
      description: fr
        ? 'Une métrique de diffusion à la fois, puis la trajectoire d’abonnés sur les plateformes sélectionnées.'
        : 'One delivery metric at a time, then the follower trajectory across the selected platforms.',
      right: h(Segmented, {
        ariaLabel: t('soc.overTime'), size: 'sm', value: metric, onChange: setMetric,
        options: [
          { id: 'impressions', label: t('kpi.impressions') },
          { id: 'reach', label: t('kpi.reach') },
          { id: 'engagements', label: t('kpi.engagements') },
          { id: 'clicks', label: t('kpi.clicks') },
        ],
      }),
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,.9fr)]' },
        h(Card, { id: 'social-performance-trend', title: t('soc.overTime'), subtitle: `${metricLabel} · ${showCompare ? (fr ? 'avec période de comparaison' : 'with comparison period') : (fr ? 'sans comparaison' : 'no comparison')}` },
          now.impressions > 0
            ? h(TrendChart, { points, format: (v) => fmtInt(v, lang), metricLabel, deltaKind: 'rel', showCompare, lang, description: `${t('soc.title')} — ${metricLabel}`, height: 258 })
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),
        h(Card, {
          title: fr ? 'Croissance des abonnés' : 'Follower growth',
          subtitle: fr ? 'Croissance nette = abonnés gagnés − abonnés perdus, cumulée sur la période.' : 'Net growth = followers gained − followers lost, accumulated over the period.',
        },
          h('div', { className: 'mb-3 grid grid-cols-3 gap-2' },
            h(StatTile, { label: fr ? 'Début de période' : 'Start of period', value: fmtCompact(followerStart, lang) }),
            h(StatTile, { label: fr ? 'Croissance nette' : 'Net growth', value: fmtSignedInt(now.followerNet, lang), tone: now.followerNet >= 0 ? 'pos' : 'neg' }),
            h(StatTile, { label: fr ? 'Fin de période' : 'End of period', value: fmtCompact(followerEnd, lang) })),
          h(MultiMetricTrend, {
            points: followerPoints, lang, height: 176,
            yDomain: ['dataMin', 'dataMax'],
            series: [{ key: 'followers', label: fr ? 'Abonnés' : 'Followers', format: (v) => fmtCompact(v, lang) }],
            ariaLabel: fr ? 'Évolution des abonnés' : 'Follower growth over time',
          }),
          h('p', { className: 'mb-0 mt-2 text-[10.5px] leading-4 text-t3' }, fr
            ? 'L’axe vertical est cadré sur la plage observée (il ne démarre pas à zéro) afin que la croissance nette reste lisible sur une base d’abonnés élevée.'
            : 'The vertical axis is framed on the observed range (it does not start at zero) so net growth stays readable against a large follower base.')))),

    /* ---------- 3 · where is it happening ---------- */
    h(PageSection, {
      step: 3,
      title: fr ? 'Où cela se passe' : 'Where it is happening',
      description: fr
        ? 'Comparaison des plateformes, puis composition de l’engagement — un même taux peut cacher des comportements très différents.'
        : 'Platform comparison, then the composition of engagement — the same rate can hide very different behaviour.',
    },
      h(Card, {
        id: 'social-platform-performance', title: t('soc.platforms'),
        subtitle: fr ? 'Volume, qualité et croissance d’abonnés côte à côte pour chaque plateforme.' : 'Volume, quality and follower growth side by side for every platform.',
      },
        pfRows.length
          ? h(DataTable, { columns: pfCols, rows: pfRows, rowKey: (r) => r.id, defaultSort: { id: 'impressions', dir: 'desc' }, ariaLabel: t('soc.platforms') })
          : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),

      h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' },
        h(Card, {
          id: 'social-engagement-composition', title: t('soc.composition'), subtitle: t('soc.compositionSub'),
        },
          compData.length
            ? h(StackedBars, {
              data: compData, lang, height: 268, ariaLabel: t('soc.composition'),
              series: [
                { key: 'reactions', label: fr ? 'Réactions' : 'Reactions' },
                { key: 'comments', label: fr ? 'Commentaires' : 'Comments' },
                { key: 'shares', label: fr ? 'Partages' : 'Shares' },
                { key: 'clicks', label: t('kpi.clicks') },
              ],
            })
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),

        h(Card, {
          title: fr ? 'Trafic et conversion générés' : 'Traffic and conversion generated',
          subtitle: fr
            ? 'Ce que le social produit réellement sur le site, dans le même périmètre de filtres.'
            : 'What social actually produces on the website, within the same filter scope.',
        },
          h('div', { className: 'grid grid-cols-2 gap-2 sm:grid-cols-3' },
            h(StatTile, { label: t('kpi.clicks'), value: fmtCompact(now.clicks, lang), hint: `${fmtPct(socialCtr, lang)} CTR` }),
            h(StatTile, { label: fr ? 'Clic → session' : 'Click → session', value: fmtPct(clickToSession === null ? null : clickToSession * 100, lang), hint: fr ? 'Rapprochement agrégé' : 'Aggregate matching' }),
            h(StatTile, { label: fr ? 'Sessions attribuées' : 'Attributed sessions', value: fmtCompact(attributedWeb.sessions, lang), hint: fr ? 'Canal Social' : 'Social channel' }),
            h(StatTile, { label: fr ? 'Sessions engagées' : 'Engaged sessions', value: fmtCompact(attributedWeb.engaged, lang), hint: `${fmtPct(engagementRateWeb(attributedWeb.engaged, attributedWeb.sessions), lang)} ${fr ? 'engagement' : 'engagement'}` }),
            h(StatTile, { label: t('kpi.conversions'), value: fmtInt(attributedWeb.conversions, lang), hint: `${fmtPct(cvr(attributedWeb.conversions, attributedWeb.sessions), lang)} CVR` }),
            h(StatTile, { label: fr ? 'Portée' : 'Reach', value: fmtCompact(now.reach, lang), hint: `${fmtPct(ratio(now.reach, now.impressions) === null ? null : ratio(now.reach, now.impressions) * 100, lang)} ${fr ? 'des impressions' : 'of impressions'}` })),
          h('p', { className: 'mb-0 mt-3 text-[10.5px] leading-4 text-t3' }, fr
            ? 'Les sessions sont mesurées au niveau du canal Social et réparties entre plateformes au prorata des clics lorsqu’un filtre plateforme est actif.'
            : 'Sessions are measured at Social-channel level and split between platforms in proportion to clicks when a platform filter is active.')))),

    /* ---------- 4 · why is it happening ---------- */
    h(PageSection, {
      step: 4,
      title: fr ? 'Pourquoi cela se passe' : 'Why it is happening',
      description: fr
        ? 'Format, sujet et qualité vidéo expliquent la plupart des écarts d’engagement.'
        : 'Format, topic and video quality explain most of the variation in engagement.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-2' },
        h(Card, {
          title: t('cnt.formats'),
          subtitle: fr ? 'Taux d’engagement moyen par format sur les contenus de la sélection.' : 'Average engagement rate by format across the selected content.',
        },
          formatRows.length
            ? h('ol', { className: 'm-0 flex list-none flex-col gap-2.5 p-0', 'aria-label': t('cnt.formats') }, formatRows.map((r) => h('li', { key: r.id, className: 'grid grid-cols-[minmax(84px,130px)_1fr_auto] items-center gap-2.5' },
              h('div', { className: 'min-w-0' },
                h('div', { className: 'truncate text-[12px] font-medium text-t1' }, r.name),
                h('div', { className: 'text-[10.5px] text-t3 tnum' }, `${r.n} · ${fmtCompact(r.imp, lang)} imp.`)),
              h(MiniBar, { pct: (r.er / maxFormatEr) * 100, color: 'var(--ch-3)' }),
              h(Num, { strong: true }, fmtPct(r.er, lang)))))
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),
        h(Card, {
          title: t('cnt.topics'),
          subtitle: fr ? 'Taux d’engagement moyen par sujet éditorial.' : 'Average engagement rate by editorial topic.',
        },
          themeRows.length
            ? h('ol', { className: 'm-0 flex list-none flex-col gap-2.5 p-0', 'aria-label': t('cnt.topics') }, themeRows.map((r) => h('li', { key: r.id, className: 'grid grid-cols-[minmax(84px,150px)_1fr_auto] items-center gap-2.5' },
              h('div', { className: 'min-w-0' },
                h('div', { className: 'truncate text-[12px] font-medium text-t1' }, r.name),
                h('div', { className: 'text-[10.5px] text-t3 tnum' }, `${r.n} · ${fmtCompact(r.imp, lang)} imp.`)),
              h(MiniBar, { pct: (r.er / maxThemeEr) * 100, color: 'var(--ch-4)' }),
              h(Num, { strong: true }, fmtPct(r.er, lang)))))
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }))),

      h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-2' },
        h(SocialVideoRetention, { q, lang }),
        h(SocialVideoQualityByPlatform, { q, lang })),

      /* progressive disclosure — planning analysis that only the social team needs */
      h(Disclosure, {
        id: 'social-planning',
        title: fr ? 'Analyse de planification' : 'Publishing plan analysis',
        description: fr
          ? 'Cadence de publication et créneaux — utile à l’équipe social, secondaire pour la lecture de performance.'
          : 'Publishing cadence and time slots — useful to the social team, secondary to the performance read.',
        badge: fr ? '2 analyses' : '2 analyses',
      },
        h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-2' },
          h('div', null,
            h('h3', { className: 'm-0 text-[13px] font-semibold text-t1' }, fr ? 'Fréquence de publication vs performance' : 'Publishing frequency vs performance'),
            h('p', { className: 'm-0 mb-3 mt-0.5 text-[11.5px] text-t3' }, fr ? 'Chaque point représente une semaine : volume publié contre engagement moyen.' : 'Each point is one week: volume published against average engagement.'),
            frequencyPoints.length >= 4
              ? h(ScatterMatrix, {
                points: frequencyPoints, lang, copy: freqCopy,
                xLabel: fr ? 'Posts / semaine' : 'Posts / week',
                yLabel: fr ? 'Taux d’engagement' : 'Engagement rate',
                zLabel: fr ? 'Impressions moyennes' : 'Avg impressions',
                ariaLabel: fr ? 'Fréquence de publication et performance' : 'Publishing frequency and performance',
              })
              : h(EmptyState, { title: t('state.empty.title'), body: fr ? 'Au moins quatre semaines de publication sont nécessaires.' : 'At least four weeks of publishing are required.' })),
          h('div', null,
            h('div', { className: 'mb-3 flex flex-wrap items-end justify-between gap-2' },
              h('div', null,
                h('h3', { className: 'm-0 text-[13px] font-semibold text-t1' }, fr ? 'Meilleurs créneaux de publication' : 'Best time to post'),
                h('p', { className: 'm-0 mt-0.5 text-[11.5px] text-t3' }, fr ? 'Signal directionnel sur les contenus de la sélection.' : 'Directional signal from the selected content.')),
              h(Segmented, {
                ariaLabel: fr ? 'Métrique heatmap' : 'Heatmap metric', size: 'sm', value: heatMetric, onChange: setHeatMetric,
                options: [
                  { id: 'er', label: 'ER' },
                  { id: 'reach', label: fr ? 'Portée moy.' : 'Avg reach' },
                  { id: 'clicks', label: fr ? 'Clics moy.' : 'Avg clicks' },
                ],
              })),
            h(HeatmapGrid, {
              rows: heatRows, cols: heatCols, cells: heatCells, lang,
              ariaLabel: fr ? 'Heatmap des créneaux de publication' : 'Best-time-to-post heatmap',
              format: (v) => (heatMetric === 'er' ? fmtPct(v, lang) : fmtCompact(v, lang)),
            }),
            h('p', { className: 'mb-0 mt-3 text-[10.5px] leading-4 text-t3' }, fr
              ? 'Les heures sont illustratives : les timestamps réels de publication ne sont pas connectés dans ce prototype.'
              : 'Hours are illustrative: real publishing timestamps are not connected in this prototype.'))))),

    /* ---------- 5 · what to do ---------- */
    h(PageSection, {
      step: 5,
      title: fr ? 'Ce qu’il faut faire' : 'What to do',
      description: fr
        ? 'Les contenus les plus performants, avec l’action recommandée pour chacun.'
        : 'The strongest content, each with its recommended next action.',
    },
      h(Card, {
        id: 'social-top-content', title: t('soc.topPosts'),
        subtitle: fr
          ? 'Classés par engagement pondéré par la portée : amplifier, distribuer, optimiser ou reconsidérer.'
          : 'Ranked by engagement weighted for reach: amplify, distribute, optimise or reconsider.',
      },
        topPosts.length
          ? h(DataTable, { columns: postCols, rows: topPosts, rowKey: (r) => r.id, ariaLabel: t('soc.topPosts') })
          : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })))
  );
}
