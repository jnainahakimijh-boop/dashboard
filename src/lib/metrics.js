/** ------------------------------------------------------------------
 *  Central metric engine.
 *
 *  Every derived metric in the product is computed here from source
 *  values — never hard-coded. All ratio helpers are zero-denominator
 *  safe: they return `null` (rendered as "—") instead of NaN/Infinity.
 *  ------------------------------------------------------------------ */
/** numerator / denominator, null when the denominator is 0 (or inputs invalid) */
export function ratio(num, den) {
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0)
        return null;
    return num / den;
}
/** clicks / impressions × 100 */
export function ctr(clicks, impressions) {
    const r = ratio(clicks, impressions);
    return r === null ? null : r * 100;
}
/** engagements / impressions × 100 */
export function engagementRateSocial(engagements, impressions) {
    const r = ratio(engagements, impressions);
    return r === null ? null : r * 100;
}
/** engaged sessions / sessions × 100 */
export function engagementRateWeb(engaged, sessions) {
    const r = ratio(engaged, sessions);
    return r === null ? null : r * 100;
}
/** non-engaged sessions / sessions × 100. In GA4 terms this is 100% - engagement rate. */
export function bounceRate(engaged, sessions) {
    const r = ratio(sessions - engaged, sessions);
    return r === null ? null : r * 100;
}
/** conversions / sessions × 100 */
export function cvr(conversions, sessions) {
    const r = ratio(conversions, sessions);
    return r === null ? null : r * 100;
}
/** spend / conversions */
export function cpa(spend, conversions) {
    return ratio(spend, conversions);
}
/** spend / clicks */
export function cpc(spend, clicks) {
    return ratio(spend, clicks);
}
/** spend / impressions × 1000 */
export function cpm(spend, impressions) {
    const r = ratio(spend, impressions);
    return r === null ? null : r * 1000;
}
/** attributed revenue / spend */
export function roas(revenue, spend) {
    return ratio(revenue, spend);
}
/** total engagement seconds / sessions */
export function avgEngagementTime(engTimeSec, sessions) {
    return ratio(engTimeSec, sessions);
}
/** Relative change between two absolute values, in % (null-safe). */
export function relChange(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0)
        return null;
    return ((current - previous) / previous) * 100;
}
/** Difference between two rates, in percentage points (null-safe).
 *  Rates are compared in points — never as a relative % of a %. */
export function ppChange(current, previous) {
    if (current === null || previous === null)
        return null;
    if (!Number.isFinite(current) || !Number.isFinite(previous))
        return null;
    return current - previous;
}
/** Build a delta for an absolute metric (relative % change). */
export function deltaAbs(current, previous, higherIsBetter = true) {
    const v = relChange(current, previous);
    return { value: v, kind: 'rel', sentiment: sentimentOf(v, higherIsBetter) };
}
/** Build a delta for a rate metric (percentage-point change). */
export function deltaRate(current, previous, higherIsBetter = true) {
    const v = ppChange(current, previous);
    return { value: v, kind: 'pp', sentiment: sentimentOf(v, higherIsBetter) };
}
function sentimentOf(v, higherIsBetter) {
    if (v === null || v === 0)
        return 0;
    const up = v > 0;
    return up === higherIsBetter ? 1 : -1;
}
