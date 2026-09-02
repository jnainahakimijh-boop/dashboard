import React, { useMemo, useState } from 'react';
import { FORMATS, MARKETS, PLATFORMS, THEMES } from '/src/data/dimensions.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { comparisonQ, contentItems, toQ } from '/src/lib/aggregate.js';
import { ctr, cvr, deltaAbs, deltaRate, engagementRateSocial, ratio } from '/src/lib/metrics.js';
import { fmtCompact, fmtDayFull, fmtInt, fmtPct } from '/src/lib/format.js';
import { KpiCard } from '/src/components/kpi/KpiCard.js';
import { RankedList } from '/src/components/charts/RankedList.js';
import { ScatterMatrix } from '/src/components/charts/ScatterMatrix.js';
import { Badge, Card, EmptyState, MiniBar, PageSection, Segmented, StatTile } from '/src/components/ui/primitives.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';
import { ContentLongevity, ContentEvergreen } from '/src/components/analysis/diagnostics.js';

const h = React.createElement;

function totalsOf(items) {
  return items.reduce((acc, it) => {
    acc.impressions += it.impressions;
    acc.engagements += it.reactions + it.comments + it.shares;
    acc.clicks += it.clicks;
    acc.sessions += it.sessions;
    acc.conversions += it.conversions;
    return acc;
  }, { impressions: 0, engagements: 0, clicks: 0, sessions: 0, conversions: 0 });
}

export default function ContentPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const showCompare = filters.compare !== 'none';
  const items = contentItems(q);
  const prevItems = contentItems(p);
  const [breakdown, setBreakdown] = useState('theme');

  const totals = useMemo(() => totalsOf(items), [items]);
  const prevTotals = useMemo(() => totalsOf(prevItems), [prevItems]);
  const overallEr = engagementRateSocial(totals.engagements, totals.impressions);
  const prevEr = engagementRateSocial(prevTotals.engagements, prevTotals.impressions);
  const overallCtr = ctr(totals.clicks, totals.impressions);
  const prevCtr = ctr(prevTotals.clicks, prevTotals.impressions);
  const overallCvr = cvr(totals.conversions, totals.sessions);
  const prevCvr = cvr(prevTotals.conversions, prevTotals.sessions);

  const kpi = (label, definition, value, prevValue, delta, href) => h(KpiCard, {
    key: label, label, definition, value, prevValue,
    delta: showCompare ? delta : undefined,
    compareLabel: showCompare ? (fr ? 'vs préc.' : 'vs prev.') : undefined,
    compareLabelFull: showCompare ? (fr ? 'vs période précédente' : 'vs previous period') : undefined,
    href, lang,
  });

  /* ---- topic / format / platform / market breakdowns ---- */
  const dimensions = {
    theme: { list: THEMES, key: 'theme', label: fr ? 'Sujet' : 'Topic' },
    format: { list: FORMATS, key: 'format', label: fr ? 'Format' : 'Format' },
    platform: { list: PLATFORMS, key: 'platform', label: fr ? 'Plateforme' : 'Platform' },
    market: { list: MARKETS, key: 'market', label: fr ? 'Marché' : 'Market' },
  };
  const aggregate = (key) => {
    const map = new Map();
    for (const it of items) {
      const cur = map.get(it[key]) || { imp: 0, eng: 0, clicks: 0, conv: 0, n: 0 };
      cur.imp += it.impressions;
      cur.eng += it.reactions + it.comments + it.shares;
      cur.clicks += it.clicks;
      cur.conv += it.conversions;
      cur.n += 1;
      map.set(it[key], cur);
    }
    return map;
  };
  const themeMap = aggregate('theme');
  const topicRows = THEMES.filter((th) => themeMap.has(th.id)).map((th) => {
    const v = themeMap.get(th.id);
    const er = engagementRateSocial(v.eng, v.imp);
    return {
      id: th.id, label: fr ? th.nameFr : th.name,
      sub: `${v.n} ${fr ? 'contenus' : 'items'} · ER ${fmtPct(er, lang)} · ${fmtInt(v.conv, lang)} conv.`,
      value: v.eng, valueLabel: fmtCompact(v.eng, lang),
      share: totals.engagements ? (v.eng / totals.engagements) * 100 : null,
    };
  }).sort((a, b) => b.value - a.value);

  const active = dimensions[breakdown];
  const activeMap = aggregate(active.key);
  const qualityRows = active.list.filter((x) => activeMap.has(x.id)).map((x) => {
    const v = activeMap.get(x.id);
    const er = engagementRateSocial(v.eng, v.imp) ?? 0;
    return {
      id: x.id,
      name: fr ? (x.nameFr ?? x.name) : x.name,
      er, n: v.n, imp: v.imp, clicks: v.clicks, conv: v.conv,
      ctr: ctr(v.clicks, v.imp),
    };
  }).sort((a, b) => b.er - a.er);
  const maxEr = Math.max(...qualityRows.map((r) => r.er), 0.001);

  /* ---- performance matrix ---- */
  const matrixPoints = items.map((it) => ({
    id: it.id,
    label: fr ? it.titleFr : it.title,
    sub: `${PLATFORMS.find((pf) => pf.id === it.platform)?.name || it.platform} · ${fmtDayFull(it.publishD, lang)}`,
    x: it.impressions,
    y: engagementRateSocial(it.reactions + it.comments + it.shares, it.impressions) || 0,
    z: it.conversions,
  }));
  const quadCopy = {
    amplify: { label: fr ? 'CONTENU STAR' : 'STAR CONTENT', desc: fr ? 'Forte diffusion et fort engagement — à répliquer.' : 'High reach and high engagement — replicate the recipe.' },
    distribute: { label: fr ? 'DIFFUSION À RENFORCER' : 'AMPLIFICATION NEEDED', desc: fr ? 'Qualité forte, diffusion insuffisante — à pousser.' : 'Strong quality, insufficient distribution — push it further.' },
    optimise: { label: fr ? 'À OPTIMISER' : 'OPTIMISE', desc: fr ? 'Forte diffusion, engagement faible — revoir le message.' : 'High reach, weak engagement — revisit the message.' },
    reconsider: { label: fr ? 'À REVOIR' : 'REVIEW', desc: fr ? 'Faible diffusion et faible engagement — à reconsidérer.' : 'Low reach and low engagement — reconsider the format or topic.' },
  };

  /* ---- library ---- */
  const libCols = [
    {
      id: 'title', header: t('nav.content'),
      cell: (r) => h('span', { className: 'block max-w-72 truncate text-[12px] font-medium text-t1', title: fr ? r.titleFr : r.title }, fr ? r.titleFr : r.title),
      sortValue: (r) => (fr ? r.titleFr : r.title), searchText: (r) => `${r.title} ${r.titleFr}`,
    },
    { id: 'platform', header: t('filters.platform'), cell: (r) => h(Num, { muted: true }, PLATFORMS.find((pf) => pf.id === r.platform)?.name || r.platform), sortValue: (r) => r.platform },
    { id: 'theme', header: t('filters.theme'), cell: (r) => h(Num, { muted: true }, (fr ? THEMES.find((x) => x.id === r.theme)?.nameFr : THEMES.find((x) => x.id === r.theme)?.name) || r.theme), sortValue: (r) => r.theme },
    { id: 'format', header: t('filters.format'), cell: (r) => h(Num, { muted: true }, (fr ? FORMATS.find((x) => x.id === r.format)?.nameFr : FORMATS.find((x) => x.id === r.format)?.name) || r.format), sortValue: (r) => r.format },
    { id: 'date', header: t('cnt.published'), cell: (r) => h(Num, { muted: true }, fmtDayFull(r.publishD, lang)), sortValue: (r) => r.publishD },
    { id: 'imp', header: t('kpi.impressions'), align: 'right', sortValue: (r) => r.impressions, cell: (r) => h(Num, null, fmtCompact(r.impressions, lang)) },
    { id: 'er', header: t('kpi.engagementRate'), align: 'right', sortValue: (r) => engagementRateSocial(r.reactions + r.comments + r.shares, r.impressions), cell: (r) => h(Num, { strong: true }, fmtPct(engagementRateSocial(r.reactions + r.comments + r.shares, r.impressions), lang)) },
    { id: 'clicks', header: t('kpi.clicks'), align: 'right', sortValue: (r) => r.clicks, cell: (r) => h(Num, null, fmtInt(r.clicks, lang)) },
    { id: 'sessions', header: t('kpi.sessions'), align: 'right', sortValue: (r) => r.sessions, cell: (r) => h(Num, null, fmtInt(r.sessions, lang)) },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.conversions, cell: (r) => h(Num, null, fmtInt(r.conversions, lang)) },
    { id: 'utm', header: 'UTM', align: 'right', sortValue: (r) => (r.utmTagged ? 1 : 0), cell: (r) => h(Badge, { tone: r.utmTagged ? 'pos' : 'warn' }, r.utmTagged ? (fr ? 'BALISÉ' : 'TAGGED') : (fr ? 'MANQUANT' : 'MISSING')) },
  ];

  const empty = items.length === 0;

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    /* ---------- 1 · what is happening ---------- */
    h(PageSection, {
      step: 1,
      title: fr ? 'Ce qui se passe' : 'What is happening',
      description: fr
        ? 'Le portefeuille éditorial publié dans la période et les filtres actifs.'
        : 'The editorial portfolio published within the active period and filters.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6' },
        kpi(fr ? 'Contenus publiés' : 'Published content',
          fr ? 'Nombre de contenus publiés dans la période et les filtres sélectionnés.' : 'Number of items published within the selected period and filters.',
          fmtInt(items.length, lang), fmtInt(prevItems.length, lang), deltaAbs(items.length, prevItems.length), '/content#content-library'),
        kpi(t('kpi.impressions'),
          fr ? 'Total des impressions générées par ces contenus.' : 'Total impressions generated by this content.',
          fmtCompact(totals.impressions, lang), fmtCompact(prevTotals.impressions, lang), deltaAbs(totals.impressions, prevTotals.impressions), '/content#content-matrix'),
        kpi(fr ? 'Engagements' : 'Engagements',
          fr ? 'Réactions, commentaires et partages cumulés.' : 'Reactions, comments and shares combined.',
          fmtCompact(totals.engagements, lang), fmtCompact(prevTotals.engagements, lang), deltaAbs(totals.engagements, prevTotals.engagements), '/content#content-matrix'),
        kpi(t('kpi.engagementRate'),
          fr ? 'Engagements ÷ impressions × 100.' : 'Engagements ÷ impressions × 100.',
          fmtPct(overallEr, lang), fmtPct(prevEr, lang), deltaRate(overallEr, prevEr), '/content#content-matrix'),
        kpi('CTR',
          fr ? 'Clics ÷ impressions × 100 — la capacité du contenu à générer une visite.' : 'Clicks ÷ impressions × 100 — the content’s ability to earn a visit.',
          fmtPct(overallCtr, lang), fmtPct(prevCtr, lang), deltaRate(overallCtr, prevCtr), '/content#content-library'),
        kpi(t('kpi.conversions'),
          fr ? 'Conversions attribuées aux sessions issues de ces contenus.' : 'Conversions attributed to sessions coming from this content.',
          fmtCompact(totals.conversions, lang), fmtCompact(prevTotals.conversions, lang), deltaAbs(totals.conversions, prevTotals.conversions), '/journey')),

      h('div', { className: 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4' },
        h(StatTile, { label: fr ? 'Clics' : 'Clicks', value: fmtCompact(totals.clicks, lang), hint: `${fmtPct(overallCtr, lang)} ${fr ? 'des impressions' : 'of impressions'}` }),
        h(StatTile, { label: fr ? 'Sessions générées' : 'Sessions generated', value: fmtCompact(totals.sessions, lang), hint: `${fmtPct(ratio(totals.sessions, totals.clicks) === null ? null : ratio(totals.sessions, totals.clicks) * 100, lang)} ${fr ? 'des clics' : 'of clicks'}` }),
        h(StatTile, { label: fr ? 'Taux de conversion' : 'Conversion rate', value: fmtPct(overallCvr, lang), hint: `${fr ? 'vs' : 'vs'} ${fmtPct(prevCvr, lang)} ${fr ? 'période précédente' : 'previous period'}` }),
        h(StatTile, {
          label: fr ? 'Couverture UTM' : 'UTM coverage',
          value: fmtPct(items.length ? (items.filter((x) => x.utmTagged).length / items.length) * 100 : null, lang),
          hint: fr ? 'Contenus correctement balisés' : 'Items correctly tagged',
        }))),

    /* ---------- 2 · where does performance come from ---------- */
    h(PageSection, {
      step: 2,
      title: fr ? 'D’où vient la performance' : 'Where performance comes from',
      description: fr
        ? 'Les sujets qui portent l’engagement, puis la qualité comparée par sujet, format, plateforme ou marché.'
        : 'The topics carrying engagement, then quality compared by topic, format, platform or market.',
      right: h(Segmented, {
        ariaLabel: fr ? 'Découpage' : 'Breakdown', size: 'sm', value: breakdown, onChange: setBreakdown,
        options: [
          { id: 'theme', label: fr ? 'Sujet' : 'Topic' },
          { id: 'format', label: 'Format' },
          { id: 'platform', label: fr ? 'Plateforme' : 'Platform' },
          { id: 'market', label: fr ? 'Marché' : 'Market' },
        ],
      }),
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-2' },
        h(Card, {
          id: 'content-topics', title: t('cnt.topics'),
          subtitle: fr
            ? 'Volume d’engagement par sujet — quel thème éditorial mobilise réellement l’audience.'
            : 'Engagement volume by topic — which editorial theme genuinely mobilises the audience.',
        },
          topicRows.length
            ? h(RankedList, { rows: topicRows, lang, ariaLabel: t('cnt.topics') })
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),

        h(Card, {
          title: `${active.label} · ${fr ? 'qualité' : 'quality'}`,
          subtitle: fr
            ? 'Taux d’engagement moyen, avec le volume publié et le CTR comme contexte.'
            : 'Average engagement rate, with published volume and CTR for context.',
        },
          qualityRows.length
            ? h('ol', { className: 'm-0 flex list-none flex-col gap-2.5 p-0', 'aria-label': active.label }, qualityRows.map((r) => h('li', { key: r.id, className: 'grid grid-cols-[minmax(96px,160px)_1fr_auto] items-center gap-2.5' },
              h('div', { className: 'min-w-0' },
                h('div', { className: 'truncate text-[12px] font-medium text-t1' }, r.name),
                h('div', { className: 'text-[10.5px] text-t3 tnum' }, `${r.n} · ${fmtCompact(r.imp, lang)} imp. · CTR ${fmtPct(r.ctr, lang)}`)),
              h(MiniBar, { pct: (r.er / maxEr) * 100, color: 'var(--ch-3)' }),
              h(Num, { strong: true }, fmtPct(r.er, lang)))))
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })))),

    /* ---------- 3 · which content to act on ---------- */
    h(PageSection, {
      step: 3,
      title: fr ? 'Sur quels contenus agir' : 'Which content to act on',
      description: fr
        ? 'Chaque point est un contenu. Les lignes médianes séparent quatre décisions concrètes.'
        : 'Every dot is one piece of content. The median lines separate four concrete decisions.',
    },
      h(Card, {
        id: 'content-matrix',
        title: fr ? 'Matrice de performance des contenus' : 'Content performance matrix',
        subtitle: fr
          ? 'Axe horizontal : impressions (diffusion). Axe vertical : taux d’engagement (résonance). Taille de la bulle : conversions.'
          : 'Horizontal axis: impressions (distribution). Vertical axis: engagement rate (resonance). Bubble size: conversions.',
        right: h('span', { className: 'rounded-[6px] border border-brd bg-card2 px-2.5 py-1.5 text-[11px] font-semibold text-t2 tnum' },
          `${fmtInt(matrixPoints.length, lang)} ${fr ? 'contenus tracés' : 'items plotted'}`),
      },
        matrixPoints.length >= 4
          ? h(ScatterMatrix, {
            points: matrixPoints, lang, copy: quadCopy, height: 340,
            xLabel: t('kpi.impressions'), yLabel: t('kpi.engagementRate'), zLabel: t('kpi.conversions'),
            ariaLabel: `${t('cnt.matrix')} — ${t('cnt.matrixSub')}`,
          })
          : h(EmptyState, {
            title: fr ? 'Pas assez de contenus pour une matrice fiable' : 'Not enough content for a reliable matrix',
            body: fr ? 'Élargissez la période ou retirez un filtre : quatre contenus minimum sont nécessaires.' : 'Widen the period or remove a filter: at least four items are required.',
          }))),

    /* ---------- 4 · how long does it keep working ---------- */
    h(PageSection, {
      step: 4,
      title: fr ? 'Combien de temps cela continue de produire' : 'How long it keeps producing',
      description: fr
        ? 'Un contenu qui travaille encore après une semaine mérite d’être republié plutôt que remplacé.'
        : 'Content still working after a week is worth resurfacing rather than replacing.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-2' },
        h(ContentLongevity, { q, lang }),
        h(ContentEvergreen, { q, lang }))),

    /* ---------- 5 · full library ---------- */
    h(PageSection, {
      step: 5,
      title: fr ? 'Bibliothèque de contenus' : 'Content library',
      description: fr
        ? 'La couche opérationnelle : tous les contenus de la sélection, triables, recherchables et exportables.'
        : 'The operational layer: every item in the selection, sortable, searchable and exportable.',
    },
      h(Card, { id: 'content-library' },
        !empty
          ? h(DataTable, { columns: libCols, rows: items, rowKey: (r) => r.id, defaultSort: { id: 'imp', dir: 'desc' }, searchable: true, pageSize: 10, ariaLabel: t('cnt.items') })
          : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })))
  );
}
