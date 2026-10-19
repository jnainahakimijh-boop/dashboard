/** Executive summary, recommendations workflow, alert events and notifications. */
import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { addDays } from '@shared/calendar';
import { can } from '@shared/rbac';
import { requirePermission } from '../auth/middleware';
import { audit } from '../audit';
import { HttpError, currentUser, type HonoEnv, type Ctx } from '../context';
import { alertEvents, notifications, recommendationComments, recommendationHistory, recommendations, users } from '../db/schema';
import { buildExecutiveSummary, summaryToText } from '../insights/summary';
import { generateRecommendations } from '../insights/recommendations';
import { explainFacts, aiStatus } from '../ai/provider';
import { body, notFound, parseList, periodParams, uuidParam } from './util';

const STATUSES = ['new', 'under_review', 'approved', 'in_progress', 'completed', 'dismissed'] as const;
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export function insightsRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('analytics.view'));

  r.get('/summary', async (c) => {
    const app = c.get('app');
    const user = currentUser(c);
    const asOf = await app.analytics.asOf();
    const p = periodParams(c, { from: addDays(asOf, -29), to: asOf });
    const metrics = c.req.query('metrics')?.split(',').filter(Boolean).slice(0, 20);
    const summary = await buildExecutiveSummary(app, user, { from: p.range.from, to: p.range.to, compare: p.compare, filters: p.filters, metrics });
    let narrative: { text: string | null; reason: string } | null = null;
    if (c.req.query('narrative') === '1') {
      if (!can(user.role, 'ai.generate')) narrative = { text: null, reason: 'forbidden' };
      else {
        const lang = c.req.query('lang') === 'en' ? 'en' : 'fr';
        const res = await explainFacts(app, 'executive_summary', { summary: summaryToText(summary, lang) }, lang, user.id);
        narrative = { text: res.text, reason: res.status.reason };
        if (res.text) await audit(c, { action: 'ai.summary.generate', details: { provider: res.status.provider, model: res.status.model } });
      }
    }
    return c.json({ ...summary, narrative, ai: await aiStatus(app) });
  });

  /* ---------- recommendations ---------- */
  r.get('/recommendations', async (c) => {
    const app = c.get('app');
    const qp = c.req.query();
    const conds = [];
    const st = parseList(qp.status);
    if (st) conds.push(inArray(recommendations.status, st));
    const pr = parseList(qp.priority);
    if (pr) conds.push(inArray(recommendations.priority, pr));
    if (qp.owner === 'me') conds.push(eq(recommendations.ownerId, currentUser(c).id));
    if (qp.owner === 'none') conds.push(isNull(recommendations.ownerId));
    const rows = await app.db
      .select({ rec: recommendations, ownerName: users.name, comments: sql<number>`(select count(*)::int from recommendation_comments rc where rc.recommendation_id = ${recommendations.id})` })
      .from(recommendations)
      .leftJoin(users, eq(users.id, recommendations.ownerId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(sql`case ${recommendations.priority} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end`, desc(recommendations.updatedAt));
    const channel = qp.channel;
    return c.json(rows.filter((x) => !channel || x.rec.channels.includes(channel)).map((x) => ({ ...x.rec, ownerName: x.ownerName, commentCount: Number(x.comments) })));
  });

  r.get('/recommendations/:id', async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const [row] = await app.db.select({ rec: recommendations, ownerName: users.name }).from(recommendations).leftJoin(users, eq(users.id, recommendations.ownerId)).where(eq(recommendations.id, id));
    if (!row) notFound('Recommendation');
    const comments = await app.db.select({ c: recommendationComments, userName: users.name }).from(recommendationComments).leftJoin(users, eq(users.id, recommendationComments.userId)).where(eq(recommendationComments.recommendationId, id)).orderBy(asc(recommendationComments.createdAt));
    const history = await app.db.select({ h: recommendationHistory, userName: users.name }).from(recommendationHistory).leftJoin(users, eq(users.id, recommendationHistory.userId)).where(eq(recommendationHistory.recommendationId, id)).orderBy(asc(recommendationHistory.createdAt));
    return c.json({ ...row.rec, ownerName: row.ownerName, comments: comments.map((x) => ({ ...x.c, userName: x.userName })), history: history.map((x) => ({ ...x.h, userName: x.userName })) });
  });

  r.patch('/recommendations/:id', requirePermission('recommendations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const user = currentUser(c);
    const d = await body(c, z.object({ status: z.enum(STATUSES).optional(), ownerId: z.string().uuid().nullable().optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), priority: z.enum(PRIORITIES).optional() }));
    const [cur] = await app.db.select().from(recommendations).where(eq(recommendations.id, id));
    if (!cur) notFound('Recommendation');
    if (d.ownerId) {
      const [owner] = await app.db.select({ id: users.id, status: users.status }).from(users).where(eq(users.id, d.ownerId));
      if (!owner || owner.status !== 'active') throw new HttpError(422, 'Owner must be an active user', 'validation');
    }
    const set: Partial<typeof recommendations.$inferInsert> = { updatedAt: new Date() };
    const hist: Array<typeof recommendationHistory.$inferInsert> = [];
    for (const k of ['status', 'ownerId', 'dueDate', 'priority'] as const) {
      if (d[k] !== undefined && d[k] !== cur[k]) {
        (set as Record<string, unknown>)[k] = d[k];
        hist.push({ recommendationId: id, userId: user.id, field: k === 'ownerId' ? 'owner' : k, fromValue: cur[k] === null ? null : String(cur[k]), toValue: d[k] === null ? null : String(d[k]) });
      }
    }
    if (d.status && d.status !== cur.status) set.statusChangedAt = new Date();
    const [row] = await app.db.update(recommendations).set(set).where(eq(recommendations.id, id)).returning();
    if (hist.length) await app.db.insert(recommendationHistory).values(hist);
    if (d.ownerId && d.ownerId !== cur.ownerId && d.ownerId !== user.id)
      await app.db.insert(notifications).values({ userId: d.ownerId, kind: 'assignment', title: `Recommendation assigned to you: ${cur.title}`, body: cur.titleFr ?? cur.title, link: `/insights?rec=${id}` });
    await audit(c, { action: 'recommendation.update', entityType: 'recommendation', entityId: id, details: d });
    return c.json(row);
  });

  r.post('/recommendations/:id/comments', requirePermission('recommendations.comment'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const { body: text } = await body(c, z.object({ body: z.string().trim().min(1).max(4000) }));
    const [rec] = await app.db.select({ id: recommendations.id, ownerId: recommendations.ownerId, title: recommendations.title }).from(recommendations).where(eq(recommendations.id, id));
    if (!rec) notFound('Recommendation');
    const user = currentUser(c);
    const [row] = await app.db.insert(recommendationComments).values({ recommendationId: id, userId: user.id, body: text }).returning();
    if (rec.ownerId && rec.ownerId !== user.id) await app.db.insert(notifications).values({ userId: rec.ownerId, kind: 'comment', title: `New comment on: ${rec.title}`, link: `/insights?rec=${id}` });
    await audit(c, { action: 'recommendation.comment', entityType: 'recommendation', entityId: id });
    return c.json(row, 201);
  });

  r.post('/recommendations', requirePermission('recommendations.manage'), async (c) => {
    const app = c.get('app');
    const user = currentUser(c);
    const d = await body(
      c,
      z.object({
        title: z.string().trim().min(3).max(200),
        summary: z.string().trim().min(3).max(4000),
        action: z.string().trim().min(3).max(2000),
        priority: z.enum(PRIORITIES),
        impact: z.enum(['high', 'medium', 'low']),
        effort: z.enum(['high', 'medium', 'low']).optional(),
        channels: z.array(z.string().max(60)).max(10).default([]),
        kpis: z.array(z.string().max(60)).max(10).default([]),
        sources: z.array(z.string().max(120)).max(10).default([]),
        evidence: z.array(z.object({ label: z.string().max(200), value: z.string().max(200), source: z.string().max(120).optional() })).max(10).default([]),
        ownerId: z.string().uuid().nullable().optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      }),
    );
    const [row] = await app.db
      .insert(recommendations)
      .values({ orgId: app.orgId, fingerprint: `manual:${crypto.randomUUID()}`, origin: 'manual', ruleKey: null, ...d, evidence: d.evidence.map((e) => ({ label: { en: e.label, fr: e.label }, text: e.value, source: e.source ?? 'manual', unit: 'text' })), status: 'new', ownerId: d.ownerId ?? null, dueDate: d.dueDate ?? null, confidence: 'manual' })
      .returning();
    await app.db.insert(recommendationHistory).values({ recommendationId: row.id, userId: user.id, field: 'status', toValue: 'new' });
    await audit(c, { action: 'recommendation.create', entityType: 'recommendation', entityId: row.id, details: { title: d.title } });
    return c.json(row, 201);
  });

  r.post('/recommendations/generate', requirePermission('recommendations.manage'), async (c) => {
    const res = await generateRecommendations(c.get('app'));
    await audit(c, { action: 'recommendation.generate', details: res });
    return c.json(res);
  });

  /* ---------- alerts ---------- */
  r.get('/alerts', async (c) => {
    const app = c.get('app');
    const qp = c.req.query();
    const conds = [];
    const st = parseList(qp.status);
    if (st) conds.push(inArray(alertEvents.status, st));
    const sev = parseList(qp.severity);
    if (sev) conds.push(inArray(alertEvents.severity, sev));
    const rows = await app.db.select().from(alertEvents).where(conds.length ? and(...conds) : undefined).orderBy(desc(alertEvents.lastTriggeredAt)).limit(500);
    return c.json(rows);
  });

  const transition = (to: 'acknowledged' | 'resolved') => async (c: Ctx) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const user = currentUser(c);
    const [cur] = await app.db.select().from(alertEvents).where(eq(alertEvents.id, id));
    if (!cur) notFound('Alert');
    if (cur.status === 'resolved') throw new HttpError(409, 'Alert already resolved', 'conflict');
    const [row] = await app.db
      .update(alertEvents)
      .set(to === 'acknowledged' ? { status: 'acknowledged', acknowledgedBy: user.id, acknowledgedAt: new Date() } : { status: 'resolved', resolvedAt: new Date(), evidence: { ...cur.evidence, resolution: `Resolved manually by ${user.name}` } })
      .where(eq(alertEvents.id, id))
      .returning();
    await audit(c, { action: `alert.${to === 'acknowledged' ? 'acknowledge' : 'resolve'}`, entityType: 'alert_event', entityId: id });
    return c.json(row);
  };
  r.post('/alerts/:id/acknowledge', requirePermission('alerts.ack'), transition('acknowledged'));
  r.post('/alerts/:id/resolve', requirePermission('alerts.ack'), transition('resolved'));

  return r;
}

export function notificationRoutes() {
  const r = new Hono<HonoEnv>();
  r.get('/', async (c) => {
    const user = currentUser(c);
    const rows = await c.get('app').db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
    return c.json({ items: rows, unread: rows.filter((x) => !x.readAt).length });
  });
  r.post('/read', async (c) => {
    const user = currentUser(c);
    const d = await body(c, z.object({ ids: z.array(z.string().uuid()).max(200).optional(), all: z.boolean().optional() }));
    const db = c.get('app').db;
    if (d.all) await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    else if (d.ids?.length) await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), inArray(notifications.id, d.ids)));
    return c.json({ ok: true });
  });
  return r;
}
