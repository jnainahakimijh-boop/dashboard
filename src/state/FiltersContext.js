import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ANCHOR_DATE, DAYS, dateToDay } from '/src/data/dimensions.js';
import { useSettings } from '/src/state/SettingsContext.js';
/** Filters live in the URL (shareable views); saved views persist locally. */
export const RANGE_DAYS = { '7d': 7, '28d': 28, '30d': 30, '90d': 90 };
function utcDate(y, m, d) {
    return new Date(Date.UTC(y, m, d));
}
function clampDay(day) {
    return Math.max(0, Math.min(DAYS - 1, day));
}
/** Resolve named calendar ranges against the deterministic dataset anchor. */
export function rangeForPreset(preset) {
    const end = new Date(ANCHOR_DATE);
    const y = end.getUTCFullYear();
    const m = end.getUTCMonth();
    const to = DAYS - 1;
    if (preset === 'today')
        return { from: to, to };
    if (preset === 'yesterday')
        return { from: Math.max(0, to - 1), to: Math.max(0, to - 1) };
    const days = RANGE_DAYS[preset];
    if (days)
        return { from: Math.max(0, DAYS - days), to };
    if (preset === 'mtd')
        return { from: clampDay(dateToDay(utcDate(y, m, 1))), to };
    if (preset === 'qtd')
        return { from: clampDay(dateToDay(utcDate(y, Math.floor(m / 3) * 3, 1))), to };
    if (preset === 'ytd')
        return { from: clampDay(dateToDay(utcDate(y, 0, 1))), to };
    if (preset === 'prev-month') {
        const start = utcDate(y, m - 1, 1);
        const finish = utcDate(y, m, 0);
        return { from: clampDay(dateToDay(start)), to: clampDay(dateToDay(finish)) };
    }
    if (preset === 'prev-quarter') {
        const qStart = Math.floor(m / 3) * 3;
        const start = utcDate(y, qStart - 3, 1);
        const finish = utcDate(y, qStart, 0);
        return { from: clampDay(dateToDay(start)), to: clampDay(dateToDay(finish)) };
    }
    if (preset === 'prev-year') {
        return { from: clampDay(dateToDay(utcDate(y - 1, 0, 1))), to: clampDay(dateToDay(utcDate(y - 1, 11, 31))) };
    }
    return { from: Math.max(0, DAYS - 30), to };
}
export function defaultFilters(preset = '30d', compare = 'previous') {
    const normalized = preset === 'custom' ? '30d' : preset;
    const range = rangeForPreset(normalized);
    return {
        ...range,
        rangePreset: normalized,
        compare,
        markets: [],
        regions: [],
        languages: [],
        channels: [],
        platforms: [],
        devices: [],
        campaigns: [],
        themes: [],
        formats: [],
        advocacyPrograms: [],
        advocateGroups: [],
    };
}
const RANGE_PRESETS = new Set(['today', 'yesterday', '7d', '28d', '30d', '90d', 'mtd', 'qtd', 'ytd', 'prev-month', 'prev-quarter', 'prev-year', 'custom']);
const COMPARE_MODES = new Set(['previous', 'previous-month', 'previous-quarter', 'previous-year', 'same-period-last-year', 'none']);
const LIST_KEYS = [
    ['mk', 'markets'],
    ['rg', 'regions'],
    ['lg', 'languages'],
    ['ch', 'channels'],
    ['pf', 'platforms'],
    ['dv', 'devices'],
    ['cp', 'campaigns'],
    ['th', 'themes'],
    ['fm', 'formats'],
    ['ap', 'advocacyPrograms'],
    ['ag', 'advocateGroups'],
];
function parseFilters(params, fallbackPreset, fallbackCompare = 'previous') {
    const f = defaultFilters(fallbackPreset, fallbackCompare);
    const presetRaw = params.get('range');
    if (presetRaw && RANGE_PRESETS.has(presetRaw)) {
        const preset = presetRaw;
        if (preset === 'custom') {
            const from = Number(params.get('from'));
            const to = Number(params.get('to'));
            if (Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to < DAYS && from <= to) {
                f.rangePreset = 'custom';
                f.from = from;
                f.to = to;
            }
        }
        else {
            const range = rangeForPreset(preset);
            f.rangePreset = preset;
            f.from = range.from;
            f.to = range.to;
        }
    }
    const compareRaw = params.get('cmp');
    if (compareRaw && COMPARE_MODES.has(compareRaw))
        f.compare = compareRaw;
    for (const [short, key] of LIST_KEYS) {
        const v = params.get(short);
        if (v)
            f[key] = v.split(',').filter(Boolean);
    }
    return f;
}
function serializeFilters(f, params) {
    ['range', 'from', 'to', 'cmp', ...LIST_KEYS.map(([s]) => s)].forEach((k) => params.delete(k));
    if (f.rangePreset === 'custom') {
        params.set('range', 'custom');
        params.set('from', String(f.from));
        params.set('to', String(f.to));
    }
    else if (f.rangePreset !== '30d') {
        params.set('range', f.rangePreset);
    }
    if (f.compare !== 'previous')
        params.set('cmp', f.compare);
    for (const [short, key] of LIST_KEYS) {
        const arr = f[key];
        if (arr.length > 0)
            params.set(short, arr.join(','));
    }
}
const Ctx = createContext(null);
const VIEWS_KEY = 'dp.views';
function loadViews() {
    try {
        const raw = localStorage.getItem(VIEWS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed))
            return [];
        return parsed.map((view) => {
            const preset = RANGE_PRESETS.has(view.filters?.rangePreset) ? view.filters.rangePreset : '30d';
            const compare = COMPARE_MODES.has(view.filters?.compare) ? view.filters.compare : 'previous';
            return { ...view, path: view.path || '/', filters: { ...defaultFilters(preset), ...view.filters, rangePreset: preset, compare } };
        });
    }
    catch {
        return [];
    }
}
export function FiltersProvider({ children }) {
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [savedViews, setSavedViews] = useState(loadViews);
    const filters = useMemo(() => parseFilters(params, settings.defaultRange, settings.defaultCompare), [params, settings.defaultRange, settings.defaultCompare]);
    const write = useCallback((next) => {
        setParams((prev) => {
            const p = new URLSearchParams(prev);
            serializeFilters(next, p);
            return p;
        }, { replace: true });
    }, [setParams]);
    const set = useCallback((patch) => write({ ...parseFilters(params, settings.defaultRange, settings.defaultCompare), ...patch }), [write, params, settings.defaultRange, settings.defaultCompare]);
    const setRangePreset = useCallback((preset) => {
        if (preset === 'custom')
            return;
        const range = rangeForPreset(preset);
        set({ rangePreset: preset, from: range.from, to: range.to });
    }, [set]);
    const toggle = useCallback((key, value) => {
        const arr = filters[key];
        const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
        set({ [key]: next });
    }, [filters, set]);
    const reset = useCallback(() => write(defaultFilters(settings.defaultRange, settings.defaultCompare)), [write, settings.defaultRange, settings.defaultCompare]);
    const activeCount = filters.markets.length + filters.regions.length + filters.languages.length + filters.channels.length + filters.platforms.length + filters.devices.length + filters.campaigns.length + filters.themes.length + filters.formats.length + filters.advocacyPrograms.length + filters.advocateGroups.length;
    const persistViews = useCallback((views) => {
        setSavedViews(views);
        try {
            localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
        }
        catch {
            /* storage unavailable */
        }
    }, []);
    const saveView = useCallback((name) => {
        const view = { id: `v-${Date.now()}`, name, path: location.pathname, filters, createdAt: new Date().toISOString() };
        persistViews([view, ...savedViews].slice(0, 12));
    }, [filters, location.pathname, savedViews, persistViews]);
    const applyView = useCallback((id) => {
        const v = savedViews.find((x) => x.id === id);
        if (!v)
            return;
        const targetParams = new URLSearchParams();
        serializeFilters(v.filters, targetParams);
        const query = targetParams.toString();
        navigate(`${v.path || '/'}${query ? `?${query}` : ''}`);
    }, [navigate, savedViews]);
    const deleteView = useCallback((id) => persistViews(savedViews.filter((v) => v.id !== id)), [savedViews, persistViews]);
    // apply user's default range on first visit without params
    useEffect(() => {
        // no-op: defaults already derive from settings.defaultRange via parseFilters fallback
    }, []);
    const value = useMemo(() => ({ filters, set, reset, setRangePreset, toggle, activeCount, savedViews, saveView, applyView, deleteView }), [filters, set, reset, setRangePreset, toggle, activeCount, savedViews, saveView, applyView, deleteView]);
    return _jsx(Ctx.Provider, { value: value, children: children });
}
export function useFilters() {
    const ctx = useContext(Ctx);
    if (!ctx)
        throw new Error('useFilters outside FiltersProvider');
    return ctx;
}
