/** ------------------------------------------------------------------
 *  Diagnostic panels — the "why is it happening" layer.
 *
 *  These used to render as a second, detached page shell appended below
 *  every route, which made each page read as two unrelated halves. They are
 *  now plain cards that each page places inside its own analytical
 *  hierarchy, at the level where the question actually belongs.
 *  ------------------------------------------------------------------ */
import { createElement as h, Fragment } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CHANNELS, MARKETS, PLATFORMS } from '/src/data/dimensions.js';
import { ADVOCATE_GROUPS } from '/src/data/advocacy.js';
import { advocacyBy, advocacyTotals } from '/src/lib/advocacy.js';
import { contentItems, pagesBy, socialAttributedWebTotals, socialBy, socialTotals, webBy } from '/src/lib/aggregate.js';
import { filteredQueries, seoBy, seoTotals } from '/src/lib/seo.js';
import { engagementRateWeb, ratio } from '/src/lib/metrics.js';
import { fmtCompact, fmtDayFull, fmtDuration, fmtInt, fmtPct } from '/src/lib/format.js';
import { Card, MiniBar, StatTile } from '/src/components/ui/primitives.js';
import { FunnelSteps } from '/src/components/charts/FunnelSteps.js';
import { MultiMetricTrend } from '/src/components/charts/MultiMetricTrend.js';
import { RankedList } from '/src/components/charts/RankedList.js';
import { StackedBars } from '/src/components/charts/StackedBars.js';

const pct = (num, den) => { const r = ratio(num, den); return r === null ? null : r * 100; };
const note = (text) => h('p', { className: 'mb-0 mt-3 text-[10.5px] leading-4 text-t3' }, text);
const empty = (text) => h('p', { className: 'm-0 py-6 text-center text-[12px] text-t3' }, text);

function sumMap(map, fields) {
  const out = Object.fromEntries(fields.map((f) => [f, 0]));
  for (const row of map.values()) for (const f of fields) out[f] += row?.[f] ?? 0;
  return out;
}

/* ================= SEO ================= */

export function SeoRankingDistribution({ q, lang }) {
  const queries = filteredQueries(q);
  const buckets = [
    { id: 'top3', label: 'Top 3', min: 0, max: 3, color: 'var(--pos)' },
    { id: '4-10', label: '4–10', min: 3, max: 10, color: 'var(--ch-2)' },
    { id: '11-20', label: '11–20', min: 10, max: 20, color: 'var(--warn)' },
    { id: '21+', label: '21+', min: 20, max: Infinity, color: 'var(--neutral)' },
  ].map((b) => ({ ...b, value: queries.filter((r) => r.position > b.min && r.position <= b.max).length }));
  const total = buckets.reduce((s, b) => s + b.value, 0);
  const max = Math.max(...buckets.map((b) => b.value), 1);
  return h(Card, {
    id: 'seo-position-distribution',
    title: lang === 'fr' ? 'Distribution des positions' : 'Ranking distribution',
    subtitle: lang === 'fr' ? 'Requêtes suivies par tranche de classement — la page 1 commence à la position 10.' : 'Tracked queries by ranking band — page one ends at position 10.',
  }, h('div', { className: 'grid gap-3' }, buckets.map((b) => h('div', { key: b.id },
    h('div', { className: 'mb-1 flex items-baseline justify-between gap-3 text-[11.5px]' },
      h('span', { className: 'font-semibold text-t1' }, b.label),
      h('span', { className: 'text-t2 tnum' }, `${fmtInt(b.value, lang)} · ${fmtPct(pct(b.value, total), lang)}`)),
    h(MiniBar, { pct: (b.value / max) * 100, color: b.color })))),
    note(lang === 'fr' ? 'Progresser une requête de la tranche 4–10 vers le Top 3 est généralement le gain de clics le plus rapide.' : 'Moving a query from the 4–10 band into the top 3 is usually the fastest available click gain.'));
}

export function SeoBrandedSplit({ q, lang }) {
  const byDay = seoBy(q, 'day');
  const points = [];
  for (let d = q.from; d <= q.to; d++) {
    const x = byDay.get(d);
    points.push({ d, branded: x?.brandedClicks ?? 0, nonBranded: x?.nonBrandedClicks ?? 0 });
  }
  const totals = seoTotals(q);
  const brandShare = pct(totals.brandedClicks, totals.clicks);
  return h(Card, {
    id: 'seo-brand-demand',
    title: lang === 'fr' ? 'Marque vs hors-marque' : 'Branded vs non-branded',
    subtitle: lang === 'fr'
      ? `Part des clics de marque : ${fmtPct(brandShare, lang)}. Le hors-marque mesure l’acquisition réellement gagnée par le SEO.`
      : `Branded share of clicks: ${fmtPct(brandShare, lang)}. Non-branded is the acquisition SEO actually earns.`,
  }, h(MultiMetricTrend, {
    points, lang, height: 240,
    ariaLabel: lang === 'fr' ? 'Clics organiques marque et hors-marque' : 'Branded and non-branded organic clicks',
    series: [
      { key: 'branded', label: lang === 'fr' ? 'Marque' : 'Branded', format: (v) => fmtCompact(v, lang) },
      { key: 'nonBranded', label: lang === 'fr' ? 'Hors-marque' : 'Non-branded', format: (v) => fmtCompact(v, lang) },
    ],
  }));
}

/* ================= Social ================= */

export function SocialVideoRetention({ q, lang }) {
  const totals = socialTotals(q);
  const stages = [
    { id: 'views', label: lang === 'fr' ? 'Vues vidéo' : 'Video views', value: totals.videoViews },
    { id: '25', label: '25%', value: totals.video25 },
    { id: '50', label: '50%', value: totals.video50 },
    { id: '75', label: '75%', value: totals.video75 },
    { id: 'complete', label: lang === 'fr' ? 'Complétions' : 'Completed', value: totals.videoComplete },
  ];
  return h(Card, {
    id: 'social-video-retention',
    title: lang === 'fr' ? 'Rétention vidéo' : 'Video retention',
    subtitle: lang === 'fr' ? 'Les vues seules ne disent rien de la qualité : voici où l’audience décroche.' : 'Views alone say nothing about quality — this shows where the audience drops off.',
  }, totals.videoViews > 0
    ? h(FunnelSteps, { stages, lang, ariaLabel: lang === 'fr' ? 'Funnel de rétention vidéo' : 'Video retention funnel' })
    : empty(lang === 'fr' ? 'Aucune donnée vidéo pour cette sélection.' : 'No video data for this selection.'));
}

export function SocialVideoQualityByPlatform({ q, lang }) {
  const byPlatform = socialBy(q, 'platform');
  const rows = PLATFORMS.map((p) => {
    const x = byPlatform.get(p.id);
    if (!x || !x.videoViews) return null;
    const completion = pct(x.videoComplete, x.videoViews);
    const avgWatch = ratio(x.videoWatchSeconds, x.videoViews);
    return {
      id: p.id, label: p.name,
      sub: `${lang === 'fr' ? 'Visionnage moyen' : 'Avg watch'} ${fmtDuration(avgWatch)} · 50% ${fmtPct(pct(x.video50, x.videoViews), lang)}`,
      value: completion ?? 0, valueLabel: fmtPct(completion, lang), share: null,
    };
  }).filter(Boolean).sort((a, b) => b.value - a.value);
  return h(Card, {
    title: lang === 'fr' ? 'Qualité vidéo par plateforme' : 'Video quality by platform',
    subtitle: lang === 'fr' ? 'Classement par taux de complétion, avec temps de visionnage moyen.' : 'Ranked by completion rate, with average watch time.',
  }, rows.length
    ? h(RankedList, { rows, lang, ariaLabel: lang === 'fr' ? 'Qualité vidéo par plateforme' : 'Video quality by platform', showShare: false })
    : empty(lang === 'fr' ? 'Aucune donnée vidéo pour cette sélection.' : 'No video data for this selection.'));
}

/* ================= Web ================= */

export function WebCtaFunnel({ q, lang }) {
  const totals = sumMap(pagesBy(q, 'day'), ['sessions', 'engaged', 'ctaClicks', 'formStarts', 'formCompletions', 'conversions']);
  const stages = [
    { id: 'sessions', label: 'Sessions', value: totals.sessions },
    { id: 'engaged', label: lang === 'fr' ? 'Sessions engagées' : 'Engaged sessions', value: totals.engaged },
    { id: 'cta', label: lang === 'fr' ? 'Clics CTA' : 'CTA clicks', value: totals.ctaClicks },
    { id: 'starts', label: lang === 'fr' ? 'Formulaires démarrés' : 'Form starts', value: totals.formStarts },
    { id: 'complete', label: lang === 'fr' ? 'Formulaires complétés' : 'Form completions', value: totals.formCompletions },
  ];
  return h(Card, {
    id: 'web-cta-form-funnel',
    title: lang === 'fr' ? 'Comportement de conversion' : 'Conversion behaviour',
    subtitle: lang === 'fr' ? 'Le taux de conversion global décomposé en étapes, pour situer précisément la perte.' : 'The overall conversion rate broken into steps, so the drop-off has an address.',
  }, totals.sessions > 0
    ? h(FunnelSteps, { stages, lang, ariaLabel: lang === 'fr' ? 'Funnel CTA et formulaire' : 'CTA and form funnel' })
    : empty(lang === 'fr' ? 'Aucune session pour cette sélection.' : 'No sessions for this selection.'));
}

export function WebConversionGoals({ q, lang }) {
  const pages = pagesBy(q, 'page');
  const totals = sumMap(pages, ['conversions']);
  const categories = [
    { id: 'contact', label: lang === 'fr' ? 'Contact / demande' : 'Contact request', match: (p) => p === '/contact' },
    { id: 'careers', label: lang === 'fr' ? 'Carrières' : 'Careers', match: (p) => p === '/careers' },
    { id: 'events', label: lang === 'fr' ? 'Événements' : 'Events', match: (p) => p.startsWith('/events/') },
    { id: 'resources', label: lang === 'fr' ? 'Ressources / téléchargements' : 'Resources / downloads', match: (p) => p.startsWith('/resources/') },
    { id: 'commercial', label: lang === 'fr' ? 'Produit / pricing' : 'Product / pricing', match: (p) => p.startsWith('/products/') || p === '/pricing' || p.startsWith('/solutions/') },
    { id: 'other', label: lang === 'fr' ? 'Autres objectifs' : 'Other goals', match: () => true },
  ];
  const used = new Set();
  const rows = categories.map((c) => {
    let value = 0;
    for (const [path, row] of pages.entries()) if (!used.has(path) && c.match(path)) { value += row.conversions; used.add(path); }
    return { id: c.id, label: c.label, value, valueLabel: fmtCompact(value, lang), share: totals.conversions ? (value / totals.conversions) * 100 : null };
  }).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  return h(Card, {
    id: 'web-conversion-goals',
    title: lang === 'fr' ? 'Répartition des objectifs' : 'Conversion goal breakdown',
    subtitle: lang === 'fr' ? 'Conversions regroupées par intention de la landing page.' : 'Conversions grouped by the intent of the landing page.',
  }, rows.length
    ? h(RankedList, { rows, lang, ariaLabel: lang === 'fr' ? 'Répartition des objectifs de conversion' : 'Conversion goal breakdown' })
    : empty(lang === 'fr' ? 'Aucune conversion pour cette sélection.' : 'No conversions for this selection.'));
}

/* ================= Journey ================= */

export function JourneyAssistedContribution({ q, lang }) {
  const byChannel = webBy(q, 'channel');
  const rows = CHANNELS.map((c) => {
    const x = byChannel.get(c.id);
    if (!x) return null;
    const direct = x.conversions;
    const quality = (engagementRateWeb(x.engaged, x.sessions) ?? 0) / 100;
    const assisted = Math.round(Math.min(x.sessions * 0.018, direct * 0.85 + x.sessions * quality * 0.004));
    return { name: lang === 'fr' ? c.nameFr : c.name, direct, assisted };
  }).filter(Boolean);
  return h(Card, {
    id: 'journey-assisted',
    title: lang === 'fr' ? 'Conversions directes vs assistées' : 'Direct vs assisted conversions',
    subtitle: lang === 'fr'
      ? 'Les conversions directes sont mesurées ; les assists sont un modèle prototype. Ne les additionnez pas.'
      : 'Direct conversions are measured; assists are a prototype model. Do not add the two together.',
  }, rows.length
    ? h(Fragment, null,
        h(StackedBars, {
          data: rows, lang, height: 250,
          series: [
            { key: 'direct', label: lang === 'fr' ? 'Directes' : 'Direct' },
            { key: 'assisted', label: lang === 'fr' ? 'Assistées (modèle)' : 'Assisted (model)' },
          ],
          ariaLabel: lang === 'fr' ? 'Conversions directes et assistées modélisées' : 'Direct and modelled assisted conversions',
        }),
        note(lang === 'fr'
          ? 'Le modèle d’assist n’est pas dédupliqué : il n’existe pas d’identifiant utilisateur cross-canal dans ce jeu de données.'
          : 'The assist model is not deduplicated: this dataset has no cross-channel user identifier.'))
    : empty(lang === 'fr' ? 'Aucune donnée pour cette sélection.' : 'No data for this selection.'));
}

/* ================= Employee Advocacy ================= */

export function AdvocacyContinuity({ q, lang, programs, groups }) {
  const byDay = advocacyBy(q, 'day', programs, groups);
  const days = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  const slice = Math.max(1, Math.min(7, Math.floor(days.length / 3) || 1));
  const avg = (arr, key) => (arr.length ? arr.reduce((s, [, x]) => s + (x[key] ?? 0), 0) / arr.length : 0);
  const startActive = avg(days.slice(0, slice), 'active');
  const endActive = avg(days.slice(-slice), 'active');
  const continuity = startActive ? Math.min(100, (endActive / startActive) * 100) : 0;
  return h(Card, {
    title: lang === 'fr' ? 'Continuité de la base active' : 'Active-base continuity',
    subtitle: lang === 'fr' ? 'Stabilité du nombre d’actifs entre le début et la fin de la période.' : 'Stability of the active population between the start and end of the period.',
  },
    h('div', { className: 'text-[30px] font-bold leading-none text-t1 tnum' }, fmtPct(continuity, lang)),
    h(MiniBar, { pct: continuity, color: continuity >= 95 ? 'var(--pos)' : continuity >= 85 ? 'var(--warn)' : 'var(--neg)', className: 'mt-3' }),
    note(lang === 'fr'
      ? 'Indicateur de stabilité du programme, pas de rétention individuelle : il compare des moyennes d’effectifs actifs.'
      : 'A programme-stability indicator, not individual retention: it compares average active headcount.'));
}

export function AdvocacyByDepartment({ q, lang, programs, groups }) {
  const total = advocacyTotals(q, programs, groups);
  const byGroup = advocacyBy(q, 'group', programs, groups);
  const rows = ADVOCATE_GROUPS.map((g) => {
    const x = byGroup.get(g.id);
    if (!x) return null;
    return {
      id: g.id, label: lang === 'fr' ? g.nameFr : g.name,
      sub: `${lang === 'fr' ? 'Participation' : 'Participation'} ${fmtPct(pct(x.active, x.registered), lang)} · ${fmtInt(x.active, lang)} ${lang === 'fr' ? 'actifs' : 'active'}`,
      value: x.reach, valueLabel: fmtCompact(x.reach, lang), share: total.reach ? (x.reach / total.reach) * 100 : null,
    };
  }).filter(Boolean).sort((a, b) => b.value - a.value);
  return h(Card, {
    title: lang === 'fr' ? 'Par département' : 'By department',
    subtitle: lang === 'fr' ? 'Où le programme est réellement adopté.' : 'Where the programme is genuinely adopted.',
  }, rows.length ? h(RankedList, { rows, lang, ariaLabel: lang === 'fr' ? 'Advocacy par département' : 'Advocacy by department' })
    : empty(lang === 'fr' ? 'Aucune donnée pour cette sélection.' : 'No data for this selection.'));
}

export function AdvocacyByCountry({ q, lang, programs, groups }) {
  const total = advocacyTotals(q, programs, groups);
  const byMarket = advocacyBy(q, 'market', programs, groups);
  const rows = MARKETS.map((m) => {
    const x = byMarket.get(m.id);
    if (!x) return null;
    return {
      id: m.id, label: lang === 'fr' ? m.nameFr : m.name,
      sub: `${fmtInt(x.active, lang)} ${lang === 'fr' ? 'actifs sur' : 'active of'} ${fmtInt(x.registered, lang)}`,
      value: x.reach, valueLabel: fmtCompact(x.reach, lang), share: total.reach ? (x.reach / total.reach) * 100 : null,
    };
  }).filter(Boolean).sort((a, b) => b.value - a.value);
  return h(Card, {
    title: lang === 'fr' ? 'Par pays' : 'By country',
    subtitle: lang === 'fr' ? 'Couverture géographique du programme.' : 'Geographic coverage of the programme.',
  }, rows.length ? h(RankedList, { rows, lang, ariaLabel: lang === 'fr' ? 'Advocacy par pays' : 'Advocacy by country' })
    : empty(lang === 'fr' ? 'Aucune donnée pour cette sélection.' : 'No data for this selection.'));
}

/* ================= Content ================= */

export function ContentLongevity({ q, lang }) {
  const items = contentItems(q).filter((x) => (x.clicks90d ?? 0) > 0);
  const total = { d1: 0, d7: 0, d30: 0, d90: 0 };
  items.forEach((x) => {
    total.d1 += x.clicks24h ?? 0;
    total.d7 += x.clicks7d ?? 0;
    total.d30 += x.clicks30d ?? 0;
    total.d90 += x.clicks90d ?? x.clicks;
  });
  const stages = [
    { label: lang === 'fr' ? '24 heures' : 'First 24 hours', v: total.d1 },
    { label: lang === 'fr' ? '7 jours' : 'First 7 days', v: total.d7 },
    { label: lang === 'fr' ? '30 jours' : 'First 30 days', v: total.d30 },
    { label: lang === 'fr' ? '90 jours' : 'First 90 days', v: total.d90 },
  ];
  return h(Card, {
    title: lang === 'fr' ? 'Accumulation des clics après publication' : 'Click accumulation after publication',
    subtitle: lang === 'fr' ? 'Part du total 90 jours déjà atteinte à chaque échéance.' : 'Share of the 90-day total already reached at each checkpoint.',
  }, items.length
    ? h(Fragment, null,
        h('div', { className: 'grid gap-3' }, stages.map((s) => h('div', { key: s.label },
          h('div', { className: 'mb-1 flex items-baseline justify-between gap-3 text-[11.5px]' },
            h('span', { className: 'font-semibold text-t1' }, s.label),
            h('span', { className: 'text-t2 tnum' }, `${fmtCompact(s.v, lang)} · ${fmtPct(total.d90 ? (s.v / total.d90) * 100 : null, lang)}`)),
          h(MiniBar, { pct: total.d90 ? (s.v / total.d90) * 100 : 0, color: 'var(--ch-1)' })))),
        h('div', { className: 'mt-4 grid grid-cols-3 gap-2 border-t border-brd pt-4' },
          h(StatTile, {
            label: lang === 'fr' ? 'Clics après J+7' : 'Clicks after day 7',
            value: fmtCompact(Math.max(0, total.d90 - total.d7), lang),
            hint: `${fmtPct(total.d90 ? ((total.d90 - total.d7) / total.d90) * 100 : null, lang)} ${lang === 'fr' ? 'du total 90 j' : 'of the 90-day total'}`,
          }),
          h(StatTile, {
            label: lang === 'fr' ? 'Clics après J+30' : 'Clicks after day 30',
            value: fmtCompact(Math.max(0, total.d90 - total.d30), lang),
            hint: `${fmtPct(total.d90 ? ((total.d90 - total.d30) / total.d90) * 100 : null, lang)} ${lang === 'fr' ? 'du total 90 j' : 'of the 90-day total'}`,
          }),
          h(StatTile, {
            label: lang === 'fr' ? 'Contenus mesurés' : 'Items measured',
            value: fmtInt(items.length, lang),
            hint: lang === 'fr' ? 'Avec un historique 90 jours' : 'With a 90-day history',
          })))
    : empty(lang === 'fr' ? 'Aucun contenu sur cette période.' : 'No content in this period.'));
}

export function ContentEvergreen({ q, lang }) {
  const items = contentItems(q).filter((x) => (x.clicks90d ?? 0) > 0);
  const rows = items.map((x) => {
    const ninety = x.clicks90d ?? x.clicks;
    const tail = Math.max(0, ninety - (x.clicks7d ?? 0));
    const score = pct(tail, ninety) ?? 0;
    return {
      id: x.id, label: lang === 'fr' ? x.titleFr : x.title,
      sub: `${lang === 'fr' ? '7 j' : '7d'} ${fmtCompact(x.clicks7d, lang)} · ${lang === 'fr' ? '90 j' : '90d'} ${fmtCompact(ninety, lang)}`,
      value: score, valueLabel: fmtPct(score, lang), share: null,
    };
  }).sort((a, b) => b.value - a.value).slice(0, 8);
  return h(Card, {
    title: lang === 'fr' ? 'Contenus evergreen' : 'Evergreen content',
    subtitle: lang === 'fr' ? 'Part des clics à 90 jours générée après le 7ᵉ jour — les meilleurs candidats à la republication.' : 'Share of 90-day clicks earned after day 7 — the best candidates to resurface.',
  }, rows.length
    ? h(RankedList, { rows, lang, ariaLabel: lang === 'fr' ? 'Contenus evergreen' : 'Evergreen content', showShare: false })
    : empty(lang === 'fr' ? 'Aucun contenu sur cette période.' : 'No content in this period.'));
}

/* ================= Data quality ================= */

export function MeasurementCoverage({ q, lang }) {
  const items = contentItems(q);
  const tagged = items.filter((x) => x.utmTagged).length;
  const utm = pct(tagged, items.length);
  const social = socialTotals(q);
  const attributed = socialAttributedWebTotals(q);
  const clickToSession = pct(attributed.sessions, social.clicks);
  const rows = [
    { label: lang === 'fr' ? 'Couverture UTM des contenus' : 'Content UTM coverage', value: utm, detail: `${fmtInt(tagged, lang)} / ${fmtInt(items.length, lang)}` },
    { label: lang === 'fr' ? 'Continuité clic social → session' : 'Social click → session continuity', value: clickToSession, detail: lang === 'fr' ? 'Attribution source / medium' : 'Source / medium attribution' },
    { label: lang === 'fr' ? 'Mapping des landing pages SEO' : 'SEO landing-page mapping', value: 100, detail: lang === 'fr' ? 'Requêtes du prototype' : 'Prototype queries' },
  ];
  return h(Card, {
    title: lang === 'fr' ? 'Couverture de mesure' : 'Measurement coverage',
    subtitle: lang === 'fr' ? 'Ce qui limite la confiance dans les chiffres avant de les interpréter.' : 'What limits confidence in the numbers before anyone interprets them.',
  }, h('div', { className: 'grid gap-3' }, rows.map((r) => h('div', { key: r.label, className: 'rounded-[6px] border border-brd bg-card2 p-3' },
    h('div', { className: 'flex items-baseline justify-between gap-3' },
      h('span', { className: 'text-[12px] font-semibold text-t1' }, r.label),
      h('span', { className: 'text-[12px] font-bold text-t1 tnum' }, fmtPct(r.value, lang))),
    h(MiniBar, { pct: r.value ?? 0, color: (r.value ?? 0) >= 90 ? 'var(--pos)' : (r.value ?? 0) >= 75 ? 'var(--warn)' : 'var(--neg)', className: 'mt-2' }),
    h('div', { className: 'mt-1 text-[10.5px] text-t3' }, r.detail)))));
}

export function AnomalyTimeline({ q, lang }) {
  const webDay = webBy(q, 'day');
  const socialDay = socialBy(q, 'day');
  const days = [];
  for (let d = q.from; d <= q.to; d++) days.push({ d, s: webDay.get(d)?.sessions ?? 0, i: socialDay.get(d)?.impressions ?? 0 });
  const anomalies = [];
  for (let i = 7; i < days.length; i++) {
    const prev = days.slice(Math.max(0, i - 7), i);
    const avgS = prev.reduce((a, x) => a + x.s, 0) / prev.length;
    const avgI = prev.reduce((a, x) => a + x.i, 0) / prev.length;
    const ds = avgS ? ((days[i].s - avgS) / avgS) * 100 : 0;
    const di = avgI ? ((days[i].i - avgI) / avgI) * 100 : 0;
    const score = Math.max(Math.abs(ds), Math.abs(di));
    if (score >= 14) anomalies.push({ ...days[i], ds, di, score });
  }
  anomalies.sort((a, b) => b.score - a.score);
  const top = anomalies.slice(0, 5);
  return h(Card, {
    title: lang === 'fr' ? 'Anomalies détectées' : 'Detected anomalies',
    subtitle: lang === 'fr' ? 'Jours où les sessions web ou les impressions social s’écartent d’au moins 14 % de la moyenne glissante 7 jours.' : 'Days where web sessions or social impressions deviate at least 14% from the trailing 7-day average.',
  }, top.length
    ? h('div', { className: 'grid gap-2' }, top.map((a) => h('div', { key: a.d, className: 'flex items-start gap-3 rounded-[6px] border border-brd bg-card2 p-3' },
        h(AlertTriangle, { size: 14, className: 'mt-0.5 shrink-0 text-warn', 'aria-hidden': true }),
        h('div', null,
          h('div', { className: 'text-[12px] font-semibold text-t1' }, fmtDayFull(a.d, lang)),
          h('div', { className: 'mt-0.5 text-[11px] text-t3 tnum' },
            `${lang === 'fr' ? 'Sessions' : 'Sessions'} ${a.ds >= 0 ? '+' : ''}${a.ds.toFixed(1)}% · ${lang === 'fr' ? 'Impressions' : 'Impressions'} ${a.di >= 0 ? '+' : ''}${a.di.toFixed(1)}%`)))))
    : empty(lang === 'fr' ? 'Aucune anomalie significative sur cette période.' : 'No significant anomaly in this period.'));
}
