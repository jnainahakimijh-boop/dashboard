import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ROLE_PERMISSIONS, isRole, type Role } from '@shared/rbac';
import { audit, writeAudit } from '../audit';
import { rateLimit, requireAuth } from '../auth/middleware';
import { SESSION_COOKIE, createSession, destroySession, destroyUserSessions } from '../auth/session';
import { HttpError, clientIp, currentUser, type Ctx, type HonoEnv } from '../context';
import { dataConnections, users } from '../db/schema';
import { burnPasswordCheck, hashPassword, passwordPolicyError, verifyPassword } from '../security/crypto';
import { body } from './util';

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

function setSessionCookie(c: Ctx, token: string, expiresAt: Date) {
  const app = c.get('app');
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: app.env.isProduction || app.env.APP_BASE_URL.startsWith('https://'),
    path: '/',
    expires: expiresAt,
  });
}

/** Demo sign-in is refused as soon as any source is genuinely connected. */
async function demoLoginAllowed(c: Ctx): Promise<boolean> {
  const app = c.get('app');
  if (!app.env.demoLoginEnabled) return false;
  const live = await app.db
    .select({ id: dataConnections.id })
    .from(dataConnections)
    .where(and(inArray(dataConnections.status, ['connected', 'degraded']), sql`${dataConnections.provider} not in ('smtp')`))
    .limit(1);
  return live.length === 0;
}

export function authRoutes() {
  const r = new Hono<HonoEnv>();

  r.get('/config', async (c) => {
    const app = c.get('app');
    const demo = await demoLoginAllowed(c);
    const demoAccounts = demo
      ? (await app.db.select({ email: users.email, name: users.name, role: users.role, scopes: users.scopes }).from(users).where(and(eq(users.isDemo, true), eq(users.status, 'active')))).map((u) => ({
          role: u.role,
          email: u.email,
          name: u.name,
          scoped: !!u.scopes?.websites?.length,
        }))
      : [];
    const [oidc] = await app.db.select({ status: dataConnections.status }).from(dataConnections).where(eq(dataConnections.provider, 'oidc')).limit(1);
    return c.json({ demoLogin: demo, demoAccounts, sso: { configured: oidc?.status === 'connected' }, passwordLogin: true, demoMode: app.env.DEMO_MODE });
  });

  r.post(
    '/login',
    rateLimit('login', 10, 15 * 60_000, (c) => clientIp(c)),
    async (c) => {
      const app = c.get('app');
      const { email, password } = await body(c, z.object({ email: z.string().email().max(200), password: z.string().min(1).max(256) }));
      const [u] = await app.db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`).limit(1);
      const fail = async (reason: string) => {
        await writeAudit(app, { action: 'auth.login', outcome: 'failure', userId: u?.id ?? null, userEmail: email, ip: clientIp(c), details: { reason } });
        throw new HttpError(401, 'Invalid e-mail or password', 'invalid_credentials');
      };
      if (!u || !u.passwordHash) {
        await burnPasswordCheck(password);
        return fail(u ? 'password_login_disabled' : 'unknown_user');
      }
      if (u.status !== 'active') {
        await burnPasswordCheck(password);
        return fail('inactive');
      }
      if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
        await writeAudit(app, { action: 'auth.login', outcome: 'denied', userId: u.id, userEmail: u.email, ip: clientIp(c), details: { reason: 'locked' } });
        throw new HttpError(429, `Account temporarily locked after repeated failures. Try again in ${LOCK_MINUTES} minutes.`, 'locked');
      }
      const ok = await verifyPassword(password, u.passwordHash);
      if (!ok) {
        const failures = u.failedLogins + 1;
        await app.db
          .update(users)
          .set({ failedLogins: failures, lockedUntil: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
          .where(eq(users.id, u.id));
        return fail('bad_password');
      }
      await app.db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, u.id));
      const { token, expiresAt } = await createSession(app, u.id, { ip: clientIp(c), userAgent: c.req.header('user-agent'), method: 'password' });
      setSessionCookie(c, token, expiresAt);
      await writeAudit(app, { action: 'auth.login', userId: u.id, userEmail: u.email, ip: clientIp(c), details: { method: 'password' } });
      return c.json({ ok: true });
    },
  );

  r.post(
    '/demo-login',
    rateLimit('demo-login', 30, 60_000, (c) => clientIp(c)),
    async (c) => {
      const app = c.get('app');
      if (!(await demoLoginAllowed(c))) throw new HttpError(403, 'Demo sign-in is disabled on this instance', 'demo_login_disabled');
      const { email } = await body(c, z.object({ email: z.string().email() }));
      const [u] = await app.db
        .select()
        .from(users)
        .where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, eq(users.isDemo, true), eq(users.status, 'active')))
        .limit(1);
      if (!u) throw new HttpError(404, 'Demo account not found', 'not_found');
      await app.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
      const { token, expiresAt } = await createSession(app, u.id, { ip: clientIp(c), userAgent: c.req.header('user-agent'), method: 'demo' });
      setSessionCookie(c, token, expiresAt);
      await writeAudit(app, { action: 'auth.login', userId: u.id, userEmail: u.email, ip: clientIp(c), details: { method: 'demo' } });
      return c.json({ ok: true });
    },
  );

  r.post('/logout', async (c) => {
    const u = c.get('user');
    if (u) {
      await destroySession(c.get('app'), u.sessionId);
      await audit(c, { action: 'auth.logout' });
    }
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  r.get('/me', requireAuth, async (c) => {
    const u = currentUser(c);
    const [row] = await c.get('app').db.select({ preferences: users.preferences, hasPassword: sql<boolean>`${users.passwordHash} is not null` }).from(users).where(eq(users.id, u.id));
    return c.json({
      user: { id: u.id, email: u.email, name: u.name, role: u.role, language: u.language, scopes: u.scopes, isDemo: u.isDemo, hasPassword: row?.hasPassword ?? false, preferences: row?.preferences ?? {} },
      permissions: [...ROLE_PERMISSIONS[u.role as Role]],
    });
  });

  r.patch('/me', requireAuth, async (c) => {
    const u = currentUser(c);
    const data = await body(c, z.object({ language: z.enum(['en', 'fr']).optional(), name: z.string().min(1).max(120).optional(), preferences: z.record(z.unknown()).optional() }));
    const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (data.language) set.language = data.language;
    if (data.name) set.name = data.name;
    if (data.preferences) {
      const json = JSON.stringify(data.preferences);
      if (json.length > 20_000) throw new HttpError(413, 'Preferences too large');
      set.preferences = data.preferences;
    }
    await c.get('app').db.update(users).set(set).where(eq(users.id, u.id));
    return c.json({ ok: true });
  });

  r.post('/password', requireAuth, async (c) => {
    const app = c.get('app');
    const u = currentUser(c);
    const { current, next } = await body(c, z.object({ current: z.string().max(256), next: z.string().max(256) }));
    const [row] = await app.db.select().from(users).where(eq(users.id, u.id));
    if (row.passwordHash && !(await verifyPassword(current, row.passwordHash))) {
      await audit(c, { action: 'auth.password_change', outcome: 'failure' });
      throw new HttpError(400, 'Current password is incorrect', 'bad_password');
    }
    const policy = passwordPolicyError(next);
    if (policy) throw new HttpError(422, policy, 'weak_password');
    await app.db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, u.id));
    await destroyUserSessions(app, u.id);
    const { token, expiresAt } = await createSession(app, u.id, { ip: clientIp(c), userAgent: c.req.header('user-agent'), method: 'password' });
    setSessionCookie(c, token, expiresAt);
    await audit(c, { action: 'auth.password_change' });
    return c.json({ ok: true });
  });

  r.get('/sso/start', (c) => {
    throw new HttpError(501, 'Single sign-on is not configured. An administrator must register an OpenID Connect client (see docs/ADMINISTRATION.md).', 'sso_not_configured');
    return c.body(null);
  });

  return r;
}

export { isRole };
