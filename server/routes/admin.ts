/** Administration API (all routes require admin.view; mutations require specific permissions and are audited). */
import { Hono } from 'hono';
import { and, asc, desc, eq, gte, ilike, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { EVENTS } from '@shared/catalog';
import { METRICS, getMetric } from '@shared/metrics';
import { APP_MODULES, ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS, PERMISSIONS, assignableRoles, type Role } from '@shared/rbac';
import { requirePermission } from '../auth/middleware';
import { audit } from '../audit';
import { destroyUserSessions } from '../auth/session';
import { HttpError, currentUser, type HonoEnv, type Ctx } from '../context';
import * as s from '../db/schema';
import { hashPassword, passwordPolicyError } from '../security/crypto';
import { CONNECTORS } from '../connectors/registry';
import { testConnection } from '../connectors/sync';
import { GEO_API_PROVIDERS, GEO_APPROVAL_KEY, geoMeasureBlocker } from '../connectors/geo';
import { describeFrequency, nextRun, type Frequency } from '../jobs/schedule';
import { warehouseTableCounts } from '../analytics/warehouse';
import { TABLE_SCHEMAS as TABLES } from '../analytics/tables';
import { IMPORT_SPECS, ImportConflict, runImport, templateCsv } from '../imports/import';
import { csvEscape } from '../reports/render';
import { evaluateAlertRules } from '../insights/alerts';
import { aiStatus } from '../ai/provider';
import { body, notFound, uuidParam } from './util';
import { DEFAULT_EXECUTIVE_LAYOUT } from '../db/seed';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const WIDGET_TYPES = ['kpi_grid', 'evolution', 'channels', 'geography', 'content_snapshot', 'alerts', 'ai_summary', 'targets'] as const;

/** Dimensions a metric can be broken down or filtered by (union over its tables; intersection for ratios). */
function metricDimensions(id: string, depth = 0): string[] {
  const m = getMetric(id);
  if (!m || depth > 4) return [];
  const a = m.agg;
  if ('tables' in a) return [...new Set(a.tables.flatMap((t) => TABLES[t]?.dims ?? []))];
  if (a.kind === 'ratio') return metricDimensions(a.num, depth + 1).filter((d) => metricDimensions(a.den, depth + 1).includes(d));
  if (a.kind === 'diff') return metricDimensions(a.a, depth + 1).filter((d) => metricDimensions(a.b, depth + 1).includes(d));
  return [];
}

export function adminRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('admin.view'));

  /* ---------- overview ---------- */
  r.get('/overview', async (c) => {
    const app = c.get('app');
    const db = app.db;
    const [usersByRole, conns, openAlerts, failedJobs, lastImports, recentAudit] = await Promise.all([
      db.select({ role: s.users.role, status: s.users.status, n: sql<number>`count(*)::int` }).from(s.users).groupBy(s.users.role, s.users.status),
      db.select({ provider: s.dataConnections.provider, name: s.dataConnections.name, status: s.dataConnections.status, mode: s.dataConnections.mode, lastSuccessAt: s.dataConnections.lastSuccessAt, lastError: s.dataConnections.lastError }).from(s.dataConnections),
      db.select({ severity: s.alertEvents.severity, n: sql<number>`count(*)::int` }).from(s.alertEvents).where(inArray(s.alertEvents.status, ['open', 'acknowledged'])).groupBy(s.alertEvents.severity),
      db.select({ n: sql<number>`count(*)::int` }).from(s.jobs).where(and(eq(s.jobs.status, 'failed'), gte(s.jobs.createdAt, new Date(Date.now() - 86_400_000)))),
      db.select().from(s.imports).orderBy(desc(s.imports.createdAt)).limit(5),
      db.select().from(s.auditLogs).orderBy(desc(s.auditLogs.createdAt)).limit(8),
    ]);
    const ds = await app.analytics.dataset();
    return c.json({
      usersByRole,
      connections: conns,
      openAlerts,
      failedJobs24h: Number(failedJobs[0]?.n ?? 0),
      lastImports: lastImports.map(({ rejected: _r, ...x }) => x),
      recentAudit,
      demoMode: ds.demoEnabled,
      emailConfigured: app.env.smtpConfigured,
      encryptionConfigured: app.secrets.available,
      ai: await aiStatus(app),
    });
  });

  /* ---------- organisation ---------- */
  r.get('/org', async (c) => {
    const app = c.get('app');
    const [org] = await app.db.select().from(s.organizations).where(eq(s.organizations.id, app.orgId));
    return c.json({ ...org, envDemoMode: app.env.DEMO_MODE });
  });

  r.patch('/org', requirePermission('org.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(
      c,
      z.object({
        name: z.string().trim().min(2).max(120).optional(),
        timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'Unknown time zone').optional(),
        defaultLanguage: z.enum(['en', 'fr']).optional(),
        currency: z.string().regex(/^[A-Z]{3}$/).optional(),
        demoMode: z.boolean().optional(),
        settings: z
          .object({
            appName: z.string().trim().min(2).max(80).optional(),
            supportedLanguages: z.array(z.enum(['en', 'fr'])).min(1).optional(),
            dateFormat: z.enum(['locale', 'iso']).optional(),
            numberLocale: z.enum(['fr-FR', 'en-GB', 'en-US']).optional(),
            defaultPeriod: z.enum(['last7', 'last30', 'last90', 'mtd', 'qtd', 'ytd', 'prevMonth', 'prevQuarter', 'prevYear']).optional(),
            defaultCompare: z.enum(['previous', 'yoy', 'none']).optional(),
            defaultTheme: z.enum(['light', 'dark', 'system']).optional(),
            fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
            weekStartsOn: z.number().int().min(0).max(6).optional(),
            dataRetentionMonths: z.number().int().min(3).max(120).optional(),
            auditRetentionMonths: z.number().int().min(6).max(120).optional(),
            reportRetentionDays: z.number().int().min(7).max(3650).optional(),
            geoRetentionMonths: z.number().int().min(3).max(120).optional(),
          })
          .optional(),
      }),
    );
    const [cur] = await app.db.select().from(s.organizations).where(eq(s.organizations.id, app.orgId));
    const { settings, ...rest } = d;
    await app.db.update(s.organizations).set({ ...rest, ...(settings ? { settings: { ...cur.settings, ...settings } } : {}), updatedAt: new Date() }).where(eq(s.organizations.id, app.orgId));
    // demo mode, currency and conversion settings feed the analytics layer on every instance
    app.analytics.invalidate();
    await audit(c, { action: 'org.update', entityType: 'organization', entityId: app.orgId, details: d });
    return c.json({ ok: true });
  });

  r.post('/org/logo', requirePermission('org.manage'), async (c) => {
    const app = c.get('app');
    const { dataUrl } = await body(c, z.object({ dataUrl: z.string().max(700_000) }));
    const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) throw new HttpError(422, 'Logo must be a PNG, JPEG or WebP image (SVG is not accepted)', 'validation');
    const bytes = Buffer.from(m[3], 'base64');
    const magic = { png: bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), jpeg: bytes[0] === 0xff && bytes[1] === 0xd8, webp: bytes.subarray(8, 12).toString('ascii') === 'WEBP' }[m[2] as 'png' | 'jpeg' | 'webp'];
    if (!magic || bytes.length > 500_000) throw new HttpError(422, 'Invalid image file (max 500 KB)', 'validation');
    await app.db.update(s.organizations).set({ logoDataUrl: dataUrl, updatedAt: new Date() }).where(eq(s.organizations.id, app.orgId));
    await audit(c, { action: 'org.logo.update', details: { bytes: bytes.length, type: m[1] } });
    return c.json({ ok: true });
  });

  r.delete('/org/logo', requirePermission('org.manage'), async (c) => {
    const app = c.get('app');
    await app.db.update(s.organizations).set({ logoDataUrl: null }).where(eq(s.organizations.id, app.orgId));
    await audit(c, { action: 'org.logo.delete' });
    return c.json({ ok: true });
  });

  /* ---------- users & roles ---------- */
  r.get('/roles', (c) => c.json({ roles: ROLES.map((role) => ({ id: role, label: ROLE_LABELS[role], description: ROLE_DESCRIPTIONS[role], permissions: [...ROLE_PERMISSIONS[role]] })), permissions: PERMISSIONS, assignable: assignableRoles(currentUser(c).role) }));

  r.get('/users', async (c) => {
    const rows = await c.get('app').db.select({ id: s.users.id, email: s.users.email, name: s.users.name, role: s.users.role, status: s.users.status, language: s.users.language, scopes: s.users.scopes, isDemo: s.users.isDemo, lastLoginAt: s.users.lastLoginAt, createdAt: s.users.createdAt, hasPassword: sql<boolean>`${s.users.passwordHash} is not null`, lockedUntil: s.users.lockedUntil }).from(s.users).orderBy(asc(s.users.name));
    return c.json(rows);
  });

  const userSchema = z.object({
    email: z.string().email().max(200),
    name: z.string().trim().min(1).max(120),
    role: z.enum(ROLES),
    language: z.enum(['en', 'fr']).default('fr'),
    password: z.string().max(256).optional(),
    scopes: z.object({ websites: z.array(z.string().max(60)).max(20).optional(), modules: z.array(z.enum(APP_MODULES)).max(10).optional() }).default({}),
  });

  const guardRole = (actor: Role, target: Role) => {
    if (!assignableRoles(actor).includes(target)) throw new HttpError(403, 'You cannot assign this role', 'forbidden');
  };

  r.post('/users', requirePermission('users.manage'), async (c) => {
    const app = c.get('app');
    const actor = currentUser(c);
    const d = await body(c, userSchema);
    guardRole(actor.role, d.role);
    if (d.password) {
      const err = passwordPolicyError(d.password);
      if (err) throw new HttpError(422, err, 'weak_password');
    }
    const [dup] = await app.db.select({ id: s.users.id }).from(s.users).where(sql`lower(${s.users.email}) = ${d.email.toLowerCase()}`);
    if (dup) throw new HttpError(409, 'A user with this e-mail already exists', 'duplicate');
    const [row] = await app.db.insert(s.users).values({ orgId: app.orgId, email: d.email, name: d.name, role: d.role, language: d.language, scopes: d.scopes, passwordHash: d.password ? await hashPassword(d.password) : null }).returning({ id: s.users.id });
    await audit(c, { action: 'user.create', entityType: 'user', entityId: row.id, details: { email: d.email, role: d.role, scopes: d.scopes, passwordSet: !!d.password } });
    return c.json(row, 201);
  });

  r.patch('/users/:id', requirePermission('users.manage'), async (c) => {
    const app = c.get('app');
    const actor = currentUser(c);
    const id = uuidParam(c);
    const d = await body(c, z.object({ name: z.string().trim().min(1).max(120).optional(), role: z.enum(ROLES).optional(), status: z.enum(['active', 'disabled']).optional(), language: z.enum(['en', 'fr']).optional(), scopes: z.object({ websites: z.array(z.string().max(60)).max(20).optional(), modules: z.array(z.enum(APP_MODULES)).max(10).optional() }).optional(), unlock: z.boolean().optional() }));
    const [target] = await app.db.select().from(s.users).where(eq(s.users.id, id));
    if (!target) notFound('User');
    if (target.role === 'super_admin' && actor.role !== 'super_admin') throw new HttpError(403, 'Only a super administrator can modify a super administrator', 'forbidden');
    if (d.role) guardRole(actor.role, d.role);
    if (id === actor.id && (d.status === 'disabled' || (d.role && d.role !== actor.role))) throw new HttpError(409, 'You cannot disable yourself or change your own role', 'conflict');
    if (target.role === 'super_admin' && (d.status === 'disabled' || (d.role && d.role !== 'super_admin'))) {
      const [{ n }] = await app.db.select({ n: sql<number>`count(*)::int` }).from(s.users).where(and(eq(s.users.role, 'super_admin'), eq(s.users.status, 'active'), ne(s.users.id, id)));
      if (Number(n) === 0) throw new HttpError(409, 'At least one active super administrator is required', 'conflict');
    }
    const { unlock, ...rest } = d;
    await app.db.update(s.users).set({ ...rest, ...(unlock ? { lockedUntil: null, failedLogins: 0 } : {}), updatedAt: new Date() }).where(eq(s.users.id, id));
    if (d.status === 'disabled' || d.role) await destroyUserSessions(app, id);
    await audit(c, { action: d.role && d.role !== target.role ? 'user.role_change' : 'user.update', entityType: 'user', entityId: id, details: { ...d, previousRole: target.role } });
    return c.json({ ok: true });
  });

  r.post('/users/:id/password', requirePermission('users.manage'), async (c) => {
    const app = c.get('app');
    const actor = currentUser(c);
    const id = uuidParam(c);
    const { password } = await body(c, z.object({ password: z.string().max(256) }));
    const [target] = await app.db.select().from(s.users).where(eq(s.users.id, id));
    if (!target) notFound('User');
    if (target.role === 'super_admin' && actor.role !== 'super_admin') throw new HttpError(403, 'Only a super administrator can do this', 'forbidden');
    const err = passwordPolicyError(password);
    if (err) throw new HttpError(422, err, 'weak_password');
    await app.db.update(s.users).set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(s.users.id, id));
    await destroyUserSessions(app, id);
    await audit(c, { action: 'user.password_reset', entityType: 'user', entityId: id });
    return c.json({ ok: true });
  });

  /* ---------- integrations ---------- */
  r.get('/integrations', async (c) => {
    const app = c.get('app');
    const conns = await app.db.select().from(s.dataConnections).orderBy(asc(s.dataConnections.provider), asc(s.dataConnections.name));
    const execs = await app.db.select().from(s.syncExecutions).orderBy(desc(s.syncExecutions.startedAt)).limit(300);
    const [syncSchedule] = await app.db.select().from(s.schedules).where(eq(s.schedules.jobType, 'connectors.sync_all'));
    const [geoSchedule] = await app.db.select().from(s.schedules).where(eq(s.schedules.jobType, 'geo.measure_all'));
    const isGeo = (p: string) => (GEO_API_PROVIDERS as readonly string[]).includes(p);
    return c.json(
      conns.map(({ secretCiphertext, ...cn }) => {
        const geoBlocker = isGeo(cn.provider) ? geoMeasureBlocker({ ...cn, hasSecret: !!secretCiphertext }) : null;
        // only connections the scheduled jobs will actually pick up show a next run
        const scheduled = ['connected', 'degraded'].includes(cn.status) && !!secretCiphertext && cn.mode === 'api';
        const nextSyncAt = isGeo(cn.provider)
          ? geoSchedule?.enabled && scheduled && !geoBlocker ? geoSchedule.nextRunAt : null
          : syncSchedule?.enabled && scheduled && CONNECTORS[cn.provider]?.sync ? syncSchedule.nextRunAt : null;
        return {
        ...cn,
        hasSecret: !!secretCiphertext,
        nextSyncAt,
        geo: isGeo(cn.provider) ? { blocker: geoBlocker, approval: (cn.config[GEO_APPROVAL_KEY] as { approvedAt: string; approvedByName: string } | undefined) ?? null } : null,
        recordsProcessed: execs.find((e) => e.connectionId === cn.id && e.status === 'succeeded')?.rowsWritten ?? null,
        definition: CONNECTORS[cn.provider] ? { label: CONNECTORS[cn.provider].label, modes: CONNECTORS[cn.provider].modes, configFields: CONNECTORS[cn.provider].configFields, secretFields: CONNECTORS[cn.provider].secretFields, readiness: CONNECTORS[cn.provider].readiness, canSync: !!CONNECTORS[cn.provider].sync, canTest: !!CONNECTORS[cn.provider].test } : null,
        webhookPath: cn.provider === 'drupal' ? `/api/ingest/drupal/${cn.id}` : null,
        executions: execs.filter((e) => e.connectionId === cn.id).slice(0, 10),
        };
      }),
    );
  });

  r.patch('/integrations/:id', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, z.object({ name: z.string().trim().min(1).max(120).optional(), config: z.record(z.union([z.string().max(4000), z.number(), z.boolean(), z.array(z.string().max(200)).max(50), z.record(z.string())])).optional(), mode: z.enum(['api', 'csv', 'demo', 'webhook']).optional() }));
    const [cur] = await app.db.select().from(s.dataConnections).where(eq(s.dataConnections.id, id));
    if (!cur) notFound('Connection');
    const def = CONNECTORS[cur.provider];
    if (d.mode && def && !def.modes.includes(d.mode)) throw new HttpError(422, `Mode ${d.mode} is not supported by ${def.label}`, 'validation');
    const set: Partial<typeof s.dataConnections.$inferInsert> = { updatedAt: new Date() };
    if (d.name) set.name = d.name;
    if (d.config) {
      // the GEO approval is recorded only through its own audited route
      const { [GEO_APPROVAL_KEY]: _reserved, ...cfg } = d.config;
      set.config = { ...cur.config, ...cfg };
    }
    if (d.mode && d.mode !== cur.mode) {
      set.mode = d.mode;
      // switching mode never claims a connection: demo → demo; others need a successful sync, test or import first
      set.status = d.mode === 'demo' ? 'demo' : cur.secretCiphertext || d.mode === 'csv' ? 'disconnected' : 'not_configured';
    }
    await app.db.update(s.dataConnections).set(set).where(eq(s.dataConnections.id, id));
    app.analytics.invalidate();
    await audit(c, { action: 'integration.update', entityType: 'connection', entityId: id, details: { provider: cur.provider, ...d } });
    return c.json({ ok: true });
  });

  r.put('/integrations/:id/secret', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const { values } = await body(c, z.object({ values: z.record(z.string().max(20_000)) }));
    const [cur] = await app.db.select().from(s.dataConnections).where(eq(s.dataConnections.id, id));
    if (!cur) notFound('Connection');
    if (!app.secrets.available) throw new HttpError(503, 'APP_ENCRYPTION_KEY is not configured; secrets cannot be stored', 'no_encryption_key');
    const def = CONNECTORS[cur.provider];
    const allowed = new Set(def?.secretFields.map((f) => f.key) ?? []);
    const clean = Object.fromEntries(Object.entries(values).filter(([k, v]) => allowed.has(k) && v.trim() !== ''));
    if (!Object.keys(clean).length) throw new HttpError(422, 'No secret value provided', 'validation');
    const prev = cur.secretCiphertext ? JSON.parse(app.secrets.open(cur.secretCiphertext)) : {};
    await app.db.update(s.dataConnections).set({ secretCiphertext: app.secrets.seal(JSON.stringify({ ...prev, ...clean })), secretUpdatedAt: new Date(), status: cur.status === 'not_configured' ? 'disconnected' : cur.status, updatedAt: new Date() }).where(eq(s.dataConnections.id, id));
    await audit(c, { action: 'integration.secret.set', entityType: 'connection', entityId: id, details: { provider: cur.provider, fields: Object.keys(clean) } });
    return c.json({ ok: true, fields: Object.keys(clean) });
  });

  r.delete('/integrations/:id/secret', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    await app.db.update(s.dataConnections).set({ secretCiphertext: null, secretUpdatedAt: new Date(), status: 'not_configured', updatedAt: new Date() }).where(eq(s.dataConnections.id, id));
    app.analytics.invalidate();
    await audit(c, { action: 'integration.secret.delete', entityType: 'connection', entityId: id });
    return c.json({ ok: true });
  });

  r.post('/integrations/:id/approval', requirePermission('ai.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, z.object({ approved: z.boolean(), confirmation: z.string().optional() }));
    const [cur] = await app.db.select().from(s.dataConnections).where(eq(s.dataConnections.id, id));
    if (!cur) notFound('Connection');
    if (!(GEO_API_PROVIDERS as readonly string[]).includes(cur.provider)) throw new HttpError(422, 'Approval applies to GEO measurement providers only', 'not_supported');
    if (d.approved && d.confirmation !== 'APPROVE') throw new HttpError(422, 'Type APPROVE to confirm the organisation authorises sending the monitored prompt texts to this provider', 'confirmation_required');
    const user = currentUser(c);
    const { [GEO_APPROVAL_KEY]: _prev, ...rest } = cur.config;
    const config = d.approved ? { ...rest, [GEO_APPROVAL_KEY]: { approvedAt: new Date().toISOString(), approvedBy: user.id, approvedByName: user.name } } : rest;
    await app.db.update(s.dataConnections).set({ config, updatedAt: new Date() }).where(eq(s.dataConnections.id, id));
    await audit(c, { action: d.approved ? 'integration.approval.grant' : 'integration.approval.revoke', entityType: 'connection', entityId: id, details: { provider: cur.provider } });
    return c.json({ ok: true });
  });

  r.post('/integrations/:id/test', requirePermission('integrations.manage'), async (c) => {
    const id = uuidParam(c);
    const res = await testConnection(c.get('app'), id);
    await audit(c, { action: 'integration.test', entityType: 'connection', entityId: id, outcome: res.ok ? 'success' : 'failure', details: { message: res.message } });
    return c.json(res);
  });

  r.post('/integrations/:id/sync', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, z.object({ from: isoDate.optional(), to: isoDate.optional() }));
    const [cur] = await app.db.select().from(s.dataConnections).where(eq(s.dataConnections.id, id));
    if (!cur) notFound('Connection');
    if (!CONNECTORS[cur.provider]?.sync) throw new HttpError(422, 'This source has no API synchronisation — use file import', 'not_supported');
    if (cur.mode !== 'api') throw new HttpError(409, 'Switch the connection to API mode first', 'conflict');
    if (!cur.secretCiphertext) throw new HttpError(409, 'Store the credentials first', 'conflict');
    const job = await app.jobs.enqueue('connector.sync', { connectionId: id, from: d.from, to: d.to }, { maxAttempts: 2, dedupeKey: `sync:${id}`, createdBy: currentUser(c).id });
    await audit(c, { action: 'integration.sync', entityType: 'connection', entityId: id, details: d });
    return c.json({ jobId: job.id }, 202);
  });

  const setStatus = (status: 'paused' | 'disconnected') => async (ctx: Ctx) => {
    const app = ctx.get('app');
    const id = uuidParam(ctx);
    const [cur] = await app.db.select().from(s.dataConnections).where(eq(s.dataConnections.id, id));
    if (!cur) notFound('Connection');
    await app.db.update(s.dataConnections).set({ status, updatedAt: new Date() }).where(eq(s.dataConnections.id, id));
    app.analytics.invalidate();
    await audit(ctx, { action: `integration.${status === 'paused' ? 'pause' : 'disconnect'}`, entityType: 'connection', entityId: id, details: { provider: cur.provider } });
    return ctx.json({ ok: true });
  };
  r.post('/integrations/:id/pause', requirePermission('integrations.manage'), setStatus('paused'));
  r.post('/integrations/:id/disconnect', requirePermission('integrations.manage'), setStatus('disconnected'));
  r.post('/integrations/:id/resume', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const [cur] = await app.db.select().from(s.dataConnections).where(eq(s.dataConnections.id, id));
    if (!cur) notFound('Connection');
    // resuming does not claim a live connection: the next successful sync sets "connected"
    await app.db.update(s.dataConnections).set({ status: cur.mode === 'demo' ? 'demo' : cur.secretCiphertext ? 'disconnected' : 'not_configured', updatedAt: new Date() }).where(eq(s.dataConnections.id, id));
    await audit(c, { action: 'integration.resume', entityType: 'connection', entityId: id });
    return c.json({ ok: true });
  });

  /* ---------- websites & social accounts ---------- */
  r.get('/websites', async (c) => c.json(await c.get('app').db.select().from(s.websites).orderBy(asc(s.websites.key))));
  const websiteSchema = z.object({ key: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(2).max(120), domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/), basePath: z.string().regex(/^\/[a-z0-9/_-]*$/i).default('/'), language: z.enum(['en', 'fr']), businessUnit: z.string().max(60).optional(), ga4Property: z.string().max(60).optional(), gscProperty: z.string().max(300).optional(), drupalEnabled: z.boolean().default(true), status: z.enum(['active', 'archived']).default('active'), settings: z.object({ countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(60).optional(), regions: z.array(z.string().max(40)).max(20).optional(), contentCategories: z.array(z.string().max(60)).max(40).optional(), conversionEvents: z.array(z.enum(EVENTS.map((e) => e.id) as [string, ...string[]])).max(20).optional() }).default({}) });
  r.post('/websites', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, websiteSchema);
    const [row] = await app.db.insert(s.websites).values({ orgId: app.orgId, ...d }).returning();
    app.analytics.invalidate();
    await audit(c, { action: 'website.create', entityType: 'website', entityId: row.id, details: d });
    return c.json(row, 201);
  });
  r.patch('/websites/:id', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, websiteSchema.omit({ key: true }).partial());
    await app.db.update(s.websites).set({ ...d, updatedAt: new Date() }).where(eq(s.websites.id, id));
    app.analytics.invalidate();
    await audit(c, { action: 'website.update', entityType: 'website', entityId: id, details: d });
    return c.json({ ok: true });
  });

  r.get('/social-accounts', async (c) => c.json(await c.get('app').db.select().from(s.socialAccounts).orderBy(asc(s.socialAccounts.platform), asc(s.socialAccounts.key))));
  const accountSchema = z.object({ key: z.string().regex(/^[a-z0-9-]{2,40}$/), platform: z.string().regex(/^[a-z_]{2,30}$/), name: z.string().trim().min(1).max(120), handle: z.string().max(200).optional(), externalId: z.string().max(120).optional(), language: z.enum(['en', 'fr']), region: z.string().max(40).optional(), businessUnit: z.string().max(60).optional(), status: z.enum(['active', 'archived']).default('active'), metrics: z.array(z.string().max(60)).max(30).default([]) });
  r.post('/social-accounts', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, accountSchema);
    const [conn] = await app.db.insert(s.dataConnections).values({ orgId: app.orgId, provider: d.platform, name: `${d.platform} — ${d.name}`, status: 'not_configured', mode: CONNECTORS[d.platform] ? 'api' : 'csv', config: { account: d.key }, scopeRefs: [d.key] }).returning();
    const [row] = await app.db.insert(s.socialAccounts).values({ orgId: app.orgId, ...d, connectionId: conn.id }).returning();
    app.analytics.invalidate();
    await audit(c, { action: 'social_account.create', entityType: 'social_account', entityId: row.id, details: d });
    return c.json(row, 201);
  });
  r.patch('/social-accounts/:id', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, accountSchema.omit({ key: true, platform: true }).partial());
    await app.db.update(s.socialAccounts).set({ ...d, updatedAt: new Date() }).where(eq(s.socialAccounts.id, id));
    app.analytics.invalidate();
    await audit(c, { action: 'social_account.update', entityType: 'social_account', entityId: id, details: d });
    return c.json({ ok: true });
  });

  /* ---------- advertising (local metadata only — the ad platform is never modified) ---------- */
  r.get('/advertising', async (c) => {
    const db = c.get('app').db;
    const [accounts, campaigns, groups, adRows] = await Promise.all([db.select().from(s.adAccounts), db.select().from(s.adCampaigns), db.select().from(s.adGroups), db.select().from(s.ads)]);
    return c.json({ accounts, campaigns, groups, ads: adRows, note: 'Budgets and external ids are stored in this platform for pacing and mapping. Nothing is written to ChatGPT Ads.' });
  });
  r.patch('/advertising/campaigns/:id', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, z.object({ monthlyBudget: z.number().min(0).max(10_000_000).nullable().optional(), externalId: z.string().max(120).nullable().optional(), utmCampaign: z.string().max(120).optional(), businessUnit: z.string().max(60).optional(), category: z.enum(['industries', 'collectivities']).optional(), objective: z.enum(['awareness', 'consideration', 'conversion']).optional() }));
    await app.db.update(s.adCampaigns).set({ ...d, updatedAt: new Date() }).where(eq(s.adCampaigns.id, id));
    await audit(c, { action: 'advertising.campaign.update', entityType: 'ad_campaign', entityId: id, details: d });
    return c.json({ ok: true });
  });
  r.patch('/advertising/ads/:id', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, z.object({ externalId: z.string().max(120).nullable().optional(), siteKey: z.string().max(60).optional() }));
    await app.db.update(s.ads).set({ ...d, updatedAt: new Date() }).where(eq(s.ads.id, id));
    await audit(c, { action: 'advertising.ad.update', entityType: 'ad', entityId: id, details: d });
    return c.json({ ok: true });
  });

  /* ---------- SEO & GEO configuration ---------- */
  const scopeSchema = z.object({
    websiteKey: z.string().max(60),
    name: z.string().trim().min(2).max(120),
    allowedHosts: z.array(z.string().regex(/^[a-z0-9.-]+(:\d+)?$/)).min(1).max(5),
    startUrls: z.array(z.string().url()).min(1).max(10),
    includePatterns: z.array(z.string().max(200)).max(20).default([]),
    excludePatterns: z.array(z.string().max(200)).max(50).default([]),
    maxPages: z.number().int().min(1).max(2000).default(200),
    maxDepth: z.number().int().min(0).max(8).default(4),
    delayMs: z.number().int().min(500).max(30_000).default(1500),
  });
  r.post('/crawl-scopes', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, scopeSchema);
    const [row] = await app.db.insert(s.seoCrawlScopes).values({ orgId: app.orgId, ...d, authorized: false, enabled: false }).returning();
    await audit(c, { action: 'crawl_scope.create', entityType: 'crawl_scope', entityId: row.id, details: d });
    return c.json(row, 201);
  });
  r.patch('/crawl-scopes/:id', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, scopeSchema.partial());
    // any change to the perimeter withdraws the authorisation
    await app.db.update(s.seoCrawlScopes).set({ ...d, authorized: false, enabled: false, authorizedBy: null, authorizedAt: null }).where(eq(s.seoCrawlScopes.id, id));
    await audit(c, { action: 'crawl_scope.update', entityType: 'crawl_scope', entityId: id, details: { ...d, authorisationWithdrawn: true } });
    return c.json({ ok: true });
  });
  r.post('/crawl-scopes/:id/authorize', requirePermission('integrations.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, z.object({ authorized: z.boolean(), confirmation: z.string().optional() }));
    const [scope] = await app.db.select().from(s.seoCrawlScopes).where(eq(s.seoCrawlScopes.id, id));
    if (!scope) notFound('Crawl scope');
    if (d.authorized) {
      const monitored = (await app.db.select({ domain: s.websites.domain }).from(s.websites)).map((w) => w.domain);
      const extra = app.env.CRAWLER_EXTRA_ALLOWED_HOSTS.split(',').map((x) => x.trim()).filter(Boolean);
      const bad = scope.allowedHosts.filter((h) => !monitored.includes(h) && !extra.includes(h));
      if (bad.length) throw new HttpError(422, `Only monitored websites can be crawled. Not allowed: ${bad.join(', ')}`, 'host_not_allowed');
      if (d.confirmation !== 'AUTHORISE') throw new HttpError(422, 'Type AUTHORISE to confirm you are allowed to audit these hosts', 'confirmation_required');
    }
    await app.db.update(s.seoCrawlScopes).set({ authorized: d.authorized, enabled: d.authorized, authorizedBy: d.authorized ? currentUser(c).id : null, authorizedAt: d.authorized ? new Date() : null }).where(eq(s.seoCrawlScopes.id, id));
    await audit(c, { action: d.authorized ? 'crawl_scope.authorize' : 'crawl_scope.revoke', entityType: 'crawl_scope', entityId: id, details: { hosts: scope.allowedHosts, maxPages: scope.maxPages, delayMs: scope.delayMs } });
    return c.json({ ok: true });
  });

  /* ---------- KPI registry & taxonomy ---------- */
  r.get('/kpis', async (c) => {
    const app = c.get('app');
    const defs = await app.db.select().from(s.metricDefinitions);
    const [org] = await app.db.select().from(s.organizations).where(eq(s.organizations.id, app.orgId));
    return c.json({
      metrics: METRICS.filter((m) => !m.internal).map((m) => ({ ...m, agg: { kind: m.agg.kind, ...('tables' in m.agg ? { tables: m.agg.tables } : {}), ...('num' in m.agg ? { num: m.agg.num, den: m.agg.den } : {}) }, dimensions: metricDimensions(m.id), override: defs.find((d) => d.metricId === m.id) ?? null })),
      conversionEvents: (org.settings as { conversionEvents?: string[] }).conversionEvents ?? [],
      events: EVENTS.map((e) => ({ id: e.id, name: e.name, keyEvent: e.keyEvent })),
    });
  });
  r.patch('/kpis/:metricId', requirePermission('kpi.manage'), async (c) => {
    const app = c.get('app');
    const metricId = c.req.param('metricId');
    if (!getMetric(metricId)) notFound('Metric');
    const d = await body(c, z.object({ enabled: z.boolean().optional(), labelEn: z.string().max(120).nullable().optional(), labelFr: z.string().max(120).nullable().optional(), definitionEn: z.string().max(2000).nullable().optional(), definitionFr: z.string().max(2000).nullable().optional(), owner: z.string().max(120).nullable().optional(), notes: z.string().max(2000).nullable().optional() }));
    const [existing] = await app.db.select().from(s.metricDefinitions).where(eq(s.metricDefinitions.metricId, metricId));
    if (existing) await app.db.update(s.metricDefinitions).set({ ...d, updatedBy: currentUser(c).id, updatedAt: new Date() }).where(eq(s.metricDefinitions.metricId, metricId));
    else await app.db.insert(s.metricDefinitions).values({ metricId, orgId: app.orgId, ...d, updatedBy: currentUser(c).id });
    await audit(c, { action: 'kpi.update', entityType: 'metric', entityId: metricId, details: d });
    return c.json({ ok: true });
  });
  r.put('/kpis/conversion-events', requirePermission('kpi.manage'), async (c) => {
    const app = c.get('app');
    const { events } = await body(c, z.object({ events: z.array(z.enum(EVENTS.map((e) => e.id) as [string, ...string[]])).min(1) }));
    const [org] = await app.db.select().from(s.organizations).where(eq(s.organizations.id, app.orgId));
    await app.db.update(s.organizations).set({ settings: { ...org.settings, conversionEvents: events } }).where(eq(s.organizations.id, app.orgId));
    app.analytics.invalidate();
    await audit(c, { action: 'kpi.conversion_events', details: { events } });
    return c.json({ ok: true });
  });
  r.get('/taxonomy', async (c) => c.json(await c.get('app').db.select().from(s.taxonomyTerms).orderBy(asc(s.taxonomyTerms.kind), asc(s.taxonomyTerms.key))));
  r.post('/taxonomy', requirePermission('kpi.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, z.object({ kind: z.enum(['topic', 'pillar', 'objective', 'audience', 'business_unit', 'tag']), key: z.string().regex(/^[a-z0-9_]{2,40}$/), labelEn: z.string().trim().min(1).max(80), labelFr: z.string().trim().min(1).max(80) }));
    const [row] = await app.db.insert(s.taxonomyTerms).values({ orgId: app.orgId, ...d }).returning();
    await audit(c, { action: 'taxonomy.create', entityType: 'taxonomy', entityId: row.id, details: d });
    return c.json(row, 201);
  });
  r.patch('/taxonomy/:id', requirePermission('kpi.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, z.object({ labelEn: z.string().trim().min(1).max(80).optional(), labelFr: z.string().trim().min(1).max(80).optional(), active: z.boolean().optional() }));
    await app.db.update(s.taxonomyTerms).set(d).where(eq(s.taxonomyTerms.id, id));
    await audit(c, { action: 'taxonomy.update', entityType: 'taxonomy', entityId: id, details: d });
    return c.json({ ok: true });
  });

  /* ---------- dashboard builder ---------- */
  r.get('/dashboards/executive', async (c) => {
    const [d] = await c.get('app').db.select().from(s.dashboards).where(eq(s.dashboards.key, 'executive'));
    return c.json(d ?? null);
  });
  r.put('/dashboards/executive', requirePermission('dashboards.edit'), async (c) => {
    const app = c.get('app');
    const { layout } = await body(c, z.object({ layout: z.array(z.object({ id: z.string().max(40), type: z.enum(WIDGET_TYPES), visible: z.boolean(), size: z.enum(['full', 'half']).optional(), chart: z.enum(['line', 'bar']).optional(), metrics: z.array(z.string().max(60)).max(16).optional(), title: z.string().max(80).optional() })).min(1).max(20) }));
    for (const w of layout) for (const m of w.metrics ?? []) if (!getMetric(m) || getMetric(m)!.internal) throw new HttpError(422, `Unknown metric ${m}`, 'validation');
    if (new Set(layout.map((w) => w.id)).size !== layout.length) throw new HttpError(422, 'Widget ids must be unique', 'validation');
    const [existing] = await app.db.select().from(s.dashboards).where(eq(s.dashboards.key, 'executive'));
    if (existing) await app.db.update(s.dashboards).set({ layout, updatedBy: currentUser(c).id, updatedAt: new Date() }).where(eq(s.dashboards.key, 'executive'));
    else await app.db.insert(s.dashboards).values({ orgId: app.orgId, key: 'executive', name: 'Executive overview', layout, updatedBy: currentUser(c).id });
    await audit(c, { action: 'dashboard.update', entityType: 'dashboard', entityId: 'executive', details: { widgets: layout.map((w) => `${w.type}${w.visible ? '' : ' (hidden)'}`) } });
    return c.json({ ok: true });
  });

  r.delete('/dashboards/executive', requirePermission('dashboards.edit'), async (c) => {
    const app = c.get('app');
    await app.db.update(s.dashboards).set({ layout: DEFAULT_EXECUTIVE_LAYOUT, updatedBy: currentUser(c).id, updatedAt: new Date() }).where(eq(s.dashboards.key, 'executive'));
    await audit(c, { action: 'dashboard.reset', entityType: 'dashboard', entityId: 'executive' });
    return c.json({ ok: true, layout: DEFAULT_EXECUTIVE_LAYOUT });
  });

  /* ---------- alert rules ---------- */
  const ruleSchema = z.object({
    name: z.string().trim().min(3).max(160),
    metricId: z.string().refine((m) => !!getMetric(m), 'Unknown metric'),
    filters: z.record(z.array(z.string().max(100)).max(50)).default({}),
    condition: z.enum(['above', 'below', 'change_up_pct', 'change_down_pct', 'change_up_abs', 'change_down_abs', 'missing_data', 'pacing_above']),
    threshold: z.number().finite().nullable().optional(),
    windowDays: z.number().int().min(1).max(90).default(7),
    compare: z.enum(['previous', 'yoy']).default('previous'),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).default('medium'),
    cooldownHours: z.number().int().min(0).max(24 * 30).default(24),
    channels: z.array(z.enum(['in_app', 'email'])).default(['in_app']),
    recipients: z.array(z.string().email()).max(50).default([]),
    enabled: z.boolean().default(true),
  });
  r.get('/alert-rules', async (c) => c.json(await c.get('app').db.select().from(s.alertRules).orderBy(asc(s.alertRules.name))));
  r.post('/alert-rules', requirePermission('alerts.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, ruleSchema);
    if (d.condition !== 'missing_data' && (d.threshold === undefined || d.threshold === null)) throw new HttpError(422, 'A threshold is required for this condition', 'validation');
    const [row] = await app.db.insert(s.alertRules).values({ orgId: app.orgId, ...d, threshold: d.threshold ?? null, createdBy: currentUser(c).id }).returning();
    await audit(c, { action: 'alert_rule.create', entityType: 'alert_rule', entityId: row.id, details: { ...d, recipients: d.recipients.length } });
    return c.json(row, 201);
  });
  r.patch('/alert-rules/:id', requirePermission('alerts.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, ruleSchema.partial());
    await app.db.update(s.alertRules).set(d).where(eq(s.alertRules.id, id));
    await audit(c, { action: 'alert_rule.update', entityType: 'alert_rule', entityId: id, details: { ...d, recipients: d.recipients?.length } });
    return c.json({ ok: true });
  });
  r.delete('/alert-rules/:id', requirePermission('alerts.manage'), async (c) => {
    const id = uuidParam(c);
    await c.get('app').db.delete(s.alertRules).where(eq(s.alertRules.id, id));
    await audit(c, { action: 'alert_rule.delete', entityType: 'alert_rule', entityId: id });
    return c.json({ ok: true });
  });
  r.post('/alert-rules/evaluate', requirePermission('alerts.manage'), async (c) => {
    const res = await evaluateAlertRules(c.get('app'));
    await audit(c, { action: 'alert_rule.evaluate', details: res });
    return c.json(res);
  });

  /* ---------- data management (imports) ---------- */
  r.get('/imports/specs', (c) => c.json(Object.values(IMPORT_SPECS).map((sp) => ({ dataset: sp.dataset, provider: sp.provider, label: sp.label, columns: sp.columns.map((col) => ({ name: col.name, type: col.type, required: !!col.required, enum: col.enum ?? null })) }))));
  r.get('/imports/template/:dataset', (c) => {
    const ds = c.req.param('dataset');
    if (!IMPORT_SPECS[ds]) notFound('Dataset');
    return new Response(templateCsv(ds), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="template_${ds}.csv"` } });
  });
  r.get('/imports', async (c) => {
    const rows = await c.get('app').db.select({ imp: s.imports, userName: s.users.name }).from(s.imports).leftJoin(s.users, eq(s.users.id, s.imports.createdBy)).orderBy(desc(s.imports.createdAt)).limit(100);
    return c.json(rows.map(({ imp: { rejected, ...rest }, userName }) => ({ ...rest, userName, rejectedPreview: rejected.slice(0, 20) })));
  });
  r.post('/imports', requirePermission('data.import'), async (c) => {
    const app = c.get('app');
    const form = await c.req.parseBody();
    const file = form.file;
    const dataset = String(form.dataset ?? '');
    if (!(file instanceof File)) throw new HttpError(422, 'Attach a CSV or XLSX file', 'validation');
    if (!IMPORT_SPECS[dataset]) throw new HttpError(422, 'Unknown dataset', 'validation');
    const name = file.name || 'upload';
    const ext = name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : name.toLowerCase().endsWith('.csv') ? 'csv' : null;
    if (!ext) throw new HttpError(422, 'Only .csv and .xlsx files are accepted', 'validation');
    if (file.size > 20 * 1024 * 1024) throw new HttpError(413, 'File too large (max 20 MB)', 'too_large');
    const content = Buffer.from(await file.arrayBuffer());
    if (ext === 'xlsx' && content.subarray(0, 2).toString('ascii') !== 'PK') throw new HttpError(422, 'The file is not a valid XLSX workbook', 'validation');
    let res: Awaited<ReturnType<typeof runImport>>;
    try {
      res = await runImport(app, { dataset, fileName: name, fileType: ext, content, replace: String(form.replace ?? 'true') !== 'false', confirmReplace: String(form.confirmReplace ?? 'false') === 'true', userId: currentUser(c).id, dryRun: String(form.dryRun ?? 'false') === 'true' });
    } catch (e) {
      if (e instanceof ImportConflict) throw new HttpError(409, e.message, 'replace_confirmation_required', { existingRows: e.existingRows, from: e.from, to: e.to });
      throw e;
    }
    await audit(c, { action: res.status === 'validated' ? 'import.validate' : 'import.run', entityType: 'import', entityId: 'id' in res ? res.id : null, details: { dataset, file: name, accepted: res.accepted, rejected: Array.isArray(res.rejected) ? res.rejected.length : res.rejected } });
    return c.json(res, 'id' in res ? 201 : 200);
  });
  r.get('/imports/:id/rejected.csv', async (c) => {
    const id = uuidParam(c);
    const [imp] = await c.get('app').db.select().from(s.imports).where(eq(s.imports.id, id));
    if (!imp) notFound('Import');
    const lines = ['row,errors', ...imp.rejected.map((x) => `${x.row},${csvEscape(x.errors.join('; '))}`)];
    return new Response(`﻿${lines.join('\r\n')}`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="rejected_${imp.dataset}.csv"` } });
  });
  r.delete('/imports/:id', requirePermission('data.import'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const [imp] = await app.db.select().from(s.imports).where(eq(s.imports.id, id));
    if (!imp) notFound('Import');
    await app.db.delete(s.factRows).where(eq(s.factRows.importId, id));
    await app.db.update(s.imports).set({ status: 'deleted' }).where(eq(s.imports.id, id));
    app.analytics.invalidate();
    await audit(c, { action: 'import.delete', entityType: 'import', entityId: id, details: { dataset: imp.dataset } });
    return c.json({ ok: true });
  });

  /* ---------- targets ---------- */
  const targetSchema = z.object({ metricId: z.string().refine((m) => !!getMetric(m), 'Unknown metric'), periodStart: isoDate, periodEnd: isoDate, value: z.number().finite(), filters: z.record(z.array(z.string())).default({}), owner: z.string().max(120).optional(), note: z.string().max(500).optional(), objective: z.string().max(200).optional(), warningRatio: z.number().min(0.1).max(1).nullable().optional() });
  r.get('/targets', async (c) => c.json(await c.get('app').db.select().from(s.metricTargets).orderBy(desc(s.metricTargets.periodStart))));
  r.post('/targets', requirePermission('targets.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, targetSchema);
    if (d.periodEnd < d.periodStart) throw new HttpError(422, 'Period end must be after start', 'validation');
    const [row] = await app.db.insert(s.metricTargets).values({ orgId: app.orgId, ...d, createdBy: currentUser(c).id }).returning();
    await audit(c, { action: 'target.create', entityType: 'target', entityId: row.id, details: d });
    return c.json(row, 201);
  });
  r.patch('/targets/:id', requirePermission('targets.manage'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, targetSchema.partial());
    await app.db.update(s.metricTargets).set(d).where(eq(s.metricTargets.id, id));
    await audit(c, { action: 'target.update', entityType: 'target', entityId: id, details: d });
    return c.json({ ok: true });
  });
  r.delete('/targets/:id', requirePermission('targets.manage'), async (c) => {
    const id = uuidParam(c);
    await c.get('app').db.delete(s.metricTargets).where(eq(s.metricTargets.id, id));
    await audit(c, { action: 'target.delete', entityType: 'target', entityId: id });
    return c.json({ ok: true });
  });

  /* ---------- AI administration ---------- */
  r.get('/ai', async (c) => {
    const app = c.get('app');
    const [settings] = await app.db.select().from(s.aiSettings).where(eq(s.aiSettings.orgId, app.orgId));
    const [conn] = await app.db.select({ secretUpdatedAt: s.dataConnections.secretUpdatedAt, hasSecret: sql<boolean>`${s.dataConnections.secretCiphertext} is not null` }).from(s.dataConnections).where(eq(s.dataConnections.provider, 'ai_provider'));
    const templates = await app.db.select().from(s.aiPromptTemplates).orderBy(asc(s.aiPromptTemplates.key), desc(s.aiPromptTemplates.version));
    const executions = await app.db.select({ id: s.aiExecutions.id, purpose: s.aiExecutions.purpose, provider: s.aiExecutions.provider, model: s.aiExecutions.model, status: s.aiExecutions.status, inputTokens: s.aiExecutions.inputTokens, outputTokens: s.aiExecutions.outputTokens, latencyMs: s.aiExecutions.latencyMs, error: s.aiExecutions.error, createdAt: s.aiExecutions.createdAt }).from(s.aiExecutions).orderBy(desc(s.aiExecutions.createdAt)).limit(50);
    return c.json({ settings, key: conn ?? { hasSecret: false }, templates, executions, status: await aiStatus(app), dataPolicy: 'Only aggregated, non-personal metrics and their labels are sent. No raw rows, personal data, credentials or documents.' });
  });
  r.patch('/ai', requirePermission('ai.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, z.object({ enabled: z.boolean().optional(), provider: z.enum(['none', 'anthropic', 'openai', 'azure_openai']).optional(), model: z.string().max(120).nullable().optional(), baseUrl: z.string().url().startsWith('https://').nullable().optional(), maxOutputTokens: z.number().int().min(100).max(4000).optional(), temperature: z.number().min(0).max(1).optional(), monthlyTokenBudget: z.number().int().min(1000).max(100_000_000).nullable().optional(), allowedFeatures: z.array(z.enum(['executive_summary'])).optional(), requireHumanReview: z.boolean().optional() }));
    await app.db.update(s.aiSettings).set({ ...d, updatedAt: new Date() }).where(eq(s.aiSettings.orgId, app.orgId));
    await audit(c, { action: 'ai.settings.update', details: d });
    return c.json({ ok: true });
  });
  r.post('/ai/approval', requirePermission('ai.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, z.object({ approved: z.boolean(), confirmation: z.string().optional() }));
    if (d.approved && d.confirmation !== 'APPROVE') throw new HttpError(422, 'Type APPROVE to confirm the organisation authorises sending aggregated metrics to the selected provider', 'confirmation_required');
    await app.db.update(s.aiSettings).set({ externalProcessingApproved: d.approved, approvedBy: d.approved ? currentUser(c).id : null, approvedAt: d.approved ? new Date() : null, updatedAt: new Date() }).where(eq(s.aiSettings.orgId, app.orgId));
    await audit(c, { action: d.approved ? 'ai.approval.grant' : 'ai.approval.revoke' });
    return c.json({ ok: true });
  });
  r.post('/ai/templates', requirePermission('ai.manage'), async (c) => {
    const app = c.get('app');
    const d = await body(c, z.object({ key: z.string().regex(/^[a-z_]{3,40}$/), body: z.string().min(20).max(8000) }));
    const [latest] = await app.db.select().from(s.aiPromptTemplates).where(eq(s.aiPromptTemplates.key, d.key)).orderBy(desc(s.aiPromptTemplates.version)).limit(1);
    await app.db.update(s.aiPromptTemplates).set({ active: false }).where(eq(s.aiPromptTemplates.key, d.key));
    const [row] = await app.db.insert(s.aiPromptTemplates).values({ orgId: app.orgId, key: d.key, version: (latest?.version ?? 0) + 1, body: d.body, active: true, createdBy: currentUser(c).id }).returning();
    await audit(c, { action: 'ai.template.version', entityType: 'ai_template', entityId: row.id, details: { key: d.key, version: row.version } });
    return c.json(row, 201);
  });

  /* ---------- audit logs ---------- */
  r.get('/audit', requirePermission('audit.view'), async (c) => {
    const qp = c.req.query();
    const conds = [];
    if (qp.action) conds.push(ilike(s.auditLogs.action, `${qp.action.replace(/[%_]/g, '')}%`));
    if (qp.user) conds.push(ilike(s.auditLogs.userEmail, `%${qp.user.replace(/[%_]/g, '')}%`));
    if (qp.outcome) conds.push(eq(s.auditLogs.outcome, qp.outcome));
    if (qp.from && /^\d{4}-\d{2}-\d{2}$/.test(qp.from)) conds.push(gte(s.auditLogs.createdAt, new Date(`${qp.from}T00:00:00Z`)));
    const page = Math.max(1, Number(qp.page) || 1);
    const pageSize = Math.min(200, Number(qp.pageSize) || 50);
    const where = conds.length ? and(...conds) : undefined;
    const rows = await c.get('app').db.select().from(s.auditLogs).where(where).orderBy(desc(s.auditLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
    const [{ n }] = await c.get('app').db.select({ n: sql<number>`count(*)::int` }).from(s.auditLogs).where(where);
    if (qp.format === 'csv') {
      await audit(c, { action: 'audit.export' });
      const all = await c.get('app').db.select().from(s.auditLogs).where(where).orderBy(desc(s.auditLogs.createdAt)).limit(50_000);
      const lines = ['time,user,action,outcome,entity_type,entity_id,ip,details', ...all.map((a) => [a.createdAt.toISOString(), a.userEmail, a.action, a.outcome, a.entityType, a.entityId, a.ip, JSON.stringify(a.details)].map(csvEscape).join(','))];
      return new Response(`﻿${lines.join('\r\n')}`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="audit-log.csv"' } });
    }
    return c.json({ items: rows, total: Number(n), page, pageSize });
  });

  /* ---------- system monitoring ---------- */
  r.get('/system', requirePermission('system.view'), async (c) => {
    const app = c.get('app');
    const db = app.db;
    const ds = await app.analytics.dataset();
    const [jobsByStatus, recentJobs, syncs, events, counts] = await Promise.all([
      db.select({ status: s.jobs.status, n: sql<number>`count(*)::int` }).from(s.jobs).groupBy(s.jobs.status),
      db.select().from(s.jobs).orderBy(desc(s.jobs.createdAt)).limit(30),
      db.select({ e: s.syncExecutions, name: s.dataConnections.name }).from(s.syncExecutions).leftJoin(s.dataConnections, eq(s.dataConnections.id, s.syncExecutions.connectionId)).orderBy(desc(s.syncExecutions.startedAt)).limit(30),
      db.select().from(s.systemEvents).orderBy(desc(s.systemEvents.createdAt)).limit(30),
      warehouseTableCounts(db),
    ]);
    const schedules = await db.select().from(s.schedules).orderBy(asc(s.schedules.name));
    const failedImports = await db.select({ id: s.imports.id, dataset: s.imports.dataset, fileName: s.imports.fileName, status: s.imports.status, rowsRejected: s.imports.rowsRejected, createdAt: s.imports.createdAt }).from(s.imports).where(inArray(s.imports.status, ['rejected', 'partial'])).orderBy(desc(s.imports.createdAt)).limit(10);
    const conns = await db.select({ name: s.dataConnections.name, status: s.dataConnections.status, lastError: s.dataConnections.lastError }).from(s.dataConnections);
    const rateLimited = conns.filter((x) => x.lastError && /\b429\b|rate.?limit|quota/i.test(x.lastError)).map((x) => ({ name: x.name, lastError: x.lastError }));
    let databaseBytes: number | null = null;
    try {
      const rows = (await db.execute(sql`select pg_database_size(current_database())::bigint as n`)) as unknown as { rows?: Array<{ n: string | number }> } | Array<{ n: string | number }>;
      const first = Array.isArray(rows) ? rows[0] : rows.rows?.[0];
      databaseBytes = first ? Number(first.n) : null;
    } catch {
      databaseBytes = null;
    }
    const [{ reportBytes }] = await db.select({ reportBytes: sql<number>`coalesce(sum(${s.reportRuns.sizeBytes}), 0)::bigint` }).from(s.reportRuns);
    return c.json({
      storage: { databaseBytes, reportFilesBytes: Number(reportBytes) },
      failedImports,
      rateLimited,
      health: { status: 'ok', uptimeSeconds: Math.round((Date.now() - app.startedAt.getTime()) / 1000), database: app.dbh.kind, node: process.version, jobsEnabled: app.env.JOBS_ENABLED, worker: app.jobs.workerId, demoMode: ds.demoEnabled, asOf: ds.asOf },
      datasets: Object.entries(ds.tables).map(([id, t]) => ({ id, origin: t!.origin, rows: t!.table.n, coverage: t!.coverage, freshness: t!.freshness, missingEntities: t!.missingEntities ?? [] })),
      warehouseRows: counts,
      jobsByStatus,
      recentJobs: recentJobs.map((j) => ({ ...j, payload: undefined })),
      syncExecutions: syncs.map((x) => ({ ...x.e, connectionName: x.name })),
      systemEvents: events,
      schedules: schedules.map((x) => ({ ...x, frequencyLabel: { en: describeFrequency(x.frequency as Frequency, 'en'), fr: describeFrequency(x.frequency as Frequency, 'fr') } })),
    });
  });
  r.post('/system/jobs/:id/retry', requirePermission('system.view'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const [job] = await app.db.select().from(s.jobs).where(eq(s.jobs.id, id));
    if (!job || job.status !== 'failed') throw new HttpError(409, 'Only failed jobs can be retried', 'conflict');
    await app.db.update(s.jobs).set({ status: 'queued', attempts: 0, runAt: new Date(), lastError: null }).where(eq(s.jobs.id, id));
    await audit(c, { action: 'job.retry', entityType: 'job', entityId: id, details: { type: job.type } });
    return c.json({ ok: true });
  });
  r.patch('/system/schedules/:id', requirePermission('system.view'), async (c) => {
    const app = c.get('app');
    const id = uuidParam(c);
    const d = await body(c, z.object({ enabled: z.boolean() }));
    const [cur] = await app.db.select().from(s.schedules).where(eq(s.schedules.id, id));
    if (!cur) notFound('Schedule');
    // re-enabling starts from the next regular slot instead of catching up on missed runs
    await app.db.update(s.schedules).set({ enabled: d.enabled, ...(d.enabled && !cur.enabled ? { nextRunAt: nextRun(cur.frequency as Frequency, new Date()) } : {}) }).where(eq(s.schedules.id, id));
    await audit(c, { action: 'schedule.update', entityType: 'schedule', entityId: id, details: d });
    return c.json({ ok: true });
  });

  return r;
}
