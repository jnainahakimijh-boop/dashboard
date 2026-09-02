import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Globe2, MousePointerClick, Radio, Search, UsersRound } from 'lucide-react';
import { CHANNELS } from '/src/data/dimensions.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { campaignTotals, comparisonQ, socialTotals, toQ, webTotals, webBy } from '/src/lib/aggregate.js';
import { advocacyTotals } from '/src/lib/advocacy.js';
import { seoTotals } from '/src/lib/seo.js';
import { aiSearchSnapshot } from '/src/lib/aiSearch.js';
import { cpa, ctr, cvr, deltaAbs, engagementRateSocial, engagementRateWeb, ratio } from '/src/lib/metrics.js';
import { fmtCompact, fmtEur, fmtInt, fmtPct } from '/src/lib/format.js';
import { Card, DeltaTag, InfoTip, PageSection } from '/src/components/ui/primitives.js';
import { RankedList } from '/src/components/charts/RankedList.js';

const h = React.createElement;

export default function GlobalPerformancePage() {
  const { filters } = useFilters();
  const { lang } = useI18n();
  const location = useLocation();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const link = (path) => `${path}${location.search}`;

  const web = webTotals(q); const wp = webTotals(p);
  const social = socialTotals(q); const sp = socialTotals(p);
  const advocacy = advocacyTotals(q, filters.advocacyPrograms, filters.advocateGroups);
  const ap = advocacyTotals(p, filters.advocacyPrograms, filters.advocateGroups);
  const seo = seoTotals(q); const seop = seoTotals(p);
  const campaigns = campaignTotals(q); const campaignsPrev = campaignTotals(p);
  const ai = aiSearchSnapshot(q);

  /* The cross-channel summary deliberately avoids adding incompatible units.
     "Measured impressions" combines impression events only, and is explicitly
     non-deduplicated: the same person can be counted on several channels. */
  const visibility = social.impressions + advocacy.impressions + seo.impressions + campaigns.impressions;
  const visibilityPrev = sp.impressions + ap.impressions + seop.impressions + campaignsPrev.impressions;
  const engagements = social.engagements + advocacy.engagements;
  const engagementsPrev = sp.engagements + ap.engagements;

  const groups = [
    {
      id: 'audience', label: fr ? 'Audience web' : 'Web audience', icon: UsersRound,
      value: web.users, prev: wp.users,
      detail: fr
        ? `Utilisateurs uniques du site. La portée sociale (${fmtCompact(social.reach, lang)}) est suivie séparément car elle ne se déduplique pas avec le web.`
        : `Unique website users. Social reach (${fmtCompact(social.reach, lang)}) is tracked separately because it does not deduplicate against the web.`,
      href: '/audience',
    },
    {
      id: 'visibility', label: fr ? 'Impressions mesurées' : 'Measured impressions', icon: Radio,
      value: visibility, prev: visibilityPrev,
      detail: fr
        ? 'Social + advocacy + recherche + paid. Somme d’événements d’exposition, non dédupliquée : ce n’est pas une audience unique.'
        : 'Social + advocacy + search + paid. A sum of exposure events, non-deduplicated: this is not a unique-audience figure.',
      href: '/social',
    },
    {
      id: 'engagement', label: fr ? 'Interactions sociales' : 'Social interactions', icon: MousePointerClick,
      value: engagements, prev: engagementsPrev,
      detail: fr
        ? `Engagements corporate + advocacy. La qualité du web se mesure autrement, en sessions engagées (${fmtPct(engagementRateWeb(web.engaged, web.sessions), lang)}).`
        : `Corporate + advocacy engagements. Web quality is measured differently, as engaged sessions (${fmtPct(engagementRateWeb(web.engaged, web.sessions), lang)}).`,
      href: '/social',
    },
    {
      id: 'traffic', label: fr ? 'Trafic web' : 'Web traffic', icon: Globe2,
      value: web.sessions, prev: wp.sessions,
      detail: fr
        ? `Sessions tous canaux confondus. ${fmtCompact(advocacy.sessions, lang)} sessions advocacy sont incluses dans ce total, pas ajoutées à côté.`
        : `Sessions across every channel. ${fmtCompact(advocacy.sessions, lang)} advocacy sessions are inside this total, not added alongside it.`,
      href: '/web',
    },
    {
      id: 'outcomes', label: fr ? 'Conversions web' : 'Web conversions', icon: Search,
      value: web.conversions, prev: wp.conversions,
      detail: fr
        ? `Objectifs complétés sur le site. Les ${fmtCompact(advocacy.conversions, lang)} conversions attribuées à l’advocacy en sont un sous-ensemble.`
        : `Goals completed on the website. The ${fmtCompact(advocacy.conversions, lang)} advocacy-attributed conversions are a subset of this.`,
      href: '/journey',
    },
  ];

  /* ---- channel contribution ---- */
  const byChannel = webBy(q, 'channel');
  const channelRows = CHANNELS.map((c) => {
    const x = byChannel.get(c.id);
    const v = x?.sessions ?? 0;
    return {
      id: c.id, label: fr ? c.nameFr : c.name,
      value: v, valueLabel: fmtCompact(v, lang),
      sub: x ? `${fmtPct(engagementRateWeb(x.engaged, x.sessions), lang)} ${fr ? 'engagement' : 'engagement'} · ${fmtPct(cvr(x.conversions, x.sessions), lang)} CVR` : undefined,
      share: web.sessions ? (v / web.sessions) * 100 : null,
    };
  }).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);

  /* ---- domain comparison: volume → quality → outcome, one row per domain ---- */
  const domains = [
    {
      id: 'web', name: fr ? 'Performance web' : 'Web performance', href: '/web',
      volumeLabel: fr ? 'Sessions' : 'Sessions', volume: fmtCompact(web.sessions, lang),
      qualityLabel: fr ? 'Taux d’engagement' : 'Engagement rate', quality: fmtPct(engagementRateWeb(web.engaged, web.sessions), lang),
      outcomeLabel: fr ? 'Conversions' : 'Conversions', outcome: fmtInt(web.conversions, lang),
      rateLabel: fr ? 'Taux de conversion' : 'Conversion rate', rate: fmtPct(cvr(web.conversions, web.sessions), lang),
    },
    {
      id: 'social', name: fr ? 'Réseaux sociaux' : 'Social media', href: '/social',
      volumeLabel: 'Impressions', volume: fmtCompact(social.impressions, lang),
      qualityLabel: fr ? 'Taux d’engagement' : 'Engagement rate', quality: fmtPct(engagementRateSocial(social.engagements, social.impressions), lang),
      outcomeLabel: fr ? 'Clics' : 'Clicks', outcome: fmtCompact(social.clicks, lang),
      rateLabel: 'CTR', rate: fmtPct(ctr(social.clicks, social.impressions), lang),
    },
    {
      id: 'advocacy', name: 'Employee Advocacy', href: '/advocacy',
      volumeLabel: 'Impressions', volume: fmtCompact(advocacy.impressions, lang),
      qualityLabel: fr ? 'Taux d’engagement' : 'Engagement rate', quality: fmtPct(engagementRateSocial(advocacy.engagements, advocacy.impressions), lang),
      outcomeLabel: fr ? 'Sessions attribuées' : 'Attributed sessions', outcome: fmtCompact(advocacy.sessions, lang),
      rateLabel: fr ? 'Taux de participation' : 'Participation rate', rate: fmtPct(ratio(advocacy.active, advocacy.registered) === null ? null : ratio(advocacy.active, advocacy.registered) * 100, lang),
    },
    {
      id: 'seo', name: fr ? 'SEO & Recherche' : 'SEO & Search', href: '/seo',
      volumeLabel: fr ? 'Impressions Search' : 'Search impressions', volume: fmtCompact(seo.impressions, lang),
      qualityLabel: fr ? 'Position moyenne' : 'Average position', quality: seo.avgPosition === null ? '—' : seo.avgPosition.toFixed(1),
      outcomeLabel: fr ? 'Clics organiques' : 'Organic clicks', outcome: fmtCompact(seo.clicks, lang),
      rateLabel: 'CTR', rate: fmtPct(ctr(seo.clicks, seo.impressions), lang),
    },
    {
      id: 'ai', name: 'AI Search & AEO', href: '/ai-search',
      volumeLabel: fr ? 'Prompts suivis' : 'Tracked prompts', volume: fmtInt(ai.trackedPrompts, lang),
      qualityLabel: fr ? 'Visibilité IA' : 'AI visibility', quality: fmtPct(ai.visibilityRate, lang),
      outcomeLabel: fr ? 'Sessions IA' : 'AI sessions', outcome: fmtCompact(ai.aiSessions, lang),
      rateLabel: fr ? 'Taux de citation' : 'Citation rate', rate: fmtPct(ai.citationRate, lang),
      prototype: true,
    },
    {
      id: 'campaigns', name: fr ? 'Campagnes' : 'Campaigns', href: '/campaigns',
      volumeLabel: 'Impressions', volume: fmtCompact(campaigns.impressions, lang),
      qualityLabel: 'CTR', quality: fmtPct(ctr(campaigns.clicks, campaigns.impressions), lang),
      outcomeLabel: fr ? 'Conversions' : 'Conversions', outcome: fmtInt(campaigns.conversions, lang),
      rateLabel: 'CPA', rate: fmtEur(cpa(campaigns.spend, campaigns.conversions), lang),
    },
  ];

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    /* ---------- 1 · cross-channel summary ---------- */
    h(PageSection, {
      step: 1,
      title: fr ? 'Vue cross-canal' : 'Cross-channel summary',
      description: fr
        ? 'Les métriques sont regroupées par rôle business, jamais additionnées entre unités incompatibles.'
        : 'Metrics are grouped by the business role they play, never summed across incompatible units.',
      right: h(InfoTip, {
        text: fr
          ? 'Additionner impressions sociales, impressions Search et sessions web produirait un chiffre sans signification. Chaque groupe reste dans son unité.'
          : 'Adding social impressions, search impressions and web sessions together would produce a meaningless number. Each group stays in its own unit.',
      }),
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] sm:grid-cols-2 xl:grid-cols-5' },
        groups.map((g) => h(Link, {
          key: g.id, to: link(g.href),
          className: 'surface-card interactive block rounded-[6px] border border-brd bg-card p-[var(--pad-card)] no-underline',
        },
          h('div', { className: 'flex items-center justify-between gap-2' },
            h('span', { className: 'text-[11px] font-bold text-t3' }, g.label),
            h(g.icon, { size: 15, className: 'text-acctext', 'aria-hidden': true })),
          h('div', { className: 'mt-3 text-[26px] font-bold leading-none text-t1 tnum' }, fmtCompact(g.value, lang)),
          h('div', { className: 'mt-3 flex items-center gap-2 border-t border-brd pt-2.5' },
            h(DeltaTag, { delta: deltaAbs(g.value, g.prev), lang }),
            h('span', { className: 'text-[11px] text-t3' }, filters.compare === 'none' ? (fr ? 'sans comparaison' : 'no comparison') : (fr ? 'vs comparaison' : 'vs comparison'))),
          h('p', { className: 'mb-0 mt-2 text-[11px] leading-4 text-t3' }, g.detail))))),

    /* ---------- 2 · domain comparison ---------- */
    h(PageSection, {
      step: 2,
      title: fr ? 'Comparaison des domaines' : 'Domain comparison',
      description: fr
        ? 'Pour chaque levier : le volume produit, la qualité obtenue et le résultat business — dans les unités propres à ce levier.'
        : 'For each channel: the volume produced, the quality achieved and the business outcome — each in its own native unit.',
    },
      h(Card, { id: 'global-domains' },
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full min-w-[820px] border-collapse text-left' },
            h('thead', null, h('tr', { className: 'border-b border-brd' },
              h('th', { scope: 'col', className: 'py-2 pr-3 text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Levier' : 'Channel'),
              h('th', { scope: 'col', className: 'py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Volume' : 'Volume'),
              h('th', { scope: 'col', className: 'py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Qualité' : 'Quality'),
              h('th', { scope: 'col', className: 'py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Résultat' : 'Outcome'),
              h('th', { scope: 'col', className: 'py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Taux clé' : 'Key rate'),
              h('th', { scope: 'col', className: 'py-2 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, ''))),
            h('tbody', null, domains.map((d) => h('tr', { key: d.id, className: 'border-b border-brd last:border-0' },
              h('td', { className: 'py-3 pr-3' },
                h('div', { className: 'text-[12.5px] font-semibold text-t1' }, d.name),
                d.prototype ? h('div', { className: 'mt-0.5 text-[10px] text-t3' }, fr ? 'Données prototype' : 'Prototype data') : null),
              h('td', { className: 'py-3 pr-3 text-right' },
                h('div', { className: 'text-[13px] font-bold text-t1 tnum' }, d.volume),
                h('div', { className: 'mt-0.5 text-[10px] text-t3' }, d.volumeLabel)),
              h('td', { className: 'py-3 pr-3 text-right' },
                h('div', { className: 'text-[13px] font-semibold text-t1 tnum' }, d.quality),
                h('div', { className: 'mt-0.5 text-[10px] text-t3' }, d.qualityLabel)),
              h('td', { className: 'py-3 pr-3 text-right' },
                h('div', { className: 'text-[13px] font-semibold text-t1 tnum' }, d.outcome),
                h('div', { className: 'mt-0.5 text-[10px] text-t3' }, d.outcomeLabel)),
              h('td', { className: 'py-3 pr-3 text-right' },
                h('div', { className: 'text-[13px] font-bold text-t1 tnum' }, d.rate),
                h('div', { className: 'mt-0.5 text-[10px] text-t3' }, d.rateLabel)),
              h('td', { className: 'py-3 text-right' },
                h(Link, { to: link(d.href), className: 'inline-flex items-center gap-1 text-[11px] font-semibold text-acctext no-underline' },
                  fr ? 'Ouvrir' : 'Open', h(ArrowRight, { size: 12, 'aria-hidden': true }))))))))))
    ,

    /* ---------- 3 · channel contribution ---------- */
    h(PageSection, {
      step: 3,
      title: fr ? 'Contribution des canaux' : 'Channel contribution',
      description: fr
        ? 'Part de chaque canal dans le trafic web, avec l’engagement et la conversion qu’il apporte.'
        : 'Each channel’s share of web traffic, with the engagement and conversion it brings.',
    },
      h(Card, { id: 'global-engagement' },
        channelRows.length
          ? h(RankedList, { rows: channelRows, lang, ariaLabel: fr ? 'Contribution des canaux' : 'Channel contribution' })
          : h('p', { className: 'm-0 py-4 text-[12px] text-t3' }, fr ? 'Aucune donnée pour cette sélection.' : 'No data for this selection.'),
        h('p', { className: 'mb-0 mt-4 border-t border-brd pt-3 text-[10.5px] leading-4 text-t3' }, fr
          ? 'Le canal Social est dérivé des clics sociaux ; le canal Paid Media contient les sessions de campagne plus une base always-on. Les deux se réconcilient avec les pages Réseaux sociaux et Campagnes.'
          : 'The Social channel is derived from social clicks; Paid Media contains campaign sessions plus an always-on base. Both reconcile with the Social Media and Campaigns pages.')))
  );
}
