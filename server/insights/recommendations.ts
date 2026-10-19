/** ------------------------------------------------------------------
 *  Deterministic recommendation rules. Every recommendation is backed
 *  by evidence computed with the semantic engine (values, periods,
 *  sources). Wording describes associations, never causes. Optional
 *  LLM explanations never change these numbers.
 *  ------------------------------------------------------------------ */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { addDays } from '@shared/calendar';
import { BUSINESS_UNITS, COMPETITORS, FORMATS, GEO_PROMPTS, PAGES, SITES, TOPICS, label, type L10n } from '@shared/catalog';
import { analyticsQuerySchema, type AnalyticsQuery, type MetricResult } from '@shared/filters';
import type { Unit } from '@shared/metrics';
import type { AppContext } from '../context';
import { adCampaigns, geoPrompts, recommendationHistory, recommendations, seoIssues } from '../db/schema';
import { runQuery, type EngineContext } from '../analytics/engine';
import { campaignPacing } from './ads';
import { fmt, fmtDate, fmtDelta, fmtPct } from './format';

export interface EvidenceItem {
  label: L10n;
  value: number | null;
  compare?: number | null;
  unit: Unit;
  period?: { from: string; to: string } | null;
  comparePeriod?: { from: string; to: string } | null;
  source: string;
  metric?: string;
}

export interface RecommendationDraft {
  ruleKey: string;
  fingerprint: string;
  title: L10n;
  summary: L10n;
  action: L10n;
  evidence: EvidenceItem[];
  kpis: string[];
  channels: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  mode: string;
}

const q = (ctx: EngineContext, x: AnalyticsQuery) => runQuery(ctx, analyticsQuerySchema.parse(x)).results;
const ev = (r: MetricResult, lbl: L10n, unit: Unit, source: string): EvidenceItem => ({ label: lbl, value: r.value, compare: r.compare, unit, period: r.meta.range, comparePeriod: r.meta.compareRange, source, metric: r.metric });
const SITE_NAME = Object.fromEntries(SITES.map((s) => [s.id, s.name]));
const BU_NAME = Object.fromEntries(BUSINESS_UNITS.map((b) => [b.id, b.name]));
const month = (iso: string) => iso.slice(0, 7);

function ruleSearchPositionDrop(ctx: EngineContext, asOf: string): RecommendationDraft[] {
  const out: RecommendationDraft[] = [];
  for (const site of SITES) {
    for (const bu of BUSINESS_UNITS) {
      const filters = { site: [site.id], bu: [bu.id] };
      // recent week vs a 4-week baseline ending two weeks earlier, so a change that started within the
      // last fortnight is not hidden inside both windows
      const [pos, clicks, imp] = q(ctx, { metrics: ['avg_position', 'organic_clicks', 'organic_impressions'], from: addDays(asOf, -6), to: asOf, compare: 'none', filters });
      const [bPos, bClicks] = q(ctx, { metrics: ['avg_position', 'organic_clicks'], from: addDays(asOf, -41), to: addDays(asOf, -14), compare: 'none', filters });
      if (pos.value === null || bPos.value === null || !pos.meta.range || !bPos.meta.range) continue;
      pos.compare = bPos.value;
      pos.delta = pos.value - bPos.value;
      pos.meta.compareRange = bPos.meta.range;
      const days = (r: { from: string; to: string }) => (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 + 1;
      // clicks compared as a daily average because the windows differ in length
      const dailyNow = (clicks.value ?? 0) / days(clicks.meta.range!);
      const dailyBase = (bClicks.value ?? 0) / days(bClicks.meta.range!);
      clicks.deltaPct = dailyBase > 0 ? dailyNow / dailyBase - 1 : null;
      if (pos.delta < 0.5 || (imp.value ?? 0) < 2000) continue;
      const qNow = q(ctx, { metrics: ['avg_position'], from: addDays(asOf, -6), to: asOf, compare: 'none', filters, groupBy: 'query' })[0];
      const qBase = q(ctx, { metrics: ['avg_position'], from: addDays(asOf, -41), to: addDays(asOf, -14), compare: 'none', filters, groupBy: 'query' })[0];
      const byQuery = { rows: (qNow.rows ?? []).map((r) => ({ ...r, compare: qBase.rows?.find((b) => b.key === r.key)?.value ?? null })) };
      const worst = (byQuery.rows ?? [])
        .filter((r) => r.value !== null && r.compare !== null)
        .map((r) => ({ key: r.key.split(':').slice(1).join(':'), d: r.value! - r.compare!, now: r.value!, before: r.compare! }))
        .sort((a, b) => b.d - a.d)
        .slice(0, 3);
      const qList = (lang: 'en' | 'fr') => worst.map((w) => `“${w.key}” ${fmt(w.before, 'position', lang)} → ${fmt(w.now, 'position', lang)}`).join(', ');
      const lostClicksPerDay = dailyBase - dailyNow;
      const sev = pos.delta >= 1.5 || lostClicksPerDay > 150;
      out.push({
        ruleKey: 'search_position_drop',
        fingerprint: `search_position_drop:${site.id}:${bu.id}:${month(asOf)}`,
        title: {
          en: `Search positions fell for ${label(BU_NAME[bu.id], 'en')} pages on ${site.name}`,
          fr: `Baisse des positions pour les pages ${label(BU_NAME[bu.id], 'fr')} sur ${site.name}`,
        },
        summary: {
          en: `Average Search Console position went from ${fmt(pos.compare, 'position', 'en')} (4-week baseline) to ${fmt(pos.value, 'position', 'en')} over the latest available days, with daily clicks ${fmtPct(clicks.deltaPct, 'en')}. Largest moves: ${qList('en')}. The data shows when the change started, not why.`,
          fr: `La position moyenne Search Console est passée de ${fmt(pos.compare, 'position', 'fr')} (référence sur 4 semaines) à ${fmt(pos.value, 'position', 'fr')} sur les derniers jours disponibles, avec des clics quotidiens à ${fmtPct(clicks.deltaPct, 'fr')}. Plus fortes variations : ${qList('fr')}. Les données montrent quand le changement a commencé, pas pourquoi.`,
        },
        action: {
          en: 'Check the affected pages for recent content, template or technical changes (titles, canonical tags, internal links, indexing), review the open SEO issues for these URLs, and compare with the competitor SERP. Re-measure after 14 days.',
          fr: 'Vérifier les changements récents de contenu, de gabarit ou techniques sur les pages concernées (titles, canonicals, maillage, indexation), revoir les anomalies SEO ouvertes sur ces URL et comparer avec la SERP concurrente. Mesurer à nouveau après 14 jours.',
        },
        evidence: [
          ev(pos, { en: 'Average position (Search Console)', fr: 'Position moyenne (Search Console)' }, 'position', 'gsc'),
          { label: { en: 'Organic clicks per day', fr: 'Clics organiques par jour' }, value: dailyNow, compare: dailyBase, unit: 'count', period: clicks.meta.range, comparePeriod: bClicks.meta.range, source: 'gsc', metric: 'organic_clicks' },
          ev(imp, { en: 'Impressions', fr: 'Impressions' }, 'count', 'gsc'),
        ],
        kpis: ['avg_position', 'organic_clicks'],
        channels: ['organic_search', site.id],
        priority: sev ? 'high' : 'medium',
        impact: sev ? 'high' : 'medium',
        effort: 'medium',
        sources: ['Google Search Console'],
        confidence: 'high',
        mode: pos.meta.mode,
      });
    }
  }
  return out;
}

async function ruleAdsPacing(app: AppContext, ctx: EngineContext, asOf: string): Promise<RecommendationDraft[]> {
  const budgets = (await app.db.select().from(adCampaigns)).map((c) => ({ key: c.key, name: c.name, category: c.category, monthlyBudget: c.monthlyBudget }));
  return campaignPacing(ctx, asOf, budgets)
    .filter((p) => p.pacing !== null && p.pacing > 1.1 && p.daysElapsed >= 5)
    .map((p) => ({
      ruleKey: 'ads_overpacing',
      fingerprint: `ads_overpacing:${p.campaign}:${month(asOf)}`,
      title: { en: `${p.name}: spending ahead of the monthly budget`, fr: `${p.name} : dépenses en avance sur le budget mensuel` },
      summary: {
        en: `Month-to-date spend is ${fmt(p.spendMtd, 'currency', 'en')} against ${fmt(p.expectedMtd, 'currency', 'en')} expected (${fmtPct(p.pacing, 'en', false)} pacing). At this rate the month would close near ${fmt(p.projectedMonth, 'currency', 'en')} for a ${fmt(p.monthlyBudget, 'currency', 'en')} budget.`,
        fr: `Dépenses depuis le début du mois : ${fmt(p.spendMtd, 'currency', 'fr')} pour ${fmt(p.expectedMtd, 'currency', 'fr')} attendus (rythme ${fmtPct(p.pacing, 'fr', false)}). À ce rythme, le mois se terminerait vers ${fmt(p.projectedMonth, 'currency', 'fr')} pour un budget de ${fmt(p.monthlyBudget, 'currency', 'fr')}.`,
      },
      action: {
        en: 'Review daily budget caps and bids in ChatGPT Ads Manager with the paid-media owner. This platform is read-only: no change is made to the ad account from here.',
        fr: 'Revoir les plafonds journaliers et les enchères dans ChatGPT Ads Manager avec le responsable média. Cette plateforme est en lecture seule : aucune modification n’est faite sur le compte publicitaire.',
      },
      evidence: [
        { label: { en: 'Spend month to date', fr: 'Dépenses depuis le début du mois' }, value: p.spendMtd, compare: p.expectedMtd, unit: 'currency', period: { from: p.monthStart, to: p.asOf }, source: 'chatgpt_ads', metric: 'ads_spend' },
        { label: { en: 'Pacing (spend ÷ expected)', fr: 'Rythme (dépenses ÷ attendu)' }, value: p.pacing, unit: 'percent', period: { from: p.monthStart, to: p.asOf }, source: 'chatgpt_ads' },
        { label: { en: 'Projected month spend', fr: 'Projection de dépense mensuelle' }, value: p.projectedMonth, compare: p.monthlyBudget, unit: 'currency', source: 'chatgpt_ads' },
      ],
      kpis: ['ads_spend', 'ads_cpa'],
      channels: ['chatgpt_ads'],
      priority: p.pacing! > 1.2 ? 'high' : 'medium',
      impact: 'medium',
      effort: 'low',
      sources: ['ChatGPT Ads (platform-reported spend)', 'Budgets recorded in Administration'],
      confidence: 'high',
      mode: p.mode,
    }));
}

function ruleAdsZeroConversion(ctx: EngineContext, asOf: string): RecommendationDraft[] {
  const from = addDays(asOf, -27);
  const [spend, conv, clicks] = q(ctx, { metrics: ['ads_spend', 'ads_conversions', 'ads_clicks'], from, to: asOf, compare: 'none', groupBy: 'ad' });
  const out: RecommendationDraft[] = [];
  for (const row of spend.rows ?? []) {
    const c = conv.rows?.find((r) => r.key === row.key)?.value ?? 0;
    const k = clicks.rows?.find((r) => r.key === row.key)?.value ?? 0;
    if ((row.value ?? 0) < 300 || c > 0) continue;
    out.push({
      ruleKey: 'ads_zero_conversion',
      fingerprint: `ads_zero_conversion:${row.key}:${month(asOf)}`,
      title: { en: `Ad ${row.key} spent ${fmt(row.value, 'currency', 'en')} with no attributed conversion`, fr: `L’annonce ${row.key} a dépensé ${fmt(row.value, 'currency', 'fr')} sans conversion attribuée` },
      summary: {
        en: `Over the last 28 days the ad received ${fmt(k, 'count', 'en')} clicks and ${fmt(row.value, 'currency', 'en')} of spend, with zero platform-attributed conversions. Conversions can arrive 24–48 h late; the gap is well beyond that delay.`,
        fr: `Sur les 28 derniers jours, l’annonce a reçu ${fmt(k, 'count', 'fr')} clics pour ${fmt(row.value, 'currency', 'fr')} de dépenses, sans conversion attribuée par la plateforme. Les conversions peuvent arriver avec 24–48 h de retard ; l’écart dépasse largement ce délai.`,
      },
      action: {
        en: 'Check that the landing page matches the ad promise and has a visible conversion path, and that the conversion event is configured for this ad group. Decide in the ad platform whether to pause or rework the ad.',
        fr: 'Vérifier que la page de destination correspond à la promesse de l’annonce avec un parcours de conversion visible, et que l’événement de conversion est bien configuré. Décider dans la plateforme publicitaire de mettre en pause ou retravailler l’annonce.',
      },
      evidence: [
        { label: { en: 'Spend', fr: 'Dépenses' }, value: row.value, unit: 'currency', period: spend.meta.range, source: 'chatgpt_ads', metric: 'ads_spend' },
        { label: { en: 'Clicks', fr: 'Clics' }, value: k, unit: 'count', period: spend.meta.range, source: 'chatgpt_ads', metric: 'ads_clicks' },
        { label: { en: 'Platform-attributed conversions', fr: 'Conversions attribuées' }, value: 0, unit: 'count', period: spend.meta.range, source: 'chatgpt_ads', metric: 'ads_conversions' },
      ],
      kpis: ['ads_conversions', 'ads_cpa'],
      channels: ['chatgpt_ads'],
      priority: (row.value ?? 0) > 1000 ? 'high' : 'medium',
      impact: 'medium',
      effort: 'low',
      sources: ['ChatGPT Ads'],
      confidence: 'high',
      mode: spend.meta.mode,
    });
  }
  return out;
}

function ruleTrackingGap(ctx: EngineContext, asOf: string): RecommendationDraft[] {
  const out: RecommendationDraft[] = [];
  for (const site of SITES) {
    const r = q(ctx, { metrics: ['form_tracking_coverage', 'form_submissions', 'ga4_form_events'], from: addDays(asOf, -44), to: asOf, compare: 'none', granularity: 'day', filters: { site: [site.id] } });
    const series = r[0].series ?? [];
    const vals = series.map((p) => p.value).filter((v): v is number => v !== null).sort((a, b) => a - b);
    if (vals.length < 20) continue;
    const median = vals[Math.floor(vals.length / 2)];
    const low = series.filter((p) => p.value !== null && p.value < median * 0.75);
    if (!low.length) continue;
    const from = low[0].from;
    const to = low[low.length - 1].to;
    const lowAvg = low.reduce((s, p) => s + (p.value ?? 0), 0) / low.length;
    const subs = r[1].series!.filter((p) => p.from >= from && p.to <= to).reduce((s, p) => s + (p.value ?? 0), 0);
    const seen = r[2].series!.filter((p) => p.from >= from && p.to <= to).reduce((s, p) => s + (p.value ?? 0), 0);
    out.push({
      ruleKey: 'tracking_gap',
      fingerprint: `tracking_gap:${site.id}:${from}`,
      title: { en: `GA4 under-recorded form submissions on ${site.name} (${fmtDate(from, 'en')} – ${fmtDate(to, 'en')})`, fr: `GA4 a sous-enregistré les formulaires sur ${site.name} (${fmtDate(from, 'fr')} – ${fmtDate(to, 'fr')})` },
      summary: {
        en: `Drupal recorded ${fmt(subs, 'count', 'en')} submissions while GA4 saw ${fmt(seen, 'count', 'en')} form events: coverage ${fmtPct(lowAvg, 'en', false)} against a usual ${fmtPct(median, 'en', false)}. Website conversion figures for these days understate real demand.`,
        fr: `Drupal a enregistré ${fmt(subs, 'count', 'fr')} soumissions alors que GA4 a vu ${fmt(seen, 'count', 'fr')} événements : couverture ${fmtPct(lowAvg, 'fr', false)} contre ${fmtPct(median, 'fr', false)} habituellement. Les conversions site de ces jours sous-estiment la demande réelle.`,
      },
      action: {
        en: 'Confirm with the web team which release or tag change happened on these dates, add a post-release tagging check, and annotate the period in reports. Use Drupal submissions as the reference for this period.',
        fr: 'Identifier avec l’équipe web la mise en production ou le changement de balisage concerné, ajouter un contrôle du marquage après chaque mise en production et annoter la période dans les rapports. Utiliser les soumissions Drupal comme référence sur la période.',
      },
      evidence: [
        { label: { en: 'GA4 form tracking coverage (gap days)', fr: 'Couverture GA4 des formulaires (jours concernés)' }, value: lowAvg, compare: median, unit: 'percent', period: { from, to }, source: 'ga4+drupal', metric: 'form_tracking_coverage' },
        { label: { en: 'Drupal submissions (gap days)', fr: 'Soumissions Drupal (jours concernés)' }, value: subs, unit: 'count', period: { from, to }, source: 'drupal', metric: 'form_submissions' },
        { label: { en: 'GA4 form events (gap days)', fr: 'Événements GA4 (jours concernés)' }, value: seen, unit: 'count', period: { from, to }, source: 'ga4', metric: 'ga4_form_events' },
      ],
      kpis: ['form_tracking_coverage', 'conversions'],
      channels: [site.id],
      priority: to >= addDays(asOf, -7) ? 'critical' : 'medium',
      impact: 'high',
      effort: 'low',
      sources: ['Google Analytics 4', 'Drupal Webform'],
      confidence: 'high',
      mode: r[0].meta.mode,
    });
  }
  return out;
}

async function ruleGeo(app: AppContext, ctx: EngineContext, asOf: string): Promise<RecommendationDraft[]> {
  const out: RecommendationDraft[] = [];
  const prompts = await app.db.select().from(geoPrompts).where(eq(geoPrompts.active, true));
  const topicName = Object.fromEntries(TOPICS.map((t) => [t.id, t.name]));
  const geo = ctx.dataset.geo;
  const from = addDays(asOf, -55);
  for (const p of prompts) {
    const text = GEO_PROMPTS.find((g) => g.id === p.key)?.text ?? p.key;
    const rows = (geo?.rows ?? []).filter((r) => r.prompt === p.key && r.status !== 'failed' && r.date >= from && r.date <= asOf);
    const mention = rows.length ? rows.filter((r) => r.mentioned).length / rows.length : null;
    if (!p.expectedPages.length && p.priority === 'high') {
      out.push({
        ruleKey: 'geo_missing_page',
        fingerprint: `geo_missing_page:${p.key}`,
        title: { en: `No reference page for a high-priority AI prompt (${p.key})`, fr: `Aucune page de référence pour un prompt IA prioritaire (${p.key})` },
        summary: {
          en: `“${text}” is a high-priority prompt with no expected veolia.com page. In the monitored sample, Veolia was mentioned in ${fmtPct(mention, 'en', false)} of ${rows.length} answers over 8 weeks.`,
          fr: `« ${text} » est un prompt prioritaire sans page veolia.com attendue. Dans l’échantillon suivi, Veolia est mentionné dans ${fmtPct(mention, 'fr', false)} des ${rows.length} réponses sur 8 semaines.`,
        },
        action: {
          en: `Decide which existing page should answer this question (or brief a new one) on ${label(topicName[p.topic] ?? { en: p.topic, fr: p.topic }, 'en')}, then record it as the expected page in the prompt library so citations can be tracked.`,
          fr: `Choisir la page existante qui doit répondre à cette question (ou en commander une) sur ${label(topicName[p.topic] ?? { en: p.topic, fr: p.topic }, 'fr')}, puis l’enregistrer comme page attendue dans la bibliothèque de prompts.`,
        },
        evidence: [{ label: { en: 'Mention rate (monitored sample, 8 weeks)', fr: 'Taux de mention (échantillon suivi, 8 semaines)' }, value: mention, unit: 'percent', period: { from, to: asOf }, source: 'geo', metric: 'geo_mention_rate' }],
        kpis: ['geo_mention_rate', 'geo_citation_rate'],
        channels: ['geo'],
        priority: 'high',
        impact: 'medium',
        effort: 'medium',
        sources: ['GEO monitoring (sampled prompts)'],
        confidence: rows.length >= 8 ? 'medium' : 'low',
        mode: geo?.origin === 'demo' ? 'demo' : 'connected',
      });
      continue;
    }
    if (p.priority !== 'high' || rows.length < 8 || mention === null || mention >= 0.25) continue;
    const compRates = COMPETITORS.map((c) => ({ c, rate: rows.filter((r) => r.competitors.includes(c.id)).length / rows.length })).sort((a, b) => b.rate - a.rate);
    const top = compRates[0];
    if (!top || top.rate < 0.35) continue;
    out.push({
      ruleKey: 'geo_low_visibility',
      fingerprint: `geo_low_visibility:${p.key}:${month(asOf)}`,
      title: { en: `Low AI-answer visibility on a priority question (${p.key})`, fr: `Faible visibilité dans les réponses IA sur une question prioritaire (${p.key})` },
      summary: {
        en: `For “${text}”, Veolia appears in ${fmtPct(mention, 'en', false)} of sampled answers while ${top.c.name} appears in ${fmtPct(top.rate, 'en', false)} (${rows.length} measurements, 8 weeks). This describes the monitored sample only.`,
        fr: `Pour « ${text} », Veolia apparaît dans ${fmtPct(mention, 'fr', false)} des réponses échantillonnées contre ${fmtPct(top.rate, 'fr', false)} pour ${top.c.name} (${rows.length} mesures, 8 semaines). Constat limité à l’échantillon suivi.`,
      },
      action: {
        en: 'Review the expected pages for clear, citable answers (definitions, figures with sources, FAQs, structured data) and check which sources the answers cite instead.',
        fr: 'Revoir les pages attendues pour qu’elles offrent des réponses claires et citables (définitions, chiffres sourcés, FAQ, données structurées) et analyser les sources citées à la place.',
      },
      evidence: [
        { label: { en: 'Veolia mention rate', fr: 'Taux de mention Veolia' }, value: mention, unit: 'percent', period: { from, to: asOf }, source: 'geo', metric: 'geo_mention_rate' },
        { label: { en: `${top.c.name} mention rate`, fr: `Taux de mention ${top.c.name}` }, value: top.rate, unit: 'percent', period: { from, to: asOf }, source: 'geo' },
      ],
      kpis: ['geo_mention_rate'],
      channels: ['geo'],
      priority: 'medium',
      impact: 'medium',
      effort: 'medium',
      sources: ['GEO monitoring (sampled prompts)'],
      confidence: 'medium',
      mode: geo?.origin === 'demo' ? 'demo' : 'connected',
    });
  }
  return out;
}

function ruleAiReferral(ctx: EngineContext, asOf: string): RecommendationDraft[] {
  const [ai, share] = q(ctx, { metrics: ['ai_referral_sessions', 'ai_referral_share'], from: addDays(asOf, -27), to: asOf });
  if (ai.deltaPct === null || ai.deltaPct < 0.12) return [];
  const [erAi] = q(ctx, { metrics: ['engagement_rate'], from: addDays(asOf, -27), to: asOf, filters: { channel: ['ai_referral'] } });
  const [erAll] = q(ctx, { metrics: ['engagement_rate'], from: addDays(asOf, -27), to: asOf });
  const pages = q(ctx, { metrics: ['sessions'], from: addDays(asOf, -27), to: asOf, groupBy: 'page', limit: 3 })[0];
  return [
    {
      ruleKey: 'ai_referral_growth',
      fingerprint: `ai_referral_growth:${month(asOf)}`,
      title: { en: 'Visits from AI assistants keep growing', fr: 'Les visites issues des assistants IA continuent de progresser' },
      summary: {
        en: `AI referral sessions reached ${fmt(ai.value, 'count', 'en')} in the last 28 days (${fmtPct(ai.deltaPct, 'en')} vs the previous 28), ${fmtPct(share.value, 'en', false)} of all sessions. These visitors engage at ${fmtPct(erAi.value, 'en', false)} vs ${fmtPct(erAll.value, 'en', false)} site-wide.`,
        fr: `Les sessions issues des IA atteignent ${fmt(ai.value, 'count', 'fr')} sur 28 jours (${fmtPct(ai.deltaPct, 'fr')} vs les 28 jours précédents), soit ${fmtPct(share.value, 'fr', false)} des sessions. Leur taux d’engagement est de ${fmtPct(erAi.value, 'fr', false)} contre ${fmtPct(erAll.value, 'fr', false)} en moyenne.`,
      },
      action: {
        en: 'Make sure the GA4 custom channel group keeps capturing new assistants, review the landing pages AI visitors reach, and link them to the GEO prompt library so content teams see which questions bring visits.',
        fr: 'Vérifier que le groupe de canaux GA4 capte les nouveaux assistants, analyser les pages d’arrivée des visiteurs IA et les relier à la bibliothèque de prompts GEO.',
      },
      evidence: [
        ev(ai, { en: 'AI referral sessions', fr: 'Sessions issues des IA' }, 'count', 'ga4'),
        ev(share, { en: 'Share of sessions', fr: 'Part des sessions' }, 'percent', 'ga4'),
        { label: { en: 'Engagement rate — AI referrals vs all', fr: 'Taux d’engagement — IA vs ensemble' }, value: erAi.value, compare: erAll.value, unit: 'percent', period: erAi.meta.range, source: 'ga4', metric: 'engagement_rate' },
      ],
      kpis: ['ai_referral_sessions', 'ai_referral_share'],
      channels: ['ai_referral', ...(pages.rows ?? []).map((r) => r.key)].slice(0, 4),
      priority: 'medium',
      impact: 'medium',
      effort: 'low',
      sources: ['Google Analytics 4'],
      confidence: 'high',
      mode: ai.meta.mode,
    },
  ];
}

function ruleXAudience(ctx: EngineContext, asOf: string): RecommendationDraft[] {
  const [net, er] = q(ctx, { metrics: ['followers_net', 'social_engagement_rate'], from: addDays(asOf, -89), to: asOf, filters: { platform: ['x'] } });
  const [erLi] = q(ctx, { metrics: ['social_engagement_rate'], from: addDays(asOf, -89), to: asOf, filters: { platform: ['linkedin'] } });
  if (net.value === null || net.value >= 0) return [];
  return [
    {
      ruleKey: 'x_audience_decline',
      fingerprint: `x_audience_decline:${month(asOf)}`,
      title: { en: 'X audience is shrinking while LinkedIn grows', fr: 'L’audience X recule tandis que LinkedIn progresse' },
      summary: {
        en: `X accounts lost ${fmt(-net.value, 'count', 'en')} followers net over 90 days. Engagement per impression on X is ${fmtPct(er.value, 'en', false)} vs ${fmtPct(erLi.value, 'en', false)} on LinkedIn (platform definitions differ; compare trends rather than levels).`,
        fr: `Les comptes X ont perdu ${fmt(-net.value, 'count', 'fr')} abonnés nets en 90 jours. L’engagement par impression sur X est de ${fmtPct(er.value, 'fr', false)} contre ${fmtPct(erLi.value, 'fr', false)} sur LinkedIn (définitions différentes : comparer les tendances plutôt que les niveaux).`,
      },
      action: {
        en: 'Review the role of X in the channel mix (newsroom, crisis communication, executive voice) and the effort allocated to it; set an explicit objective before changing frequency.',
        fr: 'Clarifier le rôle de X dans le mix (salle de presse, communication de crise, prise de parole dirigeants) et l’effort qui lui est consacré ; fixer un objectif explicite avant de modifier la fréquence.',
      },
      evidence: [
        ev(net, { en: 'Net follower change (X)', fr: 'Évolution nette des abonnés (X)' }, 'count', 'x'),
        ev(er, { en: 'Engagement rate (X)', fr: "Taux d'engagement (X)" }, 'percent', 'x'),
        ev(erLi, { en: 'Engagement rate (LinkedIn)', fr: "Taux d'engagement (LinkedIn)" }, 'percent', 'linkedin'),
      ],
      kpis: ['followers', 'social_engagement_rate'],
      channels: ['x', 'linkedin'],
      priority: 'low',
      impact: 'low',
      effort: 'medium',
      sources: ['X', 'LinkedIn'],
      confidence: 'medium',
      mode: net.meta.mode,
    },
  ];
}

function ruleDecliningPages(ctx: EngineContext, asOf: string): RecommendationDraft[] {
  const r = q(ctx, { metrics: ['sessions'], from: addDays(asOf, -89), to: asOf, compare: 'yoy', groupBy: 'page' })[0];
  if (r.meta.notes.some((n) => n.code === 'compare_incomplete')) return [];
  const declining = (r.rows ?? [])
    .filter((x) => x.compare !== null && x.compare >= 1500 && x.value !== null && (x.value - x.compare) / x.compare < -0.08)
    .map((x) => ({ ...x, pct: (x.value! - x.compare!) / x.compare!, page: PAGES.find((p) => p.id === x.key) }))
    .filter((x) => x.page && !x.page.campaign)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 4);
  if (!declining.length) return [];
  const list = (lang: 'en' | 'fr') => declining.map((d) => `${d.page!.path} (${fmtPct(d.pct, lang)})`).join(', ');
  return [
    {
      ruleKey: 'declining_pages',
      fingerprint: `declining_pages:${month(asOf)}`,
      title: { en: `${declining.length} evergreen page(s) lost visits year on year while the site grew`, fr: `${declining.length} page(s) de fond perdent des visites sur un an alors que le site progresse` },
      summary: {
        en: `Last 90 days vs the same period last year: ${list('en')}, while total sessions changed by ${fmtPct(r.deltaPct, 'en')}. Pages losing visits against a growing site deserve a review.`,
        fr: `90 derniers jours vs la même période l’an dernier : ${list('fr')}, alors que les sessions totales évoluent de ${fmtPct(r.deltaPct, 'fr')}. Ces pages perdent du terrain sur un site en croissance.`,
      },
      action: {
        en: 'Prioritise a content review of these pages (freshness, search intent, internal links), starting with the highest-traffic one. Check Search Console queries for each before rewriting.',
        fr: 'Prioriser une revue éditoriale de ces pages (fraîcheur, intention de recherche, maillage), en commençant par la plus visitée. Consulter les requêtes Search Console avant toute réécriture.',
      },
      evidence: declining.map((d) => ({ label: { en: d.page!.title, fr: d.page!.title }, value: d.value, compare: d.compare, unit: 'count' as Unit, period: r.meta.range, comparePeriod: r.meta.compareRange, source: 'ga4', metric: 'sessions' })),
      kpis: ['sessions', 'organic_clicks'],
      channels: [...new Set(declining.map((d) => d.page!.site))],
      priority: 'medium',
      impact: 'medium',
      effort: 'medium',
      sources: ['Google Analytics 4'],
      confidence: 'high',
      mode: r.meta.mode,
    },
  ];
}

async function ruleSeoIssues(app: AppContext): Promise<RecommendationDraft[]> {
  const rows = await app.db
    .select({ site: seoIssues.websiteKey, rule: seoIssues.rule, n: sql<number>`count(*)::int` })
    .from(seoIssues)
    .where(and(inArray(seoIssues.status, ['open', 'in_progress']), inArray(seoIssues.severity, ['critical', 'high'])))
    .groupBy(seoIssues.websiteKey, seoIssues.rule);
  const bySite = new Map<string, Array<{ rule: string; n: number }>>();
  for (const r of rows) bySite.set(r.site, [...(bySite.get(r.site) ?? []), { rule: r.rule, n: Number(r.n) }]);
  return [...bySite.entries()].map(([site, list]) => {
    const total = list.reduce((s, x) => s + x.n, 0);
    const detail = list.map((x) => `${x.rule.replace(/_/g, ' ')} × ${x.n}`).join(', ');
    return {
      ruleKey: 'seo_high_issues',
      fingerprint: `seo_high_issues:${site}`,
      title: { en: `${total} high-severity technical SEO issues open on ${SITE_NAME[site] ?? site}`, fr: `${total} anomalies SEO techniques majeures ouvertes sur ${SITE_NAME[site] ?? site}` },
      summary: { en: `From the latest audit: ${detail}.`, fr: `D’après le dernier audit : ${detail}.` },
      action: {
        en: 'Assign each issue an owner in SEO Intelligence → Issues, fix broken links and unintended noindex first, then re-run the audit (with crawl authorisation) to confirm.',
        fr: 'Attribuer chaque anomalie dans SEO → Anomalies, corriger d’abord les liens cassés et les noindex non voulus, puis relancer l’audit (avec autorisation de crawl) pour confirmer.',
      },
      evidence: list.map((x) => ({ label: { en: x.rule.replace(/_/g, ' '), fr: x.rule.replace(/_/g, ' ') }, value: x.n, unit: 'count' as Unit, source: 'crawler' })),
      kpis: ['organic_clicks'],
      channels: ['organic_search', site],
      priority: 'high',
      impact: 'medium',
      effort: 'low',
      sources: ['Technical SEO audit'],
      confidence: 'high',
      mode: 'connected',
    };
  });
}

function ruleSocialFormat(ctx: EngineContext, asOf: string): RecommendationDraft[] {
  const posts = ctx.dataset.posts;
  if (!posts) return [];
  const from = addDays(asOf, -179);
  const li = posts.rows.filter((p) => p.platform === 'linkedin' && p.date >= from && p.date <= asOf);
  const byFormat = new Map<string, { imp: number; eng: number; n: number }>();
  for (const p of li) {
    const e = byFormat.get(p.format) ?? { imp: 0, eng: 0, n: 0 };
    e.imp += p.impressions;
    e.eng += p.engagements;
    e.n++;
    byFormat.set(p.format, e);
  }
  const fmts = [...byFormat.entries()].filter(([, v]) => v.n >= 8 && v.imp > 0).map(([k, v]) => ({ k, er: v.eng / v.imp, n: v.n }));
  if (fmts.length < 2) return [];
  fmts.sort((a, b) => b.er - a.er);
  const best = fmts[0];
  const worst = fmts[fmts.length - 1];
  const lift = best.er / worst.er - 1;
  if (lift < 0.25) return [];
  const name = (k: string, lang: 'en' | 'fr') => label(FORMATS.find((f) => f.id === k)?.name ?? { en: k, fr: k }, lang);
  return [
    {
      ruleKey: 'social_format',
      fingerprint: `social_format:${best.k}:${worst.k}:${month(asOf)}`,
      title: { en: `On LinkedIn, ${name(best.k, 'en').toLowerCase()} posts engage more than ${name(worst.k, 'en').toLowerCase()} posts`, fr: `Sur LinkedIn, les ${name(best.k, 'fr').toLowerCase()}s engagent davantage que les ${name(worst.k, 'fr').toLowerCase()}s` },
      summary: {
        en: `Over 6 months, ${name(best.k, 'en')} posts averaged ${fmtPct(best.er, 'en', false)} engagement per impression (${best.n} posts) vs ${fmtPct(worst.er, 'en', false)} for ${name(worst.k, 'en')} (${worst.n} posts). Topic and timing also differ between groups, so this is an association to test, not proof.`,
        fr: `Sur 6 mois, les publications ${name(best.k, 'fr')} obtiennent ${fmtPct(best.er, 'fr', false)} d’engagement par impression (${best.n} publications) contre ${fmtPct(worst.er, 'fr', false)} pour ${name(worst.k, 'fr')} (${worst.n}). Les sujets et horaires diffèrent aussi : c’est une association à tester, pas une preuve.`,
      },
      action: {
        en: `Run a 4-week test publishing comparable topics in both formats and compare engagement rates before changing the editorial plan.`,
        fr: `Mener un test de 4 semaines en publiant des sujets comparables dans les deux formats, puis comparer avant de modifier la ligne éditoriale.`,
      },
      evidence: [
        { label: { en: `${name(best.k, 'en')} — engagement rate`, fr: `${name(best.k, 'fr')} — taux d’engagement` }, value: best.er, unit: 'percent', period: { from, to: asOf }, source: 'linkedin' },
        { label: { en: `${name(worst.k, 'en')} — engagement rate`, fr: `${name(worst.k, 'fr')} — taux d’engagement` }, value: worst.er, unit: 'percent', period: { from, to: asOf }, source: 'linkedin' },
      ],
      kpis: ['social_engagement_rate'],
      channels: ['linkedin'],
      priority: 'low',
      impact: 'low',
      effort: 'low',
      sources: ['LinkedIn'],
      confidence: 'medium',
      mode: posts.origin === 'demo' ? 'demo' : 'connected',
    },
  ];
}

export async function buildRecommendationDrafts(app: AppContext): Promise<RecommendationDraft[]> {
  const ctx = await app.analytics.engineContext(null);
  const asOf = ctx.dataset.asOf;
  return [
    ...ruleTrackingGap(ctx, asOf),
    ...ruleSearchPositionDrop(ctx, asOf),
    ...(await ruleAdsPacing(app, ctx, asOf)),
    ...ruleAdsZeroConversion(ctx, asOf),
    ...(await ruleGeo(app, ctx, asOf)),
    ...ruleAiReferral(ctx, asOf),
    ...ruleDecliningPages(ctx, asOf),
    ...(await ruleSeoIssues(app)),
    ...ruleXAudience(ctx, asOf),
    ...ruleSocialFormat(ctx, asOf),
  ];
}

/** Insert new recommendations; refresh evidence of existing ones without touching workflow fields. */
export async function generateRecommendations(app: AppContext): Promise<{ created: number; refreshed: number }> {
  const drafts = await buildRecommendationDrafts(app);
  let created = 0;
  let refreshed = 0;
  for (const d of drafts) {
    const [existing] = await app.db.select({ id: recommendations.id }).from(recommendations).where(eq(recommendations.fingerprint, d.fingerprint));
    const values = {
      title: d.title.en,
      titleFr: d.title.fr,
      summary: d.summary.en,
      summaryFr: d.summary.fr,
      action: d.action.en,
      actionFr: d.action.fr,
      evidence: d.evidence.map((e) => ({ ...e, mode: d.mode })) as unknown as Array<Record<string, unknown>>,
      kpis: d.kpis,
      channels: d.channels,
      sources: d.sources,
      confidence: d.confidence,
      updatedAt: new Date(),
    };
    if (existing) {
      await app.db.update(recommendations).set(values).where(eq(recommendations.id, existing.id));
      refreshed++;
    } else {
      const [row] = await app.db
        .insert(recommendations)
        .values({ orgId: app.orgId, fingerprint: d.fingerprint, ruleKey: d.ruleKey, origin: 'rule', priority: d.priority, impact: d.impact, effort: d.effort, status: 'new', ...values })
        .returning();
      await app.db.insert(recommendationHistory).values({ recommendationId: row.id, field: 'status', toValue: 'new' });
      created++;
    }
  }
  return { created, refreshed };
}

export { fmtDelta };
