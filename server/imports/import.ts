/** ------------------------------------------------------------------
 *  CSV / XLSX imports into the warehouse. Each dataset has a column
 *  spec; every row is validated (dates, known entities, non-negative
 *  numbers, duplicates). Accepted rows replace existing facts for the
 *  same dataset, period and entities; rejected rows are stored with
 *  reasons so they can be downloaded and fixed.
 *  ------------------------------------------------------------------ */
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { COUNTRIES, DEVICES, DRUPAL_FORMS, EVENTS } from '@shared/catalog';
import { isIsoDate } from '@shared/calendar';
import type { AppContext } from '../context';
import { ads, dataConnections, geoMeasurements, imports, socialAccounts, websites } from '../db/schema';
import { countFacts, deleteFacts } from '../analytics/warehouse';
import { insertFacts } from '../connectors/sync';
import type { FactRowInput } from '../connectors/types';
import { yesterdayParis } from '../analytics/service';

type ColType = 'date' | 'string' | 'number' | 'bool' | 'list';
interface Col {
  name: string;
  type: ColType;
  required?: boolean;
  /** dimension key in fact_rows */
  dim?: string;
  /** measure key in fact_rows */
  measure?: string;
  enum?: readonly string[];
  entity?: 'site' | 'account' | 'ad';
}

interface Spec {
  dataset: string;
  provider: string;
  label: string;
  columns: Col[];
  entityDim?: string;
}

const EVENT_COLS: Col[] = EVENTS.map((e) => ({ name: `event_${e.id}`, type: 'number', measure: `ev_${e.id}` }));
const GA4_BASE: Col[] = [
  { name: 'sessions', type: 'number', measure: 'sessions', required: true },
  { name: 'engaged_sessions', type: 'number', measure: 'engaged' },
  { name: 'views', type: 'number', measure: 'views' },
  { name: 'engagement_time_seconds', type: 'number', measure: 'engTime' },
];
const CHANNEL_IDS = ['organic_search', 'direct', 'referral', 'organic_social', 'email', 'ai_referral', 'paid', 'other'] as const;
const site: Col = { name: 'site', type: 'string', required: true, dim: 'site', entity: 'site' };
const date: Col = { name: 'date', type: 'date', required: true };

export const IMPORT_SPECS: Record<string, Spec> = {
  web: {
    dataset: 'web',
    provider: 'ga4',
    label: 'GA4 — sessions by country, channel and device',
    entityDim: 'site',
    columns: [date, site, { name: 'country', type: 'string', required: true, dim: 'country' }, { name: 'channel', type: 'string', required: true, dim: 'channel', enum: CHANNEL_IDS }, { name: 'device', type: 'string', required: true, dim: 'device', enum: DEVICES.map((d) => d.id) }, ...GA4_BASE, { name: 'users', type: 'number', measure: 'users' }, { name: 'new_users', type: 'number', measure: 'newUsers' }, ...EVENT_COLS],
  },
  webacq: {
    dataset: 'webacq',
    provider: 'ga4',
    label: 'GA4 — acquisition (source / medium, campaign)',
    entityDim: 'site',
    columns: [date, site, { name: 'channel', type: 'string', required: true, dim: 'channel', enum: CHANNEL_IDS }, { name: 'source_medium', type: 'string', required: true, dim: 'srcmed' }, { name: 'campaign', type: 'string', required: true, dim: 'campaign' }, ...GA4_BASE, ...EVENT_COLS],
  },
  webpage: {
    dataset: 'webpage',
    provider: 'ga4',
    label: 'GA4 — landing pages',
    entityDim: 'site',
    columns: [date, site, { name: 'page_path', type: 'string', required: true, dim: 'page' }, ...GA4_BASE, ...EVENT_COLS],
  },
  search: {
    dataset: 'search',
    provider: 'gsc',
    label: 'Search Console — property totals by country and device',
    entityDim: 'site',
    columns: [date, site, { name: 'country', type: 'string', required: true, dim: 'country' }, { name: 'device', type: 'string', required: true, dim: 'device', enum: DEVICES.map((d) => d.id) }, { name: 'clicks', type: 'number', measure: 'clicks', required: true }, { name: 'impressions', type: 'number', measure: 'impressions', required: true }, { name: 'position', type: 'number' }],
  },
  searchquery: {
    dataset: 'searchquery',
    provider: 'gsc',
    label: 'Search Console — queries',
    entityDim: 'site',
    columns: [date, site, { name: 'query', type: 'string', required: true, dim: 'query' }, { name: 'clicks', type: 'number', measure: 'clicks', required: true }, { name: 'impressions', type: 'number', measure: 'impressions', required: true }, { name: 'position', type: 'number' }],
  },
  searchpage: {
    dataset: 'searchpage',
    provider: 'gsc',
    label: 'Search Console — pages',
    entityDim: 'site',
    columns: [date, site, { name: 'page_path', type: 'string', required: true, dim: 'page' }, { name: 'clicks', type: 'number', measure: 'clicks', required: true }, { name: 'impressions', type: 'number', measure: 'impressions', required: true }, { name: 'position', type: 'number' }],
  },
  social: {
    dataset: 'social',
    provider: 'social',
    label: 'Social accounts — daily statistics',
    entityDim: 'account',
    columns: [
      date,
      { name: 'account', type: 'string', required: true, dim: 'account', entity: 'account' },
      ...['impressions', 'engagements', 'reactions', 'comments', 'shares', 'clicks', 'link_clicks', 'video_views', 'watch_minutes', 'followers_gained', 'followers_lost', 'followers', 'posts'].map(
        (n): Col => ({ name: n, type: 'number', measure: n.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()) }),
      ),
    ],
  },
  ads: {
    dataset: 'ads',
    provider: 'chatgpt_ads',
    label: 'ChatGPT Ads — daily by ad (Ads Manager export)',
    entityDim: 'ad',
    columns: [date, { name: 'ad', type: 'string', required: true, dim: 'ad', entity: 'ad' }, { name: 'spend', type: 'number', measure: 'spend', required: true }, { name: 'impressions', type: 'number', measure: 'impressions', required: true }, { name: 'clicks', type: 'number', measure: 'clicks', required: true }, { name: 'conversions', type: 'number', measure: 'conversions' }],
  },
  forms: {
    dataset: 'forms',
    provider: 'drupal',
    label: 'Drupal webform submissions (daily counts)',
    entityDim: 'site',
    columns: [date, site, { name: 'form', type: 'string', required: true, dim: 'form', enum: DRUPAL_FORMS.map((f) => f.id) }, { name: 'submissions', type: 'number', measure: 'submissions', required: true }],
  },
  posts: {
    dataset: 'posts',
    provider: 'social',
    label: 'Social posts (lifetime metrics)',
    entityDim: 'account',
    columns: [
      { name: 'published_at', type: 'date', required: true },
      { name: 'post_id', type: 'string', required: true, dim: 'post' },
      { name: 'account', type: 'string', required: true, dim: 'account', entity: 'account' },
      { name: 'platform', type: 'string', required: true, dim: 'platform', enum: ['linkedin', 'x', 'youtube'] },
      { name: 'format', type: 'string', dim: 'format' },
      { name: 'topic', type: 'string', dim: 'topic' },
      { name: 'campaign', type: 'string', dim: 'campaign' },
      { name: 'language', type: 'string', dim: 'language', enum: ['en', 'fr'] },
      { name: 'hour', type: 'string', dim: 'hour' },
      { name: 'text', type: 'string', dim: 'text' },
      { name: 'url', type: 'string', dim: 'url' },
      ...['impressions', 'reactions', 'comments', 'shares', 'clicks', 'link_clicks', 'video_views', 'watch_minutes', 'engagements'].map((n): Col => ({ name: n, type: 'number', measure: n.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()) })),
    ],
  },
  geo_measurements: {
    dataset: 'geo_measurements',
    provider: 'geo_manual',
    label: 'GEO measurements (manual observations)',
    columns: [
      date,
      { name: 'prompt', type: 'string', required: true },
      { name: 'provider', type: 'string', required: true, enum: ['openai_api_search', 'perplexity_api', 'google_aio_manual'] },
      { name: 'status', type: 'string', required: true, enum: ['completed', 'partial', 'failed'] },
      { name: 'mentioned', type: 'bool', required: true },
      { name: 'cited', type: 'bool', required: true },
      { name: 'mention_rank', type: 'number' },
      { name: 'cited_urls', type: 'list' },
      { name: 'competitors', type: 'list' },
      { name: 'confidence', type: 'string', enum: ['high', 'medium', 'low'] },
    ],
  },
};

export function templateCsv(dataset: string): string {
  const spec = IMPORT_SPECS[dataset];
  return `﻿${spec.columns.map((c) => c.name).join(',')}\r\n`;
}

/* ---------------- parsing ---------------- */

export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const delim = (s.split(/\r?\n/, 1)[0].match(/;/g)?.length ?? 0) > (s.split(/\r?\n/, 1)[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

export async function parseXlsx(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals: string[] = [];
    for (let i = 1; i <= ws.columnCount; i++) {
      const v = row.getCell(i).value;
      if (v instanceof Date) vals.push(v.toISOString().slice(0, 10));
      else if (v && typeof v === 'object' && 'result' in v) vals.push(String((v as { result: unknown }).result ?? ''));
      else if (v && typeof v === 'object' && 'text' in v) vals.push(String((v as { text: unknown }).text ?? ''));
      else vals.push(v === null || v === undefined ? '' : String(v));
    }
    out.push(vals);
  });
  return out;
}

/* ---------------- validation ---------------- */

export interface ValidationResult {
  accepted: FactRowInput[];
  geo: Array<typeof geoMeasurements.$inferInsert>;
  rejected: Array<{ row: number; errors: string[] }>;
  total: number;
  from: string | null;
  to: string | null;
  entities: string[];
  /** schema check: columns in the file that the dataset does not use, and optional columns absent from the file */
  schema: { unknownColumns: string[]; missingOptional: string[] };
  /** empty cells per optional column (required columns are reported as rejected rows) */
  missingValues: Record<string, number>;
  duplicates: number;
}

export async function validateRows(app: AppContext, dataset: string, table: string[][]): Promise<ValidationResult> {
  const spec = IMPORT_SPECS[dataset];
  if (!spec) throw new Error(`Unknown dataset ${dataset}`);
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const missingCols = spec.columns.filter((c) => c.required && !header.includes(c.name)).map((c) => c.name);
  const known_ = new Set(spec.columns.map((c) => c.name));
  const schema = { unknownColumns: header.filter((h) => h && !known_.has(h)), missingOptional: spec.columns.filter((c) => !c.required && !header.includes(c.name) && !c.name.startsWith('event_')).map((c) => c.name) };
  const res: ValidationResult = { accepted: [], geo: [], rejected: [], total: Math.max(0, table.length - 1), from: null, to: null, entities: [], schema, missingValues: {}, duplicates: 0 };
  if (missingCols.length) {
    res.rejected.push({ row: 1, errors: [`Missing required column(s): ${missingCols.join(', ')}`] });
    return res;
  }
  const known = {
    site: new Set((await app.db.select({ k: websites.key }).from(websites)).map((r) => r.k)),
    account: new Set((await app.db.select({ k: socialAccounts.key }).from(socialAccounts)).map((r) => r.k)),
    ad: new Set((await app.db.select({ k: ads.key }).from(ads)).map((r) => r.k)),
  };
  const countries = new Set(COUNTRIES.map((c) => c.id));
  const maxDate = yesterdayParis();
  const seen = new Set<string>();
  const entities = new Set<string>();
  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    const errors: string[] = [];
    const rec: Record<string, string> = {};
    header.forEach((h, j) => (rec[h] = (raw[j] ?? '').trim()));
    const dims: Record<string, string> = {};
    const measures: Record<string, number> = {};
    let day = '';
    const extra: Record<string, unknown> = {};
    for (const col of spec.columns) {
      const v = rec[col.name] ?? '';
      if (!v) {
        if (col.required) errors.push(`${col.name} is required`);
        else if (header.includes(col.name)) res.missingValues[col.name] = (res.missingValues[col.name] ?? 0) + 1;
        continue;
      }
      if (col.type === 'date') {
        if (!isIsoDate(v)) errors.push(`${col.name} must be a date YYYY-MM-DD`);
        else if (v > maxDate) errors.push(`${col.name} is in the future or today (data must be complete days)`);
        else if (v < '2015-01-01') errors.push(`${col.name} is before 2015`);
        else day = v;
        continue;
      }
      if (col.type === 'number') {
        const n = Number(v.replace(/\s/g, '').replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) errors.push(`${col.name} must be a non-negative number`);
        else if (col.measure) measures[col.measure] = n;
        else extra[col.name] = n;
        continue;
      }
      if (col.type === 'bool') {
        const b = ['true', '1', 'yes', 'oui'].includes(v.toLowerCase()) ? true : ['false', '0', 'no', 'non'].includes(v.toLowerCase()) ? false : null;
        if (b === null) errors.push(`${col.name} must be true/false`);
        else extra[col.name] = b;
        continue;
      }
      if (col.type === 'list') {
        extra[col.name] = v.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 30);
        continue;
      }
      if (v.length > 500) errors.push(`${col.name} is too long`);
      if (col.enum && !col.enum.includes(v)) errors.push(`${col.name} must be one of ${col.enum.join(', ')}`);
      if (col.entity && !known[col.entity].has(v)) errors.push(`unknown ${col.entity} "${v}" — create it in Administration first`);
      if (col.name === 'country' && !/^[A-Z]{2}$/.test(v.toUpperCase())) errors.push('country must be an ISO 3166-1 alpha-2 code');
      if (col.name === 'page_path' && !v.startsWith('/')) errors.push('page_path must start with /');
      if (col.dim) dims[col.dim] = col.name === 'country' ? v.toUpperCase() : v;
      else extra[col.name] = v;
    }
    if (dataset === 'geo_measurements') {
      if (!errors.length) {
        res.geo.push({ orgId: app.orgId, promptKey: String(extra.prompt), promptVersion: 1, provider: String(extra.provider), measuredOn: day, status: String(extra.status), mentioned: extra.mentioned as boolean, cited: extra.cited as boolean, mentionRank: (extra.mention_rank as number) ?? null, citedUrls: (extra.cited_urls as string[]) ?? [], citedDomains: ((extra.cited_urls as string[]) ?? []).map((u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }).filter(Boolean), competitors: (extra.competitors as string[]) ?? [], confidence: (extra.confidence as string) ?? 'medium', origin: 'manual_import' });
        res.from = !res.from || day < res.from ? day : res.from;
        res.to = !res.to || day > res.to ? day : res.to;
      } else res.rejected.push({ row: i + 1, errors });
      continue;
    }
    // derived keys and measures
    if (dims.page && dims.site) dims.page = `${dims.site}:${dims.page.split('?')[0].replace(/\/$/, '') || '/'}`;
    if (dims.query && dims.site) dims.query = `${dims.site}:${dims.query.toLowerCase()}`;
    if (typeof extra.position === 'number' && measures.impressions !== undefined) measures.posW = (extra.position as number) * measures.impressions;
    if (dataset.startsWith('search') && extra.position === undefined && !errors.length) errors.push('position is required to compute average position');
    if (dims.country && !countries.has(dims.country) && dataset !== 'web' && dataset !== 'search') errors.push('unknown country');
    if (measures.engaged !== undefined && measures.sessions !== undefined && measures.engaged > measures.sessions) errors.push('engaged_sessions cannot exceed sessions');
    if (measures.clicks !== undefined && measures.impressions !== undefined && dataset !== 'social' && dataset !== 'posts' && measures.clicks > measures.impressions) errors.push('clicks cannot exceed impressions');
    if (dataset === 'posts' && dims.post) {
      const m = measures;
      if (m.engagements === undefined) m.engagements = (m.reactions ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (dims.platform === 'youtube' ? 0 : m.clicks ?? 0);
    }
    const key = `${day}|${JSON.stringify(dims)}`;
    if (!errors.length && seen.has(key)) {
      errors.push('duplicate row (same date and dimensions appear earlier in the file)');
      res.duplicates++;
    }
    if (errors.length) {
      res.rejected.push({ row: i + 1, errors });
      continue;
    }
    seen.add(key);
    if (spec.entityDim && dims[spec.entityDim]) entities.add(dims[spec.entityDim]);
    res.accepted.push({ dataset: spec.dataset, day, dims, measures });
    res.from = !res.from || day < res.from ? day : res.from;
    res.to = !res.to || day > res.to ? day : res.to;
  }
  res.entities = [...entities];
  return res;
}

export class ImportConflict extends Error {
  constructor(
    public existingRows: number,
    public from: string,
    public to: string,
  ) {
    super(`${existingRows} existing rows cover ${from} → ${to} for these entities. Confirm the replacement to import.`);
  }
}

export async function runImport(app: AppContext, opts: { dataset: string; fileName: string; fileType: 'csv' | 'xlsx'; content: Buffer; replace: boolean; confirmReplace?: boolean; userId: string | null; dryRun?: boolean }) {
  const spec = IMPORT_SPECS[opts.dataset];
  if (!spec) throw new Error('Unknown dataset');
  const table = opts.fileType === 'xlsx' ? await parseXlsx(opts.content) : parseCsv(opts.content.toString('utf8'));
  if (table.length > 200_001) throw new Error('File has more than 200,000 rows; split it');
  const v = await validateRows(app, opts.dataset, table);
  const status = v.accepted.length + v.geo.length === 0 ? 'rejected' : v.rejected.length ? 'partial' : 'completed';
  const existingRows = v.accepted.length && v.from && v.to ? await countFacts(app.db, spec.dataset, v.from, v.to, spec.entityDim && v.entities.length ? { dim: spec.entityDim, keys: v.entities } : undefined) : 0;
  if (opts.dryRun)
    return {
      status: 'validated',
      total: v.total,
      accepted: v.accepted.length + v.geo.length,
      rejected: v.rejected.slice(0, 200),
      from: v.from,
      to: v.to,
      entities: v.entities,
      schema: v.schema,
      missingValues: v.missingValues,
      duplicates: v.duplicates,
      existingRows,
      mapping: spec.columns.filter((c) => c.dim || c.measure).map((c) => ({ column: c.name, target: c.dim ? `dimension:${c.dim}` : `measure:${c.measure}` })),
      preview: v.accepted.slice(0, 5).map((r) => ({ day: r.day, dims: r.dims, measures: r.measures })),
    };
  // never overwrite or double-count existing data without an explicit authorisation
  if (existingRows > 0 && !(opts.replace && opts.confirmReplace)) throw new ImportConflict(existingRows, v.from!, v.to!);
  const [imp] = await app.db
    .insert(imports)
    .values({ orgId: app.orgId, dataset: opts.dataset, fileName: opts.fileName.slice(0, 200), fileType: opts.fileType, status, rowsTotal: v.total, rowsAccepted: v.accepted.length + v.geo.length, rowsRejected: v.rejected.length, rejected: v.rejected.slice(0, 500), dateFrom: v.from, dateTo: v.to, replaceExisting: opts.replace, createdBy: opts.userId })
    .returning();
  if (v.accepted.length && v.from && v.to) {
    if (opts.replace) await deleteFacts(app.db, spec.dataset, v.from, v.to, spec.entityDim && v.entities.length ? { dim: spec.entityDim, keys: v.entities } : undefined);
    await insertFacts(app, v.accepted, { importId: imp.id });
  }
  if (v.geo.length) for (let i = 0; i < v.geo.length; i += 500) await app.db.insert(geoMeasurements).values(v.geo.slice(i, i + 500));
  if (v.accepted.length + v.geo.length) {
    // record the file-based source on the matching connection(s) so its state is visible in Integrations
    const providers = spec.provider === 'social' ? ['linkedin', 'x', 'youtube'] : [spec.provider];
    for (const p of providers) {
      const conns = await app.db.select().from(dataConnections).where(eq(dataConnections.provider, p));
      for (const c of conns) {
        const scope = c.scopeRefs ?? [];
        if (scope.length && v.entities.length && !scope.some((s) => v.entities.includes(s))) continue;
        await app.db.update(dataConnections).set({ mode: 'csv', status: 'connected', lastSyncAt: new Date(), lastSuccessAt: new Date(), lastError: null, dataFrom: v.from, dataTo: v.to, updatedAt: new Date() }).where(eq(dataConnections.id, c.id));
      }
    }
    app.analytics.invalidate();
  }
  return { id: imp.id, status, total: v.total, accepted: v.accepted.length + v.geo.length, rejected: v.rejected.length, from: v.from, to: v.to };
}
