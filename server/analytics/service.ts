/** Composes the dataset (warehouse first, demo fallback) and runs analytics queries with the caller's scope. */
import { and, eq } from 'drizzle-orm';
import { addDays, fromEpochDay, epochDay } from '@shared/calendar';
import type { AnalyticsResponse, ParsedAnalyticsQuery } from '@shared/filters';
import { DEFAULT_CONVERSION_EVENTS, type TableId } from '@shared/metrics';
import type { DB } from '../db/client';
import { geoPrompts, keywords, organizations, socialAccounts, websites } from '../db/schema';
import type { SessionUser } from '../context';
import { buildDemoDataset, type Dataset, type TableData } from './dataset';
import { runQuery, type EngineContext, type GeoPromptAttrs, type TrackedKeyword } from './engine';
import { TABLE_IDS } from './tables';
import { loadWarehouseGeo, loadWarehousePosts, loadWarehouseTables } from './warehouse';

export interface AnalyticsServiceDeps {
  db: DB;
  orgId: string;
  envDemoMode: boolean;
}

interface Cached {
  dataset: Dataset;
  conversionEvents: string[];
  trackedKeywords: TrackedKeyword[];
  geoPrompts: Map<string, GeoPromptAttrs>;
  builtAt: number;
}

/** Last complete calendar day in Europe/Paris. */
export function yesterdayParis(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return fromEpochDay(epochDay(parts) - 1);
}

export class AnalyticsService {
  private cached: Cached | null = null;
  private building: Promise<Cached> | null = null;

  constructor(private readonly deps: AnalyticsServiceDeps) {}

  invalidate(): void {
    this.cached = null;
  }

  private async build(): Promise<Cached> {
    const { db, orgId } = this.deps;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const demoEnabled = this.deps.envDemoMode && (org?.demoMode ?? true);
    const demo = demoEnabled ? buildDemoDataset() : null;
    const asOfReal = yesterdayParis();
    const wh = await loadWarehouseTables(db, asOfReal);
    const whPosts = await loadWarehousePosts(db);
    const whGeo = await loadWarehouseGeo(db);

    const siteKeys = (await db.select({ key: websites.key }).from(websites).where(eq(websites.status, 'active'))).map((r) => r.key);
    const accountKeys = (await db.select({ key: socialAccounts.key }).from(socialAccounts).where(eq(socialAccounts.status, 'active'))).map((r) => r.key);

    const tables: Partial<Record<TableId, TableData>> = {};
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
      trackedKeywords: kw.map((k) => ({ queryKey: `${k.siteKey}:${k.keyword}`, site: k.siteKey })),
      geoPrompts: new Map(prompts.map((p) => [p.key, { lang: p.language, topic: p.topic }])),
      builtAt: Date.now(),
    };
  }

  async state(): Promise<Cached> {
    if (this.cached) return this.cached;
    if (!this.building) {
      this.building = this.build().then(
        (c) => {
          this.cached = c;
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
