import { auditLogs, systemEvents } from './db/schema';
import type { AppContext, Ctx } from './context';
import { clientIp } from './context';
import { redact } from './security/redact';

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string | null;
  outcome?: 'success' | 'failure' | 'denied';
  details?: Record<string, unknown>;
  userId?: string | null;
  userEmail?: string | null;
  ip?: string | null;
}

export async function writeAudit(app: AppContext, e: AuditEntry): Promise<void> {
  try {
    await app.db.insert(auditLogs).values({
      orgId: app.orgId,
      userId: e.userId ?? null,
      userEmail: e.userEmail ?? null,
      action: e.action,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      outcome: e.outcome ?? 'success',
      ip: e.ip ?? null,
      details: redact(e.details ?? {}),
    });
  } catch (err) {
    app.log.error('audit write failed', { action: e.action, err: String(err) });
  }
}

/** Audit an action performed by the request's user. */
export function audit(c: Ctx, e: Omit<AuditEntry, 'userId' | 'userEmail' | 'ip'>): Promise<void> {
  const u = c.get('user');
  return writeAudit(c.get('app'), { ...e, userId: u?.id ?? null, userEmail: u?.email ?? null, ip: clientIp(c) });
}

export async function systemEvent(app: AppContext, level: 'info' | 'warn' | 'error', source: string, message: string, details: Record<string, unknown> = {}) {
  try {
    await app.db.insert(systemEvents).values({ level, source, message: message.slice(0, 1000), details: redact(details) });
  } catch (err) {
    app.log.error('system event write failed', { err: String(err) });
  }
}
