/** Content intelligence: one catalogue of web pages, social posts and videos with cross-channel metrics (no opaque score). */
import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { addDays } from '@shared/calendar';
import { SOCIAL_ACCOUNTS } from '@shared/catalog';
import { analyticsQuerySchema } from '@shared/filters';
import { requirePermission } from '../auth/middleware';
import { audit } from '../audit';
import { HttpError, currentUser, type HonoEnv } from '../context';
import { ads, contentItems, contentTags, taxonomyTerms } from '../db/schema';
import { runQuery } from '../analytics/engine';
import { body, parseList, periodParams } from './util';
import { postRate } from './social';

export function contentRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('analytics.view'));

  r.get('/catalog', async (c) => {
    const app = c.get('app');
    const user = currentUser(c);
    const ctx = await app.analytics.engineContext(user);
    const ds = ctx.dataset;
    const p = periodParams(c, { from: addDays(ds.asOf, -89), to: ds.asOf });
    const qp = c.req.query();
    const kinds = parseList(qp.kind) ?? ['web_page', 'social_post', 'video'];
    const topics = parseList(qp.topic);
    const tagsF = parseList(qp.tag);
    const text = (qp.q ?? '').toLowerCase().slice(0, 100);
    const items = await app.db.select().from(contentItems);
    const tags = await app.db.select().from(contentTags);
    const tagsById = new Map<string, string[]>();
    for (const t of tags) tagsById.set(t.contentId, [...(tagsById.get(t.contentId) ?? []), t.tag]);
    const itemByKey = new Map(items.map((i) => [i.sourceKey, i]));
    const scope = user.scopes?.websites;

    const posts = (ds.posts?.rows ?? []).filter((x) => x.date >= p.range.from && x.date <= p.range.to);
    const linkClicksByUrl = new Map<string, number>();
    const postsByUrl = new Map<string, number>();
    for (const x of posts) if (x.url) {
      linkClicksByUrl.set(x.url, (linkClicksByUrl.get(x.url) ?? 0) + x.linkClicks);
      postsByUrl.set(x.url, (postsByUrl.get(x.url) ?? 0) + 1);
    }
    const geoRows = (ds.geo?.rows ?? []).filter((x) => x.date >= p.range.from && x.date <= p.range.to && x.status !== 'failed');
    const citationsByUrl = new Map<string, number>();
    for (const g of geoRows) for (const u of g.citedUrls) citationsByUrl.set(u, (citationsByUrl.get(u) ?? 0) + 1);
    const adRows = await app.db.select().from(ads);
    const adsByUrl = new Map<string, number>();
    for (const a of adRows) if (a.landingUrl) adsByUrl.set(a.landingUrl, (adsByUrl.get(a.landingUrl) ?? 0) + 1);

    const out: Array<Record<string, unknown>> = [];
    if (kinds.includes('web_page')) {
      const res = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['sessions', 'engagement_rate', 'key_events', 'organic_clicks'], from: p.range.from, to: p.range.to, compare: p.compare, groupBy: 'page', filters: { site: p.filters.site, language: p.filters.language } })).results;
      for (const it of items.filter((i) => i.kind === 'web_page')) {
        if (scope?.length && !scope.includes(it.channel)) continue;
        if (p.filters.site && !p.filters.site.includes(it.channel)) continue;
        const g = (i: number) => res[i].rows?.find((x) => x.key === it.sourceKey) ?? null;
        out.push({
          key: it.sourceKey,
          id: it.id,
          kind: 'web_page',
          channel: it.channel,
          title: it.title,
          url: it.url,
          language: it.language,
          published: it.publishedAt,
          updated: it.updatedAt,
          topic: it.topic,
          businessUnit: it.businessUnit,
          pillar: it.pillar,
          objective: it.objective,
          audience: it.audience,
          campaign: it.campaign,
          format: it.format,
          owner: it.owner,
          tags: tagsById.get(it.id) ?? [],
          metrics: {
            sessions: g(0)?.value ?? 0,
            sessionsCompare: g(0)?.compare ?? null,
            engagementRate: g(1)?.value ?? null,
            keyEvents: g(2)?.value ?? 0,
            organicClicks: g(3)?.value ?? 0,
            socialPosts: postsByUrl.get(it.url ?? '') ?? 0,
            socialLinkClicks: linkClicksByUrl.get(it.url ?? '') ?? 0,
            aiCitations: citationsByUrl.get(it.url ?? '') ?? 0,
            ads: adsByUrl.get(it.url ?? '') ?? 0,
          },
          modes: { web: res[0].meta.mode, search: res[3].meta.mode },
        });
      }
    }
    for (const x of posts) {
      const kind = x.platform === 'youtube' ? 'video' : 'social_post';
      if (!kinds.includes(kind)) continue;
      if (p.filters.platform && !p.filters.platform.includes(x.platform)) continue;
      if (p.filters.language && !p.filters.language.includes(x.language)) continue;
      const o = itemByKey.get(x.id);
      out.push({
        key: x.id,
        id: o?.id ?? null,
        kind,
        channel: x.platform,
        account: SOCIAL_ACCOUNTS.find((a) => a.id === x.account)?.name ?? x.account,
        title: x.text,
        url: x.url,
        language: x.language,
        published: x.date,
        topic: o?.topic ?? x.topic,
        businessUnit: o?.businessUnit ?? x.bu,
        pillar: o?.pillar ?? x.pillar,
        objective: o?.objective ?? x.objective,
        audience: o?.audience ?? x.audience,
        campaign: o?.campaign ?? x.campaign,
        format: x.format,
        tags: o ? tagsById.get(o.id) ?? [] : [],
        metrics: { impressions: x.impressions, engagements: x.engagements, rate: postRate(x), rateBasis: x.platform === 'youtube' ? 'views' : 'impressions', linkClicks: x.linkClicks, videoViews: x.videoViews, watchMinutes: x.watchMinutes },
        modes: { social: ds.posts?.origin === 'demo' ? 'demo' : 'connected' },
      });
    }
    const filtered = out.filter(
      (x) =>
        (!topics || topics.includes(String(x.topic))) &&
        (!p.filters.bu || p.filters.bu.includes(String(x.businessUnit))) &&
        (!p.filters.campaign || p.filters.campaign.includes(String(x.campaign))) &&
        (!tagsF || (x.tags as string[]).some((t) => tagsF.includes(t))) &&
        (!text || String(x.title).toLowerCase().includes(text) || String(x.url ?? '').toLowerCase().includes(text)),
    );
    const byTopic = new Map<string, { items: number; sessions: number; impressions: number; engagements: number; videoViews: number }>();
    for (const x of filtered) {
      const k = String(x.topic ?? '(untagged)');
      const e = byTopic.get(k) ?? { items: 0, sessions: 0, impressions: 0, engagements: 0, videoViews: 0 };
      const m = x.metrics as Record<string, number>;
      e.items++;
      e.sessions += m.sessions ?? 0;
      if (x.kind === 'social_post') {
        e.impressions += m.impressions ?? 0;
        e.engagements += m.engagements ?? 0;
      }
      e.videoViews += m.videoViews ?? 0;
      byTopic.set(k, e);
    }
    return c.json({
      range: p.range,
      total: filtered.length,
      items: filtered.slice(0, Math.min(2000, Number(qp.limit) || 1000)),
      byTopic: [...byTopic.entries()].map(([topic, v]) => ({ topic, ...v, socialRate: v.impressions ? v.engagements / v.impressions : null })),
      note: 'Each channel keeps its own metrics. No combined content score is computed because the measures are not comparable.',
    });
  });

  r.put('/items/:key/classification', requirePermission('content.tag'), async (c) => {
    const app = c.get('app');
    const key = decodeURIComponent(c.req.param('key'));
    if (!key || key.length > 300) throw new HttpError(400, 'Invalid content key');
    const terms = await app.db.select().from(taxonomyTerms);
    const valid = (kind: string, v: string | null | undefined) => v === undefined || v === null || terms.some((t) => t.kind === kind && t.key === v);
    const d = await body(
      c,
      z.object({
        tags: z.array(z.string().max(60)).max(20).optional(),
        topic: z.string().max(60).nullable().optional(),
        pillar: z.string().max(60).nullable().optional(),
        objective: z.string().max(60).nullable().optional(),
        audience: z.string().max(60).nullable().optional(),
        campaign: z.string().max(60).nullable().optional(),
      }),
    );
    if (!valid('topic', d.topic) || !valid('pillar', d.pillar) || !valid('objective', d.objective) || !valid('audience', d.audience)) throw new HttpError(422, 'Unknown taxonomy value', 'validation');
    if (d.tags && d.tags.some((t) => !terms.some((x) => x.kind === 'tag' && x.key === t))) throw new HttpError(422, 'Unknown tag — add it in Administration → KPI registry & taxonomy first', 'validation');
    let [item] = await app.db.select().from(contentItems).where(eq(contentItems.sourceKey, key));
    if (!item) {
      const ds = await app.analytics.dataset();
      const post = ds.posts?.rows.find((x) => x.id === key);
      if (!post) throw new HttpError(404, 'Content not found', 'not_found');
      [item] = await app.db
        .insert(contentItems)
        .values({ orgId: app.orgId, kind: post.platform === 'youtube' ? 'video' : 'social_post', sourceKey: key, channel: post.platform, title: post.text.slice(0, 300), url: post.url, language: post.language, publishedAt: post.date, topic: post.topic, businessUnit: post.bu, pillar: post.pillar, objective: post.objective, audience: post.audience, campaign: post.campaign, format: post.format })
        .returning();
    }
    const set: Partial<typeof contentItems.$inferInsert> = {};
    for (const k of ['topic', 'pillar', 'objective', 'audience', 'campaign'] as const) if (d[k] !== undefined) set[k] = d[k];
    if (Object.keys(set).length) await app.db.update(contentItems).set(set).where(eq(contentItems.id, item.id));
    if (d.tags) {
      await app.db.delete(contentTags).where(eq(contentTags.contentId, item.id));
      if (d.tags.length) await app.db.insert(contentTags).values(d.tags.map((t) => ({ contentId: item.id, tag: t, createdBy: currentUser(c).id })));
    }
    await audit(c, { action: 'content.classify', entityType: 'content', entityId: key, details: { ...set, tags: d.tags } });
    return c.json({ ok: true });
  });

  r.get('/items/:key/tags', async (c) => {
    const key = decodeURIComponent(c.req.param('key'));
    const db = c.get('app').db;
    const [item] = await db.select().from(contentItems).where(eq(contentItems.sourceKey, key));
    if (!item) return c.json([]);
    return c.json((await db.select().from(contentTags).where(inArray(contentTags.contentId, [item.id]))).map((t) => t.tag));
  });

  return r;
}
