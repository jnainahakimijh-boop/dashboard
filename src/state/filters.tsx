/** Global filters held in the URL (shareable, bookmarkable, restored by saved views). */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { comparisonRange, isIsoDate, resolvePreset, type CompareMode, type DateRange, type RangePreset } from '@shared/calendar';
import { FILTER_KEYS, normaliseFilters, type FilterKey, type Filters } from '@shared/filters';
import { useMeta } from '@/api/hooks';

export interface GlobalFilters {
  preset: RangePreset;
  range: DateRange;
  compare: CompareMode;
  compareRange: DateRange | null;
  filters: Filters;
  asOf: string;
  activeCount: number;
  setPreset: (p: RangePreset, custom?: DateRange) => void;
  setCompare: (c: CompareMode) => void;
  setFilter: (k: FilterKey, values: string[]) => void;
  clearFilters: () => void;
  applyState: (s: { preset?: RangePreset; from?: string; to?: string; compare?: CompareMode; filters?: Filters }) => void;
  /** query parameters for module GET endpoints */
  params: Record<string, string | string[]>;
  /** serialisable snapshot for saved views */
  snapshot: { preset: RangePreset; from?: string; to?: string; compare: CompareMode; filters: Filters };
}

const PRESETS: RangePreset[] = ['last7', 'last30', 'last90', 'mtd', 'qtd', 'ytd', 'prevMonth', 'prevQuarter', 'prevYear', 'custom'];

export function useGlobalFilters(): GlobalFilters {
  const [sp, setSp] = useSearchParams();
  const meta = useMeta();
  const asOf = meta.data?.asOf ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const orgDefaults = meta.data?.org.settings;
  const defaultPreset = (PRESETS.includes(orgDefaults?.defaultPeriod as RangePreset) ? orgDefaults!.defaultPeriod : 'last30') as RangePreset;
  const preset = (PRESETS.includes(sp.get('p') as RangePreset) ? sp.get('p') : defaultPreset) as RangePreset;
  const compare = (['previous', 'yoy', 'none'].includes(sp.get('cmp') ?? '') ? sp.get('cmp') : (orgDefaults?.defaultCompare ?? 'previous')) as CompareMode;
  const filtersKey = FILTER_KEYS.map((k) => sp.get(k) ?? '').join('|');
  const filters = useMemo(() => {
    const f: Filters = {};
    for (const k of FILTER_KEYS) {
      const v = sp.get(k);
      if (v) f[k] = v.split(',').filter(Boolean);
    }
    return normaliseFilters(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);
  const from = sp.get('from');
  const to = sp.get('to');
  const range = useMemo<DateRange>(() => {
    if (preset === 'custom' && isIsoDate(from) && isIsoDate(to) && from <= to) return { from, to };
    return resolvePreset(preset === 'custom' ? 'last30' : preset, asOf);
  }, [preset, from, to, asOf]);

  const update = useCallback(
    (fn: (p: URLSearchParams) => void) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          fn(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  const setPreset = useCallback(
    (p: RangePreset, custom?: DateRange) =>
      update((n) => {
        n.set('p', p);
        if (p === 'custom' && custom) {
          n.set('from', custom.from);
          n.set('to', custom.to);
        } else {
          n.delete('from');
          n.delete('to');
        }
      }),
    [update],
  );
  const setCompare = useCallback((c: CompareMode) => update((n) => n.set('cmp', c)), [update]);
  const setFilter = useCallback(
    (k: FilterKey, values: string[]) =>
      update((n) => {
        if (values.length) n.set(k, [...new Set(values)].join(','));
        else n.delete(k);
      }),
    [update],
  );
  const clearFilters = useCallback(() => update((n) => FILTER_KEYS.forEach((k) => n.delete(k))), [update]);
  const applyState = useCallback(
    (s: { preset?: RangePreset; from?: string; to?: string; compare?: CompareMode; filters?: Filters }) =>
      update((n) => {
        if (s.preset) n.set('p', s.preset);
        if (s.from && s.to) {
          n.set('from', s.from);
          n.set('to', s.to);
        } else {
          n.delete('from');
          n.delete('to');
        }
        if (s.compare) n.set('cmp', s.compare);
        FILTER_KEYS.forEach((k) => n.delete(k));
        for (const [k, v] of Object.entries(s.filters ?? {})) if (v?.length) n.set(k, v.join(','));
      }),
    [update],
  );

  const params = useMemo(() => {
    const p: Record<string, string | string[]> = { from: range.from, to: range.to, compare };
    for (const [k, v] of Object.entries(filters)) if (v?.length) p[k] = v;
    return p;
  }, [range, compare, filters]);

  return {
    preset,
    range,
    compare,
    compareRange: comparisonRange(range, compare),
    filters,
    asOf,
    activeCount: Object.keys(filters).length,
    setPreset,
    setCompare,
    setFilter,
    clearFilters,
    applyState,
    params,
    snapshot: { preset, ...(preset === 'custom' ? { from: range.from, to: range.to } : {}), compare, filters },
  };
}
