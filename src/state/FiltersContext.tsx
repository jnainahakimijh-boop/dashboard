import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DAYS } from '@/data/dimensions';
import { useSettings } from '@/state/SettingsContext';
import type { ChannelId, DeviceId, Filters, FormatId, MarketId, PlatformId, SavedView, ThemeId } from '@/types';

/** Filters live in the URL (shareable views); saved views persist locally. */

export const RANGE_DAYS: Record<'7d' | '28d' | '90d', number> = { '7d': 7, '28d': 28, '90d': 90 };

export function defaultFilters(preset: '7d' | '28d' | '90d' = '28d'): Filters {
  const len = RANGE_DAYS[preset];
  return {
    from: DAYS - len,
    to: DAYS - 1,
    rangePreset: preset,
    compare: 'previous',
    markets: [],
    channels: [],
    platforms: [],
    devices: [],
    campaigns: [],
    themes: [],
    formats: [],
  };
}

const LIST_KEYS = [
  ['mk', 'markets'],
  ['ch', 'channels'],
  ['pf', 'platforms'],
  ['dv', 'devices'],
  ['cp', 'campaigns'],
  ['th', 'themes'],
  ['fm', 'formats'],
] as const;

function parseFilters(params: URLSearchParams, fallbackPreset: '7d' | '28d' | '90d'): Filters {
  const f = defaultFilters(fallbackPreset);
  const preset = params.get('range');
  if (preset === '7d' || preset === '28d' || preset === '90d') {
    const len = RANGE_DAYS[preset];
    f.rangePreset = preset;
    f.from = DAYS - len;
    f.to = DAYS - 1;
  } else if (preset === 'custom') {
    const from = Number(params.get('from'));
    const to = Number(params.get('to'));
    if (Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to < DAYS && from <= to) {
      f.rangePreset = 'custom';
      f.from = from;
      f.to = to;
    }
  }
  if (params.get('cmp') === 'none') f.compare = 'none';
  for (const [short, key] of LIST_KEYS) {
    const v = params.get(short);
    if (v) (f[key] as string[]) = v.split(',').filter(Boolean);
  }
  return f;
}

function serializeFilters(f: Filters, params: URLSearchParams): void {
  ['range', 'from', 'to', 'cmp', ...LIST_KEYS.map(([s]) => s)].forEach((k) => params.delete(k));
  if (f.rangePreset === 'custom') {
    params.set('range', 'custom');
    params.set('from', String(f.from));
    params.set('to', String(f.to));
  } else if (f.rangePreset !== '28d') {
    params.set('range', f.rangePreset);
  }
  if (f.compare === 'none') params.set('cmp', 'none');
  for (const [short, key] of LIST_KEYS) {
    const arr = f[key] as string[];
    if (arr.length > 0) params.set(short, arr.join(','));
  }
}

export interface FiltersCtx {
  filters: Filters;
  set: (patch: Partial<Filters>) => void;
  reset: () => void;
  setRangePreset: (preset: '7d' | '28d' | '90d') => void;
  toggle: (key: 'markets' | 'channels' | 'platforms' | 'devices' | 'campaigns' | 'themes' | 'formats', value: string) => void;
  activeCount: number;
  savedViews: SavedView[];
  saveView: (name: string) => void;
  applyView: (id: string) => void;
  deleteView: (id: string) => void;
}

const Ctx = createContext<FiltersCtx | null>(null);

const VIEWS_KEY = 'dp.views';

function loadViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedView[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const { settings } = useSettings();
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadViews);

  const filters = useMemo(() => parseFilters(params, settings.defaultRange), [params, settings.defaultRange]);

  const write = useCallback(
    (next: Filters) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          serializeFilters(next, p);
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const set = useCallback((patch: Partial<Filters>) => write({ ...parseFilters(params, settings.defaultRange), ...patch }), [write, params, settings.defaultRange]);

  const setRangePreset = useCallback(
    (preset: '7d' | '28d' | '90d') => {
      const len = RANGE_DAYS[preset];
      set({ rangePreset: preset, from: DAYS - len, to: DAYS - 1 });
    },
    [set],
  );

  const toggle = useCallback<FiltersCtx['toggle']>(
    (key, value) => {
      const arr = filters[key] as string[];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      set({ [key]: next } as Partial<Filters>);
    },
    [filters, set],
  );

  const reset = useCallback(() => write(defaultFilters(settings.defaultRange)), [write, settings.defaultRange]);

  const activeCount =
    filters.markets.length + filters.channels.length + filters.platforms.length + filters.devices.length + filters.campaigns.length + filters.themes.length + filters.formats.length;

  const persistViews = useCallback((views: SavedView[]) => {
    setSavedViews(views);
    try {
      localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const saveView = useCallback(
    (name: string) => {
      const view: SavedView = { id: `v-${Date.now()}`, name, filters, createdAt: new Date().toISOString() };
      persistViews([view, ...savedViews].slice(0, 12));
    },
    [filters, savedViews, persistViews],
  );

  const applyView = useCallback(
    (id: string) => {
      const v = savedViews.find((x) => x.id === id);
      if (v) write(v.filters);
    },
    [savedViews, write],
  );

  const deleteView = useCallback((id: string) => persistViews(savedViews.filter((v) => v.id !== id)), [savedViews, persistViews]);

  // apply user's default range on first visit without params
  useEffect(() => {
    // no-op: defaults already derive from settings.defaultRange via parseFilters fallback
  }, []);

  const value = useMemo(
    () => ({ filters, set, reset, setRangePreset, toggle, activeCount, savedViews, saveView, applyView, deleteView }),
    [filters, set, reset, setRangePreset, toggle, activeCount, savedViews, saveView, applyView, deleteView],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters(): FiltersCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFilters outside FiltersProvider');
  return ctx;
}

export type { MarketId, ChannelId, PlatformId, DeviceId, ThemeId, FormatId };
