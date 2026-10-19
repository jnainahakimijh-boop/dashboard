import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { loadEnv } from './env';
import { bootstrap, shutdown } from './bootstrap';
import { createApp } from './app';
import { createLogger } from './logger';
import type { AppContext, HonoEnv } from './context';
import { auditLogs, dataConnections, geoMeasurements, jobs, recommendations, syncExecutions } from './db/schema';
import { measureAllGeo, runGeoMeasurements } from './connectors/sync';
import { AnalyticsService } from './analytics/service';
import { queueAuthorisedCrawls } from './seo/crawler';
import { resetRateLimits } from './auth/middleware';
import { signDrupal } from './connectors/drupal';

let app: AppContext;
let http: Hono<HonoEnv>;
const DEMO_PW = 'Demo-Passw0rd!x';
const H = { 'content-type': 'application/json', 'x-vdi-request': '1' };
const cookies: Record<string, string> = {};

async function login(email: string): Promise<string> {
  if (cookies[email]) return cookies[email];
  const res = await http.request('/api/auth/demo-login', { method: 'POST', headers: H, body: JSON.stringify({ email }) });
  expect(res.status).toBe(200);
  cookies[email] = res.headers.get('set-cookie')!.split(';')[0];
  return cookies[email];
}
const as = (email: string) => ({
  get: async (path: string) => http.request(path, { headers: { cookie: await login(email) } }),
  send: async (method: string, path: string, body?: unknown) => http.request(path, { method, headers: { ...H, cookie: await login(email) }, body: body === undefined ? undefined : JSON.stringify(body) }),
});
const ADMIN = 'demo.admin@veolia.example';
const ANALYST = 'demo.analyst@veolia.example';
const EDITOR = 'demo.editor@veolia.example';
const EXEC = 'demo.executive@veolia.example';
const FR_EDITOR = 'demo.fr-editor@veolia.example';

beforeAll(async () => {
  const env = loadEnv({ VDI_SKIP_DOTENV: '1', NODE_ENV: 'test', APP_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'), DEMO_USERS_PASSWORD: DEMO_PW, SEED_ADMIN_PASSWORD: 'Super-Admin-Passw0rd!', CRAWLER_EXTRA_ALLOWED_HOSTS: '127.0.0.1:1', DATABASE_URL: process.env.TEST_DATABASE_URL ?? '' } as NodeJS.ProcessEnv);
  // embedded in-memory database by default; TEST_DATABASE_URL runs the same suite against a real (empty) PostgreSQL
  app = await bootstrap({ env, memoryDb: !process.env.TEST_DATABASE_URL, startJobs: false, log: createLogger('error', true) });
  http = createApp(app);
});

afterAll(async () => {
  await shutdown(app);
});

describe('authentication & request protection', () => {
  it('rejects unauthenticated API access', async () => {
    expect((await http.request('/api/meta')).status).toBe(401);
    expect((await http.request('/api/health')).status).toBe(200);
  });

  it('requires the CSRF header on state-changing requests', async () => {
    const res = await http.request('/api/auth/demo-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ANALYST }) });
    expect(res.status).toBe(403);
    const cross = await http.request('/api/auth/demo-login', { method: 'POST', headers: { ...H, origin: 'https://evil.example' }, body: JSON.stringify({ email: ANALYST }) });
    expect(cross.status).toBe(403);
  });

  it('signs in with a password, rejects wrong passwords and locks after repeated failures', async () => {
    resetRateLimits();
    const ok = await http.request('/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'demo.editor@veolia.example', password: DEMO_PW }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    for (let i = 0; i < 5; i++) {
      const bad = await http.request('/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'demo.executive@veolia.example', password: 'wrong-password' }) });
      expect(bad.status).toBe(401);
    }
    const locked = await http.request('/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'demo.executive@veolia.example', password: DEMO_PW }) });
    expect(locked.status).toBe(429);
    const failures = await app.db.select().from(auditLogs).where(eq(auditLogs.action, 'auth.login'));
    expect(failures.some((a) => a.outcome === 'failure')).toBe(true);
    expect(JSON.stringify(failures)).not.toContain('wrong-password');
    resetRateLimits();
  });

  it('returns the current user with permissions', async () => {
    const res = await as(ANALYST).get('/api/auth/me');
    const j = (await res.json()) as { user: { role: string }; permissions: string[] };
    expect(j.user.role).toBe('analyst');
    expect(j.permissions).toContain('recommendations.manage');
    expect(j.permissions).not.toContain('users.manage');
  });
});

describe('RBAC enforced server-side', () => {
  it('blocks administration for non-admin roles', async () => {
    expect((await as(EXEC).get('/api/admin/overview')).status).toBe(403);
    expect((await as(ANALYST).get('/api/admin/overview')).status).toBe(403);
    expect((await as(ADMIN).get('/api/admin/overview')).status).toBe(200);
  });

  it('lets editors comment but not change recommendation status', async () => {
    const [rec] = await app.db.select().from(recommendations).limit(1);
    expect((await as(EDITOR).send('PATCH', `/api/insights/recommendations/${rec.id}`, { status: 'approved' })).status).toBe(403);
    expect((await as(EDITOR).send('POST', `/api/insights/recommendations/${rec.id}/comments`, { body: 'Looks right' })).status).toBe(201);
    expect((await as(EXEC).send('POST', `/api/insights/recommendations/${rec.id}/comments`, { body: 'x' })).status).toBe(403);
    expect((await as(EDITOR).get('/api/insights/assignees')).status).toBe(403);
    const assignees = (await (await as(ANALYST).get('/api/insights/assignees')).json()) as Array<Record<string, unknown>>;
    expect(assignees.length).toBeGreaterThan(0);
    expect(assignees.every((a) => !('email' in a))).toBe(true);
    const ok = await as(ANALYST).send('PATCH', `/api/insights/recommendations/${rec.id}`, { status: 'under_review' });
    expect(ok.status).toBe(200);
    const detail = (await (await as(ANALYST).get(`/api/insights/recommendations/${rec.id}`)).json()) as { history: Array<{ field: string }>; comments: unknown[] };
    expect(detail.history.some((h) => h.field === 'status')).toBe(true);
    expect(detail.comments.length).toBeGreaterThan(0);
  });

  it('enforces per-user module restrictions on routes and on the semantic layer', async () => {
    const users = (await (await as(ADMIN).get('/api/admin/users')).json()) as Array<{ id: string; email: string }>;
    const exec = users.find((u) => u.email === EXEC)!;
    expect((await as(ADMIN).send('PATCH', `/api/admin/users/${exec.id}`, { scopes: { modules: ['web'] } })).status).toBe(200);
    try {
      expect((await as(EXEC).get('/api/ads/pacing')).status).toBe(403);
      expect((await as(EXEC).get('/api/web/pages')).status).toBe(200);
      const q = await as(EXEC).send('POST', '/api/analytics/query', { metrics: ['sessions', 'ads_spend'], from: '2026-09-01', to: '2026-09-30', compare: 'none' });
      const j = (await q.json()) as { results: Array<{ metric: string; value: number | null; meta: { mode: string; notes: Array<{ code: string }> } }> };
      expect(j.results.find((r) => r.metric === 'sessions')!.value).not.toBeNull();
      const ads = j.results.find((r) => r.metric === 'ads_spend')!;
      expect(ads.value).toBeNull();
      expect(ads.meta.notes[0].code).toBe('module_restricted');
    } finally {
      await as(ADMIN).send('PATCH', `/api/admin/users/${exec.id}`, { scopes: {} });
    }
  });

  it('prevents admins from creating super administrators', async () => {
    const res = await as(ADMIN).send('POST', '/api/admin/users', { email: 'new.super@veolia.example', name: 'X', role: 'super_admin' });
    expect(res.status).toBe(403);
  });

  it('restricts a website-scoped user to their website', async () => {
    const q = { metrics: ['sessions'], from: '2026-09-19', to: '2026-10-18' };
    const scoped = (await (await as(FR_EDITOR).send('POST', '/api/analytics/query', q)).json()) as { results: Array<{ value: number }> };
    const fr = (await (await as(ANALYST).send('POST', '/api/analytics/query', { ...q, filters: { site: ['veolia-fr'] } })).json()) as { results: Array<{ value: number }> };
    expect(scoped.results[0].value).toBe(fr.results[0].value);
    const meta = (await (await as(FR_EDITOR).get('/api/meta')).json()) as { sites: Array<{ key: string }> };
    expect(meta.sites.map((x) => x.key)).toEqual(['veolia-fr']);
  });
});

describe('secrets and integrations', () => {
  it('stores secrets write-only and never returns them', async () => {
    const list = (await (await as(ADMIN).get('/api/admin/integrations')).json()) as Array<{ id: string; provider: string; hasSecret: boolean; secretCiphertext?: string }>;
    const ga4 = list.find((x) => x.provider === 'ga4')!;
    const put = await as(ADMIN).send('PUT', `/api/admin/integrations/${ga4.id}/secret`, { values: { serviceAccountJson: '{"client_email":"x@y.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----TOPSECRET-----END PRIVATE KEY-----"}' } });
    expect(put.status).toBe(200);
    const after = await (await as(ADMIN).get('/api/admin/integrations')).text();
    expect(after).not.toContain('TOPSECRET');
    expect(after).not.toContain('secretCiphertext');
    const parsed = JSON.parse(after) as typeof list;
    expect(parsed.find((x) => x.id === ga4.id)!.hasSecret).toBe(true);
    const audits = await app.db.select().from(auditLogs).where(eq(auditLogs.action, 'integration.secret.set'));
    expect(JSON.stringify(audits)).not.toContain('TOPSECRET');
    const [row] = await app.db.select().from(dataConnections).where(eq(dataConnections.id, ga4.id));
    expect(row.secretCiphertext).toMatch(/^v1\./);
    expect(row.status).not.toBe('connected');
  });

  it('never marks a connection connected without a successful sync', async () => {
    const list = (await (await as(ADMIN).get('/api/admin/integrations')).json()) as Array<{ id: string; provider: string; status: string }>;
    const x = list.find((c) => c.provider === 'x')!;
    await as(ADMIN).send('PATCH', `/api/admin/integrations/${x.id}`, { mode: 'api' });
    const after = (await (await as(ADMIN).get('/api/admin/integrations')).json()) as typeof list;
    expect(after.find((c) => c.id === x.id)!.status).toBe('not_configured');
    const sync = await as(ADMIN).send('POST', `/api/admin/integrations/${x.id}/sync`, {});
    expect(sync.status).toBe(409);
    expect((await as(ANALYST).send('POST', `/api/admin/integrations/${x.id}/sync`, {})).status).toBe(403);
  });
});

describe('module endpoints', () => {
  it('labels recommendations built on the demo crawl snapshot as demo, never connected', async () => {
    const rows = await app.db.select().from(recommendations).where(eq(recommendations.ruleKey, 'seo_high_issues'));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) for (const e of r.evidence) expect(e.mode).toBe('demo');
  });

  const endpoints = [
    '/api/meta',
    '/api/web/pages',
    '/api/web/quality',
    '/api/social/posts?platform=linkedin&sort=rate',
    '/api/social/compare?by=format',
    '/api/social/timing?platform=linkedin',
    '/api/social/accounts',
    '/api/seo/keywords',
    '/api/seo/queries',
    '/api/seo/pages',
    '/api/seo/issues',
    '/api/seo/crawls',
    '/api/seo/competitors',
    '/api/geo/prompts',
    '/api/geo/measurements',
    '/api/geo/summary',
    '/api/geo/opportunities',
    '/api/geo/vs-seo',
    '/api/ads/structure',
    '/api/ads/pacing',
    '/api/ads/landing-pages',
    '/api/ads/conversions',
    '/api/content/catalog',
    '/api/insights/summary',
    '/api/insights/recommendations',
    '/api/insights/alerts',
    '/api/notifications',
    '/api/reports/templates',
    '/api/me/views',
    '/api/me/search?q=pfas',
  ];
  for (const e of endpoints) {
    it(`GET ${e}`, async () => {
      const res = await as(EXEC).get(e);
      expect(res.status, await res.clone().text()).toBe(200);
    });
  }

  it('executive summary separates changes, drivers, attention, actions and limitations', async () => {
    const s = (await (await as(EXEC).get('/api/insights/summary')).json()) as { changed: unknown[]; limitations: Array<{ text: { en: string } }>; modes: string[] };
    expect(s.changed.length).toBeGreaterThan(0);
    expect(s.modes).toContain('demo');
    expect(s.limitations.some((l) => l.text.en.includes('DEMO'))).toBe(true);
  });

  it('social timing withholds a best-time suggestion when the sample is too small', async () => {
    const j = (await (await as(EXEC).get('/api/social/timing?platform=youtube&from=2026-10-01&to=2026-10-18')).json()) as { recommendation: unknown; reason: string };
    expect(j.recommendation).toBeNull();
    expect(j.reason).toBe('insufficient_posts');
  });

  it('ads conversions keep platform and GA4 figures separate', async () => {
    const j = (await (await as(EXEC).get('/api/ads/conversions')).json()) as { platform: { value: number }; ga4: { value: number } };
    expect(j.platform.value).toBeGreaterThan(0);
    expect(j.ga4.value).toBeGreaterThan(0);
    expect(j).not.toHaveProperty('total');
  });

  it('uses the registry for account names, reported metrics and derived dimensions', async () => {
    const accounts = (await (await as(ADMIN).get('/api/admin/social-accounts')).json()) as Array<{ id: string; key: string; name: string; language: 'en' | 'fr'; metrics: string[] }>;
    const li = accounts.find((a) => a.key === 'li-fr')!;
    const q = { metrics: ['social_impressions'], from: '2026-09-01', to: '2026-09-30', compare: 'none', groupBy: 'account', filters: { language: ['fr'] } };
    const keys = async () => ((await (await as(ANALYST).send('POST', '/api/analytics/query', q)).json()) as { results: Array<{ rows: Array<{ key: string }> }> }).results[0].rows.map((r) => r.key);
    expect(await keys()).toContain('li-fr');
    expect((await as(ADMIN).send('PATCH', `/api/admin/social-accounts/${li.id}`, { name: 'Veolia France (renamed)', language: 'en', metrics: ['followers', 'social_posts'] })).status).toBe(200);
    expect(await keys()).not.toContain('li-fr');
    const social = (await (await as(ANALYST).get('/api/social/accounts?from=2026-09-01&to=2026-09-30')).json()) as { accounts: Array<{ key: string; name: string; reported: string[] }> };
    expect(social.accounts.find((a) => a.key === 'li-fr')).toMatchObject({ name: 'Veolia France (renamed)', reported: ['followers', 'social_posts'] });
    await as(ADMIN).send('PATCH', `/api/admin/social-accounts/${li.id}`, { name: li.name, language: li.language, metrics: li.metrics });
    expect(await keys()).toContain('li-fr');
  });

  it('another instance rebuilds its dataset after a change saved elsewhere', async () => {
    const other = new AnalyticsService({ db: app.db, orgId: app.orgId, envDemoMode: app.env.DEMO_MODE, versionCheckMs: 0 });
    const before = await other.dataset();
    expect(await other.dataset()).toBe(before);
    app.analytics.invalidate();
    await app.analytics.dataset();
    expect(await other.dataset()).not.toBe(before);
  });

  it('global search finds content, keywords and prompts', async () => {
    const j = (await (await as(ANALYST).get('/api/me/search?q=pfas')).json()) as { results: Array<{ type: string }> };
    const types = new Set(j.results.map((r) => r.type));
    expect(types.has('keyword')).toBe(true);
    expect(types.has('content')).toBe(true);
  });

  it('saved views and favorites round-trip', async () => {
    const v = await as(EDITOR).send('POST', '/api/me/views', { name: 'My view', route: '/web', state: { preset: 'last7' } });
    expect(v.status).toBe(201);
    const shared = await as(EDITOR).send('POST', '/api/me/views', { name: 'Shared', route: '/web', state: {}, shared: true });
    expect(shared.status).toBe(403);
    const f = await as(EDITOR).send('POST', '/api/me/favorites', { kind: 'page', ref: '/seo', label: 'SEO' });
    expect(f.status).toBe(201);
  });
});

describe('reports & exports', () => {
  for (const format of ['pdf', 'xlsx', 'csv'] as const) {
    it(`generates and downloads a ${format.toUpperCase()} report with metadata`, async () => {
      const tpl = ((await (await as(ANALYST).get('/api/reports/templates')).json()) as Array<{ id: string; type: string }>).find((t) => t.type === 'executive')!;
      const gen = await as(ANALYST).send('POST', '/api/reports/generate', { templateId: tpl.id, format });
      expect(gen.status, await gen.clone().text()).toBe(201);
      const run = (await gen.json()) as { id: string };
      const dl = await as(EXEC).get(`/api/reports/runs/${run.id}/download`);
      expect(dl.status).toBe(200);
      const buf = Buffer.from(await dl.arrayBuffer());
      if (format === 'pdf') expect(buf.subarray(0, 4).toString()).toBe('%PDF');
      if (format === 'xlsx') expect(buf.subarray(0, 2).toString()).toBe('PK');
      if (format === 'csv') {
        const text = buf.toString('utf8');
        expect(text.charCodeAt(0)).toBe(0xfeff);
        expect(text).toContain('DEMO');
        expect(text).toContain('Europe/Paris');
      }
    });
  }

  it('executive report keeps the seven-part structure, even when sections are narrowed', async () => {
    const res = await as(ANALYST).send('POST', '/api/reports/preview', { type: 'executive', config: { sections: ['ads'], commentary: 'Board note', language: 'en' } });
    expect(res.status).toBe(200);
    const c = (await res.json()) as { sections: Array<{ id: string; title: string; items?: unknown[]; quote?: { body: string }; appendix?: boolean }> };
    expect(c.sections.map((x) => x.id)).toEqual(['exec_summary', 'commentary', 'highlights', 'changes', 'drivers', 'risks', 'actions', 'limitations', 'ads']);
    expect(c.sections.find((x) => x.id === 'commentary')?.quote?.body).toBe('Board note');
    expect(c.sections.find((x) => x.id === 'ads')?.appendix).toBe(true);
    const lim = c.sections.find((x) => x.id === 'limitations')!;
    expect(JSON.stringify(lim.items)).toContain('DEMO');
  });

  it('builds a GEO visibility report from the monitored sample', async () => {
    const res = await as(ANALYST).send('POST', '/api/reports/preview', { type: 'geo', config: { language: 'en' } });
    const c = (await res.json()) as { sections: Array<{ id: string; tables?: Array<{ rows: unknown[] }> }>; dataModes: string[] };
    expect(c.sections.find((x) => x.id === 'geo_topics')!.tables![0].rows.length).toBeGreaterThan(0);
    expect(c.dataModes).toContain('demo');
    expect((await as(EXEC).send('POST', '/api/reports/preview', { type: 'geo' })).status).toBe(403);
  });

  it('accepts quarterly schedules', async () => {
    const tpl = ((await (await as(ANALYST).get('/api/reports/templates')).json()) as Array<{ id: string }>)[0];
    const res = await as(ANALYST).send('POST', '/api/reports/schedules', { templateId: tpl.id, name: 'Quarterly review', frequency: { kind: 'quarterly', day: 3, time: '08:00' }, format: 'pdf', recipients: [] });
    expect(res.status).toBe(201);
    const row = (await res.json()) as { nextRunAt: string };
    const next = new Date(row.nextRunAt);
    expect([0, 3, 6, 9]).toContain(next.getUTCMonth());
  });

  it('executive viewers cannot generate reports', async () => {
    expect((await as(EXEC).send('POST', '/api/reports/generate', { type: 'website', format: 'csv' })).status).toBe(403);
  });

  it('scheduled delivery is recorded as not sent without an e-mail provider', async () => {
    const schedules = (await (await as(ANALYST).get('/api/reports/schedules')).json()) as Array<{ id: string }>;
    const res = (await (await as(ANALYST).send('POST', `/api/reports/schedules/${schedules[0].id}/run`)).json()) as { delivery: string };
    expect(res.delivery).toBe('not_sent_no_provider');
  });

  it('table exports neutralise spreadsheet formulas', async () => {
    const res = await as(ANALYST).send('POST', '/api/exports/table', { format: 'csv', title: 'Test', columns: [{ key: 'a', label: 'A' }], rows: [{ a: '=HYPERLINK("x")' }, { a: 12 }] });
    const text = await res.text();
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('SEO crawl authorisation', () => {
  it('refuses to crawl a scope that has not been authorised', async () => {
    const scopes = (await (await as(ADMIN).get('/api/seo/crawl-scopes')).json()) as Array<{ id: string }>;
    const res = await as(ADMIN).send('POST', '/api/seo/crawls', { scopeId: scopes[0].id });
    expect(res.status).toBe(403);
    expect((await as(EDITOR).send('POST', '/api/seo/crawls', { scopeId: scopes[0].id })).status).toBe(403);
  });

  it('only authorises monitored hosts and requires explicit confirmation', async () => {
    const created = await as(ADMIN).send('POST', '/api/admin/crawl-scopes', { websiteKey: 'veolia-en', name: 'External', allowedHosts: ['www.example.com'], startUrls: ['https://www.example.com/'] });
    const scope = (await created.json()) as { id: string };
    const bad = await as(ADMIN).send('POST', `/api/admin/crawl-scopes/${scope.id}/authorize`, { authorized: true, confirmation: 'AUTHORISE' });
    expect(bad.status).toBe(422);
    const scopes = (await (await as(ADMIN).get('/api/seo/crawl-scopes')).json()) as Array<{ id: string; allowedHosts: string[] }>;
    const veolia = scopes.find((x) => x.allowedHosts.includes('www.veolia.com'))!;
    const noConfirm = await as(ADMIN).send('POST', `/api/admin/crawl-scopes/${veolia.id}/authorize`, { authorized: true });
    expect(noConfirm.status).toBe(422);
  });

  it('issue workflow records history', async () => {
    const issues = (await (await as(EDITOR).get('/api/seo/issues?status=open')).json()) as { items: Array<{ id: string }> };
    const id = issues.items[0].id;
    expect((await as(EDITOR).send('PATCH', `/api/seo/issues/${id}`, { status: 'in_progress', comment: 'Taking this' })).status).toBe(200);
    const hist = (await (await as(EDITOR).get(`/api/seo/issues/${id}/history`)).json()) as Array<{ action: string }>;
    expect(hist.some((h) => h.action === 'status')).toBe(true);
    expect((await as(EXEC).send('PATCH', `/api/seo/issues/${id}`, { status: 'resolved' })).status).toBe(403);
  });
});

describe('imports and webhooks (run last: they introduce real data)', () => {
  it('imports a CSV, rejects invalid rows with reasons and switches the source to connected data', async () => {
    const csv = ['date,site,form,submissions', '2026-10-01,veolia-fr,contact,12', '2026-10-02,veolia-fr,contact,-3', '2026-10-02,veolia-xx,contact,4', '2026-10-03,veolia-fr,contact,9', '2026-10-01,veolia-fr,contact,1'].join('\n');
    const fd = new FormData();
    fd.set('dataset', 'forms');
    fd.set('file', new File([csv], 'forms.csv', { type: 'text/csv' }));
    const res = await http.request('/api/admin/imports', { method: 'POST', headers: { 'x-vdi-request': '1', cookie: await login(ADMIN) }, body: fd });
    expect(res.status, await res.clone().text()).toBe(201);
    const j = (await res.json()) as { id: string; status: string; accepted: number; rejected: number };
    expect(j).toMatchObject({ status: 'partial', accepted: 2, rejected: 3 });
    const rej = await (await as(ADMIN).get(`/api/admin/imports/${j.id}/rejected.csv`)).text();
    expect(rej).toContain('non-negative');
    expect(rej).toContain('unknown site');
    expect(rej).toContain('duplicate');
    const q = (await (await as(ANALYST).send('POST', '/api/analytics/query', { metrics: ['form_submissions', 'form_tracking_coverage'], from: '2026-10-01', to: '2026-10-03', compare: 'none' })).json()) as { results: Array<{ value: number | null; meta: { mode: string; notes: Array<{ code: string; params?: Record<string, unknown> }> } }> };
    expect(q.results[0].value).toBe(21);
    expect(['connected', 'partial']).toContain(q.results[0].meta.mode);
    // GA4 (demo) ÷ Drupal (real) would mix origins → refused rather than computed
    expect(q.results[1].value).toBeNull();
    expect(q.results[1].meta.notes.some((n) => n.params?.reason === 'mixed_origins')).toBe(true);
  });

  it('previews an import and never overwrites existing rows without explicit confirmation', async () => {
    const csv = ['date,site,form,submissions,unexpected', '2026-10-01,veolia-fr,contact,30,x', '2026-10-03,veolia-fr,contact,5,y'].join('\n');
    const post = async (extra: Record<string, string>) => {
      const fd = new FormData();
      fd.set('dataset', 'forms');
      fd.set('file', new File([csv], 'forms2.csv', { type: 'text/csv' }));
      for (const [k, v] of Object.entries(extra)) fd.set(k, v);
      return http.request('/api/admin/imports', { method: 'POST', headers: { 'x-vdi-request': '1', cookie: await login(ADMIN) }, body: fd });
    };
    const dry = (await (await post({ dryRun: 'true' })).json()) as { existingRows: number; schema: { unknownColumns: string[] }; preview: unknown[]; mapping: unknown[] };
    expect(dry.existingRows).toBeGreaterThan(0);
    expect(dry.schema.unknownColumns).toContain('unexpected');
    expect(dry.preview.length).toBe(2);
    expect(dry.mapping.length).toBeGreaterThan(0);
    const refused = await post({});
    expect(refused.status).toBe(409);
    const ok = await post({ replace: 'true', confirmReplace: 'true' });
    expect(ok.status).toBe(201);
  });

  it('refuses demo sign-in once real data is connected', async () => {
    const cfg = (await (await http.request('/api/auth/config')).json()) as { demoLogin: boolean };
    expect(cfg.demoLogin).toBe(false);
    const res = await http.request('/api/auth/demo-login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'demo.analyst@veolia.example' }) });
    expect(res.status).toBe(403);
  });

  it('accepts only correctly signed Drupal webhooks and stores no personal data', async () => {
    const list = (await (await as(ADMIN).get('/api/admin/integrations')).json()) as Array<{ id: string; provider: string; config: { site?: string } }>;
    const conn = list.find((c) => c.provider === 'drupal' && c.config.site === 'veolia-en')!;
    await as(ADMIN).send('PATCH', `/api/admin/integrations/${conn.id}`, { mode: 'webhook' });
    await as(ADMIN).send('PUT', `/api/admin/integrations/${conn.id}/secret`, { values: { webhookSecret: 'shh-secret' } });
    const payload = JSON.stringify({ form_id: 'contact', submitted_at: '2026-10-05T10:00:00+02:00', email: 'person@example.com', message: 'hello' });
    const ts = String(Math.floor(Date.now() / 1000));
    const bad = await http.request(`/api/ingest/drupal/${conn.id}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vdi-timestamp': ts, 'x-vdi-signature': 'sha256=deadbeef' }, body: payload });
    expect(bad.status).toBe(401);
    const good = await http.request(`/api/ingest/drupal/${conn.id}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vdi-timestamp': ts, 'x-vdi-signature': signDrupal('shh-secret', ts, payload) }, body: payload });
    expect(good.status).toBe(200);
    const { factRows } = await import('./db/schema');
    const rows = await app.db.select().from(factRows).where(eq(factRows.connectionId, conn.id));
    expect(JSON.stringify(rows)).not.toContain('person@example.com');
    expect(rows[0].measures.submissions).toBe(1);
  });
});

describe('scheduled jobs and GEO activation (run last: they introduce real GEO data)', () => {
  const SUPER = 'admin@veolia.example';
  const superAdmin = async () => {
    resetRateLimits();
    const res = await http.request('/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: SUPER, password: 'Super-Admin-Passw0rd!' }) });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie')!.split(';')[0];
    return (method: string, path: string, body?: unknown) => http.request(path, { method, headers: { ...H, cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  };

  it('adds the GEO and crawl schedules disabled, and re-enabling starts from the next slot', async () => {
    const sys = (await (await as(ADMIN).get('/api/admin/system')).json()) as { schedules: Array<{ id: string; jobType: string; enabled: boolean; nextRunAt: string; frequencyLabel: { en: string } }> };
    const geo = sys.schedules.find((x) => x.jobType === 'geo.measure_all')!;
    const crawl = sys.schedules.find((x) => x.jobType === 'seo.crawl_all')!;
    expect(geo.enabled).toBe(false);
    expect(crawl.enabled).toBe(false);
    expect(geo.frequencyLabel.en).toBe('Every Monday at 06:00');
    expect((await as(ADMIN).send('PATCH', `/api/admin/system/schedules/${geo.id}`, { enabled: true })).status).toBe(200);
    const after = (await (await as(ADMIN).get('/api/admin/system')).json()) as typeof sys;
    expect(new Date(after.schedules.find((x) => x.id === geo.id)!.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    await as(ADMIN).send('PATCH', `/api/admin/system/schedules/${geo.id}`, { enabled: false });
    // nothing is sent while no provider is connected and approved
    expect(await measureAllGeo(app)).toEqual({ queued: 0, reason: 'no_connected_provider' });
    const res = await queueAuthorisedCrawls(app);
    const queued = await app.db.select().from(jobs).where(eq(jobs.type, 'crawl.run'));
    expect(res.queued).toBeLessThanOrEqual(Number(res.authorisedScopes));
    expect(queued.length).toBeGreaterThanOrEqual(Number(res.queued));
  });

  it('measures GEO prompts only in API mode with a key, a model and a super administrator approval', async () => {
    const list = async () => (await (await as(ADMIN).get('/api/admin/integrations')).json()) as Array<{ id: string; provider: string; status: string; geo: { blocker: string | null; approval: { approvedByName: string } | null } | null }>;
    const conn = (await list()).find((c) => c.provider === 'geo_perplexity')!;
    expect(conn.geo!.blocker).toBe('not_api_mode');
    const measure = () => as(ADMIN).send('POST', '/api/geo/measure', { provider: 'geo_perplexity' });
    const refused = await measure();
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { error: { details: { blocker: string } } }).error.details.blocker).toBe('not_api_mode');

    // the approval cannot be written through the generic configuration route
    await as(ADMIN).send('PATCH', `/api/admin/integrations/${conn.id}`, { mode: 'api', config: { model: 'sonar', processingApproval: { approvedAt: '2026-01-01T00:00:00Z' } } });
    await as(ADMIN).send('PUT', `/api/admin/integrations/${conn.id}/secret`, { values: { apiKey: 'pplx-test-key' } });
    expect((await list()).find((c) => c.id === conn.id)!.geo!.blocker).toBe('not_approved');
    expect((await measure()).status).toBe(409);

    // approval needs the super administrator and the typed confirmation
    expect((await as(ADMIN).send('POST', `/api/admin/integrations/${conn.id}/approval`, { approved: true, confirmation: 'APPROVE' })).status).toBe(403);
    const sa = await superAdmin();
    expect((await sa('POST', `/api/admin/integrations/${conn.id}/approval`, { approved: true })).status).toBe(422);
    expect((await sa('POST', `/api/admin/integrations/${conn.id}/approval`, { approved: true, confirmation: 'APPROVE' })).status).toBe(200);
    const approved = (await list()).find((c) => c.id === conn.id)!;
    expect(approved.geo).toMatchObject({ blocker: null, approval: { approvedByName: expect.any(String) } });
    expect(approved.status).not.toBe('connected');
    const meta = (await (await as(ANALYST).get('/api/meta')).json()) as { connections: Array<{ provider: string; measurable?: boolean; config?: unknown }> };
    const metaConn = meta.connections.find((c) => c.provider === 'geo_perplexity')!;
    expect(metaConn.measurable).toBe(true);
    expect(metaConn.config).toBeUndefined();
    expect((await measure()).status).toBe(202);

    // a real answer (stubbed here) is what makes the provider Connected
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ model: 'sonar', choices: [{ message: { content: 'Veolia and others treat industrial water.' } }], citations: ['https://www.veolia.com/en/solutions'] }), { status: 200 }));
    try {
      expect(await runGeoMeasurements(app, conn.id, ['p01'])).toEqual({ completed: 1, failed: 0 });
      expect(String(fetchSpy.mock.calls[0][0])).toBe('https://api.perplexity.ai/chat/completions');
    } finally {
      fetchSpy.mockRestore();
    }
    const [row] = await app.db.select().from(dataConnections).where(eq(dataConnections.id, conn.id));
    const execs = await app.db.select().from(syncExecutions).where(eq(syncExecutions.connectionId, conn.id));
    const stored = await app.db.select().from(geoMeasurements).where(eq(geoMeasurements.origin, 'api'));
    expect(row.status).toBe('connected');
    expect(execs.find((e) => e.kind === 'measure')).toMatchObject({ status: 'succeeded', rowsWritten: 1 });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ promptKey: 'p01', provider: 'perplexity_api', status: 'completed', mentioned: true, cited: true });

    // revoking stops further measurements
    expect((await sa('POST', `/api/admin/integrations/${conn.id}/approval`, { approved: false })).status).toBe(200);
    expect((await list()).find((c) => c.id === conn.id)!.geo!.blocker).toBe('not_approved');
    expect((await measure()).status).toBe(409);
  });
});
