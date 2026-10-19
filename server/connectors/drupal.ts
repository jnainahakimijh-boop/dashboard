/** ------------------------------------------------------------------
 *  Drupal Webform submissions via a signed webhook (push) or CSV.
 *  Only the form id, site and timestamp are kept: every other field of
 *  the payload (names, e-mails, messages…) is discarded on receipt.
 *  Signature: X-VDI-Signature: sha256=<hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)>
 *             X-VDI-Timestamp: <unix seconds>, accepted within ±5 minutes.
 *  ------------------------------------------------------------------ */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { ConnectorDef } from './types';

export const drupalPayloadSchema = z.object({
  form_id: z.string().min(1).max(100),
  submitted_at: z.string().datetime({ offset: true }),
  site: z.string().min(1).max(60).optional(),
});

export function signDrupal(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

export function verifyDrupalSignature(secret: string, timestamp: string | undefined, signature: string | undefined, rawBody: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!timestamp || !signature || !/^\d{9,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSec - Number(timestamp)) > 300) return false;
  const expected = Buffer.from(signDrupal(secret, timestamp, rawBody));
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Paris calendar day of a submission timestamp. */
export function parisDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export const drupalConnector: ConnectorDef = {
  provider: 'drupal',
  label: 'Drupal Webform',
  modes: ['webhook', 'csv', 'demo'],
  configFields: [
    { key: 'site', label: { en: 'Website key', fr: 'Clé du site' }, required: true, placeholder: 'veolia-fr' },
    { key: 'formMap', label: { en: 'Webform id → form key (JSON)', fr: 'Webform → clé de formulaire (JSON)' }, required: false, placeholder: '{"contact":"contact","demande_projet":"lead_request"}' },
  ],
  secretFields: [{ key: 'webhookSecret', label: { en: 'Webhook signing secret', fr: 'Secret de signature du webhook' } }],
  readiness: {
    implementation: 'implemented',
    verifiedLive: false,
    docs: ['docs/INTEGRATIONS.md#drupal-webform'],
    credentials: 'Shared signing secret configured in a small Drupal module or Webform remote-post handler',
    prerequisites: { en: 'The Drupal team adds a remote-post handler sending only form_id and submitted_at, signed with the shared secret, to /api/ingest/drupal/<connection id>. No change is made to the Veolia websites by this platform.', fr: 'L’équipe Drupal ajoute un envoi distant transmettant uniquement form_id et submitted_at, signé, vers /api/ingest/drupal/<id>. Cette plateforme ne modifie pas les sites Veolia.' },
    limitations: { en: 'Counts only — no personal data is stored. Historical data must be imported by CSV.', fr: 'Comptages uniquement — aucune donnée personnelle. L’historique s’importe par CSV.' },
  },
};
