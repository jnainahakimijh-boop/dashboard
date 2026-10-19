/** ------------------------------------------------------------------
 *  Google Analytics 4 Data API (runReport) and Search Console
 *  (searchAnalytics.query) with service-account authentication.
 *  Endpoints:
 *   POST https://oauth2.googleapis.com/token
 *   POST https://analyticsdata.googleapis.com/v1beta/{property}:runReport
 *   POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
 *  ------------------------------------------------------------------ */
import { createSign } from 'node:crypto';
import { AI_REFERRAL_SOURCES, EVENTS } from '@shared/catalog';
import { ConnectorError, httpJson, type ConnectorDef, type FactRowInput, type SyncResult } from './types';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export function parseServiceAccount(json: string): ServiceAccount {
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(json);
  } catch {
    throw new ConnectorError('The service-account key is not valid JSON');
  }
  if (!sa.client_email || !sa.private_key?.includes('PRIVATE KEY')) throw new ConnectorError('The service-account key must contain client_email and private_key');
  return sa;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function buildJwtAssertion(sa: ServiceAccount, scope: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope, aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token', iat: nowSec, exp: nowSec + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
}

export async function googleAccessToken(sa: ServiceAccount, scope: string): Promise<string> {
  const assertion = buildJwtAssertion(sa, scope);
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
  const res = await httpJson<{ access_token: string }>(sa.token_uri ?? 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  return res.access_token;
}

/* ---------------- GA4 ---------------- */

export interface Ga4ReportRequest {
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensions: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dimensionFilter?: unknown;
  limit: number;
  offset: number;
  keepEmptyRows?: boolean;
}

export interface Ga4Response {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }>;
  rowCount?: number;
}

export function ga4Request(from: string, to: string, dimensions: string[], metrics: string[], offset = 0, dimensionFilter?: unknown): Ga4ReportRequest {
  return { dateRanges: [{ startDate: from, endDate: to }], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), ...(dimensionFilter ? { dimensionFilter } : {}), limit: 25000, offset };
}

/** Flatten a GA4 response to records keyed by header names. */
export function ga4Records(res: Ga4Response): Array<Record<string, string | number>> {
  const dh = res.dimensionHeaders?.map((h) => h.name) ?? [];
  const mh = res.metricHeaders?.map((h) => h.name) ?? [];
  return (res.rows ?? []).map((r) => {
    const o: Record<string, string | number> = {};
    dh.forEach((h, i) => (o[h] = r.dimensionValues[i]?.value ?? ''));
    mh.forEach((h, i) => (o[h] = Number(r.metricValues[i]?.value ?? 0)));
    return o;
  });
}

const ga4Date = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d);

/** Map GA4 default channel group + source/medium to this platform's channel ids. */
export function mapChannel(group: string, source: string, medium = ''): string {
  const s = source.toLowerCase();
  if (s.includes('chatgpt') && medium.toLowerCase() === 'cpc') return 'paid';
  if (AI_REFERRAL_SOURCES.some((a) => s === a || s.endsWith(`.${a}`))) return 'ai_referral';
  switch (group) {
    case 'Organic Search':
      return 'organic_search';
    case 'Direct':
      return 'direct';
    case 'Referral':
      return 'referral';
    case 'Organic Social':
    case 'Organic Video':
      return 'organic_social';
    case 'Email':
      return 'email';
    default:
      return 'other';
  }
}

async function runReport(token: string, property: string, req: Ga4ReportRequest): Promise<Array<Record<string, string | number>>> {
  const out: Array<Record<string, string | number>> = [];
  let offset = 0;
  for (let page = 0; page < 40; page++) {
    const res = await httpJson<Ga4Response>(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ ...req, offset }) });
    const recs = ga4Records(res);
    out.push(...recs);
    offset += recs.length;
    if (!recs.length || offset >= (res.rowCount ?? 0)) break;
  }
  return out;
}

const EVENT_NAMES = EVENTS.map((e) => e.id);
const eventFilter = { filter: { fieldName: 'eventName', inListFilter: { values: EVENT_NAMES } } };

/** Turns GA4 base + event records into fact rows for one table, merging event counts by key. */
export function ga4ToFacts(dataset: string, site: string, base: Array<Record<string, string | number>>, events: Array<Record<string, string | number>>, keyOf: (r: Record<string, string | number>) => Record<string, string> | null): FactRowInput[] {
  const map = new Map<string, FactRowInput>();
  const k = (day: string, dims: Record<string, string>) => `${day}|${JSON.stringify(dims)}`;
  for (const r of base) {
    const dims = keyOf(r);
    if (!dims) continue;
    const day = ga4Date(String(r.date));
    const key = k(day, dims);
    const cur = map.get(key) ?? { dataset, day, dims: { site, ...dims }, measures: {} };
    const add = (m: string, v: number) => (cur.measures[m] = (cur.measures[m] ?? 0) + v);
    add('sessions', Number(r.sessions ?? 0));
    if (r.totalUsers !== undefined) add('users', Number(r.totalUsers));
    if (r.newUsers !== undefined) add('newUsers', Number(r.newUsers));
    add('engaged', Number(r.engagedSessions ?? 0));
    if (r.screenPageViews !== undefined) add('views', Number(r.screenPageViews));
    if (r.userEngagementDuration !== undefined) add('engTime', Number(r.userEngagementDuration));
    map.set(key, cur);
  }
  for (const r of events) {
    const dims = keyOf(r);
    if (!dims) continue;
    const day = ga4Date(String(r.date));
    const key = k(day, dims);
    const cur = map.get(key);
    if (!cur) continue;
    const m = `ev_${r.eventName}`;
    cur.measures[m] = (cur.measures[m] ?? 0) + Number(r.eventCount ?? 0);
  }
  return [...map.values()];
}

export async function syncGa4(conn: { config: Record<string, unknown> }, secret: Record<string, string>, range: { from: string; to: string }): Promise<SyncResult> {
  const property = String(conn.config.property ?? '');
  const site = String(conn.config.site ?? '');
  if (!/^properties\/\d+$/.test(property)) throw new ConnectorError('Configure the GA4 property as properties/<numeric id>');
  if (!site) throw new ConnectorError('Configure the website this property measures');
  const token = await googleAccessToken(parseServiceAccount(secret.serviceAccountJson ?? ''), 'https://www.googleapis.com/auth/analytics.readonly');
  const R = (dims: string[], metrics: string[], filter?: unknown) => runReport(token, property, ga4Request(range.from, range.to, dims, metrics, 0, filter));
  const baseM = ['sessions', 'engagedSessions', 'screenPageViews', 'userEngagementDuration'];

  const webDims = ['date', 'countryId', 'sessionDefaultChannelGroup', 'sessionSource', 'sessionMedium', 'deviceCategory'];
  const webKey = (r: Record<string, string | number>) => ({ country: String(r.countryId || '(not set)').toUpperCase(), channel: mapChannel(String(r.sessionDefaultChannelGroup), String(r.sessionSource), String(r.sessionMedium)), device: String(r.deviceCategory || 'desktop').toLowerCase() });
  const web = ga4ToFacts('web', site, await R(webDims, [...baseM, 'totalUsers', 'newUsers']), await R([...webDims, 'eventName'], ['eventCount'], eventFilter), webKey);

  const acqDims = ['date', 'sessionDefaultChannelGroup', 'sessionSource', 'sessionMedium', 'sessionCampaignName'];
  const acqKey = (r: Record<string, string | number>) => ({ channel: mapChannel(String(r.sessionDefaultChannelGroup), String(r.sessionSource), String(r.sessionMedium)), srcmed: `${r.sessionSource} / ${r.sessionMedium}`, campaign: String(r.sessionCampaignName || '(not set)') });
  const acq = ga4ToFacts('webacq', site, await R(acqDims, baseM), await R([...acqDims, 'eventName'], ['eventCount'], eventFilter), acqKey);

  const pageKey = (r: Record<string, string | number>) => {
    const raw = String(r.landingPagePlusQueryString ?? r.landingPage ?? '');
    if (!raw.startsWith('/')) return null;
    return { page: `${site}:${raw.split('?')[0].replace(/\/$/, '') || '/'}` };
  };
  const pages = ga4ToFacts('webpage', site, await R(['date', 'landingPagePlusQueryString'], baseM), await R(['date', 'landingPagePlusQueryString', 'eventName'], ['eventCount'], eventFilter), pageKey);

  const browsers = ga4ToFacts('webbrowser', site, await R(['date', 'deviceCategory', 'browser'], ['sessions', 'engagedSessions']), [], (r) => ({ device: String(r.deviceCategory).toLowerCase(), browser: String(r.browser) }));
  const langs = ga4ToFacts('weblang', site, await R(['date', 'languageCode'], ['sessions', 'engagedSessions']), [], (r) => ({ lang: String(r.languageCode || 'und').slice(0, 2).toLowerCase() }));

  const rows = [...web, ...acq, ...pages, ...browsers, ...langs];
  return { rows, replace: ['web', 'webacq', 'webpage', 'webbrowser', 'weblang'].map((dataset) => ({ dataset, from: range.from, to: range.to, dim: 'site', keys: [site] })), details: { rows: rows.length } };
}

/* ---------------- Search Console ---------------- */

const ISO3_TO_2: Record<string, string> = { fra: 'FR', gbr: 'GB', deu: 'DE', esp: 'ES', bel: 'BE', ita: 'IT', nld: 'NL', che: 'CH', usa: 'US', can: 'CA', bra: 'BR', mar: 'MA', are: 'AE', ind: 'IN', chn: 'CN', aus: 'AU' };
export const gscCountry = (c: string) => ISO3_TO_2[c.toLowerCase()] ?? c.toUpperCase();

export interface GscResponse {
  rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
}

export function gscBody(from: string, to: string, dimensions: string[], startRow = 0) {
  return { startDate: from, endDate: to, dimensions, rowLimit: 25000, startRow, dataState: 'final' };
}

export function gscToFacts(dataset: string, site: string, dims: string[], res: GscResponse, basePath: string): FactRowInput[] {
  return (res.rows ?? []).map((r) => {
    const rec = Object.fromEntries(dims.map((d, i) => [d, r.keys[i]]));
    const out: Record<string, string> = { site };
    if (rec.country) out.country = gscCountry(rec.country);
    if (rec.device) out.device = rec.device.toLowerCase();
    if (rec.query) out.query = `${site}:${rec.query}`;
    if (rec.page) {
      let path = rec.page;
      try {
        path = new URL(rec.page).pathname;
      } catch {
        /* keep raw */
      }
      out.page = `${site}:${path.replace(/\/$/, '') || basePath}`;
    }
    return { dataset, day: rec.date, dims: out, measures: { impressions: r.impressions, clicks: r.clicks, posW: r.position * r.impressions } };
  });
}

export async function syncGsc(conn: { config: Record<string, unknown> }, secret: Record<string, string>, range: { from: string; to: string }): Promise<SyncResult> {
  const siteUrl = String(conn.config.siteUrl ?? '');
  const site = String(conn.config.site ?? '');
  if (!siteUrl || !site) throw new ConnectorError('Configure the Search Console property URL and the website it belongs to');
  const token = await googleAccessToken(parseServiceAccount(secret.serviceAccountJson ?? ''), 'https://www.googleapis.com/auth/webmasters.readonly');
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const fetchAll = async (dims: string[]) => {
    const all: GscResponse = { rows: [] };
    for (let start = 0, page = 0; page < 40; page++) {
      const res = await httpJson<GscResponse>(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(gscBody(range.from, range.to, dims, start)) });
      all.rows!.push(...(res.rows ?? []));
      if (!res.rows?.length || res.rows.length < 25000) break;
      start += res.rows.length;
    }
    return all;
  };
  const basePath = new URL(siteUrl.startsWith('sc-domain:') ? 'https://example.org/' : siteUrl).pathname.replace(/\/$/, '') || '/';
  const rows = [
    ...gscToFacts('search', site, ['date', 'country', 'device'], await fetchAll(['date', 'country', 'device']), basePath),
    ...gscToFacts('searchquery', site, ['date', 'query'], await fetchAll(['date', 'query']), basePath),
    ...gscToFacts('searchpage', site, ['date', 'page'], await fetchAll(['date', 'page']), basePath),
  ];
  return { rows, replace: ['search', 'searchquery', 'searchpage'].map((dataset) => ({ dataset, from: range.from, to: range.to, dim: 'site', keys: [site] })), details: { rows: rows.length } };
}

export const ga4Connector: ConnectorDef = {
  provider: 'ga4',
  label: 'Google Analytics 4',
  modes: ['api', 'csv', 'demo'],
  configFields: [
    { key: 'property', label: { en: 'GA4 property', fr: 'Propriété GA4' }, required: true, placeholder: 'properties/123456789' },
    { key: 'site', label: { en: 'Website key', fr: 'Clé du site' }, required: true, placeholder: 'veolia-fr' },
  ],
  secretFields: [{ key: 'serviceAccountJson', label: { en: 'Service-account key (JSON)', fr: 'Clé de compte de service (JSON)' }, multiline: true }],
  readiness: {
    implementation: 'implemented',
    verifiedLive: false,
    docs: ['https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport'],
    credentials: 'Service account with Viewer access on the GA4 property',
    prerequisites: { en: 'Add the service account e-mail as a Viewer of each GA4 property. Mark key events in GA4. Optional: AI-referral sources are classified from sessionSource.', fr: 'Ajouter l’e-mail du compte de service comme Lecteur de chaque propriété GA4. Marquer les événements clés dans GA4.' },
    limitations: { en: 'Users are synchronised per day; period totals of users are approximations. GA4 thresholding may hide small rows. Not tested against a live property from this environment.', fr: 'Utilisateurs synchronisés par jour : les totaux de période sont des approximations. Le seuillage GA4 peut masquer de petites lignes. Non testé sur une propriété réelle depuis cet environnement.' },
  },
  sync: (_app, conn, secret, range) => syncGa4(conn, secret, range),
  test: async (_app, conn, secret) => {
    const token = await googleAccessToken(parseServiceAccount(secret.serviceAccountJson ?? ''), 'https://www.googleapis.com/auth/analytics.readonly');
    await httpJson(`https://analyticsdata.googleapis.com/v1beta/${conn.config.property}/metadata`, { headers: { authorization: `Bearer ${token}` } });
    return { ok: true, message: 'Property metadata retrieved' };
  },
};

export const gscConnector: ConnectorDef = {
  provider: 'gsc',
  label: 'Google Search Console',
  modes: ['api', 'csv', 'demo'],
  configFields: [
    { key: 'siteUrl', label: { en: 'Property URL', fr: 'URL de la propriété' }, required: true, placeholder: 'https://www.veolia.com/fr/' },
    { key: 'site', label: { en: 'Website key', fr: 'Clé du site' }, required: true, placeholder: 'veolia-fr' },
  ],
  secretFields: [{ key: 'serviceAccountJson', label: { en: 'Service-account key (JSON)', fr: 'Clé de compte de service (JSON)' }, multiline: true }],
  readiness: {
    implementation: 'implemented',
    verifiedLive: false,
    docs: ['https://developers.google.com/webmaster-tools/v1/searchanalytics/query'],
    credentials: 'Service account added as a user (restricted) of the Search Console property',
    prerequisites: { en: 'Add the service account to each property in Search Console (Settings → Users and permissions).', fr: 'Ajouter le compte de service à chaque propriété dans Search Console (Paramètres → Utilisateurs et autorisations).' },
    limitations: { en: 'Data is final after ~2 days; anonymised queries are excluded from query-level rows; average position is not a rank-tracker reading. Not tested live from this environment.', fr: 'Données définitives après ~2 jours ; requêtes anonymisées exclues au niveau requête ; la position moyenne n’est pas un suivi de positionnement. Non testé en réel depuis cet environnement.' },
  },
  sync: (_app, conn, secret, range) => syncGsc(conn, secret, range),
  test: async (_app, conn, secret) => {
    const token = await googleAccessToken(parseServiceAccount(secret.serviceAccountJson ?? ''), 'https://www.googleapis.com/auth/webmasters.readonly');
    await httpJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(String(conn.config.siteUrl))}`, { headers: { authorization: `Bearer ${token}` } });
    return { ok: true, message: 'Property accessible' };
  },
};
