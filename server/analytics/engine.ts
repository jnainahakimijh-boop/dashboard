/** ------------------------------------------------------------------
 *  Semantic query engine.
 *
 *  For each requested metric it:
 *   1. picks the physical table that supports the most active filters
 *      (and the requested breakdown), reporting the rest as ignored;
 *   2. clips the period to the table's data coverage and builds a
 *      like-for-like comparison period;
 *   3. aggregates with the metric's rule (sum, de-duplicated users,
 *      end-of-period value, ratio of totals, difference, custom);
 *   4. reports data mode, coverage, missing days and caveats as
 *      structured notes so the UI never has to guess.
 *  ------------------------------------------------------------------ */
import {
  clampRange,
  comparisonRange,
  covers,
  daysInclusive,
  defaultGranularity,
  enumerateBuckets,
  epochDay,
  type Bucket,
  type DateRange,
  type Granularity,
} from '@shared/calendar';
import { GEO_PROMPTS, QUERIES, TOPICS } from '@shared/catalog';
import {
  activeFilterKeys,
  normaliseFilters,
  type AnalyticsResponse,
  type BreakdownRow,
  type DataMode,
  type DimensionId,
  type FilterKey,
  type Filters,
  type MetricResult,
  type ParsedAnalyticsQuery,
  type ResultNote,
  type SeriesPoint,
} from '@shared/filters';
import { CONVERSION_MEASURES, getMetric, type FixedFilter, type MetricDef } from '@shared/metrics';
import { VDIMS, dayIndex, isoAt, mappedKeys, type Dataset, type TableData } from './dataset';

export interface TrackedKeyword {
  queryKey: string;
  site: string;
}

export interface GeoPromptAttrs {
  lang: string;
  topic: string;
}

export interface EngineContext {
  dataset: Dataset;
  /** GA4 events counted as conversions (KPI registry) */
  conversionEvents: string[];
  /** website key → its own conversion events, when an administrator set them (otherwise `conversionEvents`) */
  siteConversionEvents?: Record<string, string[]>;
  trackedKeywords: TrackedKeyword[];
  geoPrompts: Map<string, GeoPromptAttrs>;
  /** server-side data scope of the requesting user (websites) */
  scopeSites?: string[] | null;
}

export function defaultEngineContext(dataset: Dataset): EngineContext {
  return {
    dataset,
    conversionEvents: ['contact_form_submit', 'generate_lead', 'newsletter_signup'],
    trackedKeywords: QUERIES.filter((q) => !q.brand).map((q) => ({ queryKey: q.id, site: q.site })),
    geoPrompts: new Map(GEO_PROMPTS.map((p) => [p.id, { lang: p.lang, topic: p.topic }])),
  };
}

export class QueryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/* ---------------- users de-duplication (demo approximation) ---------------- */

/** Expected ratio of period users to the sum of daily users over n days. */
export const usersDedup = (n: number) => 1 / (1 + 0.06 * Math.log(Math.max(1, n)));

/* ---------------- constraints & planning ---------------- */

type Constraints = Map<DimensionId, Set<string>[]>;

function addConstraint(c: Constraints, dim: DimensionId, values: readonly string[]) {
  const arr = c.get(dim) ?? [];
  arr.push(new Set(values));
  c.set(dim, arr);
}

interface Plan {
  td: TableData;
  supported: FilterKey[];
  groupOk: boolean;
}

type SimpleAgg = Extract<MetricDef['agg'], { kind: 'sum' | 'users' | 'last' }>;

function planFor(ds: Dataset, agg: SimpleAgg, active: FilterKey[], groupBy: DimensionId | null): Plan | null {
  let best: Plan | null = null;
  let bestScore = -1;
  for (const tid of agg.tables) {
    const td = ds.tables[tid];
    if (!td) continue;
    const vd = VDIMS[tid];
    if (agg.fixed && Object.keys(agg.fixed).some((k) => !vd[k as DimensionId])) continue;
    if (agg.kind === 'last' && !vd[agg.entity]) continue;
    const supported = active.filter((k) => !!vd[k]);
    const groupOk = !groupBy || !!vd[groupBy];
    const score = supported.length * 10 + (groupOk ? 1 : 0);
    if (score > bestScore) {
      best = { td, supported, groupOk };
      bestScore = score;
    }
  }
  return best;
}

/** Fixed metric filters that contradict the user's filter on the same key. */
function contradiction(fixed: FixedFilter | undefined, filters: Filters): DimensionId | null {
  if (!fixed) return null;
  for (const [k, vals] of Object.entries(fixed)) {
    const user = filters[k as FilterKey];
    if (user?.length && vals && !vals.some((v) => user.includes(v))) return k as DimensionId;
  }
  return null;
}

/* ---------------- scanning ---------------- */

interface ScanSpec {
  td: TableData;
  agg: SimpleAgg;
  measures: Expanded;
  constraints: Constraints;
  range: DateRange;
  buckets: Bucket[] | null;
  groupBy: DimensionId | null;
}

interface ScanOut {
  total: number;
  byBucket: Float64Array | null;
  groupKeys: string[];
  byGroup: Float64Array | null;
  matched: number;
}

function buildMasks(td: TableData, constraints: Constraints): Array<[Uint16Array, Uint8Array]> | null {
  const byPhys = new Map<string, Uint8Array>();
  for (const [dim, sets] of constraints) {
    const vd = VDIMS[td.id][dim];
    if (!vd) continue;
    const keys = mappedKeys(td, dim);
    if (!keys) continue;
    let mask = byPhys.get(vd.phys);
    if (!mask) {
      mask = new Uint8Array(keys.length).fill(1);
      byPhys.set(vd.phys, mask);
    }
    for (let c = 0; c < keys.length; c++) {
      if (!mask[c]) continue;
      for (const s of sets) if (!s.has(keys[c])) mask[c] = 0;
    }
  }
  const out: Array<[Uint16Array, Uint8Array]> = [];
  for (const [phys, mask] of byPhys) {
    if (!mask.some((x) => x)) return null; // nothing can match
    out.push([td.table.dims[phys], mask]);
  }
  return out;
}

function scan(spec: ScanSpec): ScanOut {
  const { td, agg, measures, constraints, range, buckets, groupBy } = spec;
  const t = td.table;
  const fromDay = dayIndex(td, range.from);
  const toDay = dayIndex(td, range.to);
  const nB = buckets?.length ?? 0;
  const out: ScanOut = { total: 0, byBucket: buckets ? new Float64Array(nB) : null, groupKeys: [], byGroup: null, matched: 0 };
  const masks = buildMasks(td, constraints);
  if (!masks) return out;

  let bucketOf: Int32Array | null = null;
  if (buckets) {
    bucketOf = new Int32Array(Math.max(0, toDay - fromDay + 1)).fill(-1);
    buckets.forEach((b, bi) => {
      const bf = Math.max(fromDay, dayIndex(td, b.from));
      const bt = Math.min(toDay, dayIndex(td, b.to));
      for (let d = bf; d <= bt; d++) bucketOf![d - fromDay] = bi;
    });
  }

  let groupCol: Uint16Array | null = null;
  let groupIdx: Int32Array | null = null;
  if (groupBy) {
    const vd = VDIMS[td.id][groupBy];
    const keys = vd ? mappedKeys(td, groupBy) : null;
    if (vd && keys) {
      groupCol = t.dims[vd.phys];
      const uniq = new Map<string, number>();
      groupIdx = new Int32Array(keys.length);
      keys.forEach((k, c) => {
        let gi = uniq.get(k);
        if (gi === undefined) {
          gi = uniq.size;
          uniq.set(k, gi);
        }
        groupIdx![c] = gi;
      });
      out.groupKeys = [...uniq.keys()];
      out.byGroup = new Float64Array(out.groupKeys.length);
    }
  }

  const present = measures.measures.map((m, j) => [t.meas[m], measures.gates[j]] as const).filter(([c]) => !!c);
  const cols = present.map(([c]) => c);
  const gates = present.map(([, g]) => g);
  const gated = gates.some((g) => g !== null);
  const siteCol = gated ? t.dims.site : null;
  const nCols = cols.length;
  const rowValue = (i: number) => {
    let v = 0;
    if (siteCol) {
      for (let j = 0; j < nCols; j++) if (!gates[j] || gates[j]![siteCol[i]]) v += cols[j][i];
    } else for (let j = 0; j < nCols; j++) v += cols[j][i];
    return v;
  };
  const [start, end] = t.rows(fromDay, toDay);
  const nMasks = masks.length;

  if (agg.kind === 'last') {
    const ent = t.dims[VDIMS[td.id][agg.entity]!.phys];
    const nEnt = td.dicts[VDIMS[td.id][agg.entity]!.phys].length;
    const lastTot = new Float64Array(nEnt).fill(NaN);
    const lastB = buckets ? new Float64Array(nB * nEnt).fill(NaN) : null;
    const nG = out.groupKeys.length;
    const lastG = groupIdx ? new Float64Array(nG * nEnt).fill(NaN) : null;
    for (let i = start; i < end; i++) {
      let ok = true;
      for (let k = 0; k < nMasks; k++) if (!masks[k][1][masks[k][0][i]]) { ok = false; break; }
      if (!ok) continue;
      out.matched++;
      const v = rowValue(i);
      const e = ent[i];
      lastTot[e] = v;
      if (lastB) {
        const b = bucketOf![t.day[i] - fromDay];
        if (b >= 0) lastB[b * nEnt + e] = v;
      }
      if (lastG) lastG[groupIdx![groupCol![i]] * nEnt + e] = v;
    }
    const sumNN = (a: Float64Array, off: number, n: number) => {
      let s = 0;
      for (let j = 0; j < n; j++) if (!Number.isNaN(a[off + j])) s += a[off + j];
      return s;
    };
    out.total = sumNN(lastTot, 0, nEnt);
    if (lastB) for (let b = 0; b < nB; b++) out.byBucket![b] = sumNN(lastB, b * nEnt, nEnt);
    if (lastG) for (let g = 0; g < nG; g++) out.byGroup![g] = sumNN(lastG, g * nEnt, nEnt);
    return out;
  }

  for (let i = start; i < end; i++) {
    let ok = true;
    for (let k = 0; k < nMasks; k++) if (!masks[k][1][masks[k][0][i]]) { ok = false; break; }
    if (!ok) continue;
    out.matched++;
    const v = rowValue(i);
    out.total += v;
    if (bucketOf) {
      const b = bucketOf[t.day[i] - fromDay];
      if (b >= 0) out.byBucket![b] += v;
    }
    if (groupIdx) out.byGroup![groupIdx[groupCol![i]]] += v;
  }

  if (agg.kind === 'users') {
    const n = daysInclusive(range.from, range.to);
    out.total *= usersDedup(n);
    if (out.byGroup) for (let g = 0; g < out.byGroup.length; g++) out.byGroup[g] *= usersDedup(n);
    if (buckets && out.byBucket) {
      buckets.forEach((b, bi) => {
        const bf = epochDay(b.from) < epochDay(range.from) ? range.from : b.from;
        const bt = epochDay(b.to) > epochDay(range.to) ? range.to : b.to;
        out.byBucket![bi] *= usersDedup(Math.max(1, daysInclusive(bf, bt)));
      });
    }
  }
  return out;
}

/* ---------------- metric evaluation ---------------- */

interface Raw {
  available: boolean;
  origin: TableData['origin'] | null;
  td: TableData | null;
  supported: FilterKey[];
  groupOk: boolean;
  value: number | null;
  compare: number | null;
  series: Array<number | null> | null;
  compareSeries: Array<number | null> | null;
  seriesPartial: boolean[] | null;
  groups: Map<string, { value: number; compare: number | null }> | null;
  range: DateRange | null;
  compareRange: DateRange | null;
  notes: ResultNote[];
  partialEntities: boolean;
}

interface EvalSpec {
  q: ParsedAnalyticsQuery;
  filters: Filters;
  active: FilterKey[];
  buckets: Bucket[] | null;
  compareBuckets: Bucket[] | null;
}

const emptyRaw = (notes: ResultNote[] = []): Raw => ({
  available: false,
  origin: null,
  td: null,
  supported: [],
  groupOk: false,
  value: null,
  compare: null,
  series: null,
  compareSeries: null,
  seriesPartial: null,
  groups: null,
  range: null,
  compareRange: null,
  notes,
  partialEntities: false,
});

/** Measure columns to add up, each with an optional gate per site code (conversion events can differ by website). */
interface Expanded {
  measures: string[];
  gates: Array<Uint8Array | null>;
}

function expandMeasures(ctx: EngineContext, td: TableData, measures: string[]): Expanded {
  const out: Expanded = { measures: [], gates: [] };
  const perSite = ctx.siteConversionEvents ?? {};
  const sites = td.dicts.site;
  for (const m of measures) {
    if (m !== CONVERSION_MEASURES) {
      out.measures.push(m);
      out.gates.push(null);
      continue;
    }
    const eventsOf = (site: string) => perSite[site] ?? ctx.conversionEvents;
    const all = sites ? [...new Set([...ctx.conversionEvents, ...sites.flatMap((k) => eventsOf(k))])] : ctx.conversionEvents;
    for (const e of all) {
      const gate = sites ? Uint8Array.from(sites, (k) => (eventsOf(k).includes(e) ? 1 : 0)) : null;
      out.measures.push(`ev_${e}`);
      out.gates.push(gate && gate.every((x) => x === 1) ? null : gate);
    }
  }
  return out;
}

function constraintsFor(ctx: EngineContext, td: TableData, agg: SimpleAgg, filters: Filters, apply: FilterKey[]): Constraints {
  const c: Constraints = new Map();
  for (const k of apply) if (filters[k]?.length) addConstraint(c, k, filters[k]!);
  if (agg.fixed) for (const [k, v] of Object.entries(agg.fixed)) if (v) addConstraint(c, k as DimensionId, v);
  if (ctx.scopeSites && VDIMS[td.id].site) addConstraint(c, 'site', ctx.scopeSites);
  return c;
}

function gapNotes(td: TableData, constraints: Constraints, range: DateRange): ResultNote[] {
  if (!td.presence || !td.gapDim || !td.coverage) return [];
  // entities allowed by constraints on the gap dimension
  const dict = td.dicts[td.gapDim];
  const allowed = new Uint8Array(dict.length).fill(1);
  for (const [dim, sets] of constraints) {
    const vd = VDIMS[td.id][dim];
    if (!vd || vd.phys !== td.gapDim) continue;
    const keys = mappedKeys(td, dim)!;
    keys.forEach((k, c) => {
      for (const s of sets) if (!s.has(k)) allowed[c] = 0;
    });
  }
  const from = dayIndex(td, range.from);
  const to = Math.min(dayIndex(td, range.to), dayIndex(td, td.coverage.to));
  const missing: string[] = [];
  let first = Infinity;
  let last = -Infinity;
  let days = 0;
  for (const [code, p] of td.presence) {
    if (!allowed[code]) continue;
    let n = 0;
    for (let d = Math.max(from, p.first); d <= to; d++) {
      if (!p.days[d]) {
        n++;
        first = Math.min(first, d);
        last = Math.max(last, d);
      }
    }
    if (n) {
      missing.push(dict[code]);
      days = Math.max(days, n);
    }
  }
  if (!missing.length) return [];
  return [{ code: 'missing_days', params: { entities: missing.join(', '), days, from: isoAt(td, first), to: isoAt(td, last) } }];
}

function evalSimple(ctx: EngineContext, agg: SimpleAgg, spec: EvalSpec, restrict?: FilterKey[]): Raw {
  const { q, filters, active } = spec;
  const conflict = contradiction(agg.fixed, filters);
  if (conflict) return emptyRaw([{ code: 'unavailable', params: { reason: 'filter_excludes_metric', dimension: conflict } }]);
  const plan = planFor(ctx.dataset, agg, active, q.groupBy ?? null);
  if (!plan) return emptyRaw([{ code: 'unavailable', params: { reason: 'source_not_available' } }]);
  const { td } = plan;
  const supported = restrict ? plan.supported.filter((k) => restrict.includes(k)) : plan.supported;
  const groupBy = q.groupBy && plan.groupOk ? q.groupBy : null;
  const measures = expandMeasures(ctx, td, agg.measures);
  const constraints = constraintsFor(ctx, td, agg, filters, supported);
  const raw = emptyRaw();
  raw.available = true;
  raw.origin = td.origin;
  raw.td = td;
  raw.supported = plan.supported;
  raw.groupOk = plan.groupOk;
  raw.partialEntities = !!td.missingEntities?.length;

  if (!td.coverage) {
    raw.notes.push({ code: 'no_data' });
    return raw;
  }
  const requested: DateRange = { from: q.from, to: q.to };
  const eff = clampRange(requested, td.coverage.from, td.coverage.to);
  if (!eff) {
    raw.notes.push({ code: 'no_data', params: { coverageFrom: td.coverage.from, coverageTo: td.coverage.to } });
    return raw;
  }
  if (eff.to !== requested.to || eff.from !== requested.from) raw.notes.push({ code: 'coverage_clipped', params: { from: eff.from, to: eff.to } });
  raw.range = eff;
  const base = scan({ td, agg, measures, constraints, range: eff, buckets: null, groupBy });
  raw.value = base.total;

  const cmpRange = comparisonRange(eff, q.compare);
  let cmp: ScanOut | null = null;
  if (cmpRange) {
    raw.compareRange = cmpRange;
    if (covers(td.coverage.from, td.coverage.to, cmpRange)) {
      cmp = scan({ td, agg, measures, constraints, range: cmpRange, buckets: null, groupBy });
      raw.compare = cmp.total;
    } else raw.notes.push({ code: 'compare_incomplete', params: { from: cmpRange.from, to: cmpRange.to, coverageFrom: td.coverage.from } });
  }

  if (groupBy && base.byGroup) {
    raw.groups = new Map();
    base.groupKeys.forEach((k, g) => raw.groups!.set(k, { value: base.byGroup![g], compare: null }));
    if (cmp?.byGroup) cmp.groupKeys.forEach((k, g) => {
      const e = raw.groups!.get(k);
      if (e) e.compare = cmp!.byGroup![g];
      else raw.groups!.set(k, { value: 0, compare: cmp!.byGroup![g] });
    });
  } else if (q.groupBy) raw.notes.push({ code: 'groupby_unsupported', params: { dimension: q.groupBy } });

  if (spec.buckets) {
    const { series, partial } = seriesFor(td, agg, measures, constraints, spec.buckets);
    raw.series = series;
    raw.seriesPartial = partial;
    if (spec.compareBuckets) raw.compareSeries = seriesFor(td, agg, measures, constraints, spec.compareBuckets).series;
  }

  raw.notes.push(...gapNotes(td, constraints, eff));
  if (agg.kind === 'users' && td.origin === 'demo') raw.notes.push({ code: 'users_approx' });
  if (td.id === 'searchquery' && agg.tables[0] !== 'searchquery') raw.notes.push({ code: 'definition_differs', params: { reason: 'anonymised_queries_excluded' } });
  return raw;
}

function seriesFor(td: TableData, agg: SimpleAgg, measures: Expanded, constraints: Constraints, buckets: Bucket[]) {
  const cov = td.coverage!;
  const range: DateRange = { from: buckets[0].from, to: buckets[buckets.length - 1].to };
  const eff = clampRange(range, cov.from, cov.to);
  const series: Array<number | null> = buckets.map(() => null);
  const partial = buckets.map((b) => b.partial);
  if (!eff) return { series, partial };
  const out = scan({ td, agg, measures, constraints, range: eff, buckets, groupBy: null });
  buckets.forEach((b, i) => {
    const bEff = clampRange(b, cov.from, cov.to);
    if (!bEff) return;
    series[i] = out.byBucket![i];
    if (bEff.from !== b.from || bEff.to !== b.to) partial[i] = true;
  });
  return { series, partial };
}

function combine(a: Raw, b: Raw, f: (x: number, y: number) => number | null): Raw {
  const r = emptyRaw([...a.notes, ...b.notes]);
  if (!a.available || !b.available) return { ...r, notes: r.notes.length ? r.notes : [{ code: 'unavailable', params: { reason: 'source_not_available' } }] };
  if (a.origin !== b.origin) return emptyRaw([{ code: 'unavailable', params: { reason: 'mixed_origins' } }]);
  const op = (x: number | null, y: number | null) => (x === null || y === null ? null : f(x, y));
  r.available = true;
  r.origin = a.origin;
  r.td = a.td;
  r.supported = a.supported.filter((k) => b.supported.includes(k));
  r.groupOk = a.groupOk && b.groupOk;
  r.partialEntities = a.partialEntities || b.partialEntities;
  r.value = op(a.value, b.value);
  r.compare = op(a.compare, b.compare);
  r.range = a.range;
  r.compareRange = a.compareRange;
  if (a.series && b.series) {
    r.series = a.series.map((x, i) => op(x, b.series![i]));
    r.seriesPartial = a.seriesPartial!.map((p, i) => p || b.seriesPartial![i]);
  }
  if (a.compareSeries && b.compareSeries) r.compareSeries = a.compareSeries.map((x, i) => op(x, b.compareSeries![i]));
  if (a.groups && b.groups) {
    r.groups = new Map();
    for (const [k, va] of a.groups) {
      const vb = b.groups.get(k);
      const v = op(va.value, vb?.value ?? 0);
      if (v === null) continue;
      r.groups.set(k, { value: v, compare: op(va.compare, vb?.compare ?? null) });
    }
  }
  // de-duplicate notes
  const seen = new Set<string>();
  r.notes = r.notes.filter((n) => {
    const key = JSON.stringify(n);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return r;
}

function evalRaw(ctx: EngineContext, def: MetricDef, spec: EvalSpec, restrict?: FilterKey[], depth = 0): Raw {
  if (depth > 4) throw new QueryError(`Metric ${def.id} is defined recursively`, 500);
  const agg = def.agg;
  switch (agg.kind) {
    case 'sum':
    case 'users':
    case 'last':
      return evalSimple(ctx, agg, spec, restrict);
    case 'ratio':
    case 'diff': {
      const aDef = getMetric(agg.kind === 'ratio' ? agg.num : agg.a)!;
      const bDef = getMetric(agg.kind === 'ratio' ? agg.den : agg.b)!;
      // first pass: which filters does each side support? apply only the common set to both
      const a0 = evalRaw(ctx, aDef, { ...spec, buckets: null, compareBuckets: null }, restrict, depth + 1);
      const b0 = evalRaw(ctx, bDef, { ...spec, buckets: null, compareBuckets: null }, restrict, depth + 1);
      const common = a0.supported.filter((k) => b0.supported.includes(k));
      const a = evalRaw(ctx, aDef, spec, common, depth + 1);
      const b = evalRaw(ctx, bDef, spec, common, depth + 1);
      a.supported = common;
      b.supported = common;
      if (agg.kind === 'ratio') {
        const scale = agg.scale ?? 1;
        return combine(a, b, (x, y) => (y > 0 ? (x / y) * scale : null));
      }
      return combine(a, b, (x, y) => x - y);
    }
    case 'custom':
      return evalCustom(ctx, agg.fn, spec, restrict);
  }
}

/* ---------------- custom metrics ---------------- */

function evalCustom(ctx: EngineContext, fn: Extract<MetricDef['agg'], { kind: 'custom' }>['fn'], spec: EvalSpec, restrict?: FilterKey[]): Raw {
  if (fn === 'keyword_visibility') return evalKeywordVisibility(ctx, spec, restrict);
  return evalGeo(ctx, fn, spec, restrict);
}

const TOPIC_BU = new Map(TOPICS.map((t) => [t.id, t.bu]));

function evalKeywordVisibility(ctx: EngineContext, spec: EvalSpec, restrict?: FilterKey[]): Raw {
  const { q, filters, active } = spec;
  const td = ctx.dataset.tables.searchquery;
  if (!td) return emptyRaw([{ code: 'unavailable', params: { reason: 'source_not_available' } }]);
  const vd = VDIMS.searchquery;
  let supported = active.filter((k) => !!vd[k]);
  if (restrict) supported = supported.filter((k) => restrict.includes(k));
  const groupBy = q.groupBy && vd[q.groupBy] ? q.groupBy : null;
  const raw = emptyRaw();
  raw.available = true;
  raw.origin = td.origin;
  raw.td = td;
  raw.supported = active.filter((k) => !!vd[k]);
  raw.groupOk = !q.groupBy || !!groupBy;
  if (!td.coverage) return { ...raw, notes: [{ code: 'no_data' }] };

  // tracked keywords passing filters, with their group key
  const attr = (kw: TrackedKeyword, dim: DimensionId): string | null | undefined => {
    const v = vd[dim]!;
    return v.phys === 'site' ? v.map(kw.site) : v.map(kw.queryKey);
  };
  const tracked = ctx.trackedKeywords.filter((kw) => {
    if (ctx.scopeSites && !ctx.scopeSites.includes(kw.site)) return false;
    return supported.every((k) => filters[k]!.includes(attr(kw, k) ?? ''));
  });
  if (!tracked.length) return { ...raw, notes: [{ code: 'no_data', params: { reason: 'no_tracked_keywords' } }] };
  const qDict = td.dicts.query;
  const codeOf = new Map(qDict.map((k, c) => [k, c]));

  const visibility = (range: DateRange): { total: number | null; groups: Map<string, number> } => {
    const t = td.table;
    const [s, e] = t.rows(dayIndex(td, range.from), dayIndex(td, range.to));
    const imp = new Float64Array(qDict.length);
    const posW = new Float64Array(qDict.length);
    const qc = t.dims.query;
    for (let i = s; i < e; i++) {
      imp[qc[i]] += t.meas.impressions[i];
      posW[qc[i]] += t.meas.posW[i];
    }
    let vis = 0;
    const gv = new Map<string, [number, number]>();
    for (const kw of tracked) {
      const c = codeOf.get(kw.queryKey);
      const visible = c !== undefined && imp[c] > 0 && posW[c] / imp[c] <= 10 ? 1 : 0;
      vis += visible;
      if (groupBy) {
        const g = attr(kw, groupBy) ?? '(not set)';
        const cur = gv.get(g) ?? [0, 0];
        cur[0] += visible;
        cur[1] += 1;
        gv.set(g, cur);
      }
    }
    const groups = new Map<string, number>();
    for (const [g, [v, n]] of gv) groups.set(g, n ? v / n : 0);
    return { total: vis / tracked.length, groups };
  };

  const requested: DateRange = { from: q.from, to: q.to };
  const eff = clampRange(requested, td.coverage.from, td.coverage.to);
  if (!eff) return { ...raw, notes: [{ code: 'no_data' }] };
  if (eff.to !== requested.to || eff.from !== requested.from) raw.notes.push({ code: 'coverage_clipped', params: { from: eff.from, to: eff.to } });
  raw.range = eff;
  const cur = visibility(eff);
  raw.value = cur.total;
  const cmpRange = comparisonRange(eff, q.compare);
  let cmp: ReturnType<typeof visibility> | null = null;
  if (cmpRange) {
    raw.compareRange = cmpRange;
    if (covers(td.coverage.from, td.coverage.to, cmpRange)) {
      cmp = visibility(cmpRange);
      raw.compare = cmp.total;
    } else raw.notes.push({ code: 'compare_incomplete', params: { from: cmpRange.from, to: cmpRange.to, coverageFrom: td.coverage.from } });
  }
  if (groupBy) {
    raw.groups = new Map();
    for (const [k, v] of cur.groups) raw.groups.set(k, { value: v, compare: cmp?.groups.get(k) ?? null });
  } else if (q.groupBy) raw.notes.push({ code: 'groupby_unsupported', params: { dimension: q.groupBy } });
  const ser = (buckets: Bucket[]) =>
    buckets.map((b) => {
      const bEff = clampRange(b, td.coverage!.from, td.coverage!.to);
      return bEff ? visibility(bEff).total : null;
    });
  if (spec.buckets) {
    raw.series = ser(spec.buckets);
    raw.seriesPartial = spec.buckets.map((b) => b.partial || !covers(td.coverage!.from, td.coverage!.to, b));
    if (spec.compareBuckets) raw.compareSeries = ser(spec.compareBuckets);
  }
  raw.notes.push({ code: 'sample_only', params: { keywords: tracked.length } });
  return raw;
}

function evalGeo(ctx: EngineContext, fn: 'geo_mention_rate' | 'geo_citation_rate' | 'geo_measurements', spec: EvalSpec, restrict?: FilterKey[]): Raw {
  const { q, filters, active } = spec;
  const geo = ctx.dataset.geo;
  if (!geo || !geo.rows.length) return emptyRaw([{ code: 'unavailable', params: { reason: 'source_not_available' } }]);
  const SUPPORTED: FilterKey[] = ['language', 'bu'];
  let supported = active.filter((k) => SUPPORTED.includes(k));
  const allSupported = supported;
  if (restrict) supported = supported.filter((k) => restrict.includes(k));
  const attrs = (promptId: string, dim: string): string | undefined => {
    const p = ctx.geoPrompts.get(promptId);
    if (!p) return undefined;
    if (dim === 'language') return p.lang;
    if (dim === 'bu') return TOPIC_BU.get(p.topic);
    if (dim === 'topic') return p.topic;
    return undefined;
  };
  const groupBy = q.groupBy === 'topic' || q.groupBy === 'language' || q.groupBy === 'bu' ? q.groupBy : null;
  const rows = geo.rows.filter((r) => r.status !== 'failed' && supported.every((k) => filters[k]!.includes(attrs(r.prompt, k) ?? '')));
  const first = geo.rows[0].date;
  const last = geo.rows.reduce((m, r) => (r.date > m ? r.date : m), first);
  const raw = emptyRaw();
  raw.available = true;
  raw.origin = geo.origin;
  raw.supported = allSupported;
  raw.groupOk = !q.groupBy || !!groupBy;

  const calc = (range: DateRange, subset = rows) => {
    const inRange = subset.filter((r) => r.date >= range.from && r.date <= range.to);
    if (fn === 'geo_measurements') return inRange.length;
    if (!inRange.length) return null;
    const hit = inRange.filter((r) => (fn === 'geo_mention_rate' ? r.mentioned : r.cited)).length;
    return hit / inRange.length;
  };
  const requested: DateRange = { from: q.from, to: q.to };
  const eff = clampRange(requested, geo.rows.reduce((m, r) => (r.date < m ? r.date : m), first), last);
  if (!eff) return { ...raw, notes: [{ code: 'no_data' }] };
  if (eff.to !== requested.to || eff.from !== requested.from) raw.notes.push({ code: 'coverage_clipped', params: { from: eff.from, to: eff.to } });
  raw.range = eff;
  raw.value = calc(eff);
  const cmpRange = comparisonRange(eff, q.compare);
  if (cmpRange) {
    raw.compareRange = cmpRange;
    const geoFrom = geo.rows.reduce((m, r) => (r.date < m ? r.date : m), first);
    if (cmpRange.from >= geoFrom) raw.compare = calc(cmpRange);
    else raw.notes.push({ code: 'compare_incomplete', params: { from: cmpRange.from, to: cmpRange.to, coverageFrom: geoFrom } });
  }
  if (groupBy) {
    raw.groups = new Map();
    const keys = new Set(rows.map((r) => attrs(r.prompt, groupBy) ?? '(not set)'));
    for (const k of keys) {
      const sub = rows.filter((r) => (attrs(r.prompt, groupBy) ?? '(not set)') === k);
      const v = calc(eff, sub);
      if (v === null) continue;
      raw.groups.set(k, { value: v, compare: cmpRange && raw.compare !== null ? calc(cmpRange, sub) : null });
    }
  } else if (q.groupBy) raw.notes.push({ code: 'groupby_unsupported', params: { dimension: q.groupBy } });
  if (spec.buckets) {
    raw.series = spec.buckets.map((b) => (b.to < eff.from || b.from > last ? null : calc(b)));
    raw.seriesPartial = spec.buckets.map((b) => b.partial);
    if (spec.compareBuckets) raw.compareSeries = spec.compareBuckets.map((b) => (b.to < first ? null : calc(b)));
  }
  const inEff = rows.filter((r) => r.date >= eff.from && r.date <= eff.to);
  raw.notes.push({
    code: 'sample_only',
    params: { prompts: new Set(inEff.map((r) => r.prompt)).size, providers: new Set(inEff.map((r) => r.provider)).size, measurements: inEff.length },
  });
  return raw;
}

/* ---------------- public API ---------------- */

function modeOf(raw: Raw): DataMode {
  if (!raw.available || raw.origin === null) return 'unavailable';
  if (raw.origin === 'demo') return 'demo';
  return raw.partialEntities ? 'partial' : 'connected';
}

export function evaluateMetric(ctx: EngineContext, metricId: string, spec: EvalSpec): MetricResult {
  const def = getMetric(metricId);
  if (!def) throw new QueryError(`Unknown metric: ${metricId}`);
  const raw = evalRaw(ctx, def, spec);
  const ignored = spec.active.filter((k) => !raw.supported.includes(k));
  const value = raw.value;
  const compare = raw.compare;
  const delta = value !== null && compare !== null ? value - compare : null;
  const deltaPct = delta !== null && compare !== null && compare !== 0 ? delta / Math.abs(compare) : null;
  const result: MetricResult = {
    metric: def.id,
    value,
    compare,
    delta,
    deltaPct,
    meta: {
      mode: modeOf(raw),
      table: raw.td?.id ?? null,
      sources: def.sources,
      ignoredFilters: raw.available ? ignored : [],
      range: raw.range,
      compareRange: raw.compareRange,
      coverageEnd: raw.td?.coverage?.to ?? null,
      freshness: raw.td?.freshness ?? (def.agg.kind === 'custom' && def.module === 'geo' ? ctx.dataset.geo?.freshness ?? null : null),
      notes: raw.notes,
    },
  };
  if (spec.buckets && raw.series) {
    result.series = spec.buckets.map(
      (b, i): SeriesPoint => ({
        key: b.key,
        from: b.from,
        to: b.to,
        partial: raw.seriesPartial?.[i] ?? b.partial,
        value: raw.series![i],
        compare: raw.compareSeries?.[i] ?? null,
        compareFrom: spec.compareBuckets?.[i]?.from,
        compareTo: spec.compareBuckets?.[i]?.to,
      }),
    );
  }
  if (raw.groups) {
    const rows: BreakdownRow[] = [...raw.groups.entries()]
      .filter(([, v]) => v.value !== 0 || (v.compare ?? 0) !== 0)
      .map(([key, v]) => ({ key, value: v.value, compare: v.compare }))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    result.rows = spec.q.limit ? rows.slice(0, spec.q.limit) : rows;
  }
  return result;
}

export function runQuery(ctx: EngineContext, q: ParsedAnalyticsQuery): AnalyticsResponse {
  if (epochDay(q.from) > epochDay(q.to)) throw new QueryError('`from` must be on or before `to`');
  if (daysInclusive(q.from, q.to) > 1200) throw new QueryError('Date range too long (max 1200 days)');
  for (const m of q.metrics) if (!getMetric(m)) throw new QueryError(`Unknown metric: ${m}`);
  const filters = normaliseFilters(q.filters);
  const active = activeFilterKeys(filters);
  const granularity: Granularity | null = q.granularity === undefined ? null : q.granularity;
  const range: DateRange = { from: q.from, to: q.to };
  const buckets = granularity ? enumerateBuckets(range, granularity) : null;
  const cmpRange = comparisonRange(range, q.compare);
  const compareBuckets = granularity && cmpRange ? enumerateBuckets(cmpRange, granularity) : null;
  if (buckets && buckets.length > 1200) throw new QueryError('Too many buckets; use a coarser granularity');
  const spec: EvalSpec = { q, filters, active, buckets, compareBuckets };
  return {
    query: { from: q.from, to: q.to, compare: q.compare, granularity, groupBy: q.groupBy ?? null, filters },
    results: q.metrics.map((m) => evaluateMetric(ctx, m, spec)),
    generatedAt: new Date().toISOString(),
  };
}

export { defaultGranularity };
