/** Saved views, favorites and global search. */
import { Hono } from 'hono';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { CAMPAIGNS, label } from '@shared/catalog';
import { METRICS } from '@shared/metrics';
import { can } from '@shared/rbac';
import { requirePermission } from '../auth/middleware';
import { audit } from '../audit';
import { HttpError, currentUser, type HonoEnv } from '../context';
import { contentItems, favorites, geoPromptVersions, geoPrompts, keywords, recommendations, reportTemplates, savedViews, seoIssues } from '../db/schema';
import { body, uuidParam } from './util';

const viewState = z.record(z.unknown()).refine((v) => JSON.stringify(v).length < 20_000, 'View state too large');

export function personalRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('analytics.view'));

  r.get('/views', async (c) => {
    const user = currentUser(c);
    const route = c.req.query('route');
    const rows = await c.get('app').db.select().from(savedViews).where(or(eq(savedViews.userId, user.id), eq(savedViews.shared, true))).orderBy(desc(savedViews.isPreset), desc(savedViews.createdAt));
    return c.json(rows.filter((v) => !route || v.route === route).map((v) => ({ ...v, mine: v.userId === user.id })));
  });

  r.post('/views', async (c) => {
    const app = c.get('app');
    const user = currentUser(c);
    const d = await body(c, z.object({ name: z.string().trim().min(1).max(120), route: z.string().regex(/^\/[a-z0-9/_-]*$/i).max(100), state: viewState, shared: z.boolean().default(false) }));
    if (d.shared && !can(user.role, 'views.share')) throw new HttpError(403, 'You cannot share views', 'forbidden');
    const [row] = await app.db.insert(savedViews).values({ orgId: app.orgId, userId: user.id, ...d }).returning();
    await audit(c, { action: 'view.create', entityType: 'saved_view', entityId: row.id, details: { name: d.name, shared: d.shared } });
    return c.json(row, 201);
  });

  r.delete('/views/:id', async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const user = currentUser(c);
    const [v] = await app.db.select().from(savedViews).where(eq(savedViews.id, id));
    if (!v) return c.json({ ok: true });
    if (v.userId !== user.id && !can(user.role, 'dashboards.edit')) throw new HttpError(403, 'You can only delete your own views', 'forbidden');
    await app.db.delete(savedViews).where(eq(savedViews.id, id));
    await audit(c, { action: 'view.delete', entityType: 'saved_view', entityId: id });
    return c.json({ ok: true });
  });

  r.get('/favorites', async (c) => c.json(await c.get('app').db.select().from(favorites).where(eq(favorites.userId, currentUser(c).id)).orderBy(desc(favorites.createdAt))));

  r.post('/favorites', async (c) => {
    const d = await body(c, z.object({ kind: z.enum(['page', 'view', 'metric', 'report', 'content', 'keyword', 'prompt']), ref: z.string().min(1).max(300), label: z.string().min(1).max(200) }));
    const user = currentUser(c);
    const db = c.get('app').db;
    const [existing] = await db.select().from(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.kind, d.kind), eq(favorites.ref, d.ref)));
    if (existing) return c.json(existing);
    const [row] = await db.insert(favorites).values({ userId: user.id, ...d }).returning();
    return c.json(row, 201);
  });

  r.delete('/favorites/:id', async (c) => {
    const id = uuidParam(c);
    await c.get('app').db.delete(favorites).where(and(eq(favorites.id, id), eq(favorites.userId, currentUser(c).id)));
    return c.json({ ok: true });
  });

  /** Global search across metrics, content, keywords, prompts, recommendations, issues, campaigns and reports. */
  r.get('/search', async (c) => {
    const app = c.get('app');
    const user = currentUser(c);
    const q = (c.req.query('q') ?? '').trim().slice(0, 100);
    if (q.length < 2) return c.json({ q, results: [] });
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const lower = q.toLowerCase();
    const results: Array<{ type: string; id: string; title: string; subtitle?: string; link: string }> = [];
    for (const m of METRICS.filter((x) => !x.internal)) {
      if (m.id.includes(lower) || m.label.en.toLowerCase().includes(lower) || m.label.fr.toLowerCase().includes(lower)) results.push({ type: 'metric', id: m.id, title: label(m.label, user.language === 'en' ? 'en' : 'fr'), subtitle: m.module, link: `/admin/kpis?metric=${m.id}` });
    }
    for (const cmp of CAMPAIGNS) if (cmp.name.en.toLowerCase().includes(lower) || cmp.name.fr.toLowerCase().includes(lower) || cmp.utm.includes(lower)) results.push({ type: 'campaign', id: cmp.id, title: label(cmp.name, user.language === 'en' ? 'en' : 'fr'), subtitle: cmp.utm, link: `/?campaign=${cmp.id}` });
    const [pages, kws, prompts, recs, issues, reports] = await Promise.all([
      app.db.select().from(contentItems).where(or(ilike(contentItems.title, like), ilike(contentItems.url, like))).limit(10),
      app.db.select().from(keywords).where(ilike(keywords.keyword, like)).limit(10),
      app.db.select({ p: geoPrompts, v: geoPromptVersions }).from(geoPrompts).innerJoin(geoPromptVersions, and(eq(geoPromptVersions.promptId, geoPrompts.id), eq(geoPromptVersions.version, geoPrompts.currentVersion))).where(ilike(geoPromptVersions.text, like)).limit(10),
      app.db.select().from(recommendations).where(or(ilike(recommendations.title, like), ilike(recommendations.titleFr, like))).limit(10),
      app.db.select().from(seoIssues).where(ilike(seoIssues.url, like)).limit(10),
      app.db.select().from(reportTemplates).where(ilike(reportTemplates.name, like)).limit(10),
    ]);
    pages.forEach((p) => results.push({ type: 'content', id: p.sourceKey, title: p.title, subtitle: p.url ?? undefined, link: `/content?q=${encodeURIComponent(p.title)}` }));
    kws.forEach((k) => results.push({ type: 'keyword', id: k.id, title: k.keyword, subtitle: k.siteKey, link: `/seo?tab=keywords&q=${encodeURIComponent(k.keyword)}` }));
    prompts.forEach((p) => results.push({ type: 'prompt', id: p.p.id, title: p.v.text, subtitle: p.p.key, link: `/geo?tab=prompts&prompt=${p.p.key}` }));
    recs.forEach((r) => results.push({ type: 'recommendation', id: r.id, title: user.language === 'en' ? r.title : r.titleFr ?? r.title, subtitle: r.status, link: `/insights?rec=${r.id}` }));
    issues.forEach((i) => results.push({ type: 'seo_issue', id: i.id, title: i.url, subtitle: i.rule, link: `/seo?tab=issues&issue=${i.id}` }));
    reports.forEach((t) => results.push({ type: 'report', id: t.id, title: t.name, subtitle: t.type, link: `/reports?template=${t.id}` }));
    return c.json({ q, results: results.slice(0, 50) });
  });

  return r;
}
