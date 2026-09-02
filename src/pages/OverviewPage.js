import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Lightbulb, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { CAMPAIGN_DEFS } from '/src/data/campaigns.js';
import { CHANNELS, MARKETS } from '/src/data/dimensions.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import {
  campaignBy, campaignTotals, comparisonQ, contentItems, socialBy, socialTotals,
  socialWebFunnel, toQ, webBy, webTotals
} from '/src/lib/aggregate.js';
import { advocacyTotals } from '/src/lib/advocacy.js';
import { seoBy, seoTotals } from '/src/lib/seo.js';
import { aiSearchSnapshot } from '/src/lib/aiSearch.js';
import { cpa, ctr, cvr, engagementRateSocial, engagementRateWeb, ratio, relChange } from '/src/lib/metrics.js';
import { fmtCompact, fmtEur, fmtInt, fmtPct, fmtPpDelta, fmtRelDelta } from '/src/lib/format.js';
import { topSignals } from '/src/lib/insights.js';
import { buildRecommendations } from '/src/lib/recommendations.js';
import { usePlatformConfig } from '/src/lib/platformConfig.js';
import { TrendChart } from '/src/components/charts/TrendChart.js';
import { Badge, Card, MiniBar, PageSection, Segmented } from '/src/components/ui/primitives.js';

const h = React.createElement;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

/** Compare a KPI against the target configured in Back Office → KPI governance.
 *  Returns a status only where a real target exists — no invented health scores. */
function evaluateTarget(definition, current, previous) {
  if (!definition || !definition.enabled || !Number.isFinite(current)) return { status: 'neutral', score: null, target: null };
  const target = Number(definition.target);
  if (!Number.isFinite(target)) return { status: 'neutral', score: null, target: null };
  if (definition.targetType === 'growth') {
    const actual = relChange(current, previous);
    if (actual == null) return { status: 'neutral', score: null, target };
    const score = target > 0 ? clamp((actual / target) * 100) : 100;
    return { status: actual >= target - 0.1 ? 'pos' : score >= 80 ? 'warn' : 'neg', score, target, actual };
  }
  if (definition.targetType === 'max') {
    const score = current > 0 ? clamp((target / current) * 100) : 100;
    return { status: current <= target + 0.05 ? 'pos' : score >= 80 ? 'warn' : 'neg', score, target, actual: current };
  }
  const score = target > 0 ? clamp((current / target) * 100) : 100;
  return { status: current >= target - 0.05 ? 'pos' : score >= 80 ? 'warn' : 'neg', score, target, actual: current };
}

function statusLabel(status, fr) {
  if (status === 'pos') return fr ? 'SUR OBJECTIF' : 'ON TRACK';
  if (status === 'warn') return fr ? 'À SURVEILLER' : 'WATCH';
  if (status === 'neg') return fr ? 'ACTION REQUISE' : 'ACTION';
  return fr ? 'INFORMATIF' : 'INFO';
}
const statusTone = (status) => (status === 'pos' || status === 'warn' || status === 'neg' ? status : 'neutral');

/* ---------------- level 1: executive KPIs ---------------- */

function ExecKpi({ label, value, delta, deltaKind = 'rel', higherIsBetter = true, sub, target, href, lang }) {
  const numericDelta = Number.isFinite(delta) ? delta : null;
  const positive = numericDelta == null || numericDelta === 0 ? null : higherIsBetter ? numericDelta > 0 : numericDelta < 0;
  const DeltaIcon = numericDelta == null || numericDelta === 0 ? null : numericDelta > 0 ? TrendingUp : TrendingDown;
  const deltaText = numericDelta == null ? '—' : deltaKind === 'pp' ? fmtPpDelta(numericDelta, lang) : fmtRelDelta(numericDelta, lang);
  return h(Link, {
    to: href,
    'aria-label': `${label}: ${value}`,
    className: 'block min-w-0 rounded-[8px] border border-brds bg-card p-4 no-underline transition hover:border-acc/35 hover:shadow-[0_4px_14px_rgba(9,8,22,.05)]',
  },
    h('div', { className: 'truncate text-[11px] font-semibold text-t2', title: label }, label),
    h('div', { className: 'mt-2 text-[26px] font-bold leading-none text-t1 tnum' }, value),
    h('div', { className: 'mt-2 flex min-h-5 flex-wrap items-center gap-x-1.5 text-[10.5px]' },
      DeltaIcon ? h(DeltaIcon, { size: 12, className: positive ? 'text-pos' : 'text-neg', 'aria-hidden': true }) : null,
      h('span', { className: positive == null ? 'text-t3' : positive ? 'font-semibold text-pos' : 'font-semibold text-neg' }, deltaText),
      sub ? h('span', { className: 'truncate text-t3' }, `· ${sub}`) : null),
    target ? h('div', { className: 'mt-1.5 truncate text-[10px] text-t3' }, target) : null
  );
}

/* ---------------- level 3: cross-channel health ---------------- */

function DomainCard({ label, value, metricName, detail, status, href, fr }) {
  const bar = status === 'pos' ? 100 : status === 'warn' ? 72 : status === 'neg' ? 46 : 60;
  const color = status === 'pos' ? 'var(--pos)' : status === 'warn' ? 'var(--warn)' : status === 'neg' ? 'var(--neg)' : 'var(--text-3)';
  return h(Link, {
    to: href,
    className: 'block rounded-[7px] border border-brd bg-card2 p-3.5 no-underline transition hover:border-acc/30',
  },
    h('div', { className: 'flex items-start justify-between gap-2' },
      h('span', { className: 'text-[11.5px] font-semibold text-t1' }, label),
      h(Badge, { tone: statusTone(status) }, statusLabel(status, fr))),
    h('div', { className: 'mt-2.5 text-[20px] font-bold leading-none text-t1 tnum' }, value),
    h('div', { className: 'mt-1 text-[10px] font-medium text-t3' }, metricName),
    h('div', { className: 'mt-1.5 min-h-8 text-[10.5px] leading-4 text-t3' }, detail),
    h('div', { className: 'mt-2.5' }, h(MiniBar, { pct: bar, color }))
  );
}

/* ---------------- level 4: social → website journey ---------------- */

function Journey({ stages, lang, fr }) {
  const impressions = stages[0].value;
  const names = [
    fr ? 'Impressions' : 'Impressions',
    fr ? 'Clics' : 'Clicks',
    fr ? 'Sessions' : 'Sessions',
    fr ? 'Sessions engagées' : 'Engaged sessions',
    fr ? 'Conversions' : 'Conversions',
  ];
  const rateNames = [
    'CTR',
    fr ? 'Clic → session' : 'Click → session',
    fr ? 'Taux d’engagement' : 'Engagement rate',
    fr ? 'Engagé → conversion' : 'Engaged → conversion',
  ];
  const rateFormulas = [
    fr ? 'clics ÷ impressions' : 'clicks ÷ impressions',
    fr ? 'sessions ÷ clics' : 'sessions ÷ clicks',
    fr ? 'sessions engagées ÷ sessions' : 'engaged ÷ sessions',
    fr ? 'conversions ÷ sessions engagées' : 'conversions ÷ engaged',
  ];
  const rates = stages.slice(1).map((stage, index) => (stages[index].value > 0 ? (stage.value / stages[index].value) * 100 : null));
  return h('div', { className: 'overflow-x-auto' },
    h('div', { className: 'grid min-w-[880px] grid-cols-[1fr_92px_1fr_92px_1fr_92px_1fr_92px_1fr] items-stretch gap-2' },
      stages.flatMap((stage, index) => {
        const shareOfImpressions = impressions > 0 ? (stage.value / impressions) * 100 : null;
        const node = h('div', { key: `node-${stage.id}`, className: 'rounded-[8px] border border-brd bg-card2 px-3.5 py-3' },
          h('div', { className: 'text-[10.5px] font-semibold text-t3' }, names[index]),
          h('div', { className: 'mt-1.5 text-[22px] font-bold leading-none text-t1 tnum' }, fmtCompact(stage.value, lang)),
          h('div', { className: 'mt-1.5 text-[9.5px] text-t3 tnum' },
            index === 0
              ? (fr ? 'base du parcours' : 'journey base')
              : `${fmtPct(shareOfImpressions, lang, shareOfImpressions !== null && shareOfImpressions < 1 ? 2 : 1)} ${fr ? 'des impressions' : 'of impressions'}`)
        );
        if (index === 4) return [node];
        const connector = h('div', { key: `rate-${stage.id}`, className: 'flex flex-col items-center justify-center px-0.5 text-center' },
          h('div', { className: 'text-[9.5px] font-semibold leading-3 text-t3' }, rateNames[index]),
          h('div', { className: 'mt-1 text-[13px] font-bold text-t1 tnum' }, fmtPct(rates[index], lang)),
          h(ArrowRight, { size: 15, className: 'mx-auto mt-1 text-acctext', 'aria-hidden': true }),
          h('div', { className: 'mt-1 text-[8.5px] leading-3 text-t3' }, rateFormulas[index])
        );
        return [node, connector];
      })
    )
  );
}

/* ---------------- level 5 helpers ---------------- */

function AttentionCard({ tone, eyebrow, headline, detail, href, cta, icon: Icon }) {
  const skin = tone === 'risk'
    ? { box: 'border-neg/30 bg-negsoft', label: 'text-acctext', icon: 'text-acctext' }
    : tone === 'opportunity'
      ? { box: 'border-pos/30 bg-possoft', label: 'text-pos', icon: 'text-pos' }
      : { box: 'border-info/30 bg-infosoft', label: 'text-info', icon: 'text-info' };
  return h('div', { className: `flex min-w-0 flex-col rounded-[8px] border px-4 py-3.5 ${skin.box}` },
    h('div', { className: 'flex items-center gap-2' },
      h(Icon, { size: 15, className: `shrink-0 ${skin.icon}`, 'aria-hidden': true }),
      h('span', { className: `text-[10px] font-bold uppercase tracking-[.07em] ${skin.label}` }, eyebrow)),
    h('div', { className: 'mt-2 text-[13px] font-semibold leading-5 text-t1' }, headline),
    detail ? h('div', { className: 'mt-1.5 text-[11.5px] leading-5 text-t2' }, detail) : null,
    href ? h(Link, { to: href, className: 'mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-acctext no-underline' }, cta, h(ArrowRight, { size: 12, 'aria-hidden': true })) : null
  );
}

function StatMini({ label, value }) {
  return h('div', { className: 'min-w-0 rounded-[6px] border border-brd bg-card px-2.5 py-2' },
    h('div', { className: 'truncate text-[9.5px] font-semibold text-t3' }, label),
    h('div', { className: 'mt-1 text-[15px] font-bold leading-none text-t1 tnum' }, value));
}

/* ================================================================ */

export default function OverviewPage() {
  const { filters } = useFilters();
  const { lang } = useI18n();
  const { config } = usePlatformConfig();
  const location = useLocation();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const showCompare = filters.compare !== 'none';
  const [trendMetric, setTrendMetric] = useState('sessions');
  const link = (path) => `${path}${location.search}`;

  const web = webTotals(q); const webPrev = webTotals(p);
  const social = socialTotals(q); const socialPrev = socialTotals(p);
  const seo = seoTotals(q); const seoPrev = seoTotals(p);
  const advocacy = advocacyTotals(q, filters.advocacyPrograms, filters.advocateGroups);
  const advocacyPrev = advocacyTotals(p, filters.advocacyPrograms, filters.advocateGroups);
  const campaigns = campaignTotals(q); const campaignsPrev = campaignTotals(p);
  const ai = aiSearchSnapshot(q); const aiPrev = aiSearchSnapshot(p);

  const webEr = engagementRateWeb(web.engaged, web.sessions);
  const webCvr = cvr(web.conversions, web.sessions);
  const socialEr = engagementRateSocial(social.engagements, social.impressions);
  const seoCtr = ctr(seo.clicks, seo.impressions);
  const advocacyParticipation = ratio(advocacy.active, advocacy.registered);
  const advocacyParticipationPct = advocacyParticipation == null ? null : advocacyParticipation * 100;
  const advocacyPrevParticipation = ratio(advocacyPrev.active, advocacyPrev.registered);
  const advocacyPrevPct = advocacyPrevParticipation == null ? null : advocacyPrevParticipation * 100;
  const campaignCpa = cpa(campaigns.spend, campaigns.conversions);

  /* ---- target evaluation (Back Office governed) ---- */
  const defs = Object.fromEntries((config.kpis || []).map((item) => [item.id, item]));
  const evals = {
    sessions: evaluateTarget(defs.sessions, web.sessions, webPrev.sessions),
    engagementRate: evaluateTarget(defs.engagementRate, webEr, null),
    conversions: evaluateTarget(defs.conversions, web.conversions, webPrev.conversions),
    cvr: evaluateTarget(defs.cvr, webCvr, null),
    socialEr: evaluateTarget(defs.socialEr, socialEr, null),
    seoCtr: evaluateTarget(defs.seoCtr, seoCtr, null),
    advocacyParticipation: evaluateTarget(defs.advocacyParticipation, advocacyParticipationPct, null),
    campaignCpa: evaluateTarget(defs.campaignCpa, campaignCpa, null),
  };
  const scored = Object.values(evals).filter((x) => x.score != null);
  const met = scored.filter((x) => x.status === 'pos').length;
  const watch = scored.filter((x) => x.status === 'warn').length;
  const action = scored.filter((x) => x.status === 'neg').length;
  const overallStatus = action > 0 ? 'neg' : watch > 0 ? 'warn' : 'pos';

  const signals = topSignals(q, lang, 5, { advocacyPrograms: filters.advocacyPrograms, advocateGroups: filters.advocateGroups });
  const recommendations = buildRecommendations(q, { advocacyPrograms: filters.advocacyPrograms, advocateGroups: filters.advocateGroups }).slice(0, 3);
  const activeSources = config.integrations.filter((x) => x.enabled);
  const healthySources = activeSources.filter((x) => x.health >= 90).length;

  /* ---- level 2: one trend, one unit at a time ---- */
  const webDay = webBy(q, 'day'); const webDayPrev = webBy(p, 'day');
  const socialDay = socialBy(q, 'day'); const socialDayPrev = socialBy(p, 'day');
  const seoDay = seoBy(q, 'day'); const seoDayPrev = seoBy(p, 'day');
  const TREND_METRICS = {
    sessions: { label: fr ? 'Sessions web' : 'Web sessions', read: (d) => webDay.get(d)?.sessions ?? 0, readPrev: (d) => webDayPrev.get(d)?.sessions ?? 0 },
    reach: { label: fr ? 'Portée sociale' : 'Social reach', read: (d) => socialDay.get(d)?.reach ?? 0, readPrev: (d) => socialDayPrev.get(d)?.reach ?? 0 },
    engagements: { label: fr ? 'Engagements sociaux' : 'Social engagements', read: (d) => socialDay.get(d)?.engagements ?? 0, readPrev: (d) => socialDayPrev.get(d)?.engagements ?? 0 },
    conversions: { label: fr ? 'Conversions web' : 'Web conversions', read: (d) => webDay.get(d)?.conversions ?? 0, readPrev: (d) => webDayPrev.get(d)?.conversions ?? 0 },
    organicClicks: { label: fr ? 'Clics organiques' : 'Organic clicks', read: (d) => seoDay.get(d)?.clicks ?? 0, readPrev: (d) => seoDayPrev.get(d)?.clicks ?? 0 },
  };
  const activeTrend = TREND_METRICS[trendMetric];
  const trendPoints = [];
  for (let d = q.from; d <= q.to; d++) {
    const index = d - q.from;
    const prevD = p.from + index;
    trendPoints.push({
      d,
      value: activeTrend.read(d),
      prev: prevD <= p.to ? activeTrend.readPrev(prevD) : null,
      prevD: prevD <= p.to ? prevD : null,
    });
  }

  /* ---- level 3: what is driving traffic ---- */
  const byChannel = webBy(q, 'channel');
  const byChannelPrev = webBy(p, 'channel');
  const channelRows = CHANNELS.map((channel) => {
    const row = byChannel.get(channel.id);
    const prevRow = byChannelPrev.get(channel.id);
    return {
      id: channel.id,
      label: fr ? channel.nameFr : channel.name,
      sessions: row?.sessions ?? 0,
      engagement: row ? engagementRateWeb(row.engaged, row.sessions) : null,
      conversionRate: row ? cvr(row.conversions, row.sessions) : null,
      conversions: row?.conversions ?? 0,
      growth: prevRow ? relChange(row?.sessions ?? 0, prevRow.sessions) : null,
    };
  }).filter((x) => x.sessions > 0).sort((a, b) => b.sessions - a.sessions);
  const advocacyDriver = advocacy.sessions > 0
    ? {
      id: 'advocacy',
      label: fr ? 'Employee Advocacy' : 'Employee Advocacy',
      sessions: advocacy.sessions,
      engagement: null,
      conversionRate: cvr(advocacy.conversions, advocacy.sessions),
      conversions: advocacy.conversions,
      growth: relChange(advocacy.sessions, advocacyPrev.sessions),
      attributed: true,
    }
    : null;
  const driverRows = [...channelRows, ...(advocacyDriver ? [advocacyDriver] : [])];
  const maxDriverSessions = Math.max(1, ...driverRows.map((x) => x.sessions));

  /* ---- level 5 inputs ---- */
  const marketMap = webBy(q, 'market');
  const topMarkets = MARKETS.map((market) => ({ market, data: marketMap.get(market.id) }))
    .filter((x) => x.data?.sessions > 0)
    .sort((a, b) => b.data.sessions - a.data.sessions)
    .slice(0, 3);

  const items = contentItems(q);
  const topContent = items.length ? [...items].sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)[0] : null;

  const campaignMap = campaignBy(q, 'campaign');
  const campaignRows = CAMPAIGN_DEFS.map((def) => ({ def, data: campaignMap.get(def.id) }))
    .filter((x) => x.data?.conversions > 0)
    .map((x) => ({ ...x, cpa: cpa(x.data.spend, x.data.conversions) }))
    .sort((a, b) => (a.cpa ?? Infinity) - (b.cpa ?? Infinity));
  const bestCampaign = campaignRows[0] || null;

  const funnel = socialWebFunnel(q);
  const funnelSessionCvr = funnel[2].value > 0 ? (funnel[4].value / funnel[2].value) * 100 : null;

  /* ---- primary risk: the weakest governed KPI, with its numbers ---- */
  const RISK_META = {
    sessions: { label: fr ? 'Sessions web' : 'Web sessions', href: '/web', format: (v) => fmtCompact(v, lang), growth: true },
    engagementRate: { label: fr ? 'Taux d’engagement web' : 'Web engagement rate', href: '/web', format: (v) => fmtPct(v, lang) },
    conversions: { label: fr ? 'Conversions' : 'Conversions', href: '/journey', format: (v) => fmtCompact(v, lang), growth: true },
    cvr: { label: fr ? 'Taux de conversion' : 'Conversion rate', href: '/journey', format: (v) => fmtPct(v, lang) },
    socialEr: { label: fr ? 'Engagement social' : 'Social engagement rate', href: '/social', format: (v) => fmtPct(v, lang) },
    seoCtr: { label: fr ? 'CTR organique' : 'Organic search CTR', href: '/seo', format: (v) => fmtPct(v, lang) },
    advocacyParticipation: { label: fr ? 'Participation Employee Advocacy' : 'Employee Advocacy participation', href: '/advocacy', format: (v) => fmtPct(v, lang) },
    campaignCpa: { label: fr ? 'CPA campagnes' : 'Campaign CPA', href: '/campaigns', format: (v) => fmtEur(v, lang), lower: true },
  };
  const weakestEntry =
    Object.entries(evals).filter(([, value]) => value.status === 'neg').sort((a, b) => (a[1].score ?? 999) - (b[1].score ?? 999))[0] ||
    Object.entries(evals).filter(([, value]) => value.status === 'warn').sort((a, b) => (a[1].score ?? 999) - (b[1].score ?? 999))[0] ||
    null;
  const riskMeta = weakestEntry ? RISK_META[weakestEntry[0]] : null;
  const riskEval = weakestEntry ? weakestEntry[1] : null;
  const riskDetail = riskMeta && riskEval && riskEval.target != null
    ? (riskMeta.growth
      ? `${fr ? 'Croissance' : 'Growth'} ${fmtRelDelta(riskEval.actual, lang)} · ${fr ? 'objectif' : 'target'} ${fmtRelDelta(riskEval.target, lang)}`
      : `${fr ? 'Actuel' : 'Actual'} ${riskMeta.format(riskEval.actual)} · ${fr ? 'objectif' : 'target'} ${riskMeta.format(riskEval.target)}${riskMeta.lower ? (fr ? ' max.' : ' max') : ''}`)
    : null;

  /* ---- opportunity: the strongest growing driver with real volume ---- */
  const volumeFloor = Math.max(1, maxDriverSessions * 0.05);
  const bestGrowth = driverRows
    .filter((x) => x.growth != null && x.sessions >= volumeFloor)
    .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
  const opportunity = bestGrowth && (bestGrowth.growth ?? 0) > 0
    ? {
      headline: `${bestGrowth.label} ${fmtRelDelta(bestGrowth.growth, lang)}`,
      detail: `${fmtCompact(bestGrowth.sessions, lang)} ${fr ? 'sessions' : 'sessions'} · ${fr ? 'taux de conversion' : 'conversion rate'} ${fmtPct(bestGrowth.conversionRate, lang)}`,
    }
    : signals[0]
      ? { headline: signals[0].text, detail: null }
      : null;

  const headline = action > 0
    ? (fr ? `La performance progresse, mais ${riskMeta ? riskMeta.label.toLowerCase() : 'un indicateur'} nécessite une action.` : `Digital performance is growing, but ${riskMeta ? riskMeta.label.toLowerCase() : 'one area'} requires action.`)
    : watch > 0
      ? (fr ? 'La performance globale est positive, avec quelques indicateurs à surveiller.' : 'Overall digital performance is positive, with a few areas to watch.')
      : (fr ? 'La performance digitale est globalement sur la bonne trajectoire.' : 'Digital performance is broadly on track.');

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    /* ============ executive status ============ */
    h('section', { className: 'rounded-[10px] border border-brds bg-card p-5 sm:p-6' },
      h('div', { className: 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]' },
        h('div', null,
          h('div', { className: 'flex flex-wrap items-center gap-2' },
            h(Badge, { tone: statusTone(overallStatus) }, statusLabel(overallStatus, fr)),
            h('span', { className: 'text-[10.5px] text-t3' }, fr ? 'Synthèse exécutive multi-canal' : 'Cross-channel executive summary')),
          h('h1', { className: 'm-0 mt-3 max-w-4xl text-[23px] font-bold leading-tight text-t1' }, headline),
          h('p', { className: 'm-0 mt-2 max-w-4xl text-[12.5px] leading-6 text-t2' }, fr
            ? `Les sessions web évoluent de ${fmtRelDelta(relChange(web.sessions, webPrev.sessions), lang)} et les conversions de ${fmtRelDelta(relChange(web.conversions, webPrev.conversions), lang)}. ${riskMeta ? `${riskMeta.label} est le point d’attention principal.` : 'Aucun indicateur gouverné n’est hors objectif.'}`
            : `Web sessions are ${fmtRelDelta(relChange(web.sessions, webPrev.sessions), lang)} and conversions ${fmtRelDelta(relChange(web.conversions, webPrev.conversions), lang)}. ${riskMeta ? `${riskMeta.label} is the main area to address.` : 'No governed KPI is off target.'}`),
          h('div', { className: 'mt-4 flex flex-wrap gap-2 text-[10.5px] text-t3' },
            h('span', { className: 'rounded-[5px] border border-brd bg-card2 px-2.5 py-1.5' }, `${met}/${scored.length} ${fr ? 'objectifs sur trajectoire' : 'targets on track'}`),
            h('span', { className: 'rounded-[5px] border border-brd bg-card2 px-2.5 py-1.5' }, `${healthySources}/${activeSources.length} ${fr ? 'sources saines' : 'healthy sources'}`),
            h('span', { className: 'rounded-[5px] border border-brd bg-card2 px-2.5 py-1.5' }, `${recommendations.length} ${fr ? 'actions prioritaires' : 'priority actions'}`))),
        h('div', { className: 'rounded-[8px] border border-brd bg-card2 p-4' },
          h('div', { className: 'flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[.08em] text-t3' },
            h(Target, { size: 14, className: 'text-acc', 'aria-hidden': true }),
            fr ? 'Situation des objectifs' : 'Target status'),
          h('div', { className: 'mt-3 flex items-baseline gap-2' },
            h('span', { className: 'text-[32px] font-bold leading-none text-t1 tnum' }, `${met}/${scored.length}`),
            h('span', { className: 'text-[11px] text-t3' }, fr ? 'sur objectif' : 'on track')),
          h('div', { className: 'mt-3 grid grid-cols-3 gap-2 text-center' },
            h('div', { className: 'rounded-[5px] bg-possoft px-2 py-2' }, h('div', { className: 'text-[15px] font-bold text-pos tnum' }, met), h('div', { className: 'text-[8.5px] font-semibold text-pos' }, fr ? 'OK' : 'ON TRACK')),
            h('div', { className: 'rounded-[5px] bg-warnsoft px-2 py-2' }, h('div', { className: 'text-[15px] font-bold text-warn tnum' }, watch), h('div', { className: 'text-[8.5px] font-semibold text-warn' }, fr ? 'SURVEILLER' : 'WATCH')),
            h('div', { className: 'rounded-[5px] bg-accsoft px-2 py-2' }, h('div', { className: 'text-[15px] font-bold text-acctext tnum' }, action), h('div', { className: 'text-[8.5px] font-semibold text-acctext' }, 'ACTION'))),
          h('p', { className: 'm-0 mt-3 text-[10px] leading-4 text-t3' }, fr
            ? 'Objectifs administrés dans Paramètres → Back Office → KPIs.'
            : 'Targets are managed in Settings → Back Office → KPIs.')))),

    /* ============ 1 · what is happening ============ */
    h(PageSection, {
      step: 1,
      title: fr ? 'Ce qui se passe' : 'What is happening',
      description: fr
        ? 'Les six résultats que la direction doit connaître, comparés à la période précédente.'
        : 'The six outcomes leadership needs, each compared with the previous period.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6' },
        h(ExecKpi, {
          label: fr ? 'Sessions web' : 'Web sessions', value: fmtCompact(web.sessions, lang),
          delta: relChange(web.sessions, webPrev.sessions), sub: `${fmtPct(webEr, lang)} ${fr ? 'engagement' : 'engagement'}`,
          target: defs.sessions?.enabled ? `${fr ? 'Objectif' : 'Target'} ${fmtRelDelta(Number(defs.sessions.target), lang)}` : null,
          href: link('/web'), lang,
        }),
        h(ExecKpi, {
          label: fr ? 'Portée sociale' : 'Social reach', value: fmtCompact(social.reach, lang),
          delta: relChange(social.reach, socialPrev.reach), sub: `${fmtPct(socialEr, lang)} ER`,
          target: defs.socialEr?.enabled ? `${fr ? 'Objectif ER' : 'ER target'} ${fmtPct(Number(defs.socialEr.target), lang)}` : null,
          href: link('/social'), lang,
        }),
        h(ExecKpi, {
          label: fr ? 'Clics organiques' : 'Organic clicks', value: fmtCompact(seo.clicks, lang),
          delta: relChange(seo.clicks, seoPrev.clicks), sub: `${fmtPct(seoCtr, lang)} CTR`,
          target: defs.seoCtr?.enabled ? `${fr ? 'Objectif CTR' : 'CTR target'} ${fmtPct(Number(defs.seoCtr.target), lang)}` : null,
          href: link('/seo'), lang,
        }),
        h(ExecKpi, {
          label: fr ? 'Visibilité AI Search' : 'AI Search visibility', value: fmtPct(ai.visibilityRate, lang),
          delta: ai.visibilityRate - aiPrev.visibilityRate, deltaKind: 'pp',
          sub: `${fmtInt(ai.citations, lang)} citations`, target: fr ? 'Données prototype' : 'Prototype data',
          href: link('/ai-search'), lang,
        }),
        h(ExecKpi, {
          label: fr ? 'Conversions web' : 'Web conversions', value: fmtCompact(web.conversions, lang),
          delta: relChange(web.conversions, webPrev.conversions), sub: `${fmtPct(webCvr, lang)} CVR`,
          target: defs.conversions?.enabled ? `${fr ? 'Objectif' : 'Target'} ${fmtRelDelta(Number(defs.conversions.target), lang)}` : null,
          href: link('/journey'), lang,
        }),
        h(ExecKpi, {
          label: fr ? 'CPA campagnes' : 'Campaign CPA', value: fmtEur(campaignCpa, lang),
          delta: relChange(campaignCpa, cpa(campaignsPrev.spend, campaignsPrev.conversions)), higherIsBetter: false,
          sub: `${fmtEur(campaigns.spend, lang)} ${fr ? 'dépenses' : 'spend'}`,
          target: defs.campaignCpa?.enabled ? `${fr ? 'Plafond' : 'Ceiling'} ${fmtEur(Number(defs.campaignCpa.target), lang)}` : null,
          href: link('/campaigns'), lang,
        }))),

    /* ============ 2 · how is it evolving ============ */
    h(PageSection, {
      step: 2,
      title: fr ? 'Comment cela évolue' : 'How it is evolving',
      description: fr
        ? 'Une seule métrique à la fois, avec la période de comparaison — jamais deux unités sur le même axe.'
        : 'One metric at a time against the comparison period — never two units on one axis.',
      right: h(Segmented, {
        ariaLabel: fr ? 'Métrique de tendance' : 'Trend metric',
        size: 'sm', value: trendMetric, onChange: setTrendMetric,
        options: [
          { id: 'sessions', label: fr ? 'Sessions' : 'Sessions' },
          { id: 'reach', label: fr ? 'Portée' : 'Reach' },
          { id: 'engagements', label: fr ? 'Engagements' : 'Engagement' },
          { id: 'conversions', label: 'Conversions' },
          { id: 'organicClicks', label: fr ? 'Clics SEO' : 'Organic clicks' },
        ],
      }),
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]' },
        h(Card, {
          id: 'exec-trend',
          title: fr ? 'Tendance de performance digitale' : 'Digital performance trend',
          subtitle: `${activeTrend.label} · ${showCompare ? (fr ? 'comparé à la période précédente' : 'compared with the previous period') : (fr ? 'sans comparaison' : 'no comparison selected')}`,
        },
          h(TrendChart, {
            points: trendPoints, format: (value) => fmtInt(value, lang), metricLabel: activeTrend.label,
            deltaKind: 'rel', showCompare, lang, height: 262,
            description: `${activeTrend.label} — ${fr ? 'tendance quotidienne' : 'daily trend'}`,
          })),
        h(Card, {
          title: fr ? 'Mix d’acquisition' : 'Acquisition mix',
          subtitle: fr ? 'Part de chaque canal dans les sessions de la période.' : 'Each channel’s share of sessions in the period.',
        },
          h('div', { className: 'grid gap-3' }, channelRows.slice(0, 6).map((row) => h('div', { key: row.id },
            h('div', { className: 'mb-1.5 flex items-baseline justify-between gap-2' },
              h('span', { className: 'truncate text-[11px] font-semibold text-t2' }, row.label),
              h('span', { className: 'text-[11px] font-bold text-t1 tnum' }, fmtCompact(row.sessions, lang))),
            h(MiniBar, { pct: (row.sessions / maxDriverSessions) * 100, color: 'var(--ch-2)' }),
            h('div', { className: 'mt-1 text-[9.5px] text-t3 tnum' }, `${fmtPct(ratio(row.sessions, web.sessions) === null ? null : ratio(row.sessions, web.sessions) * 100, lang)} ${fr ? 'des sessions' : 'of sessions'} · ${fmtInt(row.conversions, lang)} conv.`))))))),

    /* ============ 3 · where is it happening ============ */
    h(PageSection, {
      step: 3,
      title: fr ? 'Où cela se passe' : 'Where it is happening',
      description: fr
        ? 'Santé de chaque levier face à son objectif, puis les sources qui produisent réellement le trafic.'
        : 'How each channel stands against its target, then the sources actually producing the traffic.',
    },
      h(Card, {
        title: fr ? 'Santé des leviers digitaux' : 'Digital channel health',
        subtitle: fr
          ? 'Un KPI principal et une métrique de contexte par domaine. Le statut n’apparaît que là où un objectif existe.'
          : 'One headline KPI and one supporting metric per domain. A status appears only where a real target exists.',
      },
        h('div', { className: 'grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6' },
          h(DomainCard, {
            label: 'Web', fr, value: fmtCompact(web.sessions, lang), metricName: fr ? 'Sessions' : 'Sessions',
            detail: `${fmtPct(webEr, lang)} ${fr ? 'engagement' : 'engagement'} · ${fmtPct(webCvr, lang)} CVR`,
            status: evals.sessions.status, href: link('/web'),
          }),
          h(DomainCard, {
            label: 'Social Media', fr, value: fmtPct(socialEr, lang), metricName: fr ? 'Taux d’engagement' : 'Engagement rate',
            detail: `${fmtCompact(social.reach, lang)} ${fr ? 'de portée' : 'reach'} · ${fmtInt(social.followerNet, lang)} ${fr ? 'abonnés nets' : 'net followers'}`,
            status: evals.socialEr.status, href: link('/social'),
          }),
          h(DomainCard, {
            label: 'SEO & Search', fr, value: fmtPct(seoCtr, lang), metricName: 'CTR',
            detail: `${fmtCompact(seo.clicks, lang)} ${fr ? 'clics' : 'clicks'} · ${fmtCompact(seo.impressions, lang)} impressions`,
            status: evals.seoCtr.status, href: link('/seo'),
          }),
          h(DomainCard, {
            label: 'AI Search & AEO', fr, value: fmtPct(ai.visibilityRate, lang), metricName: fr ? 'Visibilité IA' : 'AI visibility',
            detail: `${fmtPct(ai.citationRate, lang)} ${fr ? 'taux de citation' : 'citation rate'} · ${fr ? 'données prototype' : 'prototype data'}`,
            status: 'neutral', href: link('/ai-search'),
          }),
          h(DomainCard, {
            label: 'Employee Advocacy', fr, value: fmtPct(advocacyParticipationPct, lang), metricName: fr ? 'Participation' : 'Participation',
            detail: `${fmtCompact(advocacy.active, lang)} ${fr ? 'actifs' : 'active'} · ${fmtCompact(advocacy.reach, lang)} ${fr ? 'de portée' : 'reach'}`,
            status: evals.advocacyParticipation.status, href: link('/advocacy'),
          }),
          h(DomainCard, {
            label: fr ? 'Campagnes' : 'Campaigns', fr, value: fmtEur(campaignCpa, lang), metricName: 'CPA',
            detail: `${fmtCompact(campaigns.conversions, lang)} conv. · ${fmtEur(campaigns.spend, lang)} ${fr ? 'dépenses' : 'spend'}`,
            status: evals.campaignCpa.status, href: link('/campaigns'),
          }))),

      h(Card, {
        title: fr ? 'Ce qui génère le trafic' : 'What is driving traffic',
        subtitle: fr
          ? 'Volume et qualité côte à côte : un canal volumineux mais peu convertissant n’est pas un canal performant.'
          : 'Volume and quality side by side: a large channel that does not convert is not a strong channel.',
      },
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full min-w-[640px] border-collapse text-left' },
            h('thead', null, h('tr', { className: 'border-b border-brd' },
              h('th', { scope: 'col', className: 'py-2 pr-3 text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Source' : 'Source'),
              h('th', { scope: 'col', className: 'py-2 pr-3 text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Part des sessions' : 'Share of sessions'),
              h('th', { scope: 'col', className: 'py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, 'Sessions'),
              h('th', { scope: 'col', className: 'py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Évolution' : 'Change'),
              h('th', { scope: 'col', className: 'py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Engagement' : 'Engagement'),
              h('th', { scope: 'col', className: 'py-2 text-right text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Taux de conversion' : 'Conversion rate'))),
            h('tbody', null, driverRows.map((row, index) => h('tr', { key: row.id, className: 'border-b border-brd last:border-0' },
              h('td', { className: 'py-2.5 pr-3' },
                h('div', { className: 'flex items-center gap-2' },
                  h('span', { className: 'w-5 text-[10.5px] font-bold text-t3 tnum' }, String(index + 1).padStart(2, '0')),
                  h('span', { className: 'text-[12px] font-semibold text-t1' }, row.label),
                  row.attributed ? h(Badge, { tone: 'info', title: fr ? 'Sessions attribuées au programme — sous-ensemble du trafic social et référent.' : 'Sessions attributed to the programme — a subset of social and referral traffic.' }, fr ? 'ATTRIBUÉ' : 'ATTRIBUTED') : null)),
              h('td', { className: 'py-2.5 pr-3' }, h(MiniBar, { pct: (row.sessions / maxDriverSessions) * 100, color: row.attributed ? 'var(--ch-4)' : 'var(--ch-2)' })),
              h('td', { className: 'py-2.5 pr-3 text-right text-[12px] font-bold text-t1 tnum' }, fmtCompact(row.sessions, lang)),
              h('td', { className: `py-2.5 pr-3 text-right text-[11.5px] tnum ${row.growth == null ? 'text-t3' : row.growth >= 0 ? 'text-pos' : 'text-neg'}` }, fmtRelDelta(row.growth, lang)),
              h('td', { className: 'py-2.5 pr-3 text-right text-[11.5px] text-t2 tnum' }, row.engagement == null ? '—' : fmtPct(row.engagement, lang)),
              h('td', { className: 'py-2.5 text-right text-[11.5px] font-semibold text-t1 tnum' }, fmtPct(row.conversionRate, lang))))))))),

    /* ============ 4 · why is it happening ============ */
    h(PageSection, {
      step: 4,
      title: fr ? 'Pourquoi cela se passe' : 'Why it is happening',
      description: fr
        ? 'Le parcours Social → site, étape par étape, avec le taux de passage entre chaque étape.'
        : 'The Social → website journey, stage by stage, with the step-to-step rate between each one.',
      right: h(Link, {
        to: link('/journey'),
        className: 'inline-flex items-center gap-1 text-[11px] font-semibold text-acctext no-underline',
      }, fr ? 'Voir le parcours complet' : 'View full journey', h(ArrowRight, { size: 13, 'aria-hidden': true })),
    },
      h(Card, {
        title: fr ? 'Du reach à la conversion' : 'From reach to conversion',
        subtitle: fr
          ? 'Chaque valeur est mesurée dans le même périmètre. Aucune barre n’est agrandie artificiellement : les pourcentages sous chaque étape indiquent la part réelle des impressions.'
          : 'Every value is measured on the same scope. No bar is inflated: the percentage under each stage is its true share of impressions.',
        right: h('span', { className: 'rounded-[6px] border border-brd bg-card2 px-2.5 py-1.5 text-[11px] font-semibold text-t2 tnum' },
          `${fr ? 'CVR session' : 'Session conversion rate'} ${fmtPct(funnelSessionCvr, lang)}`),
      },
        funnel[0].value > 0
          ? h(Journey, { stages: funnel, lang, fr })
          : h('p', { className: 'm-0 py-6 text-center text-[12px] text-t3' }, fr ? 'Aucune donnée sociale pour cette sélection.' : 'No social data for this selection.'),
        h('p', { className: 'mb-0 mt-3 text-[10.5px] leading-4 text-t3' }, fr
          ? 'Taux de conversion des sessions = conversions ÷ sessions. Le rapprochement clic → session est modélisé au niveau agrégé : il n’existe pas de suivi individuel inter-plateformes.'
          : 'Session conversion rate = conversions ÷ sessions. Click-to-session matching is modelled at aggregate level; there is no individual cross-platform tracking.'))),

    /* ============ 5 · what should we do ============ */
    h(PageSection, {
      step: 5,
      title: fr ? 'Ce qu’il faut décider' : 'What to decide',
      description: fr
        ? 'Le point d’attention le plus urgent, les contributions les plus fortes, puis la file d’actions.'
        : 'The single most urgent item, the strongest contributors, then the wider action queue.',
    },
      h('div', { className: 'grid gap-2 lg:grid-cols-3' },
        h(AttentionCard, {
          tone: 'risk', icon: AlertTriangle,
          eyebrow: fr ? 'Risque principal' : 'Primary risk',
          headline: riskMeta ? riskMeta.label : (fr ? 'Aucun indicateur hors objectif' : 'No KPI off target'),
          detail: riskDetail || (fr ? 'Tous les indicateurs gouvernés sont sur leur trajectoire.' : 'Every governed KPI is on its target trajectory.'),
          href: riskMeta ? link(riskMeta.href) : null,
          cta: fr ? 'Analyser' : 'Investigate',
        }),
        h(AttentionCard, {
          tone: 'opportunity', icon: TrendingUp,
          eyebrow: fr ? 'Opportunité' : 'Opportunity',
          headline: opportunity ? opportunity.headline : (fr ? 'Pas de signal de croissance marqué' : 'No standout growth signal'),
          detail: opportunity ? opportunity.detail : (fr ? 'Aucun canal ne progresse nettement sur la période sélectionnée.' : 'No channel is growing sharply in the selected period.'),
          href: link('/insights'),
          cta: fr ? 'Voir les signaux' : 'See the signals',
        }),
        h(AttentionCard, {
          tone: 'action', icon: Lightbulb,
          eyebrow: fr ? 'Action recommandée' : 'Recommended action',
          headline: recommendations[0] ? recommendations[0].action[lang] : (fr ? 'Maintenir le pilotage actuel' : 'Maintain the current plan'),
          detail: recommendations[0] ? `${fr ? 'Responsable' : 'Owner'} · ${recommendations[0].owner}` : null,
          href: link('/insights'),
          cta: fr ? 'Ouvrir la file d’actions' : 'Open the action queue',
        })),

      h(Card, {
        title: fr ? 'Highlights business' : 'Business highlights',
        subtitle: fr ? 'Le contenu, la campagne et les marchés qui contribuent le plus sur la période.' : 'The content, campaign and markets contributing most in the period.',
      },
        h('div', { className: 'grid gap-3 lg:grid-cols-3' },
          h('div', { className: 'rounded-[8px] border border-brd bg-card2 p-4' },
            h('div', { className: 'text-[10px] font-bold uppercase tracking-[.07em] text-t3' }, fr ? 'Contenu le plus contributeur' : 'Top contributing content'),
            topContent
              ? h(React.Fragment, null,
                h('div', { className: 'mt-2 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-t1' }, fr ? topContent.titleFr : topContent.title),
                h('div', { className: 'mt-3 grid grid-cols-3 gap-2' },
                  h(StatMini, { label: 'Impressions', value: fmtCompact(topContent.impressions, lang) }),
                  h(StatMini, { label: fr ? 'Clics' : 'Clicks', value: fmtCompact(topContent.clicks, lang) }),
                  h(StatMini, { label: 'Conv.', value: fmtInt(topContent.conversions, lang) })),
                h(Link, { to: link('/content'), className: 'mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-acctext no-underline' }, fr ? 'Analyser le contenu' : 'Analyse content', h(ArrowRight, { size: 12, 'aria-hidden': true })))
              : h('div', { className: 'py-4 text-[11px] text-t3' }, fr ? 'Aucun contenu pour cette sélection.' : 'No content for this selection.')),
          h('div', { className: 'rounded-[8px] border border-brd bg-card2 p-4' },
            h('div', { className: 'text-[10px] font-bold uppercase tracking-[.07em] text-t3' }, fr ? 'Campagne la plus efficiente' : 'Most efficient campaign'),
            bestCampaign
              ? h(React.Fragment, null,
                h('div', { className: 'mt-2 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-t1' }, bestCampaign.def.name),
                h('div', { className: 'mt-3 grid grid-cols-3 gap-2' },
                  h(StatMini, { label: 'CPA', value: fmtEur(bestCampaign.cpa, lang) }),
                  h(StatMini, { label: 'Conv.', value: fmtInt(bestCampaign.data.conversions, lang) }),
                  h(StatMini, { label: fr ? 'Dépenses' : 'Spend', value: fmtEur(bestCampaign.data.spend, lang) })),
                h(Link, { to: link('/campaigns'), className: 'mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-acctext no-underline' }, fr ? 'Analyser les campagnes' : 'Analyse campaigns', h(ArrowRight, { size: 12, 'aria-hidden': true })))
              : h('div', { className: 'py-4 text-[11px] text-t3' }, fr ? 'Aucune campagne active.' : 'No active campaign.')),
          h('div', { className: 'rounded-[8px] border border-brd bg-card2 p-4' },
            h('div', { className: 'flex items-center justify-between gap-2' },
              h('div', { className: 'text-[10px] font-bold uppercase tracking-[.07em] text-t3' }, fr ? 'Marchés les plus contributeurs' : 'Top contributing markets'),
              h(Link, { to: link('/audience'), className: 'text-[10.5px] font-semibold text-acctext no-underline' }, fr ? 'Voir tout' : 'View all')),
            h('div', { className: 'mt-2 divide-y divide-brd' }, topMarkets.map(({ market, data }, index) => h('div', { key: market.id, className: 'grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 py-2.5 first:pt-1.5' },
              h('div', { className: 'text-[11px] font-bold text-t3 tnum' }, `0${index + 1}`),
              h('div', null,
                h('div', { className: 'text-[12px] font-semibold text-t1' }, fr ? market.nameFr : market.name),
                h('div', { className: 'mt-0.5 text-[9.5px] text-t3 tnum' }, `${fmtPct(cvr(data.conversions, data.sessions), lang)} CVR · ${fmtInt(data.conversions, lang)} conv.`)),
              h('div', { className: 'text-[13px] font-bold text-t1 tnum' }, fmtCompact(data.sessions, lang)))))))),

      h(Card, {
        title: fr ? 'Décisions recommandées' : 'Recommended decisions',
        subtitle: fr ? 'La file d’actions au-delà du point d’attention immédiat, classée par priorité.' : 'The action queue beyond the immediate attention item, ranked by priority.',
        right: h(Link, { to: link('/insights'), className: 'inline-flex items-center gap-1 text-[11px] font-semibold text-acctext no-underline' },
          fr ? 'Toutes les recommandations' : 'All recommendations', h(ArrowRight, { size: 12, 'aria-hidden': true })),
      },
        recommendations.length
          ? h('div', { className: 'divide-y divide-brd' }, recommendations.map((item, index) => h('article', { key: item.id, className: 'grid gap-2 py-3.5 first:pt-0 last:pb-0 md:grid-cols-[52px_minmax(0,.95fr)_minmax(0,1.2fr)_120px] md:items-start md:gap-4' },
            h('div', { className: 'inline-flex h-7 w-10 items-center justify-center rounded-[5px] bg-accsoft text-[10px] font-bold text-acctext' }, `P${index + 1}`),
            h('div', null,
              h('div', { className: 'text-[9.5px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Signal observé' : 'Observed signal'),
              h('div', { className: 'mt-1 text-[12px] font-semibold leading-5 text-t1' }, item.signal[lang])),
            h('div', null,
              h('div', { className: 'text-[9.5px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Action recommandée' : 'Recommended action'),
              h('div', { className: 'mt-1 text-[12px] leading-5 text-t2' }, item.action[lang])),
            h('div', { className: 'text-[10.5px] text-t3 md:text-right' },
              h('div', { className: 'font-semibold text-t2' }, fr ? 'Responsable' : 'Owner'),
              h('div', { className: 'mt-1' }, item.owner)))))
          : h('p', { className: 'm-0 py-4 text-[11.5px] text-t3' }, fr ? 'Aucune action prioritaire sur cette sélection.' : 'No priority action for this selection.'))),

    h('div', { className: 'flex flex-wrap items-center justify-between gap-3 rounded-[7px] border border-brd bg-card px-4 py-3 text-[10px] text-t3' },
      h('span', null, fr
        ? 'Les objectifs et les seuils de statut sont administrables dans Paramètres → Back Office → KPIs, objectifs & gouvernance.'
        : 'Targets and status thresholds are managed in Settings → Back Office → KPIs, targets & governance.'),
      h('span', { className: 'tnum' }, `${healthySources}/${activeSources.length} ${fr ? 'sources saines' : 'healthy sources'}`))
  );
}
