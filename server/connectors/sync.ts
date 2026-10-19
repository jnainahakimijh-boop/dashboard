/** Runs connector syncs, writes warehouse facts and keeps connection status truthful. */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { addDays } from '@shared/calendar';
import { COMPETITORS } from '@shared/catalog';
import type { AppContext } from '../context';
import { competitors as competitorsT, dataConnections, factRows, geoMeasurements, geoPromptVersions, geoPrompts, syncExecutions } from '../db/schema';
import { deleteFacts } from '../analytics/warehouse';
import { yesterdayParis } from '../analytics/service';
import { systemEvent } from '../audit';
import { safeErrorMessage } from '../security/redact';
import { CONNECTORS } from './registry';
import { analyseAnswer, askOpenAi, askPerplexity } from './geo';
import { ConnectorError, type FactRowInput } from './types';

export async function insertFacts(app: AppContext, rows: FactRowInput[], ref: { connectionId?: string | null; importId?: string | null }): Promise<number> {
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);
    await app.db.insert(factRows).values(batch.map((r) => ({ dataset: r.dataset, day: r.day, dims: r.dims, measures: r.measures, connectionId: ref.connectionId ?? null, importId: ref.importId ?? null })));
  }
  return rows.length;
}

export function readSecret(app: AppContext, ciphertext: string | null): Record<string, string> {
  if (!ciphertext) throw new ConnectorError('Credentials have not been configured for this connection');
  return JSON.parse(app.secrets.open(ciphertext));
}

export async function syncConnection(app: AppContext, connectionId: string, rangeIn?: { from: string; to: string }): Promise<{ rows: number; executionId: string }> {
  const [conn] = await app.db.select().from(dataConnections).where(eq(dataConnections.id, connectionId));
  if (!conn) throw new ConnectorError('Connection not found');
  const def = CONNECTORS[conn.provider];
  if (!def?.sync) throw new ConnectorError(`${def?.label ?? conn.provider} has no API synchronisation (use file import)`);
  if (conn.status === 'paused') throw new ConnectorError('Connection is paused');
  if (conn.mode !== 'api') throw new ConnectorError('Connection is not in API mode');
  const to = rangeIn?.to ?? yesterdayParis();
  const from = rangeIn?.from ?? (conn.lastSuccessAt ? addDays(to, -6) : addDays(to, -89));
  const [exec] = await app.db.insert(syncExecutions).values({ connectionId, status: 'running', kind: 'sync', details: { from, to } }).returning();
  try {
    const secret = readSecret(app, conn.secretCiphertext);
    const res = await def.sync(app, conn, secret, { from, to });
    for (const r of res.replace) await deleteFacts(app.db, r.dataset, r.from, r.to, r.dim && r.keys ? { dim: r.dim, keys: r.keys } : undefined);
    const n = await insertFacts(app, res.rows, { connectionId });
    await app.db
      .update(dataConnections)
      .set({ status: 'connected', lastSyncAt: new Date(), lastSuccessAt: new Date(), lastError: null, dataFrom: conn.dataFrom && conn.dataFrom < from ? conn.dataFrom : from, dataTo: to, updatedAt: new Date() })
      .where(eq(dataConnections.id, connectionId));
    await app.db.update(syncExecutions).set({ status: 'succeeded', finishedAt: new Date(), rowsWritten: n, details: { from, to, ...(res.details ?? {}) } }).where(eq(syncExecutions.id, exec.id));
    app.analytics.invalidate();
    return { rows: n, executionId: exec.id };
  } catch (err) {
    const msg = safeErrorMessage(err);
    await app.db
      .update(dataConnections)
      .set({ status: conn.status === 'connected' || conn.status === 'degraded' ? 'degraded' : 'disconnected', lastSyncAt: new Date(), lastError: msg, updatedAt: new Date() })
      .where(eq(dataConnections.id, connectionId));
    await app.db.update(syncExecutions).set({ status: 'failed', finishedAt: new Date(), error: msg }).where(eq(syncExecutions.id, exec.id));
    await systemEvent(app, 'warn', `connector:${conn.provider}`, `Sync failed for ${conn.name}`, { error: msg });
    throw err;
  }
}

export async function testConnection(app: AppContext, connectionId: string): Promise<{ ok: boolean; message: string }> {
  const [conn] = await app.db.select().from(dataConnections).where(eq(dataConnections.id, connectionId));
  if (!conn) throw new ConnectorError('Connection not found');
  const def = CONNECTORS[conn.provider];
  if (!def?.test) return { ok: false, message: 'No connection test is available for this provider' };
  const [exec] = await app.db.insert(syncExecutions).values({ connectionId, status: 'running', kind: 'test' }).returning();
  try {
    const secret = conn.provider === 'oidc' ? {} : readSecret(app, conn.secretCiphertext);
    const res = await def.test(app, conn, secret);
    await app.db.update(syncExecutions).set({ status: res.ok ? 'succeeded' : 'failed', finishedAt: new Date(), error: res.ok ? null : res.message }).where(eq(syncExecutions.id, exec.id));
    return res;
  } catch (err) {
    const msg = safeErrorMessage(err);
    await app.db.update(syncExecutions).set({ status: 'failed', finishedAt: new Date(), error: msg }).where(eq(syncExecutions.id, exec.id));
    return { ok: false, message: msg };
  }
}

export async function syncAllConnected(app: AppContext): Promise<Record<string, unknown>> {
  const conns = await app.db.select().from(dataConnections).where(and(inArray(dataConnections.status, ['connected', 'degraded']), eq(dataConnections.mode, 'api')));
  const out: Record<string, unknown> = {};
  for (const c of conns) {
    if (!CONNECTORS[c.provider]?.sync) continue;
    try {
      out[c.name] = await syncConnection(app, c.id);
    } catch (e) {
      out[c.name] = { error: safeErrorMessage(e) };
    }
  }
  return out;
}

/** Runs GEO measurements for the given prompts against one provider connection. */
export async function runGeoMeasurements(app: AppContext, connectionId: string, promptKeys: string[]): Promise<{ completed: number; failed: number }> {
  const [conn] = await app.db.select().from(dataConnections).where(eq(dataConnections.id, connectionId));
  if (!conn || conn.status !== 'connected') throw new ConnectorError('GEO provider is not connected');
  const secret = readSecret(app, conn.secretCiphertext);
  const model = String(conn.config.model ?? '');
  if (!model) throw new ConnectorError('Configure a model for this GEO provider');
  const brandTerms = String(conn.config.brandTerms ?? 'Veolia').split(',').map((s) => s.trim()).filter(Boolean);
  const comps = (await app.db.select().from(competitorsT)).map((c) => ({ key: c.key, name: c.name, domain: c.domain }));
  const providerKey = conn.provider === 'geo_openai' ? 'openai_api_search' : 'perplexity_api';
  const prompts = await app.db.select().from(geoPrompts).where(inArray(geoPrompts.key, promptKeys));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  let completed = 0;
  let failed = 0;
  for (const p of prompts) {
    const [v] = await app.db.select().from(geoPromptVersions).where(eq(geoPromptVersions.promptId, p.id)).orderBy(desc(geoPromptVersions.version)).limit(1);
    if (!v) continue;
    try {
      const ans = conn.provider === 'geo_openai' ? await askOpenAi(secret.apiKey, model, v.text) : await askPerplexity(secret.apiKey, model, v.text);
      const a = analyseAnswer(ans, brandTerms, 'veolia.com', comps.length ? comps : COMPETITORS.map((c) => ({ key: c.id, name: c.name, domain: c.domain })));
      await app.db.insert(geoMeasurements).values({ orgId: app.orgId, promptKey: p.key, promptVersion: v.version, provider: providerKey, measuredOn: today, status: ans.text ? 'completed' : 'partial', mentioned: a.mentioned, cited: a.cited, mentionRank: a.mentionRank, citedUrls: a.citedUrls, citedDomains: a.citedDomains, competitors: a.competitors, confidence: ans.text ? 'high' : 'low', model: ans.model ?? model, excerpt: a.excerpt, origin: 'api' });
      completed++;
    } catch (err) {
      await app.db.insert(geoMeasurements).values({ orgId: app.orgId, promptKey: p.key, promptVersion: v.version, provider: providerKey, measuredOn: today, status: 'failed', origin: 'api', model, error: safeErrorMessage(err) });
      failed++;
    }
  }
  await app.db.update(dataConnections).set({ lastSyncAt: new Date(), ...(completed ? { lastSuccessAt: new Date(), lastError: null } : { lastError: 'All measurements failed' }) }).where(eq(dataConnections.id, connectionId));
  app.analytics.invalidate();
  return { completed, failed };
}
