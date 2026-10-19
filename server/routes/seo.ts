/** SEO intelligence: keywords (Search Console positions), queries, pages, technical audit, issues, competitors. */
import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { addDays, enumerateBuckets } from '@shared/calendar';
import { analyticsQuerySchema } from '@shared/filters';
import { assertCan, requirePermission } from '../auth/middleware';
import { audit } from '../audit';
import { HttpError, currentUser, type HonoEnv, type Ctx } from '../context';
import { competitorObservations, competitors, keywordGroups, keywords, seoCrawlPages, seoCrawlScopes, seoCrawls, seoIssueHistory, seoIssues, users, websites } from '../db/schema';
import { runQuery } from '../analytics/engine';
import { RULES } from '../seo/rules';
import { body, notFound, parseList, periodParams, uuidParam } from './util';

const keywordSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  siteKey: z.string().min(1).max(60),
  groupId: z.string().uuid().nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  language: z.enum(['en', 'fr']),
  targetUrl: z.string().url().max(500).nullable().optional(),
  brand: z.boolean().default(false),
  active: z.boolean().default(true),
});

export function seoRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('analytics.view'));

  /* ---------- keywords ---------- */
  r.get('/keyword-groups', async (c) => c.json(await c.get('app').db.select().from(keywordGroups).orderBy(asc(keywordGroups.name))));
  r.post('/keyword-groups', requirePermission('seo.keywords.manage'), async (c) => {
    const d = await body(c, z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(500).optional() }));
    const [row] = await c.get('app').db.insert(keywordGroups).values({ orgId: c.get('app').orgId, ...d }).returning();
    await audit(c, { action: 'seo.keyword_group.create', entityType: 'keyword_group', entityId: row.id, details: d });
    return c.json(row, 201);
  });
  r.delete('/keyword-groups/:id', requirePermission('seo.keywords.manage'), async (c) => {
    const id = uuidParam(c);
    const db = c.get('app').db;
    await db.update(keywords).set({ groupId: null }).where(eq(keywords.groupId, id));
    await db.delete(keywordGroups).where(eq(keywordGroups.id, id));
    await audit(c, { action: 'seo.keyword_group.delete', entityType: 'keyword_group', entityId: id });
    return c.json({ ok: true });
  });

  r.get('/keywords', async (c) => {
    const app = c.get('app');
    const user = currentUser(c);
    const ctx = await app.analytics.engineContext(user);
    const asOf = ctx.dataset.asOf;
    const p = periodParams(c, { from: addDays(asOf, -27), to: asOf });
    const groupId = c.req.query('group');
    const all = await app.db.select().from(keywords).orderBy(asc(keywords.keyword));
    const scope = user.scopes?.websites;
    const list = all.filter((k) => (!groupId || k.groupId === groupId) && (!p.filters.site || p.filters.site.includes(k.siteKey)) && (!scope?.length || scope.includes(k.siteKey)));
    const res = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['organic_clicks', 'organic_impressions', 'organic_ctr', 'avg_position'], from: p.range.from, to: p.range.to, compare: p.compare, groupBy: 'query', filters: { site: p.filters.site } })).results;
    // weekly position trend (Search Console average position per week, not a daily rank)
    const trendFrom = addDays(asOf, -7 * 12 + 1);
    const weeks = enumerateBuckets({ from: trendFrom, to: asOf }, 'week');
    const weekly = weeks.map((w) => runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['avg_position'], from: w.from, to: w.to, compare: 'none', groupBy: 'query', filters: { site: p.filters.site } })).results[0]);
    const byKey = (i: number, key: string) => res[i].rows?.find((x) => x.key === key) ?? null;
    const groups = await app.db.select().from(keywordGroups);
    const groupName = new Map(groups.map((g) => [g.id, g.name]));
    return c.json({
      range: p.range,
      compareRange: res[0].meta.compareRange,
      effectiveRange: res[0].meta.range,
      mode: res[0].meta.mode,
      notes: res[0].meta.notes,
      positionSource: 'search_console_average',
      rankTracker: { configured: false, note: 'No dedicated rank-tracking provider is configured. Positions are Search Console impression-weighted averages for the period.' },
      weeks: weeks.map((w) => w.from),
      items: list.map((k) => {
        const key = `${k.siteKey}:${k.keyword}`;
        const [clicks, imp, ctr, pos] = [0, 1, 2, 3].map((i) => byKey(i, key));
        return {
          id: k.id,
          keyword: k.keyword,
          siteKey: k.siteKey,
          language: k.language,
          country: k.country,
          groupId: k.groupId,
          group: k.groupId ? groupName.get(k.groupId) ?? null : null,
          targetUrl: k.targetUrl,
          brand: k.brand,
          active: k.active,
          trackingSource: k.trackingSource,
          clicks: clicks?.value ?? 0,
          clicksCompare: clicks?.compare ?? null,
          impressions: imp?.value ?? 0,
          impressionsCompare: imp?.compare ?? null,
          ctr: ctr?.value ?? null,
          position: pos?.value ?? null,
          positionCompare: pos?.compare ?? null,
          trend: weekly.map((w) => w.rows?.find((x) => x.key === key)?.value ?? null),
          noData: !imp?.value,
        };
      }),
    });
  });

  r.post('/keywords', requirePermission('seo.keywords.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, keywordSchema);
    const [site] = await app.db.select().from(websites).where(eq(websites.key, d.siteKey));
    if (!site) throw new HttpError(422, 'Unknown website', 'validation');
    try {
      const [row] = await app.db.insert(keywords).values({ orgId: app.orgId, ...d, keyword: d.keyword.toLowerCase(), createdBy: currentUser(c).id }).returning();
      app.analytics.invalidate();
      await audit(c, { action: 'seo.keyword.create', entityType: 'keyword', entityId: row.id, details: { keyword: row.keyword, site: row.siteKey } });
      return c.json(row, 201);
    } catch {
      throw new HttpError(409, 'This keyword is already tracked for this website', 'duplicate');
    }
  });

  r.patch('/keywords/:id', requirePermission('seo.keywords.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, keywordSchema.partial());
    const [row] = await app.db.update(keywords).set(d).where(eq(keywords.id, id)).returning();
    if (!row) notFound('Keyword');
    app.analytics.invalidate();
    await audit(c, { action: 'seo.keyword.update', entityType: 'keyword', entityId: id, details: d });
    return c.json(row);
  });

  r.delete('/keywords/:id', requirePermission('seo.keywords.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    await app.db.delete(keywords).where(eq(keywords.id, id));
    app.analytics.invalidate();
    await audit(c, { action: 'seo.keyword.delete', entityType: 'keyword', entityId: id });
    return c.json({ ok: true });
  });

  /* ---------- Search Console queries and pages ---------- */
  const gscBreakdown = (dim: 'query' | 'page') => async (c: Ctx) => {
    const app = c.get('app');
    const ctx = await app.analytics.engineContext(currentUser(c));
    const p = periodParams(c, { from: addDays(ctx.dataset.asOf, -27), to: ctx.dataset.asOf });
    const limit = Math.min(500, Number(c.req.query('limit')) || 200);
    const res = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['organic_clicks', 'organic_impressions', 'organic_ctr', 'avg_position'], from: p.range.from, to: p.range.to, compare: p.compare, groupBy: dim, filters: p.filters, limit: 500 })).results;
    const keys = (res[1].rows ?? []).slice(0, limit).map((x) => x.key);
    const brandRows = dim === 'query' ? runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['organic_clicks'], from: p.range.from, to: p.range.to, compare: 'none', groupBy: 'brand', filters: p.filters })).results[0].rows : null;
    return c.json({
      range: p.range,
      effectiveRange: res[0].meta.range,
      compareRange: res[0].meta.compareRange,
      mode: res[0].meta.mode,
      notes: res[0].meta.notes,
      ignoredFilters: res[0].meta.ignoredFilters,
      totals: { clicks: res[0].value, impressions: res[1].value, ctr: res[2].value, position: res[3].value, clicksCompare: res[0].compare, positionCompare: res[3].compare },
      brandSplit: brandRows,
      items: keys.map((key) => {
        const g = (i: number) => res[i].rows?.find((x) => x.key === key) ?? null;
        return { key, label: key.split(':').slice(1).join(':'), site: key.split(':')[0], clicks: g(0)?.value ?? 0, clicksCompare: g(0)?.compare ?? null, impressions: g(1)?.value ?? 0, ctr: g(2)?.value ?? null, position: g(3)?.value ?? null, positionCompare: g(3)?.compare ?? null };
      }),
    });
  };
  r.get('/queries', gscBreakdown('query'));
  r.get('/pages', gscBreakdown('page'));

  /* ---------- technical audit ---------- */
  r.get('/rules', (c) => c.json(RULES));

  r.get('/crawl-scopes', async (c) => {
    const rows = await c.get('app').db.select().from(seoCrawlScopes).orderBy(asc(seoCrawlScopes.websiteKey));
    return c.json(rows);
  });

  r.get('/crawls', async (c) => {
    const db = c.get('app').db;
    const rows = await db.select({ crawl: seoCrawls, scope: { name: seoCrawlScopes.name, websiteKey: seoCrawlScopes.websiteKey } }).from(seoCrawls).innerJoin(seoCrawlScopes, eq(seoCrawlScopes.id, seoCrawls.scopeId)).orderBy(desc(seoCrawls.startedAt)).limit(50);
    return c.json(rows.map((x) => ({ ...x.crawl, scopeName: x.scope.name, websiteKey: x.scope.websiteKey })));
  });

  r.get('/crawls/:id/pages', async (c) => {
    const id = uuidParam(c);
    const rows = await c.get('app').db.select().from(seoCrawlPages).where(eq(seoCrawlPages.crawlId, id)).orderBy(asc(seoCrawlPages.depth), asc(seoCrawlPages.url)).limit(2000);
    return c.json(rows);
  });

  r.post('/crawls', requirePermission('seo.crawl.run'), async (c) => {
    const app = c.get('app');
    const { scopeId } = await body(c, z.object({ scopeId: z.string().uuid() }));
    const [scope] = await app.db.select().from(seoCrawlScopes).where(eq(seoCrawlScopes.id, scopeId));
    if (!scope) notFound('Crawl scope');
    if (!scope.authorized || !scope.enabled) {
      await audit(c, { action: 'seo.crawl.start', outcome: 'denied', entityType: 'crawl_scope', entityId: scopeId, details: { reason: 'scope_not_authorised' } });
      throw new HttpError(403, 'This crawl scope has not been authorised by an administrator. Authorise it in Administration → SEO & GEO before running an audit.', 'crawl_not_authorised');
    }
    const running = await app.db.select({ id: seoCrawls.id }).from(seoCrawls).where(and(eq(seoCrawls.scopeId, scopeId), inArray(seoCrawls.status, ['queued', 'running'])));
    if (running.length) throw new HttpError(409, 'A crawl is already running for this scope', 'conflict');
    const [crawl] = await app.db.insert(seoCrawls).values({ scopeId, status: 'queued', source: 'crawler', triggeredBy: currentUser(c).id }).returning();
    const job = await app.jobs.enqueue('crawl.run', { crawlId: crawl.id }, { maxAttempts: 1, createdBy: currentUser(c).id });
    await audit(c, { action: 'seo.crawl.start', entityType: 'crawl', entityId: crawl.id, details: { scope: scope.name, hosts: scope.allowedHosts } });
    return c.json({ crawl, jobId: job.id }, 202);
  });

  /* ---------- issues ---------- */
  r.get('/issues', async (c) => {
    const app = c.get('app');
    const user = currentUser(c);
    const qp = c.req.query();
    const conds = [];
    const sites = parseList(qp.site) ?? user.scopes?.websites;
    if (sites?.length) conds.push(inArray(seoIssues.websiteKey, sites));
    const statuses = parseList(qp.status);
    if (statuses) conds.push(inArray(seoIssues.status, statuses));
    const sev = parseList(qp.severity);
    if (sev) conds.push(inArray(seoIssues.severity, sev));
    const rules = parseList(qp.rule);
    if (rules) conds.push(inArray(seoIssues.rule, rules));
    if (qp.owner === 'me') conds.push(eq(seoIssues.ownerId, user.id));
    const rows = await app.db
      .select({ issue: seoIssues, ownerName: users.name })
      .from(seoIssues)
      .leftJoin(users, eq(users.id, seoIssues.ownerId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(sql`case ${seoIssues.severity} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end`, desc(seoIssues.lastSeenAt))
      .limit(2000);
    const summary = await app.db
      .select({ status: seoIssues.status, severity: seoIssues.severity, n: sql<number>`count(*)::int` })
      .from(seoIssues)
      .where(sites?.length ? inArray(seoIssues.websiteKey, sites) : undefined)
      .groupBy(seoIssues.status, seoIssues.severity);
    return c.json({ items: rows.map((x) => ({ ...x.issue, ownerName: x.ownerName, ruleLabel: RULES[x.issue.rule]?.label ?? { en: x.issue.rule, fr: x.issue.rule } })), summary });
  });

  r.get('/issues/:id/history', async (c) => {
    const id = uuidParam(c);
    const rows = await c.get('app').db.select({ h: seoIssueHistory, userName: users.name }).from(seoIssueHistory).leftJoin(users, eq(users.id, seoIssueHistory.userId)).where(eq(seoIssueHistory.issueId, id)).orderBy(asc(seoIssueHistory.createdAt));
    return c.json(rows.map((x) => ({ ...x.h, userName: x.userName })));
  });

  r.patch('/issues/:id', requirePermission('seo.issues.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const user = currentUser(c);
    const d = await body(c, z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'ignored']).optional(), ownerId: z.string().uuid().nullable().optional(), comment: z.string().trim().max(2000).optional() }));
    const [cur] = await app.db.select().from(seoIssues).where(eq(seoIssues.id, id));
    if (!cur) notFound('Issue');
    if (user.scopes?.websites?.length && !user.scopes.websites.includes(cur.websiteKey)) throw new HttpError(403, 'Outside your data scope', 'forbidden');
    const set: Partial<typeof seoIssues.$inferInsert> = {};
    if (d.status && d.status !== cur.status) {
      set.status = d.status;
      set.resolvedAt = d.status === 'resolved' ? new Date() : null;
      await app.db.insert(seoIssueHistory).values({ issueId: id, userId: user.id, action: 'status', fromValue: cur.status, toValue: d.status, comment: d.comment ?? null });
    }
    if (d.ownerId !== undefined && d.ownerId !== cur.ownerId) {
      set.ownerId = d.ownerId;
      await app.db.insert(seoIssueHistory).values({ issueId: id, userId: user.id, action: 'owner', fromValue: cur.ownerId, toValue: d.ownerId, comment: null });
    }
    if (d.comment && !d.status) await app.db.insert(seoIssueHistory).values({ issueId: id, userId: user.id, action: 'comment', comment: d.comment });
    const [row] = Object.keys(set).length ? await app.db.update(seoIssues).set(set).where(eq(seoIssues.id, id)).returning() : [cur];
    await audit(c, { action: 'seo.issue.update', entityType: 'seo_issue', entityId: id, details: { status: d.status, owner: d.ownerId } });
    return c.json(row);
  });

  /* ---------- competitors (legitimate sources only) ---------- */
  r.get('/competitors', async (c) => {
    const db = c.get('app').db;
    const list = await db.select().from(competitors).orderBy(asc(competitors.name));
    const obs = await db.select().from(competitorObservations).orderBy(desc(competitorObservations.periodEnd));
    return c.json(list.map((x) => ({ ...x, observations: obs.filter((o) => o.competitorId === x.id) })));
  });

  r.post('/competitors', requirePermission('seo.keywords.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, z.object({ name: z.string().trim().min(1).max(120), domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/), topics: z.array(z.string().max(60)).max(20).default([]), notes: z.string().max(1000).optional() }));
    const key = d.domain.replace(/[^a-z0-9]+/g, '-');
    const [row] = await app.db.insert(competitors).values({ orgId: app.orgId, key, ...d }).returning();
    await audit(c, { action: 'seo.competitor.create', entityType: 'competitor', entityId: row.id, details: { name: d.name, domain: d.domain } });
    return c.json(row, 201);
  });

  r.delete('/competitors/:id', requirePermission('seo.keywords.manage'), async (c) => {
    const id = uuidParam(c);
    const db = c.get('app').db;
    await db.delete(competitorObservations).where(eq(competitorObservations.competitorId, id));
    await db.delete(competitors).where(eq(competitors.id, id));
    await audit(c, { action: 'seo.competitor.delete', entityType: 'competitor', entityId: id });
    return c.json({ ok: true });
  });

  r.post('/competitors/:id/observations', requirePermission('seo.keywords.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(
      c,
      z.object({
        metric: z.string().trim().min(1).max(80),
        value: z.number().finite(),
        periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        source: z.string().trim().min(2).max(200),
        sourceUrl: z.string().url().max(500).optional(),
        note: z.string().max(1000).optional(),
      }),
    );
    assertCan(currentUser(c), 'seo.keywords.manage');
    const [row] = await app.db.insert(competitorObservations).values({ competitorId: id, ...d, createdBy: currentUser(c).id }).returning();
    await audit(c, { action: 'seo.competitor.observation', entityType: 'competitor', entityId: id, details: { metric: d.metric, source: d.source } });
    return c.json(row, 201);
  });

  return r;
}
