/** ------------------------------------------------------------------
 *  Dataset abstraction consumed by the query engine.
 *
 *  Every physical table is a columnar FactTable plus dictionaries that
 *  map dimension codes to keys. Demo data and warehouse data (imported
 *  files or connector syncs) use the same shape, so one engine computes
 *  every number. A table is served from exactly one origin — demo and
 *  real rows are never mixed inside a figure.
 *  ------------------------------------------------------------------ */
import { epochDay, fromEpochDay, type IsoDate } from '@shared/calendar';
import { ADS, AD_CAMPAIGNS, AD_GROUPS, CAMPAIGNS, COUNTRIES, PAGES, QUERIES, SITES, SOCIAL_ACCOUNTS, TOPICS } from '@shared/catalog';
import { CODES, DEMO_START, demoData, type DemoGeoMeasurement, type DemoPost } from '@shared/demo/generate';
import type { FactTable } from '@shared/demo/table';
import type { DimensionId } from '@shared/filters';
import type { TableId } from '@shared/metrics';

export type Origin = 'demo' | 'warehouse';

export interface TableData {
  id: TableId;
  table: FactTable;
  /** calendar date of day index 0 */
  base: IsoDate;
  /** code → key per physical dimension */
  dicts: Record<string, readonly string[]>;
  origin: Origin;
  /** first / last day that has at least one row */
  coverage: { from: IsoDate; to: IsoDate } | null;
  /** ISO timestamp of the last successful refresh */
  freshness: string | null;
  /** physical dimension used to detect missing days (e.g. account, site) */
  gapDim?: string;
  /** per gap-dimension code: first day index with data and a presence bitmap */
  presence?: Map<number, { first: number; last: number; days: Uint8Array }>;
  /** entities expected by configuration but absent from this table (→ PARTIAL) */
  missingEntities?: string[];
  /** lazily built caches of mapped keys per (virtual dimension) */
  vcache?: Map<string, string[]>;
}

export interface PostRecord extends DemoPost {
  tags?: string[];
}

export interface Dataset {
  tables: Partial<Record<TableId, TableData>>;
  posts: { origin: Origin; rows: PostRecord[]; freshness: string | null } | null;
  geo: { origin: Origin; rows: DemoGeoMeasurement[]; freshness: string | null } | null;
  /** last complete day for preset resolution */
  asOf: IsoDate;
  demoEnabled: boolean;
}

/* ---------------- virtual dimensions ---------------- */

// Lookups for derived dimensions. They start from the catalogue and are refreshed from the
// administrators' registry (websites, social accounts, campaigns, ads) at each dataset build.
const SITE = new Map<string, { language: string }>(SITES.map((s) => [s.id, s]));
const COUNTRY = new Map(COUNTRIES.map((c) => [c.id, c]));
const PAGE = new Map(PAGES.map((p) => [p.id, p]));
const QUERY = new Map(QUERIES.map((q) => [q.id, q]));
/** Branded search queries: the brand name, including common misspellings. */
const BRAND_QUERY = /v[eé]olia|veolya|veollia/i;
const ACCOUNT = new Map<string, { platform: string; language: string }>(SOCIAL_ACCOUNTS.map((a) => [a.id, a]));
const AD = new Map<string, { group: string; site: string | null }>(ADS.map((a) => [a.id, a]));
const AD_GROUP = new Map<string, { campaign: string }>(AD_GROUPS.map((g) => [g.id, g]));
const AD_CAMPAIGN = new Map<string, { id: string; category: string; utmCampaign: string | null; businessUnit: string | null }>(AD_CAMPAIGNS.map((c) => [c.id, c]));
const TOPIC_BU = new Map(TOPICS.map((t) => [t.id, t.bu]));
const CAMPAIGN_BY_UTM = new Map(CAMPAIGNS.map((c) => [c.utm, c.id]));
const CAMPAIGN_BY_AD_CAMPAIGN = new Map(AD_CAMPAIGNS.map((c) => [c.id, CAMPAIGN_BY_UTM.get(c.utmCampaign) ?? c.id]));

/** Registry rows maintained in Administration. */
export interface Registry {
  sites: Array<{ key: string; language: string }>;
  accounts: Array<{ key: string; platform: string; language: string }>;
  campaigns: Array<{ key: string; utm: string }>;
  adCampaigns: Array<{ key: string; category: string; utmCampaign: string | null; businessUnit: string | null }>;
  adGroups: Array<{ key: string; campaign: string }>;
  ads: Array<{ key: string; group: string; site: string | null }>;
}

/** Applies the registry on top of the catalogue, so websites, accounts and ads added or edited by
 *  administrators get their language, platform, campaign and category in every breakdown. */
export function applyRegistry(r: Registry, tables: Array<TableData | undefined>): void {
  for (const x of r.sites) SITE.set(x.key, { language: x.language });
  for (const x of r.accounts) ACCOUNT.set(x.key, { platform: x.platform, language: x.language });
  for (const x of r.campaigns) CAMPAIGN_BY_UTM.set(x.utm, x.key);
  for (const x of r.adCampaigns) {
    AD_CAMPAIGN.set(x.key, { id: x.key, category: x.category, utmCampaign: x.utmCampaign, businessUnit: x.businessUnit });
    CAMPAIGN_BY_AD_CAMPAIGN.set(x.key, (x.utmCampaign && CAMPAIGN_BY_UTM.get(x.utmCampaign)) || x.key);
  }
  for (const x of r.adGroups) AD_GROUP.set(x.key, { campaign: x.campaign });
  for (const x of r.ads) AD.set(x.key, { group: x.group, site: x.site });
  // mapped keys are cached per table; drop them so the new attributes apply
  for (const t of tables) if (t) t.vcache = undefined;
}

export interface VirtualDim {
  phys: string;
  map: (key: string) => string | null | undefined;
}

const id = (phys: string): VirtualDim => ({ phys, map: (k) => k });
const siteLang: VirtualDim = { phys: 'site', map: (k) => SITE.get(k)?.language };
const pageAttr = (f: (p: (typeof PAGES)[number]) => string): VirtualDim => ({ phys: 'page', map: (k) => (PAGE.has(k) ? f(PAGE.get(k)!) : '(unassigned)') });
const adCampaignOf = (adKey: string) => {
  const ad = AD.get(adKey);
  const g = ad ? AD_GROUP.get(ad.group) : undefined;
  return g ? AD_CAMPAIGN.get(g.campaign) : undefined;
};

export const VDIMS: Record<TableId, Partial<Record<DimensionId, VirtualDim>>> = {
  web: {
    site: id('site'),
    language: siteLang,
    country: id('country'),
    region: { phys: 'country', map: (k) => COUNTRY.get(k)?.region ?? 'other' },
    channel: id('channel'),
    device: id('device'),
  },
  webacq: {
    site: id('site'),
    language: siteLang,
    channel: id('channel'),
    srcmed: id('srcmed'),
    campaign: { phys: 'campaign', map: (k) => CAMPAIGN_BY_UTM.get(k) ?? k },
  },
  webpage: {
    site: id('site'),
    language: siteLang,
    page: id('page'),
    pageType: pageAttr((p) => p.type),
    topic: pageAttr((p) => p.topic),
    bu: pageAttr((p) => p.bu),
  },
  webbrowser: { site: id('site'), language: siteLang, device: id('device'), browser: id('browser') },
  weblang: { site: id('site'), language: siteLang, userLanguage: id('lang') },
  search: {
    site: id('site'),
    language: siteLang,
    country: id('country'),
    region: { phys: 'country', map: (k) => COUNTRY.get(k)?.region ?? 'other' },
    device: id('device'),
  },
  searchquery: {
    site: id('site'),
    language: siteLang,
    query: id('query'),
    topic: { phys: 'query', map: (k) => QUERY.get(k)?.topic ?? '(unassigned)' },
    bu: { phys: 'query', map: (k) => TOPIC_BU.get(QUERY.get(k)?.topic ?? '') ?? '(unassigned)' },
    // catalogue flag when the query is known, otherwise the brand term in the query text (keys are `site:query`)
    brand: { phys: 'query', map: (k) => ((QUERY.get(k)?.brand ?? BRAND_QUERY.test(k.slice(k.indexOf(':') + 1))) ? 'brand' : 'non_brand') },
  },
  searchpage: {
    site: id('site'),
    language: siteLang,
    page: id('page'),
    pageType: pageAttr((p) => p.type),
    topic: pageAttr((p) => p.topic),
    bu: pageAttr((p) => p.bu),
  },
  social: {
    account: id('account'),
    platform: { phys: 'account', map: (k) => ACCOUNT.get(k)?.platform },
    language: { phys: 'account', map: (k) => ACCOUNT.get(k)?.language },
  },
  ads: {
    ad: id('ad'),
    adGroup: { phys: 'ad', map: (k) => AD.get(k)?.group },
    adCampaign: { phys: 'ad', map: (k) => adCampaignOf(k)?.id },
    adCategory: { phys: 'ad', map: (k) => adCampaignOf(k)?.category },
    campaign: { phys: 'ad', map: (k) => CAMPAIGN_BY_AD_CAMPAIGN.get(adCampaignOf(k)?.id ?? '') },
    site: { phys: 'ad', map: (k) => AD.get(k)?.site ?? undefined },
    language: { phys: 'ad', map: (k) => SITE.get(AD.get(k)?.site ?? '')?.language },
    bu: { phys: 'ad', map: (k) => adCampaignOf(k)?.businessUnit },
  },
  forms: { site: id('site'), language: siteLang, form: id('form') },
};

/** Keys (one per code) of a virtual dimension on a table, cached. */
export function mappedKeys(td: TableData, dim: DimensionId): string[] | null {
  const vd = VDIMS[td.id][dim];
  if (!vd) return null;
  const dict = td.dicts[vd.phys];
  if (!dict) return null;
  td.vcache ??= new Map();
  const ck = dim;
  let keys = td.vcache.get(ck);
  if (!keys) {
    keys = dict.map((k) => vd.map(k) ?? '(not set)');
    td.vcache.set(ck, keys);
  }
  return keys;
}

/* ---------------- helpers ---------------- */

export function dayIndex(td: TableData, iso: IsoDate): number {
  return epochDay(iso) - epochDay(td.base);
}

export function isoAt(td: TableData, day: number): IsoDate {
  return fromEpochDay(epochDay(td.base) + day);
}

/** Coverage and presence bitmaps computed from the rows themselves. */
export function indexTable(td: TableData): TableData {
  const t = td.table;
  if (t.n === 0) {
    td.coverage = null;
    return td;
  }
  td.coverage = { from: isoAt(td, t.day[0]), to: isoAt(td, t.day[t.n - 1]) };
  if (td.gapDim) {
    const col = t.dims[td.gapDim];
    const pres = new Map<number, { first: number; last: number; days: Uint8Array }>();
    for (let i = 0; i < t.n; i++) {
      const c = col[i];
      let p = pres.get(c);
      if (!p) {
        p = { first: t.day[i], last: t.day[i], days: new Uint8Array(t.days) };
        pres.set(c, p);
      }
      p.days[t.day[i]] = 1;
      if (t.day[i] > p.last) p.last = t.day[i];
    }
    td.presence = pres;
  }
  return td;
}

/* ---------------- demo dataset ---------------- */

let demoDataset: Dataset | null = null;

const DEMO_DICTS: Record<string, readonly string[]> = {
  site: CODES.site,
  country: CODES.country,
  channel: CODES.channel,
  device: CODES.device,
  srcmed: CODES.srcmed,
  campaign: CODES.campaign,
  page: CODES.page,
  query: CODES.query,
  account: CODES.account,
  ad: CODES.ad,
  form: CODES.form,
  browser: CODES.browser,
  lang: CODES.lang,
};

export function buildDemoDataset(): Dataset {
  if (demoDataset) return demoDataset;
  const d = demoData();
  const freshness = new Date().toISOString();
  const mk = (id: TableId, table: FactTable, gapDim?: string): TableData => {
    const dicts: Record<string, readonly string[]> = {};
    for (const dim of table.dimNames) dicts[dim] = DEMO_DICTS[dim];
    const td = indexTable({ id, table, base: DEMO_START, dicts, origin: 'demo', coverage: null, freshness, gapDim });
    // the synthetic estate starts on DEMO_START for every source (e.g. no ads before launch is real zero, not missing data)
    if (td.coverage) td.coverage.from = DEMO_START;
    return td;
  };
  demoDataset = {
    tables: {
      web: mk('web', d.ga4, 'site'),
      webacq: mk('webacq', d.ga4acq, 'site'),
      webpage: mk('webpage', d.ga4page, 'site'),
      webbrowser: mk('webbrowser', d.ga4browser, 'site'),
      weblang: mk('weblang', d.ga4lang, 'site'),
      search: mk('search', d.gscSite, 'site'),
      searchquery: mk('searchquery', d.gscQuery),
      searchpage: mk('searchpage', d.gscPage, 'site'),
      social: mk('social', d.social, 'account'),
      ads: mk('ads', d.ads),
      forms: mk('forms', d.drupal, 'site'),
    },
    posts: { origin: 'demo', rows: d.posts, freshness },
    geo: { origin: 'demo', rows: d.geo, freshness },
    asOf: d.end,
    demoEnabled: true,
  };
  return demoDataset;
}
