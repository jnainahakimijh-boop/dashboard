/** Composes the dataset (warehouse first, demo fallback) and runs analytics queries with the caller's scope. */
import { and, eq, sql } from 'drizzle-orm';
import { addDays, fromEpochDay, epochDay } from '@shared/calendar';
import type { AnalyticsResponse, ParsedAnalyticsQuery } from '@shared/filters';
import { DEFAULT_CONVERSION_EVENTS, type TableId } from '@shared/metrics';
import type { DB } from '../db/client';
import { adCampaigns, adGroups, ads, campaigns, geoPrompts, keywords, organizations, socialAccounts, websites } from '../db/schema';
import type { SessionUser } from '../context';
import { applyRegistry, buildDemoDataset, type Dataset, type Registry, type TableData } from './dataset';
import { runQuery, type EngineContext, type GeoPromptAttrs, type TrackedKeyword } from './engine';
import { TABLE_IDS } from './tables';
import { loadWarehouseGeo, loadWarehousePosts, loadWarehouseTables } from './warehouse';
import { setReportingCurrency } from '../insights/format';

export interface AnalyticsServiceDeps {
  db: DB;
  orgId: string;
  envDemoMode: boolean;
  /** how often to check the shared data version (default 10 s) */
  versionCheckMs?: number;
}

interface Cached {
  dataset: Dataset;
  conversionEvents: string[];
  siteConversionEvents: Record<string, string[]>;
  trackedKeywords: TrackedKeyword[];
  geoPrompts: Map<string, GeoPromptAttrs>;
  builtAt: number;
  /** last complete day the dataset was built for */
  day: string;
  /** organisations.data_version read when the build started */
  version: number;
}

/** How often an instance checks the shared data version, to pick up syncs, imports and settings saved by other instances. */
const VERSION_CHECK_MS = 10_000;

/** Last complete calendar day in Europe/Paris. */
export function yesterdayParis(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return fromEpochDay(epochDay(parts) - 1);
}

async function loadRegistry(db: DB): Promise<Registry> {
  const [sites, accounts, cmp, adCmp, groups, adRows] = await Promise.all([
    db.select({ key: websites.key, language: websites.language }).from(websites),
    db.select({ key: socialAccounts.key, platform: socialAccounts.platform, language: socialAccounts.language }).from(socialAccounts),
    db.select({ key: campaigns.key, utm: campaigns.utm }).from(campaigns),
    db.select({ key: adCampaigns.key, category: adCampaigns.category, utmCampaign: adCampaigns.utmCampaign, businessUnit: adCampaigns.businessUnit }).from(adCampaigns),
    db.select({ key: adGroups.key, campaign: adCampaigns.key }).from(adGroups).innerJoin(adCampaigns, eq(adCampaigns.id, adGroups.campaignId)),
    db.select({ key: ads.key, group: adGroups.key, site: ads.siteKey }).from(ads).innerJoin(adGroups, eq(adGroups.id, ads.adGroupId)),
  ]);
  return { sites, accounts, campaigns: cmp.filter((c) => !!c.utm) as Array<{ key: string; utm: string }>, adCampaigns: adCmp, adGroups: groups, ads: adRows };
}

export class AnalyticsService {
  private cached: Cached | null = null;
  private building: Promise<Cached> | null = null;
  /** incremented by invalidate(); a build started before an invalidation is not kept */
  private generation = 0;
  private bump: Promise<unknown> = Promise.resolve();
  private checkedAt = 0;

  constructor(private readonly deps: AnalyticsServiceDeps) {}

  /** Drops this instance's dataset and bumps the shared version so the other instances rebuild too. */
  invalidate(): void {
    this.cached = null;
    this.generation++;
    const { db, orgId } = this.deps;
    // the local cache is already dropped; a failed bump only delays other instances until the next day change
    this.bump = this.bump.then(() => db.update(organizations).set({ dataVersion: sql`${organizations.dataVersion} + 1` }).where(eq(organizations.id, orgId))).catch(() => undefined);
  }

  private async versionChanged(cached: Cached): Promise<boolean> {
    if (Date.now() - this.checkedAt < (this.deps.versionCheckMs ?? VERSION_CHECK_MS)) return false;
    this.checkedAt = Date.now();
    const [row] = await this.deps.db.select({ v: organizations.dataVersion }).from(organizations).where(eq(organizations.id, this.deps.orgId));
    return !!row && row.v !== cached.version;
  }

  private async build(): Promise<Cached> {
    const { db, orgId } = this.deps;
    await this.bump;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    setReportingCurrency(org?.currency);
    const demoEnabled = this.deps.envDemoMode && (org?.demoMode ?? true);
    const demo = demoEnabled ? buildDemoDataset() : null;
    const asOfReal = yesterdayParis();
    const wh = await loadWarehouseTables(db, asOfReal);
    const whPosts = await loadWarehousePosts(db);
    const whGeo = await loadWarehouseGeo(db);

    const siteKeys = (await db.select({ key: websites.key }).from(websites).where(eq(websites.status, 'active'))).map((r) => r.key);
    const accountKeys = (await db.select({ key: socialAccounts.key }).from(socialAccounts).where(eq(socialAccounts.status, 'active'))).map((r) => r.key);

    const tables: Partial<Record<TableId, TableData>> = {};
    applyRegistry(await loadRegistry(db), [...Object.values(wh), ...Object.values(demo?.tables ?? {})]);
    for (const tid of TABLE_IDS) {
      const w = wh[tid];
      if (w && w.table.n > 0) {
        // PARTIAL when configured entities are absent from the real data
        const dim = tid === 'social' ? 'account' : w.dicts.site ? 'site' : null;
        const expected = dim === 'account' ? accountKeys : dim === 'site' ? siteKeys : [];
        if (dim) w.missingEntities = expected.filter((k) => !w.dicts[dim].includes(k));
        tables[tid] = w;
      } else if (demo?.tables[tid]) tables[tid] = demo.tables[tid];
    }
    const realEnds = Object.values(tables)
      .filter((t) => t!.origin === 'warehouse' && t!.coverage)
      .map((t) => t!.coverage!.to);
    const anyDemo = Object.values(tables).some((t) => t!.origin === 'demo');
    const asOf = anyDemo && demo ? demo.asOf : realEnds.length ? realEnds.sort().at(-1)! : asOfReal;

    const dataset: Dataset = {
      tables,
      posts: whPosts ? { origin: 'warehouse', ...whPosts } : demo?.posts ?? null,
      geo: whGeo ? { origin: 'warehouse', ...whGeo } : demo?.geo ?? null,
      asOf,
      demoEnabled,
    };

    const kw = await db.select().from(keywords).where(and(eq(keywords.active, true), eq(keywords.brand, false)));
    const prompts = await db.select().from(geoPrompts);
    const settings = (org?.settings ?? {}) as { conversionEvents?: string[] };
    return {
      dataset,
      conversionEvents: settings.conversionEvents?.length ? settings.conversionEvents : DEFAULT_CONVERSION_EVENTS,
      siteConversionEvents: Object.fromEntries(
        (await db.select({ key: websites.key, settings: websites.settings }).from(websites))
          .map((w) => [w.key, ((w.settings ?? {}) as { conversionEvents?: string[] }).conversionEvents ?? []] as const)
          .filter(([, ev]) => ev.length > 0),
      ),
      trackedKeywords: kw.map((k) => ({ queryKey: `${k.siteKey}:${k.keyword}`, site: k.siteKey })),
      geoPrompts: new Map(prompts.map((p) => [p.key, { lang: p.language, topic: p.topic }])),
      builtAt: Date.now(),
      day: asOfReal,
      version: org?.dataVersion ?? 0,
    };
  }

  async state(): Promise<Cached> {
    const cached = this.cached;
    // a new calendar day or a change saved by another instance makes the dataset stale
    if (cached && (cached.day !== yesterdayParis() || (await this.versionChanged(cached)))) {
      if (this.cached === cached) this.cached = null;
    }
    if (this.cached) return this.cached;
    if (!this.building) {
      const gen = this.generation;
      this.building = this.build().then(
        (c) => {
          if (gen === this.generation) this.cached = c;
          this.building = null;
          return c;
        },
        (e) => {
          this.building = null;
          throw e;
        },
      );
    }
    return this.building;
  }

  async dataset(): Promise<Dataset> {
    return (await this.state()).dataset;
  }

  async engineContext(user: Pick<SessionUser, 'scopes'> | null): Promise<EngineContext> {
    const s = await this.state();
    return {
      dataset: s.dataset,
      conversionEvents: s.conversionEvents,
      siteConversionEvents: s.siteConversionEvents,
      trackedKeywords: s.trackedKeywords,
      geoPrompts: s.geoPrompts,
      scopeSites: user?.scopes?.websites?.length ? user.scopes.websites : null,
    };
  }

  async query(user: Pick<SessionUser, 'scopes'> | null, q: ParsedAnalyticsQuery): Promise<AnalyticsResponse> {
    return runQuery(await this.engineContext(user), q);
  }

  async asOf(): Promise<string> {
    return (await this.dataset()).asOf;
  }
}

export { addDays };
