/** ------------------------------------------------------------------
 *  Calendar utilities shared by the server and the web app.
 *  All dates are calendar dates (YYYY-MM-DD) in the organisation time
 *  zone; arithmetic is done on UTC epoch days so no DST drift occurs.
 *  ------------------------------------------------------------------ */

export type IsoDate = string; // YYYY-MM-DD

export type RangePreset = 'last7' | 'last30' | 'last90' | 'mtd' | 'qtd' | 'ytd' | 'prevMonth' | 'prevQuarter' | 'prevYear' | 'custom';
export type CompareMode = 'previous' | 'yoy' | 'none';
export type Granularity = 'day' | 'week' | 'month';

export const RANGE_PRESETS: RangePreset[] = ['last7', 'last30', 'last90', 'mtd', 'qtd', 'ytd', 'prevMonth', 'prevQuarter', 'prevYear', 'custom'];
export const COMPARE_MODES: CompareMode[] = ['previous', 'yoy', 'none'];

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is IsoDate {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Epoch day number (days since 1970-01-01) for an ISO calendar date. */
export function epochDay(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function fromEpochDay(n: number): IsoDate {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  return fromEpochDay(epochDay(iso) + n);
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return epochDay(b) - epochDay(a);
}

export function daysInclusive(from: IsoDate, to: IsoDate): number {
  return diffDays(from, to) + 1;
}

function parts(iso: IsoDate): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

function iso(y: number, m: number, d: number): IsoDate {
  return fromEpochDay(Math.round(Date.UTC(y, m - 1, d) / 86400000));
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = Monday … 6 = Sunday */
export function weekday(isoDate: IsoDate): number {
  return (new Date(epochDay(isoDate) * 86400000).getUTCDay() + 6) % 7;
}

/** Same calendar date one year earlier (29 Feb → 28 Feb). */
export function minusOneYear(isoDate: IsoDate): IsoDate {
  const [y, m, d] = parts(isoDate);
  return iso(y - 1, m, Math.min(d, lastDayOfMonth(y - 1, m)));
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/** Resolve a preset relative to the last complete day (`asOf`). */
export function resolvePreset(preset: Exclude<RangePreset, 'custom'>, asOf: IsoDate): DateRange {
  const [y, m] = parts(asOf);
  switch (preset) {
    case 'last7':
      return { from: addDays(asOf, -6), to: asOf };
    case 'last30':
      return { from: addDays(asOf, -29), to: asOf };
    case 'last90':
      return { from: addDays(asOf, -89), to: asOf };
    case 'mtd':
      return { from: iso(y, m, 1), to: asOf };
    case 'qtd': {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: iso(y, qStart, 1), to: asOf };
    }
    case 'ytd':
      return { from: iso(y, 1, 1), to: asOf };
    case 'prevMonth': {
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      return { from: iso(py, pm, 1), to: iso(py, pm, lastDayOfMonth(py, pm)) };
    }
    case 'prevQuarter': {
      const q = Math.floor((m - 1) / 3);
      const pq = q === 0 ? 3 : q - 1;
      const py = q === 0 ? y - 1 : y;
      const start = pq * 3 + 1;
      return { from: iso(py, start, 1), to: iso(py, start + 2, lastDayOfMonth(py, start + 2)) };
    }
    case 'prevYear':
      return { from: iso(y - 1, 1, 1), to: iso(y - 1, 12, 31) };
  }
}

/** Comparison range for a period. `previous` = equal-length period immediately before;
 *  `yoy` = same calendar dates one year earlier. */
export function comparisonRange(range: DateRange, mode: CompareMode): DateRange | null {
  if (mode === 'none') return null;
  if (mode === 'yoy') return { from: minusOneYear(range.from), to: minusOneYear(range.to) };
  const len = daysInclusive(range.from, range.to);
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

/** Monday of the ISO week containing the date. */
export function weekStart(isoDate: IsoDate): IsoDate {
  return addDays(isoDate, -weekday(isoDate));
}

export function bucketKey(isoDate: IsoDate, g: Granularity): string {
  if (g === 'day') return isoDate;
  if (g === 'week') return weekStart(isoDate);
  return isoDate.slice(0, 7);
}

export interface Bucket {
  key: string;
  from: IsoDate;
  to: IsoDate;
  /** true when the bucket is cut by the range edges (partial week/month) */
  partial: boolean;
}

/** Ordered buckets covering [from, to]; edge buckets are clipped and flagged partial. */
export function enumerateBuckets(range: DateRange, g: Granularity): Bucket[] {
  const out: Bucket[] = [];
  let cur = range.from;
  const end = epochDay(range.to);
  while (epochDay(cur) <= end) {
    const key = bucketKey(cur, g);
    let natFrom: IsoDate;
    let natTo: IsoDate;
    if (g === 'day') {
      natFrom = cur;
      natTo = cur;
    } else if (g === 'week') {
      natFrom = key;
      natTo = addDays(key, 6);
    } else {
      const [y, m] = parts(cur);
      natFrom = iso(y, m, 1);
      natTo = iso(y, m, lastDayOfMonth(y, m));
    }
    const from = epochDay(natFrom) < epochDay(range.from) ? range.from : natFrom;
    const to = epochDay(natTo) > end ? range.to : natTo;
    out.push({ key, from, to, partial: from !== natFrom || to !== natTo });
    cur = addDays(to, 1);
  }
  return out;
}

/** Sensible default granularity for a range length. */
export function defaultGranularity(range: DateRange): Granularity {
  const n = daysInclusive(range.from, range.to);
  if (n <= 45) return 'day';
  if (n <= 200) return 'week';
  return 'month';
}

export function clampRange(range: DateRange, min: IsoDate, max: IsoDate): DateRange | null {
  const from = epochDay(range.from) < epochDay(min) ? min : range.from;
  const to = epochDay(range.to) > epochDay(max) ? max : range.to;
  return epochDay(from) > epochDay(to) ? null : { from, to };
}

/** Whether `inner` is fully covered by [min, max]. */
export function covers(min: IsoDate, max: IsoDate, inner: DateRange): boolean {
  return epochDay(inner.from) >= epochDay(min) && epochDay(inner.to) <= epochDay(max);
}
