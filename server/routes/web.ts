/** Website analytics module: landing pages and measurement quality. KPIs and breakdowns use /api/analytics/query. */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { addDays } from '@shared/calendar';
import { DRUPAL_FORMS, EVENTS } from '@shared/catalog';
import { analyticsQuerySchema, type MetricResult } from '@shared/filters';
import { requirePermission } from '../auth/middleware';
import { currentUser, type HonoEnv } from '../context';
import { contentItems } from '../db/schema';
import { runQuery } from '../analytics/engine';
import { periodParams } from './util';

export function webRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('analytics.view'));

  r.get('/pages', async (c) => {
    const app = c.get('app');
    const ctx = await app.analytics.engineContext(currentUser(c));
    const asOf = ctx.dataset.asOf;
    const p = periodParams(c, { from: addDays(asOf, -29), to: asOf });
    const base = { from: p.range.from, to: p.range.to, compare: p.compare, filters: p.filters, groupBy: 'page' as const };
    const ga = runQuery(ctx, analyticsQuerySchema.parse({ ...base, metrics: ['sessions', 'engaged_sessions', 'engagement_rate', 'views', 'avg_engagement_time', 'key_events', 'conversions'] })).results;
    const gsc = runQuery(ctx, analyticsQuerySchema.parse({ ...base, metrics: ['organic_clicks', 'organic_impressions', 'avg_position'] })).results;
    const items = await app.db.select().from(contentItems).where(eq(contentItems.kind, 'web_page'));
    const meta = new Map(items.map((i) => [i.sourceKey, i]));
    const keys = new Set<string>();
    for (const res of [...ga, ...gsc]) for (const row of res.rows ?? []) keys.add(row.key);
    const val = (res: MetricResult, key: string) => res.rows?.find((x) => x.key === key) ?? null;
    const rows = [...keys].map((key) => {
      const m = meta.get(key);
      const metrics: Record<string, { value: number | null; compare: number | null }> = {};
      for (const res of [...ga, ...gsc]) {
        const v = val(res, key);
        metrics[res.metric] = { value: v?.value ?? (res.meta.mode === 'unavailable' ? null : 0), compare: v?.compare ?? null };
      }
      return {
        key,
        site: key.split(':')[0],
        path: key.split(':').slice(1).join(':'),
        title: m?.title ?? key,
        type: m?.format ?? null,
        topic: m?.topic ?? null,
        businessUnit: m?.businessUnit ?? null,
        owner: m?.owner ?? null,
        published: m?.publishedAt ?? null,
        updated: m?.updatedAt ?? null,
        campaign: m?.campaign ?? null,
        metrics,
      };
    });
    return c.json({
      range: p.range,
      compareRange: p.compareRange,
      rows,
      meta: Object.fromEntries([...ga, ...gsc].map((x) => [x.metric, x.meta])),
    });
  });

  /** Measurement quality: GA4 vs Drupal form coverage, untagged traffic, event configuration, gaps. */
  r.get('/quality', async (c) => {
    const app = c.get('app');
    const ctx = await app.analytics.engineContext(currentUser(c));
    const asOf = ctx.dataset.asOf;
    const p = periodParams(c, { from: addDays(asOf, -59), to: asOf });
    const Q = (x: Record<string, unknown>) => runQuery(ctx, analyticsQuerySchema.parse({ from: p.range.from, to: p.range.to, compare: 'none', filters: p.filters, ...x })).results;
    const sites = ctx.dataset.tables.forms?.dicts.site ?? [];
    const coverageBySite = sites.map((site) => {
      const [cov, sub, ga] = Q({ metrics: ['form_tracking_coverage', 'form_submissions', 'ga4_form_events'], granularity: 'day', filters: { ...p.filters, site: [site] } });
      return { site, coverage: cov.value, submissions: sub.value, ga4Events: ga.value, series: cov.series?.map((s) => ({ date: s.from, value: s.value })) ?? [], meta: cov.meta };
    });
    const forms = DRUPAL_FORMS.map((f) => {
      const ev = EVENTS.find((e) => e.id === f.event)!;
      const [sub] = Q({ metrics: ['form_submissions'], groupBy: 'form' });
      const [gaEv] = Q({ metrics: [`ev_${ev.id}`] });
      const drupal = sub.rows?.find((x) => x.key === f.id)?.value ?? 0;
      return { form: f.id, name: f.name, event: ev.id, drupalSubmissions: drupal, ga4Events: gaEv.value, coverage: drupal > 0 && gaEv.value !== null ? gaEv.value / drupal : null };
    });
    const [acq] = Q({ metrics: ['sessions'], groupBy: 'channel' });
    const untagged = await Promise.all(
      (['email', 'organic_social'] as const).map(async (ch) => {
        const [byCampaign] = Q({ metrics: ['sessions'], groupBy: 'campaign', filters: { ...p.filters, channel: [ch] } });
        const total = byCampaign.value ?? 0;
        const notSet = byCampaign.rows?.find((x) => x.key === '(not set)')?.value ?? 0;
        return { channel: ch, sessions: total, untaggedSessions: notSet, untaggedShare: total > 0 ? notSet / total : null };
      }),
    );
    const [evTotals] = [Q({ metrics: EVENTS.map((e) => `ev_${e.id}`) })];
    // a single filtered website shows its own conversion events when an administrator set them
    const oneSite = p.filters.site?.length === 1 ? p.filters.site[0] : null;
    const conversionEvents = (oneSite && ctx.siteConversionEvents?.[oneSite]) || ctx.conversionEvents;
    const events = EVENTS.map((e, i) => ({ id: e.id, name: e.name, keyEvent: e.keyEvent, conversion: conversionEvents.includes(e.id), drupalForm: e.drupalForm ?? null, count: evTotals[i].value, observed: (evTotals[i].value ?? 0) > 0 }));
    const [sessions] = Q({ metrics: ['sessions'] });
    const notes = [...new Map([...coverageBySite.flatMap((x) => x.meta.notes), ...sessions.meta.notes].map((n) => [JSON.stringify(n), n])).values()];
    return c.json({ range: p.range, coverageBySite, forms, untagged, events, channelSessions: acq.rows ?? [], notes, mode: sessions.meta.mode });
  });

  return r;
}
