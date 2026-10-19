/** ------------------------------------------------------------------
 *  Deterministic synthetic dataset for DEMO mode.
 *
 *  Generation order encodes the cross-source relationships (all tested):
 *   1. Social posts → daily account metrics are the exact sum of post
 *      metrics distributed over their decay window (X has a 3-day
 *      collection gap: rows absent, never zero).
 *   2. ChatGPT Ads → GA4 "Paid" channel sessions/key events equal the
 *      GA4-side sessions recorded for ad clicks (≤ clicks).
 *   3. Search Console → GA4 organic sessions ≈ 93% of GSC clicks; the
 *      last 2 days of GSC are withheld (processing delay).
 *   4. GA4 organic social sessions ≤ social link clicks (82% landing).
 *   5. Drupal webform submissions = true submissions; GA4 records ~86%
 *      (consent / blockers) and loses contact events on 14–16 Sep 2026
 *      on the FR site (simulated tag misconfiguration).
 *   6. Landing-page, acquisition and browser tables are allocated from
 *      GA4 totals with largest-remainder rounding, so they reconcile.
 *  ------------------------------------------------------------------ */

import { addDays, daysInclusive, epochDay, fromEpochDay, weekday } from '../calendar';
import {
  ADS,
  AD_CAMPAIGNS,
  AD_GROUPS,
  BROWSERS,
  CAMPAIGNS,
  CHANNELS,
  COMPETITORS,
  COUNTRIES,
  DEVICES,
  DRUPAL_FORMS,
  EVENTS,
  FORMATS,
  GEO_PROMPTS,
  GEO_PROVIDERS,
  GSC_ANONYMISED_IMPRESSION_SHARE,
  LANGUAGE_NAMES,
  NEUTRAL_CITATION_DOMAINS,
  PAGES,
  QUERIES,
  SITES,
  SOCIAL_ACCOUNTS,
  SOURCE_MEDIUMS,
  TOPICS,
  type ChannelId,
  type GeoProviderId,
  type Lang,
  type PlatformId,
  type SiteId,
} from '../catalog';
import { FactTable } from './table';
import { allocate, gauss, noise, sround, strHash, u01 } from './rng';

export const DEMO_START = '2024-07-01';
export const DEMO_END = '2026-10-18';
export const DEMO_DAYS = daysInclusive(DEMO_START, DEMO_END);
export const GSC_DELAY_DAYS = 2;
export const X_GAP_DAYS = ['2026-10-08', '2026-10-09', '2026-10-10'];
export const GA4_TRACKING_GAP = { site: 'veolia-fr' as SiteId, event: 'contact_form_submit', from: '2026-09-14', to: '2026-09-16' };
export const GA4_TRACKING_RATE = 0.86;
export const GSC_TO_GA4_SESSIONS = 0.93;
export const SOCIAL_LINK_TO_SESSION = 0.82;
export const ADS_CLICK_TO_SESSION = 0.87;

export const dayOf = (iso: string) => epochDay(iso) - epochDay(DEMO_START);
export const isoOf = (d: number) => fromEpochDay(epochDay(DEMO_START) + d);

/* ---------------- dimension code tables ---------------- */

export const CODES = {
  site: SITES.map((s) => s.id),
  country: COUNTRIES.map((c) => c.id),
  channel: CHANNELS.map((c) => c.id),
  device: DEVICES.map((d) => d.id),
  srcmed: SOURCE_MEDIUMS.map((s) => s.id),
  campaign: ['(not set)', 'newsletter', ...CAMPAIGNS.map((c) => c.utm)],
  page: PAGES.map((p) => p.id),
  query: QUERIES.map((q) => q.id),
  account: SOCIAL_ACCOUNTS.map((a) => a.id),
  ad: ADS.map((a) => a.id),
  form: DRUPAL_FORMS.map((f) => f.id),
  browser: BROWSERS.map((b) => b.id),
  lang: Object.keys(LANGUAGE_NAMES),
} as const;

export type DimCodeKey = keyof typeof CODES;

const idx = <T extends string>(arr: readonly T[]) => new Map(arr.map((v, i) => [v, i]));
export const CODE_INDEX: { [K in DimCodeKey]: Map<string, number> } = {
  site: idx(CODES.site),
  country: idx(CODES.country),
  channel: idx(CODES.channel),
  device: idx(CODES.device),
  srcmed: idx(CODES.srcmed),
  campaign: idx(CODES.campaign),
  page: idx(CODES.page),
  query: idx(CODES.query),
  account: idx(CODES.account),
  ad: idx(CODES.ad),
  form: idx(CODES.form),
  browser: idx(CODES.browser),
  lang: idx(CODES.lang),
};

export const EVENT_MEASURES = EVENTS.map((e) => `ev_${e.id}`);
export const GA4_MEASURES = ['sessions', 'users', 'newUsers', 'engaged', 'views', 'engTime', ...EVENT_MEASURES] as const;
export const GA4_ACQ_MEASURES = ['sessions', 'engaged', 'views', 'engTime', ...EVENT_MEASURES] as const;
export const GA4_PAGE_MEASURES = ['sessions', 'engaged', 'views', 'engTime', ...EVENT_MEASURES] as const;
export const GSC_MEASURES = ['impressions', 'clicks', 'posW'] as const;
export const SOCIAL_MEASURES = [
  'impressions',
  'engagements',
  'reactions',
  'comments',
  'shares',
  'clicks',
  'linkClicks',
  'videoViews',
  'watchMinutes',
  'followersGained',
  'followersLost',
  'followers',
  'posts',
] as const;
export const ADS_MEASURES = ['spend', 'impressions', 'clicks', 'conversions', 'gaSessions', 'gaEngaged', 'ga_contact', 'ga_lead', 'ga_brochure'] as const;

/* ---------------- posts & GEO records ---------------- */

export interface DemoPost {
  id: string;
  account: string;
  platform: PlatformId;
  day: number;
  date: string;
  hour: number;
  weekday: number;
  format: string;
  topic: string;
  campaign: string | null;
  bu: string;
  objective: string;
  pillar: string;
  audience: string;
  language: Lang;
  text: string;
  url: string | null;
  impressions: number;
  reactions: number;
  comments: number;
  shares: number;
  clicks: number;
  linkClicks: number;
  videoViews: number;
  watchMinutes: number;
  engagements: number;
  subsGained: number;
}

export interface DemoGeoMeasurement {
  id: string;
  day: number;
  date: string;
  provider: GeoProviderId;
  prompt: string;
  promptVersion: number;
  status: 'completed' | 'failed' | 'partial';
  mentioned: boolean;
  cited: boolean;
  mentionRank: number | null;
  citedUrls: string[];
  citedDomains: string[];
  competitors: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface DemoData {
  start: string;
  end: string;
  days: number;
  ga4: FactTable<'site' | 'country' | 'channel' | 'device', (typeof GA4_MEASURES)[number]>;
  ga4acq: FactTable<'site' | 'channel' | 'srcmed' | 'campaign', (typeof GA4_ACQ_MEASURES)[number]>;
  ga4page: FactTable<'site' | 'page', (typeof GA4_PAGE_MEASURES)[number]>;
  ga4browser: FactTable<'site' | 'device' | 'browser', 'sessions' | 'engaged'>;
  /** sessions by visitor (browser) language */
  ga4lang: FactTable<'site' | 'lang', 'sessions' | 'engaged'>;
  gscSite: FactTable<'site' | 'country' | 'device', (typeof GSC_MEASURES)[number]>;
  gscQuery: FactTable<'site' | 'query', (typeof GSC_MEASURES)[number]>;
  gscPage: FactTable<'site' | 'page', (typeof GSC_MEASURES)[number]>;
  social: FactTable<'account', (typeof SOCIAL_MEASURES)[number]>;
  ads: FactTable<'ad', (typeof ADS_MEASURES)[number]>;
  drupal: FactTable<'site' | 'form', 'submissions'>;
  posts: DemoPost[];
  geo: DemoGeoMeasurement[];
  /** end-of-day audience per account (followers / subscribers) */
  audience: Float64Array[];
  generatedMs: number;
}

/* ---------------- helpers ---------------- */

const S_GA4 = strHash('ga4');
const S_GSC = strHash('gsc');
const S_SOC = strHash('social');
const S_ADS = strHash('ads');
const S_GEO = strHash('geo');
const S_PAGE = strHash('pages');
const S_DRU = strHash('drupal');

const WEEKDAY_WEB = [1.1, 1.14, 1.13, 1.08, 0.96, 0.52, 0.47];
const WEEKDAY_SEARCH = [1.06, 1.08, 1.08, 1.05, 0.98, 0.78, 0.76];
const FR_HOLIDAYS = new Set(['05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25', '01-01']);

interface DayInfo {
  iso: string;
  wd: number;
  month: number;
  dom: number;
  t: number; // years since start
}

function buildDays(): DayInfo[] {
  const out: DayInfo[] = [];
  for (let d = 0; d < DEMO_DAYS; d++) {
    const iso = isoOf(d);
    out.push({ iso, wd: weekday(iso), month: Number(iso.slice(5, 7)), dom: Number(iso.slice(8, 10)), t: d / 365.25 });
  }
  return out;
}

function seasonal(di: DayInfo, lang: Lang, search = false): number {
  let f = (search ? WEEKDAY_SEARCH : WEEKDAY_WEB)[di.wd];
  if (di.month === 8) f *= lang === 'fr' ? 0.62 : 0.86;
  else if (di.month === 7 && di.dom >= 14) f *= lang === 'fr' ? 0.84 : 0.94;
  if ((di.month === 12 && di.dom >= 22) || (di.month === 1 && di.dom <= 2)) f *= lang === 'fr' ? 0.55 : 0.6;
  if (lang === 'fr' && FR_HOLIDAYS.has(di.iso.slice(5))) f *= 0.6;
  return f;
}

function campaignActive(campaignId: string | undefined, iso: string): boolean {
  if (!campaignId) return false;
  const c = CAMPAIGNS.find((x) => x.id === campaignId);
  if (!c) return false;
  return iso >= c.from && (c.to === null || iso <= c.to);
}

function topicInterest(topic: string, t: number): number {
  switch (topic) {
    case 'pfas':
      return Math.pow(1.38, t);
    case 'datacentre_water':
      return Math.pow(1.6, t);
    case 'waste_circular':
      return Math.pow(0.96, t);
    default:
      return Math.pow(1.03, t);
  }
}

const ctrCurve = (p: number) => 0.31 * Math.exp(-0.33 * (Math.max(1, p) - 1)) + 0.008;

/** Smooth step from 0→1 over `span` days starting at `from`. */
function ramp(d: number, from: number, span = 3): number {
  if (d < from) return 0;
  return Math.min(1, (d - from + 1) / span);
}

/* ---------------- generator ---------------- */

export function generateDemoData(): DemoData {
  const t0 = Date.now();
  const days = buildDays();
  const D = DEMO_DAYS;
  const nSites = SITES.length;

  /* ===== 1. social posts & daily account metrics ===== */
  const posts: DemoPost[] = [];
  const nAcc = SOCIAL_ACCOUNTS.length;
  const NM = SOCIAL_MEASURES.length;
  const soc = new Float64Array(nAcc * D * NM);
  const sIdx = (a: number, d: number, m: number) => (a * D + d) * NM + m;
  const M = Object.fromEntries(SOCIAL_MEASURES.map((m, i) => [m, i])) as Record<(typeof SOCIAL_MEASURES)[number], number>;
  // link clicks landing per (day, site) and per (day, site, campaign code) for GA4 social
  const socialLinks = new Float64Array(D * nSites);
  const socialLinksCampaign = new Float64Array(D * nSites * CODES.campaign.length);
  const audience: Float64Array[] = SOCIAL_ACCOUNTS.map(() => new Float64Array(D));

  const POST_TEXT: Record<string, Record<Lang, string[]>> = {
    water_treatment: {
      en: ['How industrial sites reuse up to 40% of their process water', 'Inside a zero-liquid-discharge plant', 'Water scarcity: three levers for manufacturers', 'Our engineers on the future of water treatment'],
      fr: ["Comment les sites industriels réutilisent jusqu'à 40 % de leur eau", "Réutilisation des eaux usées : où en est la France ?", 'Sécheresse : trois leviers pour les industriels', "Nos ingénieurs racontent le traitement de l'eau de demain"],
    },
    decarbonisation: {
      en: ['Decarbonising heavy industry, one site at a time', 'Heat recovery cut this plant’s emissions by a quarter', 'What a credible decarbonisation roadmap looks like'],
      fr: ['Décarboner l’industrie, site par site', 'La récupération de chaleur, levier de décarbonation', 'À quoi ressemble une feuille de route de décarbonation crédible'],
    },
    pfas: {
      en: ['PFAS: why destruction matters more than capture', 'New results from our PFAS treatment pilot', 'PFAS regulation in 2026 — what changes for industry'],
      fr: ['PFAS : détruire plutôt que capter', 'Nouveaux résultats de notre pilote de traitement des PFAS', 'Réglementation PFAS 2026 : ce qui change'],
    },
    waste_circular: {
      en: ['Turning waste into resources: a circular economy story', 'Recycling rates are rising — here is how', 'From landfill to feedstock'],
      fr: ['Transformer les déchets en ressources', 'Économie circulaire : un exemple concret', 'Valorisation des déchets : les chiffres clés'],
    },
    energy_efficiency: {
      en: ['Energy efficiency is the cheapest energy', 'How a hospital cut its energy bill by 18%'],
      fr: ["L'efficacité énergétique, l'énergie la moins chère", "Comment un hôpital a réduit sa facture d'énergie de 18 %"],
    },
    datacentre_water: {
      en: ['Data centres and water: rethinking cooling', 'AI needs water — here is how to use less of it'],
      fr: ['Data centers et eau : repenser le refroidissement', "L'IA a soif : comment consommer moins d'eau"],
    },
    municipal_services: {
      en: ['Smart water networks for cities', 'How municipalities cut water losses in half'],
      fr: ["Des réseaux d'eau intelligents pour les collectivités", 'Comment une collectivité a réduit de moitié ses fuites'],
    },
    corporate: {
      en: ['Annual results: key figures', 'Our sustainability report is out', 'A message from our leadership team'],
      fr: ['Résultats annuels : les chiffres clés', 'Notre rapport développement durable est en ligne', 'Le mot de notre direction'],
    },
    careers: {
      en: ['Join our graduate programme', 'Meet the people behind our water plants', 'Life as a field engineer'],
      fr: ['Rejoignez notre programme jeunes diplômés', 'Alternance : candidatures ouvertes', 'Portrait : la vie d’ingénieure terrain'],
    },
  };

  const decay = (platform: PlatformId, format: string): number[] => {
    if (platform === 'linkedin') return [0.42, 0.25, 0.13, 0.08, 0.05, 0.03, 0.02, 0.02];
    if (platform === 'x') return [0.72, 0.18, 0.06, 0.04];
    const n = format === 'short' ? 10 : 45;
    const r = format === 'short' ? 0.75 : 0.9;
    const w = Array.from({ length: n }, (_, i) => Math.pow(r, i));
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / s);
  };

  const weekdayPostW: Record<PlatformId, number[]> = {
    linkedin: [0.18, 0.24, 0.24, 0.2, 0.12, 0.01, 0.01],
    x: [0.17, 0.19, 0.19, 0.17, 0.15, 0.07, 0.06],
    youtube: [0.15, 0.2, 0.2, 0.2, 0.15, 0.05, 0.05],
  };
  const hourW: Array<[number, number]> = [
    [7, 0.04],
    [8, 0.13],
    [9, 0.17],
    [10, 0.15],
    [11, 0.11],
    [12, 0.06],
    [13, 0.05],
    [14, 0.1],
    [15, 0.08],
    [16, 0.06],
    [17, 0.03],
    [18, 0.02],
  ];
  const pick = <T,>(items: Array<[T, number]>, u: number): T => {
    const tot = items.reduce((s, [, w]) => s + w, 0);
    let acc = 0;
    for (const [v, w] of items) {
      acc += w / tot;
      if (u < acc) return v;
    }
    return items[items.length - 1][0];
  };
  const timeFactor = (platform: PlatformId, wd: number, hour: number) => {
    if (platform === 'linkedin') return (wd >= 1 && wd <= 3 ? 1.12 : wd >= 5 ? 0.7 : 0.95) * (hour >= 8 && hour <= 10 ? 1.18 : hour >= 16 ? 0.85 : 1);
    if (platform === 'x') return (hour >= 12 && hour <= 14 ? 1.1 : hour < 8 ? 0.85 : 1) * (wd >= 5 ? 0.9 : 1);
    return wd >= 4 ? 1.08 : 1;
  };

  // audience follows a deterministic path; post reach uses audience on the publish day
  SOCIAL_ACCOUNTS.forEach((acc, a) => {
    let aud = acc.audienceStart;
    for (let d = 0; d < D; d++) {
      const di = days[d];
      const churn = acc.platform === 'x' ? 0.00016 : 0.00009;
      const gross = Math.max(0, acc.growth + churn);
      const wf = acc.platform === 'linkedin' ? WEEKDAY_WEB[di.wd] : 1;
      const gained = sround(aud * gross * wf * noise(0.25, S_SOC, a, d, 1), S_SOC, a, d, 2);
      const lost = sround(aud * churn * noise(0.25, S_SOC, a, d, 3), S_SOC, a, d, 4);
      aud += gained - lost;
      audience[a][d] = aud;
      soc[sIdx(a, d, M.followersGained)] = gained;
      soc[sIdx(a, d, M.followersLost)] = lost;
      soc[sIdx(a, d, M.followers)] = aud;
    }
  });

  const formatsFor = (p: PlatformId) => FORMATS.filter((f) => f.platforms.includes(p)).map((f) => f.id);
  const formatW: Record<string, number> = { image: 0.32, video: 0.16, carousel: 0.16, article: 0.08, text: 0.16, poll: 0.04, link: 0.3, short: 0.4, live: 0.06 };
  const formatPerf: Record<string, { reach: number; eng: number; click: number }> = {
    image: { reach: 1, eng: 1, click: 1 },
    video: { reach: 1.25, eng: 1.15, click: 0.6 },
    carousel: { reach: 1.15, eng: 1.4, click: 0.8 },
    article: { reach: 0.7, eng: 0.8, click: 1.8 },
    text: { reach: 0.85, eng: 0.9, click: 0.5 },
    poll: { reach: 1.3, eng: 1.6, click: 0.2 },
    link: { reach: 0.8, eng: 0.7, click: 2.1 },
    short: { reach: 2.2, eng: 1.1, click: 0.2 },
    live: { reach: 0.6, eng: 1.3, click: 0.4 },
  };
  const topicPerf: Record<string, number> = {
    water_treatment: 1.05,
    decarbonisation: 0.95,
    pfas: 1.25,
    waste_circular: 1.0,
    energy_efficiency: 0.85,
    datacentre_water: 1.15,
    municipal_services: 0.9,
    corporate: 0.9,
    careers: 1.35,
  };

  SOCIAL_ACCOUNTS.forEach((acc, a) => {
    const formats = formatsFor(acc.platform);
    const nWeeks = Math.ceil(D / 7);
    let seq = 0;
    for (let w = 0; w < nWeeks; w++) {
      const count = sround(acc.postsPerWeek * noise(0.3, S_SOC, a, w, 10), S_SOC, a, w, 11);
      for (let k = 0; k < count; k++) {
        const wd = pick(weekdayPostW[acc.platform].map((x, i) => [i, x] as [number, number]), u01(S_SOC, a, w, k, 12));
        const d = w * 7 + ((wd - days[0].wd + 7) % 7);
        if (d >= D) continue;
        const di = days[d];
        const hour = acc.platform === 'x' ? 7 + Math.floor(u01(S_SOC, a, w, k, 13) * 12) : pick(hourW, u01(S_SOC, a, w, k, 13));
        // campaign-aware topic choice
        const activeCampaigns = CAMPAIGNS.filter((c) => di.iso >= c.from && (c.to === null || di.iso <= c.to) && !c.id.startsWith('chatgpt'));
        let topic: string;
        let campaign: string | null = null;
        if (activeCampaigns.length && u01(S_SOC, a, w, k, 14) < 0.55) {
          const c = activeCampaigns[Math.floor(u01(S_SOC, a, w, k, 15) * activeCampaigns.length)];
          topic = c.topic;
          campaign = c.id;
        } else {
          topic = TOPICS[Math.floor(u01(S_SOC, a, w, k, 16) * TOPICS.length)].id;
        }
        const format = pick(formats.map((f) => [f, formatW[f] ?? 0.1] as [string, number]), u01(S_SOC, a, w, k, 17));
        const fp = formatPerf[format];
        const tf = timeFactor(acc.platform, wd, hour);
        const viral = u01(S_SOC, a, w, k, 18) < 0.02 ? 2.5 + u01(S_SOC, a, w, k, 19) * 3 : 1;
        const campaignBoost = campaign ? 1.2 : 1;
        const topicF = topicPerf[topic] ?? 1;
        const lognorm = Math.exp(0.38 * gauss(S_SOC, a, w, k, 20));
        const aud = audience[a][d];
        const tdef = TOPICS.find((x) => x.id === topic)!;
        const texts = POST_TEXT[topic][acc.language];
        const text = texts[Math.floor(u01(S_SOC, a, w, k, 21) * texts.length)];
        const sitePages = PAGES.filter((p) => p.topic === topic && p.site === (acc.language === 'fr' ? 'veolia-fr' : 'veolia-en'));
        const hasLink = acc.platform !== 'youtube' && (format === 'link' || format === 'article' || u01(S_SOC, a, w, k, 22) < 0.78) && sitePages.length > 0;
        const page = hasLink ? sitePages[Math.floor(u01(S_SOC, a, w, k, 23) * sitePages.length)] : null;

        // potential lifetime metrics
        let imp = 0,
          reactions = 0,
          comments = 0,
          shares = 0,
          clicks = 0,
          linkClicks = 0,
          videoViews = 0,
          watch = 0,
          subs = 0;
        if (acc.platform === 'linkedin') {
          const reachRate = acc.id === 'li-group' ? 0.022 : 0.05;
          imp = aud * reachRate * fp.reach * topicF * tf * viral * campaignBoost * lognorm;
          reactions = imp * 0.0185 * fp.eng * topicF * noise(0.15, S_SOC, a, w, k, 30);
          comments = reactions * 0.065 * noise(0.3, S_SOC, a, w, k, 31);
          shares = reactions * 0.05 * noise(0.3, S_SOC, a, w, k, 32);
          clicks = imp * 0.016 * fp.click * noise(0.2, S_SOC, a, w, k, 33);
          linkClicks = hasLink ? clicks * 0.55 : 0;
          videoViews = format === 'video' ? imp * 0.28 : 0;
        } else if (acc.platform === 'x') {
          imp = aud * 0.031 * fp.reach * topicF * tf * viral * campaignBoost * lognorm;
          reactions = imp * 0.0062 * fp.eng * topicF * noise(0.2, S_SOC, a, w, k, 30); // likes
          comments = reactions * 0.09 * noise(0.3, S_SOC, a, w, k, 31); // replies
          shares = reactions * 0.19 * noise(0.3, S_SOC, a, w, k, 32); // reposts + quotes
          clicks = imp * 0.0042 * fp.click * noise(0.25, S_SOC, a, w, k, 33); // link + profile clicks
          linkClicks = hasLink ? clicks * 0.62 : 0;
          videoViews = format === 'video' ? imp * 0.22 : 0;
        } else {
          // YouTube: impressions = thumbnail impressions; videoViews = views
          imp = aud * (format === 'short' ? 2.4 : 0.95) * topicF * viral * lognorm;
          const ctr = format === 'short' ? 0.09 : 0.047;
          videoViews = imp * ctr * fp.eng * noise(0.15, S_SOC, a, w, k, 34) + (format === 'live' ? 300 : 0);
          const avgMin = format === 'short' ? 0.38 : format === 'live' ? 8.6 : 2.4;
          watch = videoViews * avgMin * noise(0.12, S_SOC, a, w, k, 35);
          reactions = videoViews * 0.026 * noise(0.2, S_SOC, a, w, k, 30);
          comments = videoViews * 0.0028 * noise(0.3, S_SOC, a, w, k, 31);
          shares = videoViews * 0.0042 * noise(0.3, S_SOC, a, w, k, 32);
          subs = videoViews * 0.0021 * noise(0.3, S_SOC, a, w, k, 36);
        }

        // distribute over the decay window, truncated at the end of the dataset
        const dist = decay(acc.platform, format);
        const vals = [imp, reactions, comments, shares, clicks, linkClicks, videoViews, watch, subs];
        const lifetime = new Float64Array(vals.length);
        const siteIdx = acc.language === 'fr' ? 0 : 1;
        const cmpCode = campaign ? CODE_INDEX.campaign.get(CAMPAIGNS.find((c) => c.id === campaign)!.utm)! : 0;
        for (let i = 0; i < dist.length && d + i < D; i++) {
          const dd = d + i;
          for (let v = 0; v < vals.length; v++) {
            const x = sround(vals[v] * dist[i], S_SOC, a, w * 64 + k, i, 40 + v);
            lifetime[v] += x;
            if (v === 0) soc[sIdx(a, dd, M.impressions)] += x;
            else if (v === 1) soc[sIdx(a, dd, M.reactions)] += x;
            else if (v === 2) soc[sIdx(a, dd, M.comments)] += x;
            else if (v === 3) soc[sIdx(a, dd, M.shares)] += x;
            else if (v === 4) soc[sIdx(a, dd, M.clicks)] += x;
            else if (v === 5) {
              soc[sIdx(a, dd, M.linkClicks)] += x;
              if (page) {
                socialLinks[dd * nSites + siteIdx] += x;
                socialLinksCampaign[(dd * nSites + siteIdx) * CODES.campaign.length + cmpCode] += x;
              }
            } else if (v === 6) soc[sIdx(a, dd, M.videoViews)] += x;
            else if (v === 7) soc[sIdx(a, dd, M.watchMinutes)] += x;
          }
        }
        soc[sIdx(a, d, M.posts)] += 1;
        const [lImp, lReact, lCom, lShare, lClicks, lLink, lViews, lWatch, lSubs] = lifetime;
        const engagements = acc.platform === 'youtube' ? lReact + lCom + lShare : lReact + lCom + lShare + lClicks;
        posts.push({
          id: `${acc.id}-${String(++seq).padStart(4, '0')}`,
          account: acc.id,
          platform: acc.platform,
          day: d,
          date: di.iso,
          hour,
          weekday: wd,
          format,
          topic,
          campaign,
          bu: tdef.bu,
          objective: topic === 'careers' ? 'recruitment' : topic === 'corporate' ? 'reputation' : format === 'link' || format === 'article' ? 'consideration' : 'awareness',
          pillar: topic === 'careers' ? 'people' : topic === 'corporate' ? 'corporate' : format === 'video' || format === 'carousel' ? 'expertise' : 'impact',
          audience: topic === 'careers' ? 'talent' : topic === 'municipal_services' ? 'public_sector' : topic === 'corporate' ? 'investors' : 'industry',
          language: acc.language,
          text: acc.platform === 'youtube' ? `${text} (video)` : text,
          url: page ? `https://${'www.veolia.com'}${page.path}` : null,
          impressions: lImp,
          reactions: lReact,
          comments: lCom,
          shares: lShare,
          clicks: lClicks,
          linkClicks: lLink,
          videoViews: lViews,
          watchMinutes: lWatch,
          engagements,
          subsGained: lSubs,
        });
      }
    }
  });
  // daily engagements per platform definition
  SOCIAL_ACCOUNTS.forEach((acc, a) => {
    for (let d = 0; d < D; d++) {
      const r = soc[sIdx(a, d, M.reactions)];
      const c = soc[sIdx(a, d, M.comments)];
      const s = soc[sIdx(a, d, M.shares)];
      const k = soc[sIdx(a, d, M.clicks)];
      soc[sIdx(a, d, M.engagements)] = acc.platform === 'youtube' ? r + c + s : r + c + s + k;
    }
  });
  const xGap = new Set(X_GAP_DAYS.map(dayOf));
  const social = new FactTable(['account'] as const, SOCIAL_MEASURES, D * nAcc);
  for (let d = 0; d < D; d++) {
    for (let a = 0; a < nAcc; a++) {
      if (SOCIAL_ACCOUNTS[a].platform === 'x' && xGap.has(d)) continue; // collection gap: rows absent
      const vals = SOCIAL_MEASURES.map((_, m) => soc[sIdx(a, d, m)]);
      social.push(d, [a], vals);
    }
  }
  social.finalize(D);

  /* ===== 2. ChatGPT Ads ===== */
  const ads = new FactTable(['ad'] as const, ADS_MEASURES, D * ADS.length);
  const paidBySite = new Float64Array(D * nSites * 6); // sessions, engaged, contact, lead, brochure, (unused)
  const paidByCampaign = new Float64Array(D * nSites * AD_CAMPAIGNS.length);
  for (let d = 0; d < D; d++) {
    const di = days[d];
    for (let ci = 0; ci < AD_CAMPAIGNS.length; ci++) {
      const c = AD_CAMPAIGNS[ci];
      const startD = dayOf(c.from);
      if (d < startD) continue;
      const groups = AD_GROUPS.filter((g) => g.campaign === c.id && !(g.pausedFrom && di.iso >= g.pausedFrom));
      const campaignAds = ADS.filter((ad) => groups.some((g) => g.id === ad.group));
      if (!campaignAds.length) continue;
      const pacing = c.category === 'collectivities' && di.iso >= '2026-10-01' ? 1.24 : c.category === 'industries' ? 0.97 : 1;
      const wf = di.wd >= 5 ? 0.82 : 1.06;
      const rampUp = Math.min(1, 0.45 + (d - startD) * 0.08);
      const dailyBudget = (c.monthlyBudget / 30.4) * pacing * wf * rampUp;
      const weights = campaignAds.map((ad) => ad.ctr);
      const wsum = weights.reduce((s, x) => s + x, 0);
      campaignAds.forEach((ad) => {
        const ai = CODE_INDEX.ad.get(ad.id)!;
        const spend = Math.round(dailyBudget * (ad.ctr / wsum) * noise(0.08, S_ADS, ai, d, 1) * 100) / 100;
        const impressions = sround((spend / c.cpm) * 1000 * noise(0.06, S_ADS, ai, d, 2), S_ADS, ai, d, 3);
        const clicks = Math.min(impressions, sround(impressions * ad.ctr * noise(0.12, S_ADS, ai, d, 4), S_ADS, ai, d, 5));
        const conversions = Math.min(clicks, sround(clicks * ad.cvr * noise(0.3, S_ADS, ai, d, 6), S_ADS, ai, d, 7));
        const gaSessions = Math.min(clicks, sround(clicks * ADS_CLICK_TO_SESSION * noise(0.04, S_ADS, ai, d, 8), S_ADS, ai, d, 9));
        const ind = c.category === 'industries';
        const gaEngaged = Math.min(gaSessions, sround(gaSessions * (ind ? 0.56 : 0.37) * noise(0.06, S_ADS, ai, d, 10), S_ADS, ai, d, 11));
        const zeroConv = ad.cvr === 0 ? 0 : 1;
        const gaContact = Math.min(gaEngaged, sround(gaSessions * (ind ? 0.011 : 0.006) * zeroConv * noise(0.3, S_ADS, ai, d, 12), S_ADS, ai, d, 13));
        const gaLead = Math.min(gaEngaged, sround(gaSessions * (ind ? 0.017 : 0.002) * zeroConv * noise(0.3, S_ADS, ai, d, 14), S_ADS, ai, d, 15));
        const gaBrochure = Math.min(gaEngaged, sround(gaSessions * (ind ? 0.022 : 0.004) * noise(0.3, S_ADS, ai, d, 16), S_ADS, ai, d, 17));
        if (spend <= 0) return;
        ads.push(d, [ai], [spend, impressions, clicks, conversions, gaSessions, gaEngaged, gaContact, gaLead, gaBrochure]);
        const s = CODE_INDEX.site.get(ad.site)!;
        const base = (d * nSites + s) * 6;
        paidBySite[base] += gaSessions;
        paidBySite[base + 1] += gaEngaged;
        paidBySite[base + 2] += gaContact;
        paidBySite[base + 3] += gaLead;
        paidBySite[base + 4] += gaBrochure;
        paidByCampaign[(d * nSites + s) * AD_CAMPAIGNS.length + ci] += gaSessions;
      });
    }
  }
  ads.finalize(D);

  /* ===== 3. Search Console ===== */
  const gscQuery = new FactTable(['site', 'query'] as const, GSC_MEASURES, D * QUERIES.length);
  const gscSite = new FactTable(['site', 'country', 'device'] as const, GSC_MEASURES, D * nSites * COUNTRIES.length * 3);
  const gscPage = new FactTable(['site', 'page'] as const, GSC_MEASURES, D * PAGES.length);
  const gscClicksActual = new Float64Array(D * nSites);
  const gscClicksExpected = new Float64Array(D * nSites);
  const gscCutoff = D - GSC_DELAY_DAYS;
  const searchDevice = [0.58, 0.4, 0.02];
  const pagesBySite = SITES.map((s) => PAGES.filter((p) => p.site === s.id));
  for (let d = 0; d < D; d++) {
    const di = days[d];
    for (let s = 0; s < nSites; s++) {
      const site = SITES[s];
      let sumImp = 0,
        sumClk = 0,
        sumPosW = 0,
        expClk = 0;
      const pageImp = new Map<string, number>();
      const pageClk = new Map<string, number>();
      const pagePosW = new Map<string, number>();
      QUERIES.forEach((q, qi) => {
        if (q.site !== site.id) return;
        const t = di.t;
        const cliffDelta = q.cliff ? q.cliff.delta * ramp(d, dayOf(q.cliff.from), 3) : 0;
        const basePos = Math.max(1, q.pos + q.drift * t);
        const pos = Math.max(1, basePos + cliffDelta + gauss(S_GSC, qi, d, 1) * (q.brand ? 0.05 : 0.35));
        const campaignBoost = CAMPAIGNS.some((c) => c.topic === q.topic && di.iso >= c.from && (c.to === null || di.iso <= c.to)) ? 1.15 : 1;
        const impExp = q.imp * seasonal(di, site.language, true) * topicInterest(q.topic, t) * campaignBoost;
        const imp = sround(impExp * noise(0.12, S_GSC, qi, d, 2), S_GSC, qi, d, 3);
        const ctr = Math.min(0.9, ctrCurve(pos) * (q.brand ? 1.25 : 1) * noise(0.1, S_GSC, qi, d, 4));
        const clk = Math.min(imp, sround(imp * ctr, S_GSC, qi, d, 5));
        expClk += impExp * ctrCurve(basePos) * (q.brand ? 1.25 : 1);
        if (d < gscCutoff && imp > 0) gscQuery.push(d, [s, qi], [imp, clk, imp * pos]);
        sumImp += imp;
        sumClk += clk;
        sumPosW += imp * pos;
        const pid = `${site.id}:${q.page}`;
        pageImp.set(pid, (pageImp.get(pid) ?? 0) + imp);
        pageClk.set(pid, (pageClk.get(pid) ?? 0) + clk);
        pagePosW.set(pid, (pagePosW.get(pid) ?? 0) + imp * pos);
      });
      // site totals include anonymised queries
      const anonImp = sround((sumImp * GSC_ANONYMISED_IMPRESSION_SHARE) / (1 - GSC_ANONYMISED_IMPRESSION_SHARE), S_GSC, s, d, 6);
      const anonClk = sround(anonImp * 0.011, S_GSC, s, d, 7);
      const totImp = sumImp + anonImp;
      const totClk = sumClk + anonClk;
      const totPosW = sumPosW + anonImp * 14.5;
      gscClicksActual[d * nSites + s] = totClk;
      gscClicksExpected[d * nSites + s] = expClk / (1 - 0.06) + anonImp * 0.011;
      if (d >= gscCutoff) continue;
      // country × device cells
      const w = new Float64Array(COUNTRIES.length * 3);
      COUNTRIES.forEach((c, ci) => {
        for (let dv = 0; dv < 3; dv++) w[ci * 3 + dv] = c.share[site.id] * searchDevice[dv] * noise(0.08, S_GSC, s, d, 100 + ci * 3 + dv);
      });
      const impCells = allocate(totImp, w);
      const clkCells = allocate(totClk, w);
      const avgPos = totImp > 0 ? totPosW / totImp : 10;
      COUNTRIES.forEach((c, ci) => {
        const offset = c.share[site.id] > 0.05 ? 0 : 2.2;
        for (let dv = 0; dv < 3; dv++) {
          const k = ci * 3 + dv;
          const imp = impCells[k];
          if (imp <= 0) continue;
          const clk = Math.min(imp, clkCells[k]);
          const pos = Math.max(1, avgPos + offset + (dv === 1 ? 0.4 : 0));
          gscSite.push(d, [s, ci, dv], [imp, clk, imp * pos]);
        }
      });
      // pages: queries' pages carry their own volumes; remaining traffic spread by page weight
      const sp = pagesBySite[s];
      const restImp = totImp - [...pageImp.values()].reduce((x, y) => x + y, 0);
      const restClk = totClk - [...pageClk.values()].reduce((x, y) => x + y, 0);
      const restImpCells = allocate(Math.max(0, restImp), sp.map((p) => p.w));
      const restClkCells = allocate(Math.max(0, restClk), sp.map((p) => p.w));
      sp.forEach((p, k) => {
        const imp = (pageImp.get(p.id) ?? 0) + restImpCells[k];
        const clk = Math.min(imp, (pageClk.get(p.id) ?? 0) + restClkCells[k]);
        if (imp <= 0) return;
        const posW = (pagePosW.get(p.id) ?? 0) + restImpCells[k] * 14.5;
        gscPage.push(d, [s, CODE_INDEX.page.get(p.id)!], [imp, clk, posW]);
      });
    }
  }
  gscQuery.finalize(D);
  gscSite.finalize(D);
  gscPage.finalize(D);

  /* ===== 4. GA4 ===== */
  const ga4 = new FactTable(['site', 'country', 'channel', 'device'] as const, GA4_MEASURES, D * 400);
  const ga4acq = new FactTable(['site', 'channel', 'srcmed', 'campaign'] as const, GA4_ACQ_MEASURES, D * 60);
  const ga4page = new FactTable(['site', 'page'] as const, GA4_PAGE_MEASURES, D * PAGES.length);
  const ga4browser = new FactTable(['site', 'device', 'browser'] as const, ['sessions', 'engaged'] as const, D * 40);
  const ga4lang = new FactTable(['site', 'lang'] as const, ['sessions', 'engaged'] as const, D * 20);
  const drupal = new FactTable(['site', 'form'] as const, ['submissions'] as const, D * 6);
  const NE = EVENTS.length;
  const gapFrom = dayOf(GA4_TRACKING_GAP.from);
  const gapTo = dayOf(GA4_TRACKING_GAP.to);
  const devConv = [1.35, 0.62, 0.95];
  const devEng = [1.06, 0.92, 0.98];
  const devTime = [1.12, 0.85, 0.95];
  const paidCountry: Record<SiteId, Record<string, number>> = {
    'veolia-fr': { FR: 0.82, BE: 0.07, CH: 0.05, CA: 0.04, MA: 0.02 },
    'veolia-en': { US: 0.52, GB: 0.3, CA: 0.08, AU: 0.06, IN: 0.04 },
  };
  const countryEng: Record<string, number> = { CN: 0.8, IN: 0.88, BR: 0.92, AE: 0.95 };

  for (let d = 0; d < D; d++) {
    const di = days[d];
    for (let s = 0; s < nSites; s++) {
      const site = SITES[s];
      const lang = site.language;
      const tNorm = Math.min(1, d / (D - 1));
      const shareOf = (ch: ChannelId) => {
        const c = CHANNELS.find((x) => x.id === ch)!;
        const curve = ch === 'ai_referral' ? Math.pow(tNorm, 1.7) : tNorm;
        return c.shareStart + (c.shareEnd - c.shareStart) * curve;
      };
      const expectedOrganic = gscClicksExpected[d * nSites + s] * GSC_TO_GA4_SESSIONS;
      // non-search channels follow the (stronger) web weekday pattern rather than the search one
      const webVsSearch = seasonal(di, lang) / seasonal(di, lang, true);
      const baseTotal = (expectedOrganic / shareOf('organic_search')) * webVsSearch;
      // newsletter: first Tuesday of the month and the following day
      const firstTue = di.wd === 1 && di.dom <= 7;
      const dayAfter = di.wd === 2 && di.dom <= 8 && di.dom >= 2;
      const emailFactor = firstTue ? 3.6 : dayAfter ? 1.9 : 0.55;
      const resultsSpike = di.iso === '2026-02-26' || di.iso === '2025-02-27' ? 1.6 : 1;
      const channelSessions: Record<ChannelId, number> = {
        organic_search: sround(gscClicksActual[d * nSites + s] * GSC_TO_GA4_SESSIONS * noise(0.03, S_GA4, s, d, 1), S_GA4, s, d, 2),
        direct: sround(baseTotal * shareOf('direct') * resultsSpike * noise(0.07, S_GA4, s, d, 3), S_GA4, s, d, 4),
        referral: sround(baseTotal * shareOf('referral') * resultsSpike * noise(0.09, S_GA4, s, d, 5), S_GA4, s, d, 6),
        organic_social: Math.min(socialLinks[d * nSites + s], sround(socialLinks[d * nSites + s] * SOCIAL_LINK_TO_SESSION, S_GA4, s, d, 7)),
        email: sround(baseTotal * shareOf('email') * emailFactor * noise(0.1, S_GA4, s, d, 8), S_GA4, s, d, 9),
        ai_referral: sround(baseTotal * shareOf('ai_referral') * noise(0.12, S_GA4, s, d, 10), S_GA4, s, d, 11),
        paid: paidBySite[(d * nSites + s) * 6],
      };

      const siteTot = new Float64Array(GA4_MEASURES.length);
      const deviceTot = new Float64Array(3 * 2); // sessions, engaged per device
      const countryTot = new Float64Array(COUNTRIES.length * 2); // sessions, engaged per country
      const trueEvents = new Float64Array(NE);
      const chTotals = new Map<ChannelId, Float64Array>();

      CHANNELS.forEach((ch, ci) => {
        const S = channelSessions[ch.id];
        const chTot = new Float64Array(GA4_MEASURES.length);
        chTotals.set(ch.id, chTot);
        if (S <= 0) return;
        const w = new Float64Array(COUNTRIES.length * 3);
        const devShare = [ch.desktop, ch.mobile, Math.max(0.01, 1 - ch.desktop - ch.mobile)];
        COUNTRIES.forEach((c, k) => {
          const cs = ch.id === 'paid' ? paidCountry[site.id][c.id] ?? 0 : c.share[site.id];
          for (let dv = 0; dv < 3; dv++) w[k * 3 + dv] = cs * devShare[dv] * noise(0.08, S_GA4, s, d, ci * 1000 + k * 3 + dv);
        });
        const cells = allocate(S, w);
        // paid: event totals come from ads (GA4-side); allocate across cells by session weight
        const paidAlloc: Int32Array[] = [];
        if (ch.id === 'paid') {
          const pb = (d * nSites + s) * 6;
          const engW = new Float64Array(cells.length);
          for (let k = 0; k < cells.length; k++) engW[k] = cells[k] * devEng[k % 3];
          paidAlloc.push(allocate(paidBySite[pb + 1], engW)); // engaged
          const convW = new Float64Array(cells.length);
          for (let k = 0; k < cells.length; k++) convW[k] = cells[k] * devConv[k % 3];
          paidAlloc.push(allocate(paidBySite[pb + 2], convW), allocate(paidBySite[pb + 3], convW), allocate(paidBySite[pb + 4], convW));
        }
        for (let k = 0; k < cells.length; k++) {
          const sessions = cells[k];
          if (sessions <= 0) continue;
          const c = Math.floor(k / 3);
          const dv = k % 3;
          const cc = COUNTRIES[c];
          const r = (salt: number) => S_GA4 * 31 + salt;
          const users = Math.max(1, Math.min(sessions, sround(sessions * 0.82 * noise(0.03, r(1), s, d, ci, k), r(2), s, d, ci, k)));
          const newUsers = Math.min(users, sround(users * ch.newUserShare * noise(0.05, r(3), s, d, ci, k), r(4), s, d, ci, k));
          let engaged: number;
          if (ch.id === 'paid') engaged = Math.min(sessions, paidAlloc[0][k]);
          else {
            const rate = Math.min(0.95, Math.max(0.05, ch.engaged * devEng[dv] * (countryEng[cc.id] ?? 1) * noise(0.05, r(5), s, d, ci, k)));
            engaged = Math.min(sessions, sround(sessions * rate, r(6), s, d, ci, k));
          }
          const views = Math.max(sessions, sround(sessions * ch.viewsPerSession * noise(0.06, r(7), s, d, ci, k), r(8), s, d, ci, k));
          const engTime = sround(sessions * ch.engSecPerSession * devTime[dv] * noise(0.08, r(9), s, d, ci, k), r(10), s, d, ci, k);
          const ev = new Float64Array(NE);
          EVENTS.forEach((e, ei) => {
            if (ch.id === 'paid') {
              if (e.id === 'contact_form_submit') ev[ei] = paidAlloc[1][k];
              else if (e.id === 'generate_lead') ev[ei] = paidAlloc[2][k];
              else if (e.id === 'brochure_download') ev[ei] = paidAlloc[3][k];
              else ev[ei] = 0;
              trueEvents[ei] += ev[ei] / GA4_TRACKING_RATE;
              ev[ei] = Math.min(ev[ei], engaged);
              return;
            }
            let chF = ch.intent;
            if (e.id === 'career_apply_click') chF *= ch.id === 'organic_social' ? 2.6 : ch.id === 'ai_referral' ? 0.5 : 1;
            if (e.id === 'newsletter_signup') chF *= ch.id === 'email' ? 0.3 : 1;
            const exp = sessions * e.rate * chF * devConv[dv];
            trueEvents[ei] += exp / GA4_TRACKING_RATE;
            let track = 1;
            if (e.id === GA4_TRACKING_GAP.event && site.id === GA4_TRACKING_GAP.site && d >= gapFrom && d <= gapTo) track = 0.04;
            ev[ei] = Math.min(engaged, sround(exp * track * noise(0.25, r(20 + ei), s, d, ci, k), r(40 + ei), s, d, ci, k));
          });
          const row = [sessions, users, newUsers, engaged, views, engTime, ...ev];
          ga4.push(d, [s, c, ci, dv], row);
          for (let m = 0; m < row.length; m++) {
            siteTot[m] += row[m];
            chTot[m] += row[m];
          }
          deviceTot[dv * 2] += sessions;
          deviceTot[dv * 2 + 1] += engaged;
          countryTot[c * 2] += sessions;
          countryTot[c * 2 + 1] += engaged;
        }
      });

      // acquisition detail: allocate channel totals over source/medium × campaign combos
      const acqIdx = GA4_ACQ_MEASURES.map((m) => GA4_MEASURES.indexOf(m as (typeof GA4_MEASURES)[number]));
      CHANNELS.forEach((ch, ci) => {
        const tot = chTotals.get(ch.id)!;
        if (tot[0] <= 0) return;
        const combos: Array<{ sm: number; cmp: number; w: number }> = [];
        SOURCE_MEDIUMS.forEach((sm, smi) => {
          if (sm.channel !== ch.id) return;
          const base = sm.share * noise(0.06, S_GA4, s, d, 500 + smi);
          if (ch.id === 'organic_social') {
            const cb = (d * nSites + s) * CODES.campaign.length;
            const total = socialLinks[d * nSites + s] || 1;
            CODES.campaign.forEach((_, cmi) => {
              if (cmi === 1) return;
              const share = cmi === 0 ? Math.max(0, total - sumRange(socialLinksCampaign, cb + 2, cb + CODES.campaign.length)) / total : socialLinksCampaign[cb + cmi] / total;
              if (share > 0) combos.push({ sm: smi, cmp: cmi, w: base * share });
            });
          } else if (ch.id === 'email') {
            combos.push({ sm: smi, cmp: sm.id.startsWith('newsletter') ? 1 : 0, w: base });
          } else if (ch.id === 'paid') {
            AD_CAMPAIGNS.forEach((ac, aci) => {
              const v = paidByCampaign[(d * nSites + s) * AD_CAMPAIGNS.length + aci];
              if (v > 0) combos.push({ sm: smi, cmp: CODE_INDEX.campaign.get(ac.utmCampaign)!, w: v });
            });
          } else combos.push({ sm: smi, cmp: 0, w: base });
        });
        if (!combos.length) return;
        const sessAlloc = allocate(tot[0], combos.map((c) => c.w));
        const allocs = acqIdx.map((mi, j) => (j === 0 ? sessAlloc : allocate(tot[mi], Array.from(sessAlloc))));
        combos.forEach((c, k) => {
          if (sessAlloc[k] <= 0) return;
          ga4acq.push(
            d,
            [s, ci, c.sm, c.cmp],
            allocs.map((a) => a[k]),
          );
        });
      });

      // landing pages
      const sp = pagesBySite[s];
      const pw = sp.map((p, k) => {
        let f = p.w * Math.pow(1 + p.trend, di.t) * noise(0.1, S_PAGE, s, d, k);
        if (campaignActive(p.campaign, di.iso)) f *= 1.8;
        if (p.path.includes('annual-results') || p.path.includes('resultats-annuels')) f *= di.iso === '2026-02-26' ? 9 : di.iso < '2026-02-26' ? 0.05 : 1;
        if (p.published > di.iso) f = 0;
        return f;
      });
      const pSess = allocate(siteTot[0], pw);
      const pEng = allocate(
        siteTot[3],
        sp.map((p, k) => pSess[k] * Math.min(1.35, p.eng)),
      );
      // cap engaged at sessions, moving any excess to pages with headroom
      let excess = 0;
      for (let k = 0; k < sp.length; k++) {
        if (pEng[k] > pSess[k]) {
          excess += pEng[k] - pSess[k];
          pEng[k] = pSess[k];
        }
      }
      for (let k = 0; excess > 0 && k < sp.length; k++) {
        const room = pSess[k] - pEng[k];
        const mv = Math.min(room, excess);
        pEng[k] += mv;
        excess -= mv;
      }
      const pViews = allocate(siteTot[4], sp.map((p, k) => pSess[k] * (p.type === 'article' || p.type === 'resource' ? 1.4 : 1)));
      const pTime = allocate(siteTot[5], sp.map((p, k) => pSess[k] * p.eng));
      const pEv = EVENTS.map((e, ei) =>
        allocate(
          siteTot[6 + ei],
          sp.map((p, k) => pSess[k] * p.conv * eventAffinity(p.type, e.id)),
        ),
      );
      sp.forEach((p, k) => {
        if (pSess[k] <= 0 && pViews[k] <= 0) return;
        ga4page.push(d, [s, CODE_INDEX.page.get(p.id)!], [pSess[k], pEng[k], pViews[k], pTime[k], ...pEv.map((a) => a[k])]);
      });

      // browsers per device
      for (let dv = 0; dv < 3; dv++) {
        const key = DEVICES[dv].id;
        const bw = BROWSERS.map((b, bi) => b[key] * noise(0.05, S_GA4, s, d, 900 + dv * 10 + bi));
        const bs = allocate(deviceTot[dv * 2], bw);
        const be = allocate(deviceTot[dv * 2 + 1], Array.from(bs));
        BROWSERS.forEach((_, bi) => {
          if (bs[bi] > 0) ga4browser.push(d, [s, dv, bi], [bs[bi], Math.min(bs[bi], be[bi])]);
        });
      }

      // visitor language: country traffic split by each country's browser-language mix
      const lw = new Float64Array(CODES.lang.length);
      const lwe = new Float64Array(CODES.lang.length);
      COUNTRIES.forEach((cc, ci) => {
        for (const [lg, sh] of cc.languages) {
          const li = CODE_INDEX.lang.get(lg);
          if (li === undefined) continue;
          lw[li] += countryTot[ci * 2] * sh;
          lwe[li] += countryTot[ci * 2 + 1] * sh;
        }
      });
      const ls = allocate(siteTot[0], lw);
      const le = allocate(siteTot[3], lwe);
      CODES.lang.forEach((_, li) => {
        if (ls[li] > 0) ga4lang.push(d, [s, li], [ls[li], Math.min(ls[li], le[li])]);
      });

      // Drupal webform submissions (server-side truth)
      DRUPAL_FORMS.forEach((f, fi) => {
        const ei = EVENTS.findIndex((e) => e.id === f.event);
        const sub = sround(trueEvents[ei] * noise(0.04, S_DRU, s, d, fi), S_DRU, s, d, fi + 10);
        drupal.push(d, [s, fi], [sub]);
      });
    }
  }
  ga4.finalize(D);
  ga4acq.finalize(D);
  ga4page.finalize(D);
  ga4browser.finalize(D);
  ga4lang.finalize(D);
  drupal.finalize(D);

  /* ===== 5. GEO measurements ===== */
  const geo: DemoGeoMeasurement[] = [];
  const geoStart = dayOf('2026-04-20');
  GEO_PROMPTS.forEach((p, pi) => {
    GEO_PROVIDERS.forEach((prov, vi) => {
      if (prov.method === 'manual_observation' && p.priority !== 'high') return;
      for (let d = geoStart + (pi % 7); d < D; d += prov.cadence) {
        const di = days[d];
        const tYears = (d - geoStart) / 365.25;
        const providerOffset = prov.id === 'perplexity_api' ? 0.06 : prov.id === 'google_aio_manual' ? -0.05 : 0;
        const pm = Math.min(0.97, Math.max(0.01, p.mention + p.trend * tYears + providerOffset + gauss(S_GEO, pi, vi, d, 1) * 0.04));
        const pc = Math.min(0.95, Math.max(0.0, p.cite + p.trend * tYears * 0.8 + providerOffset * 0.6));
        const failed = u01(S_GEO, pi, vi, d, 2) < 0.025;
        const mentioned = !failed && u01(S_GEO, pi, vi, d, 3) < pm;
        const cited = !failed && u01(S_GEO, pi, vi, d, 4) < (mentioned ? pc / Math.max(pm, 0.05) : 0.03);
        const citedUrls: string[] = [];
        const citedDomains: string[] = [];
        if (cited) {
          const pages = p.expectedPages.length ? p.expectedPages : [p.lang === 'fr' ? '/fr' : '/en'];
          const pg = pages[Math.floor(u01(S_GEO, pi, vi, d, 5) * pages.length)];
          citedUrls.push(`https://www.veolia.com${pg}`);
          citedDomains.push('veolia.com');
        }
        const competitors: string[] = [];
        COMPETITORS.forEach((c, ci) => {
          const st = c.strength[p.topic] ?? 0.08;
          if (!failed && u01(S_GEO, pi, vi, d, 10 + ci) < st) {
            competitors.push(c.id);
            if (u01(S_GEO, pi, vi, d, 20 + ci) < 0.55) {
              citedUrls.push(`https://www.${c.domain}/`);
              citedDomains.push(c.domain);
            }
          }
        });
        const nNeutral = failed ? 0 : 1 + Math.floor(u01(S_GEO, pi, vi, d, 30) * 3);
        for (let k = 0; k < nNeutral; k++) {
          const dom = NEUTRAL_CITATION_DOMAINS[Math.floor(u01(S_GEO, pi, vi, d, 31 + k) * NEUTRAL_CITATION_DOMAINS.length)];
          if (!citedDomains.includes(dom)) {
            citedDomains.push(dom);
            citedUrls.push(`https://${dom}/`);
          }
        }
        const status: DemoGeoMeasurement['status'] = failed ? 'failed' : u01(S_GEO, pi, vi, d, 40) < 0.03 ? 'partial' : 'completed';
        geo.push({
          id: `geo-${p.id}-${prov.id}-${di.iso}`,
          day: d,
          date: di.iso,
          provider: prov.id,
          prompt: p.id,
          promptVersion: p.id === 'p02' && di.iso >= '2026-07-01' ? 2 : 1,
          status,
          mentioned,
          cited,
          mentionRank: mentioned ? 1 + Math.floor(u01(S_GEO, pi, vi, d, 41) * (competitors.length + 1)) : null,
          citedUrls,
          citedDomains,
          competitors,
          confidence: prov.method === 'manual_observation' ? 'medium' : status === 'partial' ? 'low' : 'high',
        });
      }
    });
  });

  return {
    start: DEMO_START,
    end: DEMO_END,
    days: D,
    ga4,
    ga4acq,
    ga4page,
    ga4browser,
    ga4lang,
    gscSite,
    gscQuery,
    gscPage,
    social,
    ads,
    drupal,
    posts,
    geo,
    audience,
    generatedMs: Date.now() - t0,
  };
}

function sumRange(arr: Float64Array, from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += arr[i];
  return s;
}

function eventAffinity(type: string, event: string): number {
  switch (event) {
    case 'contact_form_submit':
      return type === 'conversion' ? 6 : type === 'solution' || type === 'municipal' ? 1.4 : 0.4;
    case 'generate_lead':
      return type === 'solution' || type === 'industry' || type === 'municipal' ? 2.2 : type === 'conversion' ? 2 : 0.2;
    case 'newsletter_signup':
      return type === 'article' || type === 'home' ? 2.2 : 0.6;
    case 'brochure_download':
      return type === 'resource' ? 5 : type === 'solution' ? 1.6 : 0.3;
    case 'career_apply_click':
      return type === 'careers' ? 14 : 0.05;
    case 'file_download':
      return type === 'press' || type === 'resource' || type === 'corporate' ? 3 : 0.5;
    default:
      return 1;
  }
}

let cached: DemoData | null = null;

/** Lazily generated singleton (≈1 s on first use). */
export function demoData(): DemoData {
  if (!cached) cached = generateDemoData();
  return cached;
}

export { addDays };
