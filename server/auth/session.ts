import { and, eq, lt, or } from 'drizzle-orm';
import { isRole } from '@shared/rbac';
import type { AppContext, SessionUser } from '../context';
import { sessions, users } from '../db/schema';
import { newToken, sha256 } from '../security/crypto';

export const SESSION_COOKIE = 'vdi_session';

export async function createSession(app: AppContext, userId: string, meta: { ip?: string; userAgent?: string; method: string }): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + app.env.SESSION_ABSOLUTE_HOURS * 3600_000);
  await app.db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    method: meta.method,
  });
  return { token, expiresAt };
}

export async function resolveSession(app: AppContext, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const rows = await app.db
    .select({ s: sessions, u: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, sha256(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const now = Date.now();
  const idleMs = app.env.SESSION_IDLE_MINUTES * 60_000;
  if (row.s.expiresAt.getTime() <= now || row.s.lastSeenAt.getTime() + idleMs <= now || row.u.status !== 'active' || !isRole(row.u.role)) {
    await app.db.delete(sessions).where(eq(sessions.id, row.s.id));
    return null;
  }
  if (now - row.s.lastSeenAt.getTime() > 60_000) {
    await app.db.update(sessions).set({ lastSeenAt: new Date(now) }).where(eq(sessions.id, row.s.id));
  }
  return {
    id: row.u.id,
    orgId: row.u.orgId,
    email: row.u.email,
    name: row.u.name,
    role: row.u.role,
    language: row.u.language,
    scopes: row.u.scopes ?? {},
    isDemo: row.u.isDemo,
    sessionId: row.s.id,
  };
}

export async function destroySession(app: AppContext, sessionId: string): Promise<void> {
  await app.db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function destroyUserSessions(app: AppContext, userId: string): Promise<void> {
  await app.db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(app: AppContext): Promise<void> {
  const idleCutoff = new Date(Date.now() - app.env.SESSION_IDLE_MINUTES * 60_000);
  await app.db.delete(sessions).where(or(lt(sessions.expiresAt, new Date()), lt(sessions.lastSeenAt, idleCutoff)));
}

export { and };
