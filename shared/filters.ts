/** ------------------------------------------------------------------
 *  Global filter model shared by the web app and the API.
 *  A filter only applies to a metric when the metric's source table
 *  carries that dimension; otherwise the API reports it as "not
 *  applicable" for that metric and the UI shows an indicator.
 *  ------------------------------------------------------------------ */
import { z } from 'zod';
import { COMPARE_MODES, isIsoDate, type CompareMode, type Granularity } from './calendar';

export const FILTER_KEYS = ['site', 'country', 'region', 'language', 'channel', 'device', 'campaign', 'bu', 'platform'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string[]>>;

/** Dimensions that can be used to break a metric down (superset of filter keys). */
export const DIMENSIONS = [
  ...FILTER_KEYS,
  'srcmed',
  'page',
  'pageType',
  'topic',
  'query',
  'brand',
  'account',
  'ad',
  'adGroup',
  'adCampaign',
  'adCategory',
  'form',
  'browser',
] as const;
export type DimensionId = (typeof DIMENSIONS)[number];

const isoDate = z.string().refine(isIsoDate, 'Invalid date (YYYY-MM-DD)');
const values = z.array(z.string().min(1).max(200)).max(200);

export const filtersSchema = z
  .object(Object.fromEntries(FILTER_KEYS.map((k) => [k, values.optional()])) as Record<FilterKey, z.ZodOptional<typeof values>>)
  .strict();

export const analyticsQuerySchema = z.object({
  metrics: z.array(z.string().min(1).max(80)).min(1).max(40),
  from: isoDate,
  to: isoDate,
  compare: z.enum(COMPARE_MODES as [CompareMode, ...CompareMode[]]).default('previous'),
  granularity: z.enum(['day', 'week', 'month']).nullable().optional(),
  groupBy: z.enum(DIMENSIONS).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  filters: filtersSchema.default({}),
});

export type AnalyticsQuery = z.input<typeof analyticsQuerySchema>;
export type ParsedAnalyticsQuery = z.output<typeof analyticsQuerySchema>;

export type DataMode = 'demo' | 'connected' | 'partial' | 'unavailable';

export interface ResultNote {
  code:
    | 'coverage_clipped'
    | 'missing_days'
    | 'users_approx'
    | 'no_data'
    | 'unavailable'
    | 'groupby_unsupported'
    | 'sample_only'
    | 'platform_attributed'
    | 'compare_incomplete'
    | 'definition_differs';
  params?: Record<string, string | number>;
}

export interface SeriesPoint {
  key: string;
  from: string;
  to: string;
  partial: boolean;
  value: number | null;
  compare: number | null;
  compareFrom?: string;
  compareTo?: string;
}

export interface BreakdownRow {
  key: string;
  value: number | null;
  compare: number | null;
}

export interface MetricResultMeta {
  mode: DataMode;
  table: string | null;
  sources: string[];
  ignoredFilters: FilterKey[];
  range: { from: string; to: string } | null;
  compareRange: { from: string; to: string } | null;
  coverageEnd: string | null;
  freshness: string | null;
  notes: ResultNote[];
}

export interface MetricResult {
  metric: string;
  value: number | null;
  compare: number | null;
  delta: number | null;
  deltaPct: number | null;
  series?: SeriesPoint[];
  rows?: BreakdownRow[];
  meta: MetricResultMeta;
}

export interface AnalyticsResponse {
  query: { from: string; to: string; compare: CompareMode; granularity: Granularity | null; groupBy: DimensionId | null; filters: Filters };
  results: MetricResult[];
  generatedAt: string;
}

/** Remove empty arrays / unknown keys so URL state and cache keys stay canonical. */
export function normaliseFilters(f: Filters | undefined): Filters {
  const out: Filters = {};
  if (!f) return out;
  for (const k of FILTER_KEYS) {
    const v = f[k];
    if (v && v.length) out[k] = [...new Set(v)].sort();
  }
  return out;
}

export function activeFilterKeys(f: Filters): FilterKey[] {
  return FILTER_KEYS.filter((k) => (f[k]?.length ?? 0) > 0);
}
