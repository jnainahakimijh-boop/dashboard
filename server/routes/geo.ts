/** GEO & AI visibility: prompt library (versioned), measurements with provenance, summaries, opportunities, GEO vs SEO. */
import { Hono } from 'hono';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { addDays, comparisonRange } from '@shared/calendar';
import { COMPETITORS, GEO_PROVIDERS, TOPICS } from '@shared/catalog';
import type { DemoGeoMeasurement } from '@shared/demo/generate';
import { analyticsQuerySchema } from '@shared/filters';
import { requirePermission } from '../auth/middleware';
import { audit } from '../audit';
import { HttpError, currentUser, type HonoEnv, type Ctx } from '../context';
import { competitors, dataConnections, geoPromptVersions, geoPrompts } from '../db/schema';
import { runQuery } from '../analytics/engine';
import { body, notFound, parseList, periodParams, uuidParam } from './util';

const promptSchema = z.object({
  text: z.string().trim().min(5).max(500),
  language: z.enum(['en', 'fr']),
  topic: z.string().min(1).max(60),
  intent: z.enum(['informational', 'commercial', 'comparison', 'navigational']),
  market: z.string().trim().min(1).max(60),
  priority: z.enum(['high', 'medium', 'low']),
  expectedPages: z.array(z.string().trim().regex(/^\/[^\s]*$/, 'Use a site path starting with /').max(300)).max(10).default([]),
});

interface Stats {
  measurements: number;
  failed: number;
  partial: number;
  mentioned: number;
  cited: number;
  mentionRate: number | null;
  citationRate: number | null;
}

function stats(rows: DemoGeoMeasurement[]): Stats {
  const valid = rows.filter((r) => r.status !== 'failed');
  const mentioned = valid.filter((r) => r.mentioned).length;
  const cited = valid.filter((r) => r.cited).length;
  return {
    measurements: valid.length,
    failed: rows.length - valid.length,
    partial: rows.filter((r) => r.status === 'partial').length,
    mentioned,
    cited,
    mentionRate: valid.length ? mentioned / valid.length : null,
    citationRate: valid.length ? cited / valid.length : null,
  };
}

export function geoRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('analytics.view'));

  const load = async (c: Ctx) => {
    const app = c.get('app');
    const ds = await app.analytics.dataset();
    const p = periodParams(c, { from: addDays(ds.asOf, -55), to: ds.asOf });
    const prompts = await app.db.select().from(geoPrompts);
    const versions = await app.db.select().from(geoPromptVersions);
    const providers = parseList(c.req.query('provider'));
    const promptAttr = new Map(prompts.map((x) => [x.key, x]));
    const lang = p.filters.language;
    const all = (ds.geo?.rows ?? []).filter((x) => (!providers || providers.includes(x.provider)) && (!lang || lang.includes(promptAttr.get(x.prompt)?.language ?? '')));
    const inRange = (from: string, to: string) => all.filter((x) => x.date >= from && x.date <= to);
    return { app, ds, p, prompts, versions, all, inRange, origin: ds.geo?.origin ?? null };
  };

  r.get('/prompts', async (c) => {
    const { p, prompts, versions, inRange } = await load(c);
    const rows = inRange(p.range.from, p.range.to);
    return c.json(
      prompts
        .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
        .map((x) => {
          const v = versions.filter((y) => y.promptId === x.id).sort((a, b) => b.version - a.version);
          return { ...x, text: v[0]?.text ?? '', versions: v.length, stats: stats(rows.filter((m) => m.prompt === x.key)) };
        }),
    );
  });

  r.get('/prompts/:id/versions', async (c) => {
    const id = uuidParam(c);
    return c.json(await c.get('app').db.select().from(geoPromptVersions).where(eq(geoPromptVersions.promptId, id)).orderBy(desc(geoPromptVersions.version)));
  });

  r.post('/prompts', requirePermission('geo.prompts.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, promptSchema);
    const existing = await app.db.select({ key: geoPrompts.key }).from(geoPrompts);
    const n = existing.reduce((m, x) => Math.max(m, Number(x.key.replace(/\D/g, '')) || 0), 0) + 1;
    const key = `p${String(n).padStart(2, '0')}`;
    const user = currentUser(c);
    const [row] = await app.db.insert(geoPrompts).values({ orgId: app.orgId, key, currentVersion: 1, language: d.language, topic: d.topic, intent: d.intent, market: d.market, priority: d.priority, expectedPages: d.expectedPages, createdBy: user.id }).returning();
    await app.db.insert(geoPromptVersions).values({ promptId: row.id, version: 1, text: d.text, changeNote: 'Created', createdBy: user.id });
    app.analytics.invalidate();
    await audit(c, { action: 'geo.prompt.create', entityType: 'geo_prompt', entityId: row.id, details: { key, text: d.text } });
    return c.json(row, 201);
  });

  r.patch('/prompts/:id', requirePermission('geo.prompts.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, promptSchema.partial().extend({ active: z.boolean().optional(), changeNote: z.string().max(300).optional() }));
    const [cur] = await app.db.select().from(geoPrompts).where(eq(geoPrompts.id, id));
    if (!cur) notFound('Prompt');
    const user = currentUser(c);
    const [latest] = await app.db.select().from(geoPromptVersions).where(eq(geoPromptVersions.promptId, id)).orderBy(desc(geoPromptVersions.version)).limit(1);
    let currentVersion = cur.currentVersion;
    if (d.text && d.text !== latest?.text) {
      currentVersion = (latest?.version ?? 0) + 1;
      await app.db.insert(geoPromptVersions).values({ promptId: id, version: currentVersion, text: d.text, changeNote: d.changeNote ?? 'Wording updated', createdBy: user.id });
    }
    const { text: _t, changeNote: _c, ...rest } = d;
    void _t;
    void _c;
    const [row] = await app.db.update(geoPrompts).set({ ...rest, currentVersion, updatedAt: new Date() }).where(eq(geoPrompts.id, id)).returning();
    app.analytics.invalidate();
    await audit(c, { action: 'geo.prompt.update', entityType: 'geo_prompt', entityId: id, details: { ...rest, newVersion: currentVersion !== cur.currentVersion ? currentVersion : undefined } });
    return c.json(row);
  });

  r.get('/measurements', async (c) => {
    const { p, inRange, origin } = await load(c);
    const qp = c.req.query();
    const promptKeys = parseList(qp.prompt);
    const statuses = parseList(qp.status);
    const rows = inRange(p.range.from, p.range.to)
      .filter((x) => (!promptKeys || promptKeys.includes(x.prompt)) && (!statuses || statuses.includes(x.status)))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const page = Math.max(1, Number(qp.page) || 1);
    const pageSize = Math.min(200, Math.max(10, Number(qp.pageSize) || 50));
    const providerMeta = new Map(GEO_PROVIDERS.map((g) => [g.id, g]));
    return c.json({
      total: rows.length,
      page,
      pageSize,
      mode: origin === 'demo' ? 'demo' : origin ? 'connected' : 'unavailable',
      items: rows.slice((page - 1) * pageSize, page * pageSize).map((x) => ({ ...x, method: providerMeta.get(x.provider)?.method ?? 'unknown', origin: origin === 'demo' ? 'demo' : 'recorded' })),
    });
  });

  r.get('/summary', async (c) => {
    const { p, prompts, inRange, origin } = await load(c);
    const cur = inRange(p.range.from, p.range.to);
    const cmpR = comparisonRange(p.range, p.compare);
    const cmp = cmpR ? inRange(cmpR.from, cmpR.to) : [];
    const promptByKey = new Map(prompts.map((x) => [x.key, x]));
    const comps = await c.get('app').db.select().from(competitors);
    const compName = new Map([...COMPETITORS.map((x) => [x.id, x.name] as const), ...comps.map((x) => [x.key, x.name] as const)]);
    const valid = cur.filter((x) => x.status !== 'failed');
    const brandMentions = valid.filter((x) => x.mentioned).length;
    const compMentions = new Map<string, number>();
    for (const x of valid) for (const k of x.competitors) compMentions.set(k, (compMentions.get(k) ?? 0) + 1);
    const totalBrandMentions = brandMentions + [...compMentions.values()].reduce((s, n) => s + n, 0);
    const domains = new Map<string, number>();
    for (const x of valid) for (const d of x.citedDomains) domains.set(d, (domains.get(d) ?? 0) + 1);
    const expectedCited = valid.filter((x) => {
      const pr = promptByKey.get(x.prompt);
      return pr && pr.expectedPages.length && x.citedUrls.some((u) => pr.expectedPages.some((ep) => u.endsWith(ep)));
    }).length;
    const withExpected = valid.filter((x) => (promptByKey.get(x.prompt)?.expectedPages.length ?? 0) > 0).length;
    return c.json({
      range: p.range,
      compareRange: cmpR,
      mode: origin === 'demo' ? 'demo' : origin ? 'connected' : 'unavailable',
      sampleNote: 'Rates describe the monitored prompts and providers only; they are not a measure of all AI usage.',
      overall: stats(cur),
      overallCompare: cmpR ? stats(cmp) : null,
      expectedPageCitationRate: withExpected ? expectedCited / withExpected : null,
      byProvider: GEO_PROVIDERS.map((g) => ({ id: g.id, name: g.name, method: g.method, cadenceDays: g.cadence, limitation: g.limitation, stats: stats(cur.filter((x) => x.provider === g.id)) })),
      byTopic: TOPICS.map((t) => ({ topic: t.id, name: t.name, stats: stats(cur.filter((x) => promptByKey.get(x.prompt)?.topic === t.id)), compare: cmpR ? stats(cmp.filter((x) => promptByKey.get(x.prompt)?.topic === t.id)) : null })).filter((x) => x.stats.measurements > 0),
      shareOfVoice: [
        { key: 'veolia', name: 'Veolia', mentions: brandMentions, share: totalBrandMentions ? brandMentions / totalBrandMentions : null },
        ...[...compMentions.entries()].map(([k, n]) => ({ key: k, name: compName.get(k) ?? k, mentions: n, share: totalBrandMentions ? n / totalBrandMentions : null })),
      ].sort((a, b) => b.mentions - a.mentions),
      citedDomains: [...domains.entries()].map(([domain, n]) => ({ domain, citations: n, share: valid.length ? n / valid.length : null })).sort((a, b) => b.citations - a.citations).slice(0, 15),
      series: (() => {
        const weeks = new Map<string, DemoGeoMeasurement[]>();
        for (const x of cur) {
          const d = new Date(`${x.date}T00:00:00Z`);
          const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
          weeks.set(monday, [...(weeks.get(monday) ?? []), x]);
        }
        return [...weeks.entries()].sort().map(([week, xs]) => ({ week, ...stats(xs) }));
      })(),
    });
  });

  r.get('/opportunities', async (c) => {
    const { p, prompts, versions, inRange, origin } = await load(c);
    const cur = inRange(p.range.from, p.range.to);
    const out: Array<Record<string, unknown>> = [];
    for (const pr of prompts.filter((x) => x.active)) {
      const rows = cur.filter((x) => x.prompt === pr.key);
      const s = stats(rows);
      const text = versions.filter((v) => v.promptId === pr.id).sort((a, b) => b.version - a.version)[0]?.text ?? pr.key;
      const valid = rows.filter((x) => x.status !== 'failed');
      const comp = COMPETITORS.map((cc) => ({ id: cc.id, name: cc.name, rate: valid.length ? valid.filter((x) => x.competitors.includes(cc.id)).length / valid.length : 0 })).sort((a, b) => b.rate - a.rate)[0];
      const base = { promptId: pr.id, key: pr.key, text, topic: pr.topic, priority: pr.priority, language: pr.language, stats: s, lowSample: s.measurements < 6 };
      if (!pr.expectedPages.length) out.push({ ...base, type: 'no_expected_page', score: pr.priority === 'high' ? 3 : 2 });
      if (s.mentionRate !== null && s.mentionRate < 0.3) out.push({ ...base, type: 'low_mention', score: (pr.priority === 'high' ? 3 : pr.priority === 'medium' ? 2 : 1) * (1 - s.mentionRate) });
      if (comp && s.mentionRate !== null && comp.rate > s.mentionRate + 0.1) out.push({ ...base, type: 'competitor_ahead', competitor: comp, score: (comp.rate - s.mentionRate) * 3 });
      if (s.mentionRate !== null && s.citationRate !== null && s.mentionRate - s.citationRate > 0.25) out.push({ ...base, type: 'citation_gap', score: (s.mentionRate - s.citationRate) * 2 });
    }
    out.sort((a, b) => (b.score as number) - (a.score as number));
    return c.json({ range: p.range, mode: origin === 'demo' ? 'demo' : origin ? 'connected' : 'unavailable', items: out });
  });

  /** Descriptive comparison of AI-answer visibility with organic search performance by topic. */
  r.get('/vs-seo', async (c) => {
    const { app, p, prompts, inRange } = await load(c);
    const ctx = await app.analytics.engineContext(currentUser(c));
    const res = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['organic_clicks', 'avg_position', 'organic_impressions'], from: p.range.from, to: p.range.to, compare: 'none', groupBy: 'topic', filters: { site: p.filters.site, language: p.filters.language } })).results;
    const cur = inRange(p.range.from, p.range.to);
    const topicOf = new Map(prompts.map((x) => [x.key, x.topic]));
    return c.json({
      range: p.range,
      note: 'Side-by-side view only: organic rankings and AI-answer mentions are measured differently and one does not imply the other.',
      seoTable: res[0].meta.table,
      seoNotes: res[0].meta.notes,
      items: TOPICS.map((t) => {
        const g = (i: number) => res[i].rows?.find((x) => x.key === t.id)?.value ?? null;
        const s = stats(cur.filter((x) => topicOf.get(x.prompt) === t.id));
        return { topic: t.id, name: t.name, prompts: prompts.filter((x) => x.topic === t.id).length, geo: s, seo: { clicks: g(0), position: g(1), impressions: g(2) } };
      }).filter((x) => x.prompts > 0 || (x.seo.impressions ?? 0) > 0),
    });
  });

  r.post('/measure', requirePermission('geo.measure.run'), async (c) => {
    const app = c.get('app');
    const d = await body(c, z.object({ provider: z.enum(['geo_openai', 'geo_perplexity']), promptIds: z.array(z.string().uuid()).max(100).optional() }));
    const [conn] = await app.db.select().from(dataConnections).where(eq(dataConnections.provider, d.provider));
    if (!conn || conn.status !== 'connected' || !conn.secretCiphertext) {
      await audit(c, { action: 'geo.measure.start', outcome: 'denied', details: { provider: d.provider, reason: 'provider_not_connected' } });
      throw new HttpError(409, 'This GEO provider is not connected. Configure its API key and approve external processing in Administration → Integrations first.', 'provider_not_connected');
    }
    const prompts = d.promptIds?.length ? await app.db.select().from(geoPrompts).where(inArray(geoPrompts.id, d.promptIds)) : await app.db.select().from(geoPrompts).where(eq(geoPrompts.active, true)).orderBy(asc(geoPrompts.key));
    const job = await app.jobs.enqueue('geo.measure', { connectionId: conn.id, promptKeys: prompts.map((x) => x.key) }, { maxAttempts: 1, createdBy: currentUser(c).id });
    await audit(c, { action: 'geo.measure.start', entityType: 'connection', entityId: conn.id, details: { prompts: prompts.length } });
    return c.json({ jobId: job.id }, 202);
  });

  return r;
}
