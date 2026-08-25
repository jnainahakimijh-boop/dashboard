/** ------------------------------------------------------------------
 *  Central metric engine.
 *
 *  Every derived metric in the product is computed here from source
 *  values — never hard-coded. All ratio helpers are zero-denominator
 *  safe: they return `null` (rendered as "—") instead of NaN/Infinity.
 *  ------------------------------------------------------------------ */

/** numerator / denominator, null when the denominator is 0 (or inputs invalid) */
export function ratio(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

/** clicks / impressions × 100 */
export function ctr(clicks: number, impressions: number): number | null {
  const r = ratio(clicks, impressions);
  return r === null ? null : r * 100;
}

/** engagements / impressions × 100 */
export function engagementRateSocial(engagements: number, impressions: number): number | null {
  const r = ratio(engagements, impressions);
  return r === null ? null : r * 100;
}

/** engaged sessions / sessions × 100 */
export function engagementRateWeb(engaged: number, sessions: number): number | null {
  const r = ratio(engaged, sessions);
  return r === null ? null : r * 100;
}

/** conversions / sessions × 100 */
export function cvr(conversions: number, sessions: number): number | null {
  const r = ratio(conversions, sessions);
  return r === null ? null : r * 100;
}

/** spend / conversions */
export function cpa(spend: number, conversions: number): number | null {
  return ratio(spend, conversions);
}

/** spend / clicks */
export function cpc(spend: number, clicks: number): number | null {
  return ratio(spend, clicks);
}

/** spend / impressions × 1000 */
export function cpm(spend: number, impressions: number): number | null {
  const r = ratio(spend, impressions);
  return r === null ? null : r * 1000;
}

/** attributed revenue / spend */
export function roas(revenue: number, spend: number): number | null {
  return ratio(revenue, spend);
}

/** total engagement seconds / sessions */
export function avgEngagementTime(engTimeSec: number, sessions: number): number | null {
  return ratio(engTimeSec, sessions);
}

/** Relative change between two absolute values, in % (null-safe). */
export function relChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Difference between two rates, in percentage points (null-safe).
 *  Rates are compared in points — never as a relative % of a %. */
export function ppChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return current - previous;
}

export type DeltaKind = 'rel' | 'pp';

export interface Delta {
  value: number | null;
  kind: DeltaKind;
  /** direction of business impact: +1 good, -1 bad, 0 neutral/unknown */
  sentiment: -1 | 0 | 1;
}

/** Build a delta for an absolute metric (relative % change). */
export function deltaAbs(current: number, previous: number, higherIsBetter = true): Delta {
  const v = relChange(current, previous);
  return { value: v, kind: 'rel', sentiment: sentimentOf(v, higherIsBetter) };
}

/** Build a delta for a rate metric (percentage-point change). */
export function deltaRate(current: number | null, previous: number | null, higherIsBetter = true): Delta {
  const v = ppChange(current, previous);
  return { value: v, kind: 'pp', sentiment: sentimentOf(v, higherIsBetter) };
}

function sentimentOf(v: number | null, higherIsBetter: boolean): -1 | 0 | 1 {
  if (v === null || v === 0) return 0;
  const up = v > 0;
  return up === higherIsBetter ? 1 : -1;
}
