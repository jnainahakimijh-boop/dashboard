/** Loads imported / synchronised facts from PostgreSQL into columnar tables. */
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { addDays, daysInclusive, epochDay } from '@shared/calendar';
import { FactTable } from '@shared/demo/table';
import type { DemoGeoMeasurement } from '@shared/demo/generate';
import type { TableId } from '@shared/metrics';
import type { DB } from '../db/client';
import { factRows, geoMeasurements } from '../db/schema';
import { indexTable, type PostRecord, type TableData } from './dataset';
import { TABLE_IDS, TABLE_SCHEMAS, WAREHOUSE_BASE } from './tables';

export async function warehouseTableCounts(db: DB): Promise<Record<string, number>> {
  const rows = await db.select({ dataset: factRows.dataset, n: sql<number>`count(*)::int` }).from(factRows).groupBy(factRows.dataset);
  return Object.fromEntries(rows.map((r) => [r.dataset, Number(r.n)]));
}

export async function loadWarehouseTables(db: DB, asOf: string): Promise<Partial<Record<TableId, TableData>>> {
  const counts = await warehouseTableCounts(db);
  const out: Partial<Record<TableId, TableData>> = {};
  const totalDays = Math.max(1, daysInclusive(WAREHOUSE_BASE, asOf) + 1);
  for (const tid of TABLE_IDS) {
    if (!counts[tid]) continue;
    const schema = TABLE_SCHEMAS[tid];
    const rows = await db
      .select({ day: factRows.day, dims: factRows.dims, measures: factRows.measures, createdAt: factRows.createdAt })
      .from(factRows)
      .where(eq(factRows.dataset, tid))
      .orderBy(asc(factRows.day));
    const dicts: Record<string, string[]> = Object.fromEntries(schema.dims.map((d) => [d, [] as string[]]));
    const codeMaps: Record<string, Map<string, number>> = Object.fromEntries(schema.dims.map((d) => [d, new Map<string, number>()]));
    const table = new FactTable(schema.dims, schema.measures, Math.max(16, rows.length));
    const base = epochDay(WAREHOUSE_BASE);
    let latest = 0;
    const dv = new Array<number>(schema.dims.length);
    const mv = new Array<number>(schema.measures.length);
    for (const r of rows) {
      const day = epochDay(r.day) - base;
      if (day < 0 || day >= totalDays) continue;
      schema.dims.forEach((d, k) => {
        const key = String(r.dims[d] ?? '(not set)');
        let code = codeMaps[d].get(key);
        if (code === undefined) {
          code = dicts[d].length;
          dicts[d].push(key);
          codeMaps[d].set(key, code);
        }
        dv[k] = code;
      });
      schema.measures.forEach((m, k) => {
        const v = Number(r.measures[m] ?? 0);
        mv[k] = Number.isFinite(v) ? v : 0;
      });
      table.push(day, dv, mv);
      latest = Math.max(latest, r.createdAt.getTime());
    }
    table.finalize(totalDays);
    out[tid] = indexTable({ id: tid, table, base: WAREHOUSE_BASE, dicts, origin: 'warehouse', coverage: null, freshness: latest ? new Date(latest).toISOString() : null, gapDim: schema.gapDim });
  }
  return out;
}

export async function loadWarehousePosts(db: DB): Promise<{ rows: PostRecord[]; freshness: string | null } | null> {
  const rows = await db.select().from(factRows).where(eq(factRows.dataset, 'posts')).orderBy(asc(factRows.day));
  if (!rows.length) return null;
  let latest = 0;
  const posts = rows.map((r): PostRecord => {
    latest = Math.max(latest, r.createdAt.getTime());
    const d = r.dims;
    const m = r.measures;
    const n = (k: string) => Number(m[k] ?? 0) || 0;
    const date = r.day;
    const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    return {
      id: d.post,
      account: d.account,
      platform: (d.platform ?? 'linkedin') as PostRecord['platform'],
      day: epochDay(date) - epochDay(WAREHOUSE_BASE),
      date,
      hour: Number(d.hour ?? 9),
      weekday: dow,
      format: d.format ?? 'unknown',
      topic: d.topic ?? '(untagged)',
      campaign: d.campaign || null,
      bu: d.bu ?? '(unassigned)',
      objective: d.objective ?? '(unassigned)',
      pillar: d.pillar ?? '(unassigned)',
      audience: d.audience ?? '(unassigned)',
      language: (d.language ?? 'en') as PostRecord['language'],
      text: d.text ?? '',
      url: d.url || null,
      impressions: n('impressions'),
      reactions: n('reactions'),
      comments: n('comments'),
      shares: n('shares'),
      clicks: n('clicks'),
      linkClicks: n('linkClicks'),
      videoViews: n('videoViews'),
      watchMinutes: n('watchMinutes'),
      engagements: n('engagements') || n('reactions') + n('comments') + n('shares') + (d.platform === 'youtube' ? 0 : n('clicks')),
      subsGained: n('subsGained'),
    };
  });
  return { rows: posts, freshness: latest ? new Date(latest).toISOString() : null };
}

export async function loadWarehouseGeo(db: DB): Promise<{ rows: DemoGeoMeasurement[]; freshness: string | null } | null> {
  const rows = await db.select().from(geoMeasurements).orderBy(asc(geoMeasurements.measuredOn));
  if (!rows.length) return null;
  let latest = 0;
  return {
    rows: rows.map((r) => {
      latest = Math.max(latest, r.createdAt.getTime());
      return {
        id: r.id,
        day: epochDay(r.measuredOn) - epochDay(WAREHOUSE_BASE),
        date: r.measuredOn,
        provider: r.provider as DemoGeoMeasurement['provider'],
        prompt: r.promptKey,
        promptVersion: r.promptVersion,
        status: r.status as DemoGeoMeasurement['status'],
        mentioned: !!r.mentioned,
        cited: !!r.cited,
        mentionRank: r.mentionRank,
        citedUrls: r.citedUrls,
        citedDomains: r.citedDomains,
        competitors: r.competitors,
        confidence: (r.confidence ?? 'medium') as DemoGeoMeasurement['confidence'],
      };
    }),
    freshness: latest ? new Date(latest).toISOString() : null,
  };
}

export async function deleteFacts(db: DB, dataset: string, from: string, to: string, siteOrEntityKeys?: { dim: string; keys: string[] }): Promise<void> {
  const conds = [eq(factRows.dataset, dataset), sql`${factRows.day} >= ${from}`, sql`${factRows.day} <= ${to}`];
  if (siteOrEntityKeys?.keys.length) conds.push(inArray(sql`${factRows.dims} ->> ${siteOrEntityKeys.dim}`, siteOrEntityKeys.keys));
  await db.delete(factRows).where(sql.join(conds, sql` AND `));
}

export { addDays, inArray };
