/** ------------------------------------------------------------------
 *  ChatGPT Ads — READ-ONLY reporting connector.
 *
 *  Based on OpenAI's Ads API documentation (developers.openai.com/ads,
 *  /ads/reporting, /ads/api-reference/insights) as summarised from the
 *  official pages on 2026-10-19: base URL https://api.ads.openai.com/v1,
 *  Bearer API key scoped to one ad account, list endpoints with cursor
 *  pagination (limit ≤ 500, `after`, `has_more`), and insights at
 *  /ad_account/insights with aggregation_level (campaign | ad_group | ad),
 *  time_granularity (none | daily), JSON-encoded time_ranges (exclusive
 *  end, ≤ 365 days) and fields[]. The official pages show two different
 *  field-naming styles, so the response field mapping is configurable
 *  and must be checked against the live API before production use.
 *
 *  Only GET requests are issued. No campaign, budget, ad or pixel is
 *  created or modified.
 *  ------------------------------------------------------------------ */
import { addDays } from '@shared/calendar';
import { ConnectorError, httpJson, type ConnectorDef, type FactRowInput, type SyncResult } from './types';

export const DEFAULT_FIELD_MAP = {
  date: 'readable_time',
  adId: 'ad_id',
  spend: 'spend',
  impressions: 'impressions',
  clicks: 'clicks',
  conversions: 'conversions',
};
export type FieldMap = typeof DEFAULT_FIELD_MAP;

export function insightsUrl(baseUrl: string, from: string, to: string, fields: string[], after?: string): string {
  const u = new URL(`${baseUrl.replace(/\/$/, '')}/ad_account/insights`);
  u.searchParams.set('aggregation_level', 'ad');
  u.searchParams.set('time_granularity', 'daily');
  u.searchParams.append('time_ranges[]', JSON.stringify({ since: from, until: addDays(to, 1) }));
  for (const f of fields) u.searchParams.append('fields[]', f);
  u.searchParams.set('limit', '500');
  if (after) u.searchParams.set('after', after);
  return u.toString();
}

const path = (o: unknown, p: string): unknown => p.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o);

export function insightsToFacts(rows: unknown[], map: FieldMap, knownAds: Map<string, string>): { facts: FactRowInput[]; unknownAds: string[] } {
  const unknown = new Set<string>();
  const facts: FactRowInput[] = [];
  for (const r of rows) {
    const extId = String(path(r, map.adId) ?? '');
    const day = String(path(r, map.date) ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const ad = knownAds.get(extId);
    if (!ad) {
      unknown.add(extId);
      continue;
    }
    const n = (k: keyof FieldMap) => Number(path(r, map[k]) ?? 0) || 0;
    facts.push({ dataset: 'ads', day, dims: { ad }, measures: { spend: n('spend'), impressions: n('impressions'), clicks: n('clicks'), conversions: n('conversions') } });
  }
  return { facts, unknownAds: [...unknown] };
}

export const chatgptAdsConnector: ConnectorDef = {
  provider: 'chatgpt_ads',
  label: 'ChatGPT Ads',
  modes: ['api', 'csv', 'demo'],
  configFields: [
    { key: 'baseUrl', label: { en: 'API base URL', fr: 'URL de base de l’API' }, required: true, placeholder: 'https://api.ads.openai.com/v1' },
    { key: 'fieldMap', label: { en: 'Response field mapping (JSON)', fr: 'Correspondance des champs (JSON)' }, required: false, placeholder: JSON.stringify(DEFAULT_FIELD_MAP) },
  ],
  secretFields: [{ key: 'apiKey', label: { en: 'Ads API key (read access)', fr: 'Clé API Ads (lecture)' } }],
  readiness: {
    implementation: 'partial',
    verifiedLive: false,
    docs: ['https://developers.openai.com/ads', 'https://developers.openai.com/ads/reporting', 'https://developers.openai.com/ads/api-reference/insights', 'https://help.openai.com/en/articles/20001214-measure-results'],
    credentials: 'Ads API key created in ChatGPT Ads Manager (one key per ad account)',
    prerequisites: {
      en: 'Create a read-only Ads API key for the advertiser account, map each ad’s external id in Administration → Advertising, and confirm the insight field names against the API reference.',
      fr: 'Créer une clé API Ads en lecture, renseigner l’identifiant externe de chaque annonce (Administration → Publicité) et vérifier les noms de champs dans la référence de l’API.',
    },
    limitations: {
      en: 'The documentation pages could not be fetched from this build environment; endpoints follow official excerpts and field names are configurable. Spend finalises after several hours; conversions can appear 24–48 h late. Read-only: no ad creation, budget change or pixel deployment.',
      fr: 'La documentation n’a pas pu être consultée depuis l’environnement de build ; les points d’accès suivent des extraits officiels et les champs sont paramétrables. Les dépenses se finalisent après plusieurs heures ; conversions avec 24–48 h de délai. Lecture seule.',
    },
  },
  sync: async (app, conn, secret, range): Promise<SyncResult> => {
    const base = String(conn.config.baseUrl ?? 'https://api.ads.openai.com/v1');
    if (!/^https:\/\//.test(base)) throw new ConnectorError('Base URL must use HTTPS');
    let map = DEFAULT_FIELD_MAP;
    if (conn.config.fieldMap) {
      try {
        map = { ...DEFAULT_FIELD_MAP, ...(typeof conn.config.fieldMap === 'string' ? JSON.parse(conn.config.fieldMap) : conn.config.fieldMap) };
      } catch {
        throw new ConnectorError('Field mapping is not valid JSON');
      }
    }
    const { ads } = await import('../db/schema');
    const known = new Map((await app.db.select().from(ads)).filter((a) => a.externalId).map((a) => [a.externalId!, a.key]));
    if (!known.size) throw new ConnectorError('No ad has an external id yet. Map ads to their ChatGPT Ads ids in Administration → Advertising.');
    const headers = { authorization: `Bearer ${secret.apiKey}` };
    const rows: unknown[] = [];
    let after: string | undefined;
    for (let page = 0; page < 50; page++) {
      const res = await httpJson<{ data?: unknown[]; has_more?: boolean; last_id?: string }>(insightsUrl(base, range.from, range.to, Object.values(map), after), { headers });
      rows.push(...(res.data ?? []));
      if (!res.has_more || !res.last_id) break;
      after = res.last_id;
    }
    const { facts, unknownAds } = insightsToFacts(rows, map, known);
    return { rows: facts, replace: [{ dataset: 'ads', from: range.from, to: range.to, dim: 'ad', keys: [...known.values()] }], details: { rowsReceived: rows.length, unknownAds } };
  },
  test: async (_app, conn, secret) => {
    const base = String(conn.config.baseUrl ?? 'https://api.ads.openai.com/v1').replace(/\/$/, '');
    await httpJson(`${base}/campaigns?limit=1`, { headers: { authorization: `Bearer ${secret.apiKey}` } });
    return { ok: true, message: 'Campaign list readable' };
  },
};
