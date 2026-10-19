import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { can, type Permission } from '@shared/rbac';
import { writeAudit } from '../audit';
import { HttpError, clientIp, type HonoEnv } from '../context';
import { SESSION_COOKIE, resolveSession } from './session';

/** Attaches the authenticated user (if any) to the request. */
export const sessionMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  c.set('user', token ? await resolveSession(c.get('app'), token) : null);
  await next();
};

export const requireAuth: MiddlewareHandler<HonoEnv> = async (c, next) => {
  if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'unauthenticated');
  await next();
};

/** Server-side permission check; denials are audited. */
export function requirePermission(p: Permission): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const u = c.get('user');
    if (!u) throw new HttpError(401, 'Authentication required', 'unauthenticated');
    if (!can(u.role, p)) {
      await writeAudit(c.get('app'), {
        action: 'access.denied',
        outcome: 'denied',
        userId: u.id,
        userEmail: u.email,
        ip: clientIp(c),
        details: { permission: p, method: c.req.method, path: c.req.path },
      });
      throw new HttpError(403, 'You do not have permission to perform this action', 'forbidden', { permission: p });
    }
    await next();
  };
}

export function assertCan(user: { role: Parameters<typeof can>[0] } | null, p: Permission): void {
  if (!user) throw new HttpError(401, 'Authentication required', 'unauthenticated');
  if (!can(user.role, p)) throw new HttpError(403, 'You do not have permission to perform this action', 'forbidden', { permission: p });
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-vdi-request';

/**
 * CSRF defence for cookie-authenticated JSON APIs: state-changing requests must carry a
 * custom header (not settable cross-site without CORS, which is not enabled) and, when the
 * browser sends an Origin, it must be this application's origin.
 */
export const csrfMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  if (SAFE.has(c.req.method) || c.req.path.startsWith('/api/ingest/')) return next();
  if (c.req.header(CSRF_HEADER) !== '1') throw new HttpError(403, 'Missing request verification header', 'csrf');
  const origin = c.req.header('origin');
  if (origin) {
    const app = c.get('app');
    const allowed = new Set([new URL(app.env.APP_BASE_URL).origin]);
    const host = c.req.header('host');
    if (host) {
      allowed.add(`http://${host}`);
      allowed.add(`https://${host}`);
    }
    if (!allowed.has(origin)) throw new HttpError(403, 'Cross-origin request rejected', 'csrf');
  }
  await next();
};

/* ---------------- rate limiting (in-process, fixed window) ---------------- */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(name: string, limit: number, windowMs: number, key: (c: Parameters<MiddlewareHandler<HonoEnv>>[0]) => string): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    const k = `${name}:${key(c)}`;
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(k, b);
    }
    b.count++;
    if (b.count > limit) {
      c.header('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)));
      throw new HttpError(429, 'Too many requests — please wait and try again', 'rate_limited');
    }
    if (buckets.size > 50_000) for (const [kk, v] of buckets) if (v.resetAt <= now) buckets.delete(kk);
    await next();
  };
}

export function resetRateLimits(): void {
  buckets.clear();
}

/** Security headers for API and SPA responses. */
export const securityHeaders: MiddlewareHandler<HonoEnv> = async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  c.header('Cross-Origin-Opener-Policy', 'same-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (c.get('app')?.env.isProduction) c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (!c.req.path.startsWith('/api/')) {
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
  } else {
    c.header('Cache-Control', 'no-store');
  }
};
