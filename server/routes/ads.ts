/** ChatGPT Ads (read-only): structure with metrics, pacing, landing pages, conversions side by side. */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { addDays } from '@shared/calendar';
import { CAMPAIGNS, DEMO_AD_ATTRIBUTION_WINDOW } from '@shared/catalog';
import { analyticsQuerySchema, type MetricResult } from '@shared/filters';
import { requirePermission } from '../auth/middleware';
import { currentUser, type HonoEnv } from '../context';
import { adAccounts, adCampaigns, adGroups, ads, dataConnections } from '../db/schema';
import { runQuery } from '../analytics/engine';
import { campaignPacing } from '../insights/ads';
import { periodParams } from './util';

const AD_METRICS = ['ads_spend', 'ads_impressions', 'ads_clicks', 'ads_ctr', 'ads_cpc', 'ads_cpm', 'ads_conversions', 'ads_cpa', 'ads_cvr'];

export function adsRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('analytics.view'));

  r.get('/structure', async (c) => {
    const app = c.get('app');
    const ctx = await app.analytics.engineContext(currentUser(c));
    const p = periodParams(c, { from: addDays(ctx.dataset.asOf, -29), to: ctx.dataset.asOf });
    const Q = (groupBy: 'adCampaign' | 'adGroup' | 'ad') => runQuery(ctx, analyticsQuerySchema.parse({ metrics: AD_METRICS, from: p.range.from, to: p.range.to, compare: p.compare, groupBy, filters: p.filters })).results;
    const byCampaign = Q('adCampaign');
    const byGroup = Q('adGroup');
    const byAd = Q('ad');
    const ga = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['ads_ga_sessions', 'ads_ga_key_events'], from: p.range.from, to: p.range.to, compare: p.compare, groupBy: 'campaign', filters: p.filters })).results;
    const pick = (res: MetricResult[], key: string) => Object.fromEntries(res.map((m) => [m.metric, { value: m.rows?.find((x) => x.key === key)?.value ?? (m.meta.mode === 'unavailable' ? null : 0), compare: m.rows?.find((x) => x.key === key)?.compare ?? null }]));
    const [account] = await app.db.select().from(adAccounts);
    const campaigns = await app.db.select().from(adCampaigns);
    const groups = await app.db.select().from(adGroups);
    const adRows = await app.db.select().from(ads);
    const utmToCampaign = new Map(CAMPAIGNS.map((x) => [x.utm, x.id]));
    const totals = runQuery(ctx, analyticsQuerySchema.parse({ metrics: [...AD_METRICS, 'ads_ga_sessions', 'ads_ga_key_events'], from: p.range.from, to: p.range.to, compare: p.compare, filters: p.filters })).results;
    return c.json({
      range: p.range,
      compareRange: totals[0].meta.compareRange,
      mode: totals[0].meta.mode,
      notes: totals[0].meta.notes,
      account: account ? { name: account.name, currency: account.currency, timezone: account.timezone, status: account.status } : null,
      attributionWindow: totals[0].meta.mode === 'demo' ? DEMO_AD_ATTRIBUTION_WINDOW : { en: 'As configured in the ChatGPT Ads account', fr: 'Selon la configuration du compte ChatGPT Ads' },
      totals: Object.fromEntries(totals.map((m) => [m.metric, { value: m.value, compare: m.compare, deltaPct: m.deltaPct, delta: m.delta }])),
      campaigns: campaigns.map((cg) => ({
        key: cg.key,
        name: cg.name,
        category: cg.category,
        objective: cg.objective,
        status: cg.status,
        monthlyBudget: cg.monthlyBudget,
        startDate: cg.startDate,
        utmCampaign: cg.utmCampaign,
        metrics: pick(byCampaign, cg.key),
        ga4: pick(ga, utmToCampaign.get(cg.utmCampaign ?? '') ?? ''),
        groups: groups
          .filter((g) => g.campaignId === cg.id)
          .map((g) => ({
            key: g.key,
            name: g.name,
            status: g.status,
            statusSince: g.statusSince,
            metrics: pick(byGroup, g.key),
            ads: adRows.filter((a) => a.adGroupId === g.id).map((a) => ({ key: a.key, name: a.name, headline: a.headline, landingUrl: a.landingUrl, status: a.status, reviewStatus: a.reviewStatus, metrics: pick(byAd, a.key) })),
          })),
      })),
    });
  });

  r.get('/pacing', async (c) => {
    const app = c.get('app');
    const ctx = await app.analytics.engineContext(currentUser(c));
    const asOf = c.req.query('asOf') && /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('asOf')!) ? c.req.query('asOf')! : ctx.dataset.asOf;
    const campaigns = await app.db.select().from(adCampaigns);
    const pacing = campaignPacing(ctx, asOf, campaigns.map((x) => ({ key: x.key, name: x.name, category: x.category, monthlyBudget: x.monthlyBudget })));
    // cumulative spend per campaign per day, against the straight-line budget
    const [y, m] = asOf.split('-').map(Number);
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cum = new Map(campaigns.map((cg) => [cg.key, 0]));
    const series = campaigns.map((cg) => ({ campaign: cg.key, points: [] as Array<{ date: string; cumulative: number; budgetLine: number }> }));
    for (let d = 1; d <= Number(asOf.slice(8, 10)); d++) {
      const date = `${asOf.slice(0, 7)}-${String(d).padStart(2, '0')}`;
      const day = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['ads_spend'], from: date, to: date, compare: 'none', groupBy: 'adCampaign' })).results[0];
      campaigns.forEach((cg, i) => {
        cum.set(cg.key, cum.get(cg.key)! + (day.rows?.find((x) => x.key === cg.key)?.value ?? 0));
        series[i].points.push({ date, cumulative: cum.get(cg.key)!, budgetLine: ((cg.monthlyBudget ?? 0) * d) / dim });
      });
    }
    return c.json({ asOf, pacing, series, note: 'Budgets are the monthly budgets recorded in this platform (Administration → Advertising). Spend is platform-reported and can be revised for several hours.' });
  });

  r.get('/landing-pages', async (c) => {
    const app = c.get('app');
    const ctx = await app.analytics.engineContext(currentUser(c));
    const p = periodParams(c, { from: addDays(ctx.dataset.asOf, -29), to: ctx.dataset.asOf });
    const adRows = await app.db.select().from(ads);
    const byAd = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['ads_clicks', 'ads_conversions', 'ads_spend'], from: p.range.from, to: p.range.to, compare: 'none', groupBy: 'ad' })).results;
    const pages = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['sessions', 'engagement_rate', 'key_events'], from: p.range.from, to: p.range.to, compare: 'none', groupBy: 'page' })).results;
    const byLanding = new Map<string, typeof adRows>();
    for (const a of adRows) if (a.landingUrl) byLanding.set(a.landingUrl, [...(byLanding.get(a.landingUrl) ?? []), a]);
    const items = [...byLanding.entries()].map(([url, list]) => {
      const path = new URL(url).pathname;
      const site = list[0].siteKey ?? '';
      const pageKey = `${site}:${path}`;
      const sum = (i: number) => list.reduce((s, a) => s + (byAd[i].rows?.find((x) => x.key === a.key)?.value ?? 0), 0);
      const pv = (i: number) => pages[i].rows?.find((x) => x.key === pageKey)?.value ?? null;
      return { url, site, ads: list.map((a) => ({ key: a.key, name: a.name, status: a.status })), adClicks: sum(0), platformConversions: sum(1), spend: sum(2), pageSessionsAllChannels: pv(0), pageEngagementRateAllChannels: pv(1), pageKeyEventsAllChannels: pv(2) };
    });
    return c.json({ range: p.range, items, mode: byAd[0].meta.mode, note: 'Page metrics cover all traffic to the page (GA4), not only ad visitors. Ad metrics are platform-reported.' });
  });

  /** Conversions from three systems, shown side by side and never summed. */
  r.get('/conversions', async (c) => {
    const app = c.get('app');
    const ctx = await app.analytics.engineContext(currentUser(c));
    const p = periodParams(c, { from: addDays(ctx.dataset.asOf, -29), to: ctx.dataset.asOf });
    const res = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['ads_conversions', 'ads_ga_key_events', 'ads_ga_sessions', 'ads_clicks'], from: p.range.from, to: p.range.to, compare: p.compare, granularity: 'week', filters: p.filters })).results;
    return c.json({
      range: p.range,
      mode: res[0].meta.mode,
      platform: { metric: 'ads_conversions', value: res[0].value, compare: res[0].compare, series: res[0].series, attribution: res[0].meta.mode === 'demo' ? DEMO_AD_ATTRIBUTION_WINDOW : { en: 'ChatGPT Ads attribution settings', fr: 'Paramètres d’attribution ChatGPT Ads' } },
      ga4: { metric: 'ads_ga_key_events', value: res[1].value, compare: res[1].compare, series: res[1].series, sessions: res[2].value, attribution: { en: 'GA4 session attribution (utm_source=chatgpt, utm_medium=cpc)', fr: 'Attribution de session GA4 (utm_source=chatgpt, utm_medium=cpc)' } },
      clicks: res[3].value,
      clickToSessionRate: res[3].value ? (res[2].value ?? 0) / res[3].value : null,
      explanation: {
        en: 'The ad platform counts conversions it can attribute to an ad click or view within its window (24–48 h reporting delay). GA4 counts key events in sessions it attributes to ChatGPT Ads. They overlap and use different rules, so they are never added together.',
        fr: 'La plateforme publicitaire compte les conversions qu’elle attribue à un clic ou une vue dans sa fenêtre (délai 24–48 h). GA4 compte les événements clés des sessions qu’il attribue à ChatGPT Ads. Ces chiffres se recoupent et suivent des règles différentes : ils ne sont jamais additionnés.',
      },
    });
  });

  r.get('/integration', async (c) => {
    const [conn] = await c.get('app').db.select().from(dataConnections).where(eq(dataConnections.provider, 'chatgpt_ads'));
    return c.json({
      status: conn?.status ?? 'not_configured',
      mode: conn?.mode ?? 'demo',
      lastSuccessAt: conn?.lastSuccessAt ?? null,
      readOnly: true,
      writeCapabilities: 'none — creating ads, changing budgets, publishing or editing campaigns is not implemented and would require separate authorisation',
      documentation: ['https://developers.openai.com/ads', 'https://developers.openai.com/ads/reporting', 'https://help.openai.com/en/articles/20001214-measure-results'],
    });
  });

  return r;
}
