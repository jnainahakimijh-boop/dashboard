/** Inbound webhooks (no session; HMAC-authenticated). */
import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { DRUPAL_FORMS } from '@shared/catalog';
import { writeAudit } from '../audit';
import { HttpError, clientIp, type HonoEnv } from '../context';
import { dataConnections, factRows } from '../db/schema';
import { rateLimit } from '../auth/middleware';
import { drupalPayloadSchema, parisDay, verifyDrupalSignature } from '../connectors/drupal';
import { readSecret } from '../connectors/sync';

export function ingestRoutes() {
  const r = new Hono<HonoEnv>();

  r.post(
    '/drupal/:connectionId',
    rateLimit('ingest', 600, 60_000, (c) => c.req.param('connectionId') ?? 'x'),
    async (c) => {
      const app = c.get('app');
      const id = c.req.param('connectionId');
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Not found');
      const raw = await c.req.text();
      if (raw.length > 20_000) throw new HttpError(413, 'Payload too large');
      const [conn] = await app.db.select().from(dataConnections).where(and(eq(dataConnections.id, id), eq(dataConnections.provider, 'drupal')));
      if (!conn || !conn.secretCiphertext || conn.status === 'paused' || conn.mode !== 'webhook') throw new HttpError(404, 'Not found');
      const secret = readSecret(app, conn.secretCiphertext).webhookSecret;
      if (!verifyDrupalSignature(secret, c.req.header('x-vdi-timestamp'), c.req.header('x-vdi-signature'), raw)) {
        await writeAudit(app, { action: 'ingest.drupal', outcome: 'denied', entityType: 'connection', entityId: id, ip: clientIp(c), details: { reason: 'bad_signature' } });
        throw new HttpError(401, 'Invalid signature', 'bad_signature');
      }
      let parsed;
      try {
        parsed = drupalPayloadSchema.parse(JSON.parse(raw));
      } catch {
        throw new HttpError(422, 'Invalid payload', 'validation');
      }
      // everything except form id and timestamp is discarded here — no personal data is stored
      const formMap = (typeof conn.config.formMap === 'string' ? JSON.parse(conn.config.formMap || '{}') : conn.config.formMap ?? {}) as Record<string, string>;
      const form = formMap[parsed.form_id] ?? parsed.form_id;
      if (!DRUPAL_FORMS.some((f) => f.id === form)) throw new HttpError(422, 'Unmapped form id', 'unmapped_form');
      const site = String(conn.config.site ?? '');
      const day = parisDay(parsed.submitted_at);
      const [existing] = await app.db
        .select()
        .from(factRows)
        .where(and(eq(factRows.dataset, 'forms'), eq(factRows.day, day), sql`${factRows.dims} ->> 'site' = ${site}`, sql`${factRows.dims} ->> 'form' = ${form}`))
        .limit(1);
      if (existing) await app.db.update(factRows).set({ measures: { submissions: Number(existing.measures.submissions ?? 0) + 1 } }).where(eq(factRows.id, existing.id));
      else await app.db.insert(factRows).values({ dataset: 'forms', day, dims: { site, form }, measures: { submissions: 1 }, connectionId: id });
      await app.db.update(dataConnections).set({ status: 'connected', lastSuccessAt: new Date(), lastSyncAt: new Date(), lastError: null }).where(eq(dataConnections.id, id));
      app.analytics.invalidate();
      return c.json({ ok: true });
    },
  );

  return r;
}
