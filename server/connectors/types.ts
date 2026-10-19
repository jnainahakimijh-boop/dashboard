import type { L10n } from '@shared/catalog';
import type { AppContext } from '../context';
import type { dataConnections } from '../db/schema';

export type Connection = typeof dataConnections.$inferSelect;

export interface FactRowInput {
  dataset: string;
  day: string;
  dims: Record<string, string>;
  measures: Record<string, number>;
}

export interface SyncResult {
  rows: FactRowInput[];
  /** datasets written, with the entity dimension used for replacement (e.g. site, account, ad) */
  replace: Array<{ dataset: string; from: string; to: string; dim?: string; keys?: string[] }>;
  details?: Record<string, unknown>;
}

export interface Readiness {
  implementation: 'implemented' | 'partial' | 'manual_only';
  verifiedLive: boolean;
  docs: string[];
  credentials: string;
  prerequisites: L10n;
  limitations: L10n;
}

export interface ConnectorDef {
  provider: string;
  label: string;
  modes: Array<'api' | 'csv' | 'demo' | 'webhook'>;
  /** non-secret configuration keys shown in the admin form */
  configFields: Array<{ key: string; label: L10n; required: boolean; placeholder?: string }>;
  /** names of secret fields (write-only) */
  secretFields: Array<{ key: string; label: L10n; multiline?: boolean }>;
  readiness: Readiness;
  test?: (app: AppContext, conn: Connection, secret: Record<string, string>) => Promise<{ ok: boolean; message: string }>;
  sync?: (app: AppContext, conn: Connection, secret: Record<string, string>, range: { from: string; to: string }) => Promise<SyncResult>;
}

export class ConnectorError extends Error {}

/** fetch with timeout and bounded response size; never logs headers. */
export async function httpJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 30_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (text.length > 50 * 1024 * 1024) throw new ConnectorError('Response too large');
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new ConnectorError(`Unexpected non-JSON response (HTTP ${res.status})`);
    }
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } | string; message?: string; detail?: string })?.error;
      const m = typeof msg === 'string' ? msg : msg?.message ?? (json as { message?: string })?.message ?? (json as { detail?: string })?.detail ?? res.statusText;
      throw new ConnectorError(`HTTP ${res.status}: ${String(m).slice(0, 300)}`);
    }
    return json as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ConnectorError('Request timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
