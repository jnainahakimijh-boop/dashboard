import type { CampaignTotals, SocialTotals, WebTotals } from './aggregate';
import { avgEngagementTime, cpa, ctr, cvr, deltaAbs, deltaRate, engagementRateSocial, engagementRateWeb, type Delta } from './metrics';
import { fmtCompact, fmtDuration, fmtEur, fmtInt, fmtPct, type Locale } from './format';
import type { MsgKey } from '@/i18n/messages';

/** ------------------------------------------------------------------
 *  KPI registry: one place that knows how each KPI is computed from
 *  source totals, how it is formatted, and how deltas behave
 *  (absolute → relative %, rate → percentage points).
 *  ------------------------------------------------------------------ */

export type KpiUnit = 'count' | 'rate' | 'duration' | 'currency';

export interface KpiDef<T> {
  id: string;
  labelKey: MsgKey;
  defKey: MsgKey;
  unit: KpiUnit;
  higherIsBetter: boolean;
  value: (t: T) => number | null;
  format: (v: number | null, l: Locale, compact?: boolean) => string;
}

const countFmt = (v: number | null, l: Locale, compact = true) => (compact ? fmtCompact(v, l) : fmtInt(v, l));
const rateFmt = (v: number | null, l: Locale) => fmtPct(v, l);
const durFmt = (v: number | null) => fmtDuration(v);
const eurFmt = (v: number | null, l: Locale) => fmtEur(v, l);

export const WEB_KPIS: KpiDef<WebTotals>[] = [
  { id: 'users', labelKey: 'kpi.users', defKey: 'def.users', unit: 'count', higherIsBetter: true, value: (t) => t.users, format: countFmt },
  { id: 'sessions', labelKey: 'kpi.sessions', defKey: 'def.sessions', unit: 'count', higherIsBetter: true, value: (t) => t.sessions, format: countFmt },
  { id: 'engagedSessions', labelKey: 'kpi.engagedSessions', defKey: 'def.engagedSessions', unit: 'count', higherIsBetter: true, value: (t) => t.engaged, format: countFmt },
  { id: 'engagementRate', labelKey: 'kpi.engagementRate', defKey: 'def.engagementRateWeb', unit: 'rate', higherIsBetter: true, value: (t) => engagementRateWeb(t.engaged, t.sessions), format: rateFmt },
  { id: 'avgEngTime', labelKey: 'kpi.avgEngTime', defKey: 'def.avgEngTime', unit: 'duration', higherIsBetter: true, value: (t) => avgEngagementTime(t.engTime, t.sessions), format: durFmt },
  { id: 'conversions', labelKey: 'kpi.conversions', defKey: 'def.conversions', unit: 'count', higherIsBetter: true, value: (t) => t.conversions, format: countFmt },
  { id: 'cvr', labelKey: 'kpi.cvr', defKey: 'def.cvr', unit: 'rate', higherIsBetter: true, value: (t) => cvr(t.conversions, t.sessions), format: rateFmt },
];

export const SOCIAL_KPIS: KpiDef<SocialTotals>[] = [
  { id: 'impressions', labelKey: 'kpi.impressions', defKey: 'def.impressions', unit: 'count', higherIsBetter: true, value: (t) => t.impressions, format: countFmt },
  { id: 'reach', labelKey: 'kpi.reach', defKey: 'def.reach', unit: 'count', higherIsBetter: true, value: (t) => t.reach, format: countFmt },
  { id: 'engagements', labelKey: 'kpi.engagements', defKey: 'def.engagementRateSocial', unit: 'count', higherIsBetter: true, value: (t) => t.engagements, format: countFmt },
  { id: 'engagementRate', labelKey: 'kpi.engagementRate', defKey: 'def.engagementRateSocial', unit: 'rate', higherIsBetter: true, value: (t) => engagementRateSocial(t.engagements, t.impressions), format: rateFmt },
  { id: 'clicks', labelKey: 'kpi.clicks', defKey: 'def.clicks', unit: 'count', higherIsBetter: true, value: (t) => t.clicks, format: countFmt },
  { id: 'ctr', labelKey: 'kpi.ctr', defKey: 'def.ctr', unit: 'rate', higherIsBetter: true, value: (t) => ctr(t.clicks, t.impressions), format: rateFmt },
  { id: 'videoViews', labelKey: 'kpi.videoViews', defKey: 'def.videoViews', unit: 'count', higherIsBetter: true, value: (t) => t.videoViews, format: countFmt },
  { id: 'followerNet', labelKey: 'kpi.followerNet', defKey: 'def.followerNet', unit: 'count', higherIsBetter: true, value: (t) => t.followerNet, format: countFmt },
];

export const CAMPAIGN_KPIS: KpiDef<CampaignTotals>[] = [
  { id: 'impressions', labelKey: 'kpi.impressions', defKey: 'def.impressions', unit: 'count', higherIsBetter: true, value: (t) => t.impressions, format: countFmt },
  { id: 'clicks', labelKey: 'kpi.clicks', defKey: 'def.clicks', unit: 'count', higherIsBetter: true, value: (t) => t.clicks, format: countFmt },
  { id: 'ctr', labelKey: 'kpi.ctr', defKey: 'def.ctr', unit: 'rate', higherIsBetter: true, value: (t) => ctr(t.clicks, t.impressions), format: rateFmt },
  { id: 'conversions', labelKey: 'kpi.conversions', defKey: 'def.conversions', unit: 'count', higherIsBetter: true, value: (t) => t.conversions, format: countFmt },
  { id: 'spend', labelKey: 'kpi.spend', defKey: 'def.spend', unit: 'currency', higherIsBetter: false, value: (t) => t.spend, format: eurFmt },
  { id: 'cpa', labelKey: 'kpi.cpa', defKey: 'def.cpa', unit: 'currency', higherIsBetter: false, value: (t) => cpa(t.spend, t.conversions), format: eurFmt },
];

/** Delta between two totals for a KPI, respecting unit semantics. */
export function kpiDelta<T>(def: KpiDef<T>, current: T, previous: T): Delta {
  const cv = def.value(current);
  const pv = def.value(previous);
  if (def.unit === 'rate') return deltaRate(cv, pv, def.higherIsBetter);
  if (cv === null || pv === null) return { value: null, kind: 'rel', sentiment: 0 };
  return deltaAbs(cv, pv, def.higherIsBetter);
}
