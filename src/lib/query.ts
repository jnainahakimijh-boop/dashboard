/** Helpers that turn the global filter state into semantic-layer queries. */
import { defaultGranularity, type Granularity } from '@shared/calendar';
import type { AnalyticsQuery, DimensionId, Filters, MetricResult } from '@shared/filters';
import type { Series } from '@/components/charts';
import { formatBucket } from '@/lib/format';
import type { GlobalFilters } from '@/state/filters';

export function spec(gf: GlobalFilters, metrics: string[], extra: { groupBy?: DimensionId; granularity?: Granularity | 'auto' | null; limit?: number; filters?: Filters; compare?: 'previous' | 'yoy' | 'none' } = {}): AnalyticsQuery {
  const granularity = extra.granularity === 'auto' ? defaultGranularity(gf.range) : extra.granularity ?? undefined;
  return {
    metrics,
    from: gf.range.from,
    to: gf.range.to,
    compare: extra.compare ?? gf.compare,
    filters: { ...gf.filters, ...(extra.filters ?? {}) },
    ...(granularity ? { granularity } : {}),
    ...(extra.groupBy ? { groupBy: extra.groupBy } : {}),
    ...(extra.limit ? { limit: extra.limit } : {}),
  };
}

export function toSeries(r: MetricResult, label: string, slot: number, unit: Series['unit'], granularity: Granularity, lang: 'en' | 'fr'): Series {
  return { id: r.metric, label, slot, unit, points: (r.series ?? []).map((p) => ({ key: p.key, label: formatBucket(p.key, granularity, lang), value: p.value, compare: p.compare, partial: p.partial })) };
}

export function byKey(r: MetricResult | undefined, key: string) {
  return r?.rows?.find((x) => x.key === key) ?? null;
}
