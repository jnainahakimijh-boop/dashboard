import type { Context } from 'hono';
import type { Permission, Role } from '@shared/rbac';
import type { DB, DbHandle } from './db/client';
import type { Env } from './env';
import type { SecretBox } from './security/crypto';
import type { AnalyticsService } from './analytics/service';
import type { JobQueue } from './jobs/queue';
import type { Logger } from './logger';

export interface AppContext {
  env: Env;
  dbh: DbHandle;
  db: DB;
  secrets: SecretBox;
  orgId: string;
  analytics: AnalyticsService;
  jobs: JobQueue;
  log: Logger;
  startedAt: Date;
}

export interface SessionUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
  language: string;
  scopes: { websites?: string[]; modules?: string[] };
  isDemo: boolean;
  sessionId: string;
}

export type HonoEnv = {
  Variables: {
    app: AppContext;
    user: SessionUser | null;
    requestId: string;
  };
};

export type Ctx = Context<HonoEnv>;

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 501 | 502 | 503,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function currentUser(c: Ctx): SessionUser {
  const u = c.get('user');
  if (!u) throw new HttpError(401, 'Authentication required', 'unauthenticated');
  return u;
}

export function clientIp(c: Ctx): string {
  const app = c.get('app');
  if (app.env.TRUST_PROXY) {
    const xf = c.req.header('x-forwarded-for');
    if (xf) return xf.split(',')[0].trim();
  }
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return incoming?.socket?.remoteAddress ?? 'unknown';
}

export type { Permission };
