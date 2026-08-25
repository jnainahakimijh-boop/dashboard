import { dataset } from '@/data';
import { CAMPAIGN_DEFS } from '@/data/campaigns';
import type { ChannelId, ContentItem, DeviceId, Filters, FormatId, MarketId, PlatformId, ThemeId } from '@/types';

/** ------------------------------------------------------------------
 *  Aggregation selectors. Every figure on every page flows through
 *  these functions, so filtering genuinely recalculates the data.
 *
 *  Filter applicability by fact table (shown in the UI where relevant):
 *  - web:       date, market, channel, device
 *  - social:    date, market, platform
 *  - campaigns: date, campaign, theme; market = campaign runs in a
 *               selected market (delivery is not segmented by market)
 *  - pages:     date, market (no channel/device segmentation collected)
 *  - content:   publish date, market, platform, theme, format
 *  ------------------------------------------------------------------ */

export interface FilterQ {
  from: number;
  to: number;
  markets: MarketId[];
  channels: ChannelId[];
  platforms: PlatformId[];
  devices: DeviceId[];
  campaigns: string[];
  themes: ThemeId[];
  formats: FormatId[];
}

export function toQ(f: Filters): FilterQ {
  return {
    from: f.from,
    to: f.to,
    markets: f.markets,
    channels: f.channels,
    platforms: f.platforms,
    devices: f.devices,
    campaigns: f.campaigns,
    themes: f.themes,
    formats: f.formats,
  };
}

/** Previous period of identical length, immediately before the range. */
export function prevQ(q: FilterQ): FilterQ {
  const len = q.to - q.from + 1;
  return { ...q, from: q.from - len, to: q.from - 1 };
}

export interface WebTotals {
  sessions: number;
  users: number;
  newUsers: number;
  engaged: number;
  conversions: number;
  engTime: number;
}

export interface SocialTotals {
  impressions: number;
  reach: number;
  reactions: number;
  comments: number;
  shares: number;
  engagements: number;
  clicks: number;
  videoViews: number;
  followerNet: number;
}

export interface CampaignTotals {
  impressions: number;
  clicks: number;
  sessions: number;
  conversions: number;
  spend: number;
}

const ZERO_WEB: WebTotals = { sessions: 0, users: 0, newUsers: 0, engaged: 0, conversions: 0, engTime: 0 };
const ZERO_SOCIAL: SocialTotals = { impressions: 0, reach: 0, reactions: 0, comments: 0, shares: 0, engagements: 0, clicks: 0, videoViews: 0, followerNet: 0 };
const ZERO_CAMPAIGN: CampaignTotals = { impressions: 0, clicks: 0, sessions: 0, conversions: 0, spend: 0 };

/* small memo cache — selectors are pure over the static dataset */
const cache = new Map<string, unknown>();
function memo<T>(key: string, compute: () => T): T {
  if (cache.has(key)) return cache.get(key) as T;
  if (cache.size > 400) cache.clear();
  const v = compute();
  cache.set(key, v);
  return v;
}

const inSet = <T>(arr: T[], v: T) => arr.length === 0 || arr.includes(v);

function qKey(q: FilterQ): string {
  return [q.from, q.to, q.markets.join(','), q.channels.join(','), q.platforms.join(','), q.devices.join(','), q.campaigns.join(','), q.themes.join(','), q.formats.join(',')].join('|');
}

/* ---------------- web ---------------- */

function webMatch(q: FilterQ) {
  return (f: { d: number; market: MarketId; channel: ChannelId; device: DeviceId }) =>
    f.d >= q.from && f.d <= q.to && inSet(q.markets, f.market) && inSet(q.channels, f.channel) && inSet(q.devices, f.device);
}

function addWeb(t: WebTotals, f: WebTotals): void {
  t.sessions += f.sessions;
  t.users += f.users;
  t.newUsers += f.newUsers;
  t.engaged += f.engaged;
  t.conversions += f.conversions;
  t.engTime += f.engTime;
}

export function webTotals(q: FilterQ): WebTotals {
  return memo(`wt:${qKey(q)}`, () => {
    const t = { ...ZERO_WEB };
    const match = webMatch(q);
    for (const f of dataset.web) if (match(f)) addWeb(t, f);
    return t;
  });
}

export type WebGroupKey = 'day' | 'channel' | 'market' | 'device';

export function webBy(q: FilterQ, key: WebGroupKey): Map<string | number, WebTotals> {
  return memo(`wb:${key}:${qKey(q)}`, () => {
    const out = new Map<string | number, WebTotals>();
    const match = webMatch(q);
    for (const f of dataset.web) {
      if (!match(f)) continue;
      const k = key === 'day' ? f.d : f[key === 'channel' ? 'channel' : key === 'market' ? 'market' : 'device'];
      let t = out.get(k);
      if (!t) out.set(k, (t = { ...ZERO_WEB }));
      addWeb(t, f);
    }
    return out;
  });
}

/* ---------------- social ---------------- */

function socialMatch(q: FilterQ) {
  return (f: { d: number; market: MarketId; platform: PlatformId }) =>
    f.d >= q.from && f.d <= q.to && inSet(q.markets, f.market) && inSet(q.platforms, f.platform);
}

function addSocial(t: SocialTotals, f: (typeof dataset.social)[number]): void {
  t.impressions += f.impressions;
  t.reach += f.reach;
  t.reactions += f.reactions;
  t.comments += f.comments;
  t.shares += f.shares;
  t.engagements += f.reactions + f.comments + f.shares;
  t.clicks += f.clicks;
  t.videoViews += f.videoViews;
  t.followerNet += f.followerNet;
}

export function socialTotals(q: FilterQ): SocialTotals {
  return memo(`st:${qKey(q)}`, () => {
    const t = { ...ZERO_SOCIAL };
    const match = socialMatch(q);
    for (const f of dataset.social) if (match(f)) addSocial(t, f);
    return t;
  });
}

export type SocialGroupKey = 'day' | 'platform' | 'market';

export function socialBy(q: FilterQ, key: SocialGroupKey): Map<string | number, SocialTotals> {
  return memo(`sb:${key}:${qKey(q)}`, () => {
    const out = new Map<string | number, SocialTotals>();
    const match = socialMatch(q);
    for (const f of dataset.social) {
      if (!match(f)) continue;
      const k = key === 'day' ? f.d : key === 'platform' ? f.platform : f.market;
      let t = out.get(k);
      if (!t) out.set(k, (t = { ...ZERO_SOCIAL }));
      addSocial(t, f);
    }
    return out;
  });
}

/** Days in range where a platform has no rows at all (collection gaps).
 *  Missing days must stay missing — they are never rendered as zero. */
export function socialMissingDays(q: FilterQ, platform: PlatformId): number[] {
  return memo(`smd:${platform}:${q.from}:${q.to}`, () => {
    const present = new Set<number>();
    for (const f of dataset.social) if (f.platform === platform && f.d >= q.from && f.d <= q.to) present.add(f.d);
    const missing: number[] = [];
    for (let d = Math.max(0, q.from); d <= q.to; d++) if (!present.has(d)) missing.push(d);
    return missing;
  });
}

/* ---------------- campaigns ---------------- */

function campaignAllowed(q: FilterQ): Set<string> {
  const allowed = new Set<string>();
  for (const c of CAMPAIGN_DEFS) {
    if (!inSet(q.campaigns, c.id)) continue;
    if (!inSet(q.themes, c.theme)) continue;
    if (q.markets.length > 0 && !c.markets.some((m) => q.markets.includes(m))) continue;
    allowed.add(c.id);
  }
  return allowed;
}

function addCampaign(t: CampaignTotals, f: (typeof dataset.campaignFacts)[number]): void {
  t.impressions += f.impressions;
  t.clicks += f.clicks;
  t.sessions += f.sessions;
  t.conversions += f.conversions;
  t.spend += f.spend;
}

export function campaignTotals(q: FilterQ): CampaignTotals {
  return memo(`ct:${qKey(q)}`, () => {
    const t = { ...ZERO_CAMPAIGN };
    const allowed = campaignAllowed(q);
    for (const f of dataset.campaignFacts) {
      if (f.d < q.from || f.d > q.to || !allowed.has(f.campaign)) continue;
      addCampaign(t, f);
    }
    return t;
  });
}

export type CampaignGroupKey = 'campaign' | 'day';

export function campaignBy(q: FilterQ, key: CampaignGroupKey): Map<string | number, CampaignTotals> {
  return memo(`cb:${key}:${qKey(q)}`, () => {
    const out = new Map<string | number, CampaignTotals>();
    const allowed = campaignAllowed(q);
    for (const f of dataset.campaignFacts) {
      if (f.d < q.from || f.d > q.to || !allowed.has(f.campaign)) continue;
      const k = key === 'day' ? f.d : f.campaign;
      let t = out.get(k);
      if (!t) out.set(k, (t = { ...ZERO_CAMPAIGN }));
      addCampaign(t, f);
    }
    return out;
  });
}

/* ---------------- landing pages ---------------- */

export interface PageTotals {
  sessions: number;
  users: number;
  engaged: number;
  conversions: number;
}

export function pagesBy(q: FilterQ, key: 'page' | 'day'): Map<string | number, PageTotals> {
  return memo(`pb:${key}:${qKey(q)}`, () => {
    const out = new Map<string | number, PageTotals>();
    for (const f of dataset.pages) {
      if (f.d < q.from || f.d > q.to || !inSet(q.markets, f.market)) continue;
      const k = key === 'day' ? f.d : f.page;
      let t = out.get(k);
      if (!t) out.set(k, (t = { sessions: 0, users: 0, engaged: 0, conversions: 0 }));
      t.sessions += f.sessions;
      t.users += f.users;
      t.engaged += f.engaged;
      t.conversions += f.conversions;
    }
    return out;
  });
}

/** Per-page daily sessions series (for table trend sparklines). */
export function pageDaySeries(q: FilterQ, page: string): number[] {
  return memo(`pds:${page}:${q.from}:${q.to}:${q.markets.join(',')}`, () => {
    const len = q.to - q.from + 1;
    const series = new Array(len).fill(0);
    for (const f of dataset.pages) {
      if (f.page !== page || f.d < q.from || f.d > q.to || !inSet(q.markets, f.market)) continue;
      series[f.d - q.from] += f.sessions;
    }
    return series;
  });
}

/* ---------------- content ---------------- */

export function contentItems(q: FilterQ): ContentItem[] {
  return memo(`ci:${qKey(q)}`, () =>
    dataset.content.filter(
      (c) =>
        c.publishD >= q.from &&
        c.publishD <= q.to &&
        inSet(q.markets, c.market) &&
        inSet(q.platforms, c.platform) &&
        inSet(q.themes, c.theme) &&
        inSet(q.formats, c.format),
    ),
  );
}

/* ---------------- funnel ---------------- */

export interface FunnelStage {
  id: string;
  value: number;
}

/** Paid & social acquisition funnel. Scope: social platforms + paid
 *  campaigns → web sessions on the Social/Paid channels. Monotonicity
 *  (stage n+1 <= stage n) holds by construction and is covered by tests. */
export function acquisitionFunnel(q: FilterQ): FunnelStage[] {
  return memo(`fn:${qKey(q)}`, () => {
    const soc = socialTotals(q);
    const cmp = campaignTotals(q);
    const webQ: FilterQ = { ...q, channels: (['social', 'paid'] as ChannelId[]).filter((c) => inSet(q.channels, c)) };
    const noWeb = webQ.channels.length === 0;
    const w = noWeb ? { ...ZERO_WEB } : webTotals({ ...webQ, channels: webQ.channels });
    return [
      { id: 'impressions', value: soc.impressions + cmp.impressions },
      { id: 'clicks', value: soc.clicks + cmp.clicks },
      { id: 'sessions', value: w.sessions },
      { id: 'engaged', value: w.engaged },
      { id: 'conversions', value: w.conversions },
    ];
  });
}

/* ---------------- daily series helper ---------------- */

export interface DayPoint {
  d: number;
  value: number | null;
}

/** Build an aligned daily series from a grouped-by-day map; missing days are null. */
export function daySeries(map: Map<string | number, { [k: string]: number }>, q: FilterQ, field: string, treatMissingAsZero = true): DayPoint[] {
  const out: DayPoint[] = [];
  for (let d = q.from; d <= q.to; d++) {
    const t = map.get(d) as Record<string, number> | undefined;
    out.push({ d, value: t ? t[field] : treatMissingAsZero ? 0 : null });
  }
  return out;
}
