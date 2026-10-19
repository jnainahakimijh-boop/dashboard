import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import {
  ADS,
  AD_CAMPAIGNS,
  AD_GROUPS,
  AI_REFERRAL_SOURCES,
  BUSINESS_UNITS,
  CHANNELS,
  COUNTRIES,
  DEVICES,
  DRUPAL_FORMS,
  EVENTS,
  FORMATS,
  GEO_PROVIDERS,
  LANGUAGE_NAMES,
  PLATFORMS,
  REGIONS,
} from '@shared/catalog';
import { analyticsQuerySchema } from '@shared/filters';
import { DEFAULT_EXECUTIVE_KPIS, TABLE_SOURCES, type SourceKey, type TableId } from '@shared/metrics';
import { requirePermission } from '../auth/middleware';
import { currentUser, type HonoEnv } from '../context';
import { campaigns, competitors, dashboards, dataConnections, metricDefinitions, organizations, socialAccounts, taxonomyTerms, websites } from '../db/schema';
import { QueryError } from '../analytics/engine';
import { HttpError } from '../context';
import { body } from './util';

export function metaRoutes() {
  const r = new Hono<HonoEnv>();
  // mounted at /api: guard each route explicitly (a '*' middleware would also cover public paths such as /api/ingest)
  r.use('/meta', requirePermission('analytics.view'));
  r.use('/analytics/*', requirePermission('analytics.view'));

  r.get('/meta', async (c) => {
    const app = c.get('app');
    const user = currentUser(c);
    const db = app.db;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, app.orgId));
    const ds = await app.analytics.dataset();
    const sources: Record<string, { mode: string; coverageFrom: string | null; coverageTo: string | null; freshness: string | null; missingEntities: string[] }> = {};
    const firstTable: Partial<Record<SourceKey, TableId>> = { ga4: 'web', gsc: 'search', linkedin: 'social', x: 'social', youtube: 'social', chatgpt_ads: 'ads', drupal: 'forms' };
    for (const [src, tid] of Object.entries(firstTable) as Array<[SourceKey, TableId]>) {
      const td = ds.tables[tid];
      sources[src] = td
        ? { mode: td.origin === 'demo' ? 'demo' : td.missingEntities?.length ? 'partial' : 'connected', coverageFrom: td.coverage?.from ?? null, coverageTo: td.coverage?.to ?? null, freshness: td.freshness, missingEntities: td.missingEntities ?? [] }
        : { mode: 'unavailable', coverageFrom: null, coverageTo: null, freshness: null, missingEntities: [] };
    }
    sources.geo = ds.geo
      ? { mode: ds.geo.origin === 'demo' ? 'demo' : 'connected', coverageFrom: ds.geo.rows[0]?.date ?? null, coverageTo: ds.geo.rows.at(-1)?.date ?? null, freshness: ds.geo.freshness, missingEntities: [] }
      : { mode: 'unavailable', coverageFrom: null, coverageTo: null, freshness: null, missingEntities: [] };

    const [sites, accounts, cmp, terms, comps, defs, dash, conns] = await Promise.all([
      db.select().from(websites).orderBy(asc(websites.key)),
      db.select().from(socialAccounts).orderBy(asc(socialAccounts.key)),
      db.select().from(campaigns).orderBy(asc(campaigns.startDate)),
      db.select().from(taxonomyTerms).where(eq(taxonomyTerms.active, true)),
      db.select({ key: competitors.key, name: competitors.name, domain: competitors.domain, isDemo: competitors.isDemo }).from(competitors),
      db.select().from(metricDefinitions),
      db.select().from(dashboards).where(eq(dashboards.key, 'executive')),
      db.select({ provider: dataConnections.provider, status: dataConnections.status, name: dataConnections.name, mode: dataConnections.mode, lastSuccessAt: dataConnections.lastSuccessAt }).from(dataConnections),
    ]);
    const scope = user.scopes?.websites;
    return c.json({
      org: { name: org.name, timezone: org.timezone, currency: org.currency, defaultLanguage: org.defaultLanguage, logoDataUrl: org.logoDataUrl, demoMode: ds.demoEnabled, settings: { conversionEvents: (org.settings as { conversionEvents?: string[] }).conversionEvents ?? [] } },
      asOf: ds.asOf,
      dataStart: Object.values(ds.tables).reduce<string | null>((m, t) => (t?.coverage && (!m || t.coverage.from < m) ? t.coverage.from : m), null),
      sources,
      tableSources: TABLE_SOURCES,
      connections: conns,
      sites: sites.filter((s) => !scope?.length || scope.includes(s.key)).map((s) => ({ key: s.key, name: s.name, domain: s.domain, basePath: s.basePath, language: s.language, businessUnit: s.businessUnit, status: s.status })),
      accounts: accounts.map((a) => ({ key: a.key, platform: a.platform, name: a.name, handle: a.handle, language: a.language, status: a.status })),
      campaigns: cmp.map((x) => ({ key: x.key, utm: x.utm, name: { en: x.nameEn, fr: x.nameFr }, from: x.startDate, to: x.endDate, topic: x.topic, businessUnit: x.businessUnit, objective: x.objective })),
      taxonomy: terms.map((t) => ({ kind: t.kind, key: t.key, label: { en: t.labelEn, fr: t.labelFr } })),
      competitors: comps,
      metricOverrides: Object.fromEntries(defs.map((d) => [d.metricId, { enabled: d.enabled, label: d.labelEn || d.labelFr ? { en: d.labelEn, fr: d.labelFr } : null, definition: d.definitionEn || d.definitionFr ? { en: d.definitionEn, fr: d.definitionFr } : null, owner: d.owner }])),
      executiveLayout: dash[0]?.layout ?? [{ id: 'kpis', type: 'kpi_grid', visible: true, metrics: DEFAULT_EXECUTIVE_KPIS }],
      catalog: {
        countries: COUNTRIES.map((x) => ({ id: x.id, isoNum: x.isoNum, name: x.name, region: x.region })),
        regions: REGIONS,
        channels: CHANNELS.map((x) => ({ id: x.id, name: x.name })),
        devices: DEVICES,
        events: EVENTS.map((e) => ({ id: e.id, name: e.name, keyEvent: e.keyEvent, conversion: e.conversion, drupalForm: e.drupalForm ?? null })),
        forms: DRUPAL_FORMS,
        platforms: PLATFORMS,
        formats: FORMATS,
        businessUnits: BUSINESS_UNITS,
        languages: LANGUAGE_NAMES,
        geoProviders: GEO_PROVIDERS,
        aiReferralSources: AI_REFERRAL_SOURCES,
        adCampaigns: AD_CAMPAIGNS,
        adGroups: AD_GROUPS,
        ads: ADS,
      },
    });
  });

  r.post('/analytics/query', async (c) => {
    const app = c.get('app');
    const q = await body(c, analyticsQuerySchema);
    try {
      return c.json(await app.analytics.query(currentUser(c), q));
    } catch (e) {
      if (e instanceof QueryError) throw new HttpError(e.status === 500 ? 500 : 400, e.message, 'query');
      throw e;
    }
  });

  return r;
}
