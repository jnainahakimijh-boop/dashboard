import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { MARKETS } from '/src/data/dimensions.js';
import { ADVOCACY_PROGRAMS } from '/src/data/advocacy.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { comparisonQ, socialTotals, toQ } from '/src/lib/aggregate.js';
import { advocacyBy, advocacyTotals, topAdvocates } from '/src/lib/advocacy.js';
import { cvr, ctr, deltaAbs, deltaRate, engagementRateSocial, ratio } from '/src/lib/metrics.js';
import { fmtCompact, fmtInt, fmtPct, fmtX } from '/src/lib/format.js';
import { KpiCard } from '/src/components/kpi/KpiCard.js';
import { MultiMetricTrend } from '/src/components/charts/MultiMetricTrend.js';
import { RankedList } from '/src/components/charts/RankedList.js';
import { Badge, Btn, Card, Disclosure, EmptyState, InfoTip, PageSection, Segmented, StatTile } from '/src/components/ui/primitives.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';
import { AdvocacyContinuity, AdvocacyByDepartment, AdvocacyByCountry } from '/src/components/analysis/diagnostics.js';

const h = React.createElement;
const pct = (num, den) => { const r = ratio(num, den); return r === null ? null : r * 100; };

export default function AdvocacyPage() {
  const { filters } = useFilters();
  const { lang } = useI18n();
  const location = useLocation();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const showCompare = filters.compare !== 'none';
  const programs = filters.advocacyPrograms;
  const groups = filters.advocateGroups;
  const now = advocacyTotals(q, programs, groups);
  const prev = advocacyTotals(p, programs, groups);
  const social = socialTotals(q);
  const [rankMetric, setRankMetric] = useState('reach');
  const [trendView, setTrendView] = useState('exposure');
  const [anonymise, setAnonymise] = useState(false);

  const er = engagementRateSocial(now.engagements, now.impressions);
  const erPrev = engagementRateSocial(prev.engagements, prev.impressions);
  const clickRate = ctr(now.clicks, now.impressions);
  const clickRatePrev = ctr(prev.clicks, prev.impressions);
  const convRate = cvr(now.conversions, now.sessions);
  const participation = pct(now.active, now.registered);
  const participationPrev = pct(prev.active, prev.registered);
  const amplification = ratio(now.reach, social.reach);
  const postsPerActive = ratio(now.posts, now.active);
  const reachPerPost = ratio(now.reach, now.posts);

  const kpi = (label, definition, value, prevValue, delta, href) => h(KpiCard, {
    key: label, label, definition, value, prevValue,
    delta: showCompare ? delta : undefined,
    compareLabel: showCompare ? (fr ? 'vs préc.' : 'vs prev.') : undefined,
    compareLabelFull: showCompare ? (fr ? 'vs période précédente' : 'vs previous period') : undefined,
    href, lang,
  });

  /* ---- trend ---- */
  const byDay = advocacyBy(q, 'day', programs, groups);
  const points = [];
  for (let d = q.from; d <= q.to; d++) {
    const x = byDay.get(d);
    points.push({ d, reach: x?.reach ?? 0, impressions: x?.impressions ?? 0, engagements: x?.engagements ?? 0 });
  }
  const trendSeries = trendView === 'engagements'
    ? [{ key: 'engagements', label: 'Engagements', format: (v) => fmtCompact(v, lang) }]
    : [
      { key: 'impressions', label: 'Impressions', format: (v) => fmtCompact(v, lang) },
      { key: 'reach', label: fr ? 'Portée' : 'Reach', format: (v) => fmtCompact(v, lang) },
    ];

  /* ---- programme contribution ---- */
  const byProgram = advocacyBy(q, 'program', programs, groups);
  const total = now[rankMetric];
  const programRows = ADVOCACY_PROGRAMS.map((prog) => {
    const x = byProgram.get(prog.id);
    if (!x) return null;
    const v = x[rankMetric] ?? 0;
    return {
      id: prog.id, label: fr ? prog.nameFr : prog.name,
      value: v, valueLabel: fmtCompact(v, lang),
      sub: `${fmtPct(engagementRateSocial(x.engagements, x.impressions), lang)} ER · ${fmtPct(ctr(x.clicks, x.impressions), lang)} CTR · ${fmtInt(x.active, lang)} ${fr ? 'actifs' : 'active'}`,
      share: total ? (v / total) * 100 : null,
    };
  }).filter(Boolean).sort((a, b) => b.value - a.value);

  /* ---- region contribution ---- */
  const byMarket = advocacyBy(q, 'market', programs, groups);
  const regionAgg = new Map();
  for (const m of MARKETS) {
    const x = byMarket.get(m.id);
    if (!x) continue;
    const cur = regionAgg.get(m.region) ?? { reach: 0, active: 0, registered: 0, sessions: 0, conversions: 0 };
    cur.reach += x.reach; cur.active += x.active; cur.registered += x.registered;
    cur.sessions += x.sessions; cur.conversions += x.conversions;
    regionAgg.set(m.region, cur);
  }
  const regionRows = [...regionAgg.entries()].map(([region, x]) => ({
    id: region, label: region,
    sub: `${fmtPct(pct(x.active, x.registered), lang)} ${fr ? 'de participation' : 'participation'} · ${fmtInt(x.sessions, lang)} sessions`,
    value: x.reach, valueLabel: fmtCompact(x.reach, lang),
    share: now.reach ? (x.reach / now.reach) * 100 : null,
  })).sort((a, b) => b.value - a.value);

  /* ---- contribution concentration: programme health, not a ranking ---- */
  const advocateRows = topAdvocates(q, groups);
  const concentration = useMemo(() => {
    if (!advocateRows.length) return null;
    const sorted = [...advocateRows].sort((a, b) => b.reach - a.reach);
    const totalReach = sorted.reduce((s, x) => s + x.reach, 0);
    if (!totalReach) return null;
    const shareOfTop = (fraction) => {
      const take = Math.max(1, Math.round(sorted.length * fraction));
      return (sorted.slice(0, take).reduce((s, x) => s + x.reach, 0) / totalReach) * 100;
    };
    return { top10: shareOfTop(0.1), top25: shareOfTop(0.25), bottom50: 100 - shareOfTop(0.5), count: sorted.length };
  }, [advocateRows]);

  /* ---- corporate vs advocacy comparison ---- */
  const comparison = [
    { metric: fr ? 'Portée' : 'Reach', corporate: fmtCompact(social.reach, lang), advocacy: fmtCompact(now.reach, lang) },
    { metric: fr ? 'Impressions' : 'Impressions', corporate: fmtCompact(social.impressions, lang), advocacy: fmtCompact(now.impressions, lang) },
    { metric: fr ? 'Taux d’engagement' : 'Engagement rate', corporate: fmtPct(engagementRateSocial(social.engagements, social.impressions), lang), advocacy: fmtPct(er, lang) },
    { metric: 'CTR', corporate: fmtPct(ctr(social.clicks, social.impressions), lang), advocacy: fmtPct(clickRate, lang) },
  ];

  const advocateCols = [
    {
      id: 'name', header: fr ? 'Participant' : 'Advocate',
      cell: (r, i) => h('div', null,
        h('div', { className: 'font-medium text-t1' }, anonymise ? `${fr ? 'Participant' : 'Advocate'} ${r.id.replace('adv-', '')}` : r.name),
        h('div', { className: 'text-[10.5px] text-t3' }, r.department)),
      sortValue: (r) => r.name, searchText: (r) => `${r.name} ${r.department}`,
    },
    { id: 'posts', header: fr ? 'Partages' : 'Shares', align: 'right', cell: (r) => h(Num, null, fmtInt(r.posts, lang)), sortValue: (r) => r.posts },
    { id: 'reach', header: fr ? 'Portée' : 'Reach', align: 'right', cell: (r) => h(Num, { strong: true }, fmtCompact(r.reach, lang)), sortValue: (r) => r.reach },
    { id: 'er', header: fr ? 'Taux d’engagement' : 'Engagement rate', align: 'right', cell: (r) => h(Num, null, fmtPct(engagementRateSocial(r.engagements, r.impressions), lang)), sortValue: (r) => engagementRateSocial(r.engagements, r.impressions) },
    { id: 'clicks', header: fr ? 'Clics' : 'Clicks', align: 'right', cell: (r) => h(Num, null, fmtInt(r.clicks, lang)), sortValue: (r) => r.clicks },
    { id: 'sessions', header: 'Sessions', align: 'right', cell: (r) => h(Num, null, fmtInt(r.sessions, lang)), sortValue: (r) => r.sessions },
    { id: 'conv', header: fr ? 'Conversions' : 'Conversions', align: 'right', cell: (r) => h(Num, null, fmtInt(r.conversions, lang)), sortValue: (r) => r.conversions },
  ];

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    h('div', { className: 'flex items-start gap-3 rounded-[8px] border border-info/25 bg-infosoft px-4 py-3 text-[11.5px] leading-5 text-t2' },
      h(ShieldCheck, { size: 17, className: 'mt-0.5 shrink-0 text-info', 'aria-hidden': true }),
      h('span', null, fr
        ? 'Cette vue mesure la santé du programme, pas la performance individuelle. Les données nominatives peuvent être anonymisées et les seuils RH/RGPD s’appliquent en production.'
        : 'This view measures programme health, not individual performance. Named data can be anonymised and HR/GDPR thresholds apply in production.')),

    /* ---------- 1 · adoption ---------- */
    h(PageSection, {
      step: 1,
      title: fr ? 'Adoption du programme' : 'Programme adoption',
      description: fr
        ? 'Combien de collaborateurs sont inscrits, combien participent réellement, et à quel rythme ils publient.'
        : 'How many employees are registered, how many actually take part, and how often they publish.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] sm:grid-cols-2 xl:grid-cols-5' },
        kpi(fr ? 'Ambassadeurs inscrits' : 'Registered advocates',
          fr ? 'Collaborateurs inscrits au programme dans le périmètre sélectionné.' : 'Employees enrolled in the programme within the selected scope.',
          fmtInt(now.registered, lang), fmtInt(prev.registered, lang), deltaAbs(now.registered, prev.registered), '/advocacy#advocacy-analysis'),
        kpi(fr ? 'Participants actifs' : 'Active advocates',
          fr ? 'Nombre moyen de participants actifs par jour sur la période.' : 'Average number of active participants per day over the period.',
          fmtInt(now.active, lang), fmtInt(prev.active, lang), deltaAbs(now.active, prev.active), '/advocacy#advocacy-trend'),
        kpi(fr ? 'Taux de participation' : 'Participation rate',
          fr ? 'Participants actifs ÷ inscrits. C’est l’indicateur d’adoption gouverné dans le Back Office.' : 'Active advocates ÷ registered advocates. This is the governed adoption KPI in the Back Office.',
          fmtPct(participation, lang), fmtPct(participationPrev, lang), deltaRate(participation, participationPrev), '/advocacy#advocacy-analysis'),
        kpi(fr ? 'Publications' : 'Shares published',
          fr ? 'Nombre de publications partagées par les collaborateurs sur la période.' : 'Number of posts shared by employees over the period.',
          fmtCompact(now.posts, lang), fmtCompact(prev.posts, lang), deltaAbs(now.posts, prev.posts), '/advocacy#advocacy-trend'),
        kpi(fr ? 'Publications par actif' : 'Shares per active advocate',
          fr ? 'Publications ÷ participants actifs — mesure la régularité, pas le volume brut.' : 'Shares ÷ active advocates — measures regularity rather than raw volume.',
          (postsPerActive ?? 0).toFixed(1), (ratio(prev.posts, prev.active) ?? 0).toFixed(1),
          deltaAbs(postsPerActive ?? 0, ratio(prev.posts, prev.active) ?? 0), '/advocacy#advocacy-trend'))),

    /* ---------- 2 · amplification ---------- */
    h(PageSection, {
      step: 2,
      title: fr ? 'Amplification' : 'Amplification',
      description: fr
        ? 'L’audience gagnée grâce aux collaborateurs, et son évolution quotidienne.'
        : 'The audience earned through employees, and how it moves day by day.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-[minmax(0,1.3fr)_minmax(0,.85fr)]' },
        h(Card, {
          id: 'advocacy-trend',
          title: fr ? 'Évolution de l’amplification' : 'Amplification over time',
          subtitle: fr
            ? 'Portée et impressions partagent la même échelle. Les engagements, cent fois plus petits, sont affichés séparément.'
            : 'Reach and impressions share one scale. Engagements, two orders of magnitude smaller, are shown separately.',
          right: h(Segmented, {
            ariaLabel: fr ? 'Métrique d’amplification' : 'Amplification metric', size: 'sm',
            value: trendView, onChange: setTrendView,
            options: [
              { id: 'exposure', label: fr ? 'Portée & impressions' : 'Reach & impressions' },
              { id: 'engagements', label: 'Engagements' },
            ],
          }),
        },
          now.impressions > 0
            ? h(MultiMetricTrend, {
              points, lang, height: 250, ariaLabel: fr ? 'Tendance advocacy' : 'Advocacy trend',
              series: trendSeries,
            })
            : h(EmptyState, { title: fr ? 'Aucune donnée' : 'No data', body: fr ? 'Aucune activité advocacy sur cette sélection.' : 'No advocacy activity for this selection.' })),
        h(Card, {
          title: fr ? 'Qualité de l’amplification' : 'Amplification quality',
          subtitle: fr ? 'Ce que produit chaque publication, indépendamment du volume.' : 'What each post produces, independently of volume.',
          right: h(InfoTip, {
            text: `${fr ? 'Taux d’amplification' : 'Amplification rate'}: ${fmtX(amplification, lang)} — ${fr ? 'portée advocacy ÷ portée corporate organique.' : 'advocacy reach ÷ corporate organic reach.'}`,
          }),
        },
          h('div', { className: 'grid grid-cols-2 gap-2' },
            h(StatTile, { label: fr ? 'Portée' : 'Reach', value: fmtCompact(now.reach, lang), hint: `${fmtX(amplification, lang)} ${fr ? 'du corporate' : 'of corporate'}` }),
            h(StatTile, { label: 'Impressions', value: fmtCompact(now.impressions, lang), hint: `${fmtPct(pct(now.reach, now.impressions), lang)} ${fr ? 'de portée unique' : 'unique reach'}` }),
            h(StatTile, { label: 'Engagements', value: fmtCompact(now.engagements, lang), hint: `${fmtPct(er, lang)} ER` }),
            h(StatTile, { label: fr ? 'Portée par publication' : 'Reach per share', value: fmtCompact(reachPerPost, lang), hint: fr ? 'Moyenne sur la période' : 'Average over the period' }))))),

    /* ---------- 3 · business contribution ---------- */
    h(PageSection, {
      step: 3,
      title: fr ? 'Contribution business' : 'Business contribution',
      description: fr
        ? 'Ce que le programme apporte au site : clics, sessions et conversions attribuées.'
        : 'What the programme delivers to the website: attributed clicks, sessions and conversions.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] sm:grid-cols-2 xl:grid-cols-4' },
        kpi(fr ? 'Clics' : 'Clicks',
          fr ? 'Clics sur les liens partagés par les collaborateurs.' : 'Clicks on links shared by employees.',
          fmtCompact(now.clicks, lang), fmtCompact(prev.clicks, lang), deltaAbs(now.clicks, prev.clicks), '/advocacy#advocacy-comparison'),
        kpi('CTR',
          fr ? 'Clics ÷ impressions advocacy.' : 'Advocacy clicks ÷ advocacy impressions.',
          fmtPct(clickRate, lang), fmtPct(clickRatePrev, lang), deltaRate(clickRate, clickRatePrev), '/advocacy#advocacy-comparison'),
        kpi(fr ? 'Sessions web' : 'Web sessions',
          fr ? 'Sessions attribuées aux liens partagés via le programme.' : 'Sessions attributed to links shared through the programme.',
          fmtCompact(now.sessions, lang), fmtCompact(prev.sessions, lang), deltaAbs(now.sessions, prev.sessions), '/journey'),
        kpi(fr ? 'Conversions' : 'Conversions',
          fr ? 'Conversions attribuées aux sessions advocacy. Sous-ensemble des conversions web totales.' : 'Conversions attributed to advocacy sessions. A subset of total web conversions.',
          fmtCompact(now.conversions, lang), fmtCompact(prev.conversions, lang), deltaAbs(now.conversions, prev.conversions), '/journey')),

      h(Card, {
        id: 'advocacy-comparison',
        title: fr ? 'Social corporate vs Employee Advocacy' : 'Corporate social vs Employee Advocacy',
        subtitle: fr
          ? 'Comparer volume et qualité, pas seulement la portée : l’advocacy pèse moins en volume mais convertit souvent mieux.'
          : 'Compare volume and quality, not reach alone: advocacy is smaller in volume but often converts better.',
      },
        h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)]' },
          h('div', { className: 'overflow-x-auto' },
            h('table', { className: 'w-full border-collapse text-[12px]' },
              h('thead', null, h('tr', { className: 'border-b border-brd text-left' },
                h('th', { scope: 'col', className: 'py-2 text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Métrique' : 'Metric'),
                h('th', { scope: 'col', className: 'py-2 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Corporate' : 'Corporate'),
                h('th', { scope: 'col', className: 'py-2 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, 'Advocacy'))),
              h('tbody', null, comparison.map((r) => h('tr', { key: r.metric, className: 'border-b border-brd last:border-0' },
                h('td', { className: 'py-2.5 font-medium text-t1' }, r.metric),
                h('td', { className: 'py-2.5 text-right' }, h(Num, null, r.corporate)),
                h('td', { className: 'py-2.5 text-right' }, h(Num, { strong: true }, r.advocacy)))))))
          ,
          h('div', { className: 'grid gap-2' },
            h(StatTile, { label: fr ? 'Taux d’amplification' : 'Amplification rate', value: fmtX(amplification, lang), hint: fr ? 'Portée advocacy ÷ portée corporate' : 'Advocacy reach ÷ corporate reach' }),
            h(StatTile, { label: fr ? 'Taux de conversion advocacy' : 'Advocacy conversion rate', value: fmtPct(convRate, lang), hint: fr ? 'Conversions ÷ sessions attribuées' : 'Conversions ÷ attributed sessions' }),
            h(StatTile, { label: fr ? 'Clic → session' : 'Click → session', value: fmtPct(pct(now.sessions, now.clicks), lang), hint: fr ? 'Continuité d’attribution' : 'Attribution continuity' }))))),

    /* ---------- 4 · programme analysis ---------- */
    h(PageSection, {
      step: 4,
      id: 'advocacy-analysis',
      title: fr ? 'Analyse du programme' : 'Programme analysis',
      description: fr
        ? 'Où le programme fonctionne et où il faut recruter : par programme, département, région et pays.'
        : 'Where the programme works and where to recruit: by programme, department, region and country.',
      right: h(Segmented, {
        ariaLabel: fr ? 'Métrique de classement' : 'Ranking metric', size: 'sm', value: rankMetric, onChange: setRankMetric,
        options: [
          { id: 'reach', label: fr ? 'Portée' : 'Reach' },
          { id: 'sessions', label: 'Sessions' },
          { id: 'engagements', label: fr ? 'Engag.' : 'Eng.' },
        ],
      }),
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-2' },
        h(Card, {
          title: fr ? 'Par programme' : 'By programme',
          subtitle: fr ? 'Contribution de chaque programme sur la métrique sélectionnée.' : 'Each programme’s contribution on the selected metric.',
        },
          programRows.length
            ? h(RankedList, { rows: programRows, lang, ariaLabel: fr ? 'Contribution par programme' : 'Contribution by programme' })
            : h(EmptyState, { title: fr ? 'Aucune donnée' : 'No data', body: fr ? 'Aucune donnée advocacy pour cette sélection.' : 'No advocacy data for this selection.' })),
        h(Card, {
          title: fr ? 'Par région' : 'By region',
          subtitle: fr ? 'Portée regroupée par région, avec le taux de participation local.' : 'Reach grouped by region, with the local participation rate.',
        },
          regionRows.length
            ? h(RankedList, { rows: regionRows, lang, ariaLabel: fr ? 'Contribution par région' : 'Contribution by region' })
            : h(EmptyState, { title: fr ? 'Aucune donnée' : 'No data', body: fr ? 'Aucune donnée advocacy pour cette sélection.' : 'No advocacy data for this selection.' }))),

      h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-3' },
        h(AdvocacyByDepartment, { q, lang, programs, groups }),
        h(AdvocacyByCountry, { q, lang, programs, groups }),
        h(AdvocacyContinuity, { q, lang, programs, groups })),

      concentration
        ? h(Card, {
          title: fr ? 'Concentration de la contribution' : 'Contribution concentration',
          subtitle: fr
            ? 'Un programme sain répartit la portée. Une forte concentration signale une dépendance à quelques participants.'
            : 'A healthy programme spreads reach. High concentration signals dependence on a few participants.',
        },
          h('div', { className: 'grid gap-2 sm:grid-cols-3' },
            h(StatTile, {
              label: fr ? 'Portée des 10 % les plus actifs' : 'Reach from the most active 10%',
              value: fmtPct(concentration.top10, lang),
              tone: concentration.top10 > 35 ? 'warn' : 'pos',
              hint: fr ? 'Au-delà de 35 %, la dépendance est élevée' : 'Above 35% the dependence is high',
            }),
            h(StatTile, {
              label: fr ? 'Portée des 25 % les plus actifs' : 'Reach from the most active 25%',
              value: fmtPct(concentration.top25, lang),
              hint: fr ? 'Répartition du cœur du programme' : 'Spread across the programme core',
            }),
            h(StatTile, {
              label: fr ? 'Portée de la moitié la moins active' : 'Reach from the least active half',
              value: fmtPct(concentration.bottom50, lang),
              tone: concentration.bottom50 < 15 ? 'warn' : 'pos',
              hint: fr ? 'Mesure la profondeur de l’engagement' : 'Measures the depth of engagement',
            })),
          h('p', { className: 'mb-0 mt-3 text-[10.5px] leading-4 text-t3' }, fr
            ? `Calculé sur ${fmtInt(concentration.count, lang)} participants du périmètre sélectionné.`
            : `Calculated across ${fmtInt(concentration.count, lang)} advocates in the selected scope.`))
        : null,

      h(Disclosure, {
        title: fr ? 'Détail par participant' : 'Individual contribution detail',
        description: fr
          ? 'Vue nominative destinée à la gestion du programme. Anonymisable pour les environnements soumis à des contraintes RH.'
          : 'Named view for programme management. Can be anonymised for environments with HR constraints.',
        badge: fr ? 'Données sensibles' : 'Sensitive data',
      },
        h('div', { className: 'mb-3 flex flex-wrap items-center gap-3' },
          h(Btn, { size: 'sm', variant: anonymise ? 'primary' : 'default', onClick: () => setAnonymise((v) => !v), 'aria-pressed': anonymise },
            anonymise ? (fr ? 'Noms masqués' : 'Names hidden') : (fr ? 'Masquer les noms' : 'Hide names')),
          h(Badge, { tone: anonymise ? 'pos' : 'neutral' }, anonymise ? (fr ? 'ANONYMISÉ' : 'ANONYMISED') : (fr ? 'NOMINATIF' : 'NAMED'))),
        advocateRows.length
          ? h(DataTable, {
            columns: advocateCols, rows: advocateRows.slice(0, 14), rowKey: (r) => r.id,
            defaultSort: { id: 'reach', dir: 'desc' }, searchable: !anonymise, pageSize: 8,
            ariaLabel: fr ? 'Détail par participant' : 'Individual contribution detail',
          })
          : h(EmptyState, { title: fr ? 'Aucune donnée' : 'No data', body: fr ? 'Aucun participant pour cette sélection.' : 'No advocate for this selection.' }))),

    /* ---------- 5 · what to do ---------- */
    h(PageSection, {
      step: 5,
      title: fr ? 'Ce qu’il faut faire' : 'What to do',
      description: fr
        ? 'Le contenu que le programme relaie se pilote depuis la performance éditoriale.'
        : 'The content the programme relays is steered from editorial performance.',
    },
      h(Card, {
        title: fr ? 'Contenu amplifié' : 'Amplified content',
        subtitle: fr
          ? 'Le prototype ne relie pas chaque partage à un contenu précis. Les thèmes et formats les plus performants se pilotent depuis Performance des contenus.'
          : 'The prototype does not link individual shares to a specific post. The strongest topics and formats are steered from Content Performance.',
      },
        h('div', { className: 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4' },
          h(StatTile, { label: fr ? 'Publications sur la période' : 'Shares in the period', value: fmtCompact(now.posts, lang), hint: `${(postsPerActive ?? 0).toFixed(1)} ${fr ? 'par actif' : 'per active advocate'}` }),
          h(StatTile, { label: fr ? 'Portée moyenne par publication' : 'Average reach per share', value: fmtCompact(reachPerPost, lang) }),
          h(StatTile, { label: fr ? 'Engagement par publication' : 'Engagements per share', value: fmtCompact(ratio(now.engagements, now.posts), lang) }),
          h(StatTile, { label: fr ? 'Sessions par publication' : 'Sessions per share', value: fmtCompact(ratio(now.sessions, now.posts), lang) })),
        h(Link, {
          to: `/content${location.search}`,
          className: 'mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-acctext no-underline',
        }, fr ? 'Ouvrir Performance des contenus' : 'Open Content Performance', h(ArrowRight, { size: 13, 'aria-hidden': true }))))
  );
}
