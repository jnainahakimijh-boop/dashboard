import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, SearchCheck } from 'lucide-react';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { comparisonQ, toQ, webTotals } from '/src/lib/aggregate.js';
import { filteredQueries, seoBy, seoTotals } from '/src/lib/seo.js';
import { ctr, cvr, deltaAbs, deltaRate, engagementRateWeb, ratio } from '/src/lib/metrics.js';
import { fmtCompact, fmtInt, fmtPct } from '/src/lib/format.js';
import { KpiCard } from '/src/components/kpi/KpiCard.js';
import { Badge, Card, EmptyState, PageSection, Segmented, StatTile } from '/src/components/ui/primitives.js';
import { MultiMetricTrend } from '/src/components/charts/MultiMetricTrend.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';
import { SeoRankingDistribution, SeoBrandedSplit } from '/src/components/analysis/diagnostics.js';

const h = React.createElement;

export default function SeoPage() {
  const { filters } = useFilters();
  const { lang } = useI18n();
  const location = useLocation();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const showCompare = filters.compare !== 'none';
  const [trendView, setTrendView] = useState('both');

  const now = seoTotals(q);
  const prev = seoTotals(p);
  const web = webTotals({ ...q, channels: ['organic'] });
  const webPrev = webTotals({ ...p, channels: ['organic'] });
  const searchCtr = ctr(now.clicks, now.impressions);
  const prevCtr = ctr(prev.clicks, prev.impressions);

  /* Search position is a rank: a smaller number is better, so the delta is
     expressed in positions gained rather than as a percentage of a rank. */
  const positionDelta = now.avgPosition != null && prev.avgPosition != null
    ? { value: now.avgPosition - prev.avgPosition, kind: 'rank', sentiment: now.avgPosition === prev.avgPosition ? 0 : now.avgPosition < prev.avgPosition ? 1 : -1 }
    : { value: null, kind: 'rank', sentiment: 0 };

  const kpi = (label, definition, value, prevValue, delta, href) => h(KpiCard, {
    key: label, label, definition, value, prevValue,
    delta: showCompare ? delta : undefined,
    compareLabel: showCompare ? (fr ? 'vs préc.' : 'vs prev.') : undefined,
    compareLabelFull: showCompare ? (fr ? 'vs période précédente' : 'vs previous period') : undefined,
    href, lang,
  });

  /* ---- trend ---- */
  const byDay = seoBy(q, 'day');
  const points = [];
  for (let d = q.from; d <= q.to; d++) {
    const x = byDay.get(d);
    points.push({ d, impressions: x?.impressions ?? 0, clicks: x?.clicks ?? 0 });
  }
  const trendSeries = trendView === 'clicks'
    ? [{ key: 'clicks', label: fr ? 'Clics' : 'Clicks', format: (v) => fmtCompact(v, lang) }]
    : trendView === 'impressions'
      ? [{ key: 'impressions', label: 'Impressions', format: (v) => fmtCompact(v, lang) }]
      : [
        { key: 'impressions', label: 'Impressions', format: (v) => fmtCompact(v, lang) },
        { key: 'clicks', label: fr ? 'Clics' : 'Clicks', format: (v) => fmtCompact(v, lang) },
      ];

  /* ---- queries ---- */
  const queryRows = filteredQueries(q).map((r) => ({
    ...r,
    ctr: ctr(r.clicks, r.impressions),
    opportunity: r.position >= 4 && r.position <= 15 && r.impressions > 12000
      ? 'near-page-1'
      : r.impressions > 18000 && (ctr(r.clicks, r.impressions) ?? 0) < 2.5
        ? 'low-ctr'
        : 'steady',
  }));
  const queryCols = [
    { id: 'query', header: fr ? 'Requête' : 'Query', cell: (r) => h('span', { className: 'text-[12px] font-medium text-t1' }, r.query), sortValue: (r) => r.query, searchText: (r) => r.query },
    { id: 'branded', header: fr ? 'Type' : 'Type', cell: (r) => h(Badge, { tone: r.branded ? 'neutral' : 'info' }, r.branded ? (fr ? 'MARQUE' : 'BRANDED') : (fr ? 'HORS-MARQUE' : 'NON-BRANDED')), sortValue: (r) => (r.branded ? 1 : 0) },
    { id: 'clicks', header: fr ? 'Clics' : 'Clicks', align: 'right', cell: (r) => h(Num, { strong: true }, fmtCompact(r.clicks, lang)), sortValue: (r) => r.clicks },
    { id: 'imp', header: 'Impressions', align: 'right', cell: (r) => h(Num, null, fmtCompact(r.impressions, lang)), sortValue: (r) => r.impressions },
    { id: 'ctr', header: 'CTR', align: 'right', cell: (r) => h(Num, null, fmtPct(r.ctr, lang)), sortValue: (r) => r.ctr },
    { id: 'pos', header: fr ? 'Position' : 'Position', align: 'right', cell: (r) => h(Num, null, r.position.toFixed(1)), sortValue: (r) => r.position },
    { id: 'conv', header: fr ? 'Conversions' : 'Conversions', align: 'right', cell: (r) => h(Num, null, fmtInt(r.conversions, lang)), sortValue: (r) => r.conversions },
    { id: 'page', header: 'Landing page', cell: (r) => h('span', { className: 'mono text-[10.5px] text-t3' }, r.landingPage), searchText: (r) => r.landingPage },
    {
      id: 'opp', header: fr ? 'Opportunité' : 'Opportunity', sortValue: (r) => r.opportunity,
      cell: (r) => r.opportunity === 'near-page-1'
        ? h(Badge, { tone: 'info', title: fr ? 'Position 4 à 15 avec un volume d’impressions élevé : le gain de position est le levier le plus direct.' : 'Position 4 to 15 with high impression volume: gaining rank is the most direct lever.' }, 'POS. 4–15')
        : r.opportunity === 'low-ctr'
          ? h(Badge, { tone: 'warn', title: fr ? 'Beaucoup d’impressions mais peu de clics : travailler le titre et la meta description.' : 'Plenty of impressions but few clicks: rework the title and meta description.' }, fr ? 'CTR FAIBLE' : 'LOW CTR')
          : h(Badge, { tone: 'neutral' }, fr ? 'STABLE' : 'STEADY'),
    },
  ];
  const opportunities = queryRows.filter((r) => r.opportunity !== 'steady').sort((a, b) => b.impressions - a.impressions).slice(0, 5);

  /* ---- SEO landing-page performance, aggregated from the tracked queries ---- */
  const pageMap = new Map();
  for (const r of queryRows) {
    const cur = pageMap.get(r.landingPage) ?? { clicks: 0, impressions: 0, conversions: 0, weighted: 0, queries: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.conversions += r.conversions;
    cur.weighted += r.position * r.impressions;
    cur.queries += 1;
    pageMap.set(r.landingPage, cur);
  }
  const landingRows = [...pageMap.entries()].map(([path, v]) => ({
    id: path, path, ...v,
    ctr: ctr(v.clicks, v.impressions),
    avgPosition: v.impressions ? v.weighted / v.impressions : null,
    cvr: cvr(v.conversions, v.clicks),
  })).sort((a, b) => b.clicks - a.clicks);
  const landingCols = [
    { id: 'path', header: 'Landing page', cell: (r) => h('span', { className: 'mono block max-w-56 truncate text-[11.5px] text-t1', title: r.path }, r.path), sortValue: (r) => r.path, searchText: (r) => r.path },
    { id: 'queries', header: fr ? 'Requêtes' : 'Queries', align: 'right', cell: (r) => h(Num, { muted: true }, fmtInt(r.queries, lang)), sortValue: (r) => r.queries },
    { id: 'imp', header: 'Impressions', align: 'right', cell: (r) => h(Num, null, fmtCompact(r.impressions, lang)), sortValue: (r) => r.impressions },
    { id: 'clicks', header: fr ? 'Clics' : 'Clicks', align: 'right', cell: (r) => h(Num, { strong: true }, fmtCompact(r.clicks, lang)), sortValue: (r) => r.clicks },
    { id: 'ctr', header: 'CTR', align: 'right', cell: (r) => h(Num, null, fmtPct(r.ctr, lang)), sortValue: (r) => r.ctr },
    { id: 'pos', header: fr ? 'Position moy.' : 'Avg position', align: 'right', cell: (r) => h(Num, null, r.avgPosition === null ? '—' : r.avgPosition.toFixed(1)), sortValue: (r) => r.avgPosition },
    { id: 'conv', header: fr ? 'Conversions' : 'Conversions', align: 'right', cell: (r) => h(Num, null, fmtInt(r.conversions, lang)), sortValue: (r) => r.conversions },
    { id: 'cvr', header: fr ? 'Conv. / clic' : 'Conv. per click', align: 'right', cell: (r) => h(Num, null, fmtPct(r.cvr, lang)), sortValue: (r) => r.cvr },
  ];

  /* ---- recommendations grounded in the numbers above ---- */
  const nearPageOne = queryRows.filter((r) => r.opportunity === 'near-page-1');
  const lowCtr = queryRows.filter((r) => r.opportunity === 'low-ctr');
  const nearPageOneUpside = nearPageOne.reduce((sum, r) => sum + Math.max(0, Math.round(r.impressions * 0.05) - r.clicks), 0);
  const recommendations = [
    nearPageOne.length ? {
      id: 'rank',
      title: fr ? `Faire progresser ${nearPageOne.length} requêtes de la position 4–15 vers le top 3` : `Move ${nearPageOne.length} queries from positions 4–15 into the top 3`,
      body: fr
        ? `Ces requêtes cumulent ${fmtCompact(nearPageOne.reduce((s, r) => s + r.impressions, 0), lang)} impressions. Atteindre un CTR de 5 % représenterait environ ${fmtCompact(nearPageOneUpside, lang)} clics supplémentaires.`
        : `These queries already collect ${fmtCompact(nearPageOne.reduce((s, r) => s + r.impressions, 0), lang)} impressions. Reaching a 5% click-through rate would be worth roughly ${fmtCompact(nearPageOneUpside, lang)} additional clicks.`,
      owner: 'SEO',
    } : null,
    lowCtr.length ? {
      id: 'ctr',
      title: fr ? `Réécrire les titres et meta descriptions de ${lowCtr.length} requêtes à fort volume` : `Rewrite titles and meta descriptions for ${lowCtr.length} high-volume queries`,
      body: fr
        ? 'Ces requêtes sont bien positionnées mais leur CTR reste sous 2,5 % : le problème est la présentation dans les résultats, pas le classement.'
        : 'These queries rank well but stay below a 2.5% click-through rate: the problem is how the result is presented, not the ranking.',
      owner: fr ? 'SEO & Contenu' : 'SEO & Content',
    } : null,
    {
      id: 'brand',
      title: fr ? 'Suivre séparément la demande de marque et l’acquisition hors-marque' : 'Track brand demand separately from non-branded acquisition',
      body: fr
        ? `La marque représente ${fmtPct(ratio(now.brandedClicks, now.clicks) === null ? null : ratio(now.brandedClicks, now.clicks) * 100, lang)} des clics organiques. La croissance SEO réelle se mesure sur le hors-marque.`
        : `Branded queries account for ${fmtPct(ratio(now.brandedClicks, now.clicks) === null ? null : ratio(now.brandedClicks, now.clicks) * 100, lang)} of organic clicks. Genuine SEO growth is measured on the non-branded half.`,
      owner: fr ? 'SEO & Communication' : 'SEO & Communications',
    },
  ].filter(Boolean);

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    /* ---------- 1 · search visibility ---------- */
    h(PageSection, {
      step: 1,
      title: fr ? 'Visibilité en recherche' : 'Search visibility',
      description: fr
        ? 'La chaîne SEO se lit de gauche à droite : visibilité → clics → trafic → conversion.'
        : 'The SEO chain reads left to right: visibility → clicks → traffic → conversion.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6' },
        kpi(fr ? 'Impressions Search' : 'Search impressions',
          fr ? 'Nombre d’affichages des pages du site dans les résultats de recherche.' : 'Times site pages appeared in search results.',
          fmtCompact(now.impressions, lang), fmtCompact(prev.impressions, lang), deltaAbs(now.impressions, prev.impressions), '/seo#seo-trend'),
        kpi(fr ? 'Clics organiques' : 'Organic clicks',
          fr ? 'Clics provenant des résultats de recherche naturels.' : 'Clicks coming from organic search results.',
          fmtCompact(now.clicks, lang), fmtCompact(prev.clicks, lang), deltaAbs(now.clicks, prev.clicks), '/seo#seo-trend'),
        kpi('Organic CTR',
          fr ? 'Clics ÷ impressions Search × 100.' : 'Search clicks ÷ search impressions × 100.',
          fmtPct(searchCtr, lang), fmtPct(prevCtr, lang), deltaRate(searchCtr, prevCtr), '/seo#seo-queries'),
        kpi(fr ? 'Position moyenne' : 'Average position',
          fr ? 'Position moyenne pondérée par les impressions. Une position plus basse est meilleure.' : 'Impression-weighted average position. A lower number is better.',
          now.avgPosition?.toFixed(1) ?? '—', prev.avgPosition?.toFixed(1) ?? '—', positionDelta, '/seo#seo-position-distribution'),
        kpi(fr ? 'Sessions organiques' : 'Organic sessions',
          fr ? 'Sessions web attribuées au canal Organic Search.' : 'Web sessions attributed to the Organic Search channel.',
          fmtCompact(web.sessions, lang), fmtCompact(webPrev.sessions, lang), deltaAbs(web.sessions, webPrev.sessions), '/web#web-acquisition'),
        kpi(fr ? 'Mots-clés classés' : 'Ranking keywords',
          fr ? 'Nombre moyen de mots-clés suivis avec une visibilité mesurable par jour.' : 'Average number of tracked keywords with measurable visibility per day.',
          fmtCompact(now.rankingKeywords, lang), fmtCompact(prev.rankingKeywords, lang), deltaAbs(now.rankingKeywords, prev.rankingKeywords), '/seo#seo-queries')),

      h('div', { className: 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4' },
        h(StatTile, { label: fr ? 'Clics de marque' : 'Branded clicks', value: fmtCompact(now.brandedClicks, lang), hint: `${fmtPct(ratio(now.brandedClicks, now.clicks) === null ? null : ratio(now.brandedClicks, now.clicks) * 100, lang)} ${fr ? 'des clics' : 'of clicks'}` }),
        h(StatTile, { label: fr ? 'Clics hors-marque' : 'Non-branded clicks', value: fmtCompact(now.nonBrandedClicks, lang), hint: fr ? 'Acquisition gagnée par le SEO' : 'Acquisition earned by SEO' }),
        h(StatTile, { label: fr ? 'Engagement organique' : 'Organic engagement rate', value: fmtPct(engagementRateWeb(web.engaged, web.sessions), lang), hint: fr ? 'Qualité du trafic SEO' : 'Quality of SEO traffic' }),
        h(StatTile, { label: fr ? 'Conversions organiques' : 'Organic conversions', value: fmtInt(web.conversions, lang), hint: `${fmtPct(cvr(web.conversions, web.sessions), lang)} CVR` }))),

    /* ---------- 2 · trend ---------- */
    h(PageSection, {
      step: 2,
      title: fr ? 'Comment cela évolue' : 'How it is evolving',
      description: fr
        ? 'Impressions et clics sont liés mais de volumes très différents : comparez leur trajectoire, pas leur hauteur.'
        : 'Impressions and clicks are related but very different in size: compare their trajectory, not their height.',
      right: h(Segmented, {
        ariaLabel: fr ? 'Métrique de tendance' : 'Trend metric', size: 'sm', value: trendView, onChange: setTrendView,
        options: [
          { id: 'both', label: fr ? 'Les deux' : 'Both' },
          { id: 'impressions', label: 'Impressions' },
          { id: 'clicks', label: fr ? 'Clics' : 'Clicks' },
        ],
      }),
    },
      h(Card, {
        id: 'seo-trend',
        title: fr ? 'Visibilité et clics organiques' : 'Organic visibility and clicks',
        subtitle: fr ? 'Évolution quotidienne sur la période sélectionnée.' : 'Daily movement across the selected period.',
      },
        now.impressions > 0
          ? h(MultiMetricTrend, { points, lang, height: 258, series: trendSeries, ariaLabel: fr ? 'Impressions et clics organiques' : 'Organic impressions and clicks' })
          : h(EmptyState, { title: fr ? 'Aucune donnée' : 'No data', body: fr ? 'Aucune donnée SEO pour cette sélection.' : 'No search data for this selection.' }))),

    /* ---------- 3 · where the visibility sits ---------- */
    h(PageSection, {
      step: 3,
      title: fr ? 'Où se situe la visibilité' : 'Where the visibility sits',
      description: fr
        ? 'La distribution des positions montre le potentiel disponible ; la répartition marque / hors-marque montre ce qui est réellement gagné.'
        : 'Ranking distribution shows the available upside; the branded split shows what is genuinely earned.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-2' },
        h(SeoRankingDistribution, { q, lang }),
        h(SeoBrandedSplit, { q, lang }))),

    /* ---------- 4 · queries and pages ---------- */
    h(PageSection, {
      step: 4,
      title: fr ? 'Quelles requêtes et quelles pages' : 'Which queries and which pages',
      description: fr
        ? 'Le détail opérationnel : requêtes suivies et pages de destination associées.'
        : 'The operational detail: tracked queries and the landing pages behind them.',
    },
      h(Card, {
        id: 'seo-queries', title: fr ? 'Requêtes de recherche' : 'Search queries',
        subtitle: fr
          ? 'Deux opportunités sont marquées automatiquement : position 4–15 à fort volume, et fort volume avec CTR faible.'
          : 'Two opportunities are flagged automatically: high-volume positions 4–15, and high volume with a weak click-through rate.',
      },
        queryRows.length
          ? h(DataTable, { columns: queryCols, rows: queryRows, rowKey: (r) => r.id, searchable: true, pageSize: 10, defaultSort: { id: 'imp', dir: 'desc' }, ariaLabel: fr ? 'Requêtes de recherche' : 'Search queries' })
          : h(EmptyState, { title: fr ? 'Aucune donnée' : 'No data', body: fr ? 'Aucune requête pour cette sélection.' : 'No query for this selection.' })),

      h(Card, {
        id: 'seo-landing-pages',
        title: fr ? 'Performance des pages de destination' : 'Landing page performance',
        subtitle: fr
          ? 'Les pages qui captent réellement la recherche, avec leur position moyenne pondérée.'
          : 'The pages actually capturing search demand, with their impression-weighted average position.',
      },
        landingRows.length
          ? h(DataTable, { columns: landingCols, rows: landingRows, rowKey: (r) => r.id, searchable: true, pageSize: 8, defaultSort: { id: 'clicks', dir: 'desc' }, ariaLabel: fr ? 'Performance des pages de destination' : 'Landing page performance' })
          : h(EmptyState, { title: fr ? 'Aucune donnée' : 'No data', body: fr ? 'Aucune page pour cette sélection.' : 'No page for this selection.' }))),

    /* ---------- 5 · what to do ---------- */
    h(PageSection, {
      step: 5,
      title: fr ? 'Ce qu’il faut faire' : 'What to do',
      description: fr
        ? 'Trois actions dérivées directement des chiffres ci-dessus, avec l’équipe responsable.'
        : 'Three actions derived directly from the numbers above, each with an owner.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]' },
        h(Card, {
          title: fr ? 'Actions SEO prioritaires' : 'Prioritised SEO actions',
          subtitle: fr ? 'Chaque action cite le signal qui la justifie.' : 'Each action cites the signal that justifies it.',
        },
          h('div', { className: 'grid gap-2' }, recommendations.map((r, index) => h('article', { key: r.id, className: 'rounded-[6px] border border-brd bg-card2 p-3.5' },
            h('div', { className: 'flex items-start gap-2.5' },
              h('span', { className: 'inline-flex h-6 w-8 shrink-0 items-center justify-center rounded-[5px] bg-accsoft text-[10px] font-bold text-acctext' }, `P${index + 1}`),
              h('div', { className: 'min-w-0' },
                h('div', { className: 'text-[12.5px] font-semibold leading-5 text-t1' }, r.title),
                h('p', { className: 'm-0 mt-1 text-[11.5px] leading-5 text-t2' }, r.body),
                h('div', { className: 'mt-1.5 text-[10.5px] text-t3' }, `${fr ? 'Responsable' : 'Owner'} · ${r.owner}`))))))),

        h(Card, {
          title: fr ? 'Opportunités les plus volumineuses' : 'Highest-volume opportunities',
          subtitle: fr ? 'Classées par impressions disponibles.' : 'Ranked by available impressions.',
        },
          opportunities.length
            ? h('div', { className: 'grid gap-2' }, opportunities.map((r) => h('div', { key: r.id, className: 'rounded-[6px] border border-brd bg-card2 p-3' },
              h('div', { className: 'flex gap-2' },
                h(SearchCheck, { size: 15, className: 'mt-0.5 shrink-0 text-acctext', 'aria-hidden': true }),
                h('div', { className: 'min-w-0' },
                  h('div', { className: 'truncate text-[12px] font-semibold text-t1', title: r.query }, r.query),
                  h('div', { className: 'mt-1 text-[11px] leading-4 text-t3 tnum' },
                    `${fmtCompact(r.impressions, lang)} imp. · CTR ${fmtPct(r.ctr, lang)} · ${fr ? 'pos.' : 'pos.'} ${r.position.toFixed(1)}`))))))
            : h('p', { className: 'm-0 py-4 text-[11.5px] text-t3' }, fr ? 'Aucune opportunité marquée sur cette sélection.' : 'No flagged opportunity in this selection.'),
          h(Link, {
            to: `/ai-search${location.search}`,
            className: 'mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-acctext no-underline',
          }, fr ? 'Voir la visibilité dans les moteurs IA' : 'See visibility in AI answer engines', h(ArrowRight, { size: 13, 'aria-hidden': true })))))
  );
}
