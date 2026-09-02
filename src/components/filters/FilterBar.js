import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { CalendarDays, Check, RotateCcw, Search, X } from 'lucide-react';
import { CHANNELS, DAYS, DEVICES, FORMATS, MARKETS, PLATFORMS, THEMES, dateToDay, dayToDate } from '/src/data/dimensions.js';
import { CAMPAIGN_DEFS } from '/src/data/campaigns.js';
import { ADVOCACY_PROGRAMS, ADVOCATE_GROUPS } from '/src/data/advocacy.js';
import { FILTERED_PAGES, PAGE_META } from '/src/lib/nav.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
const DIMS = [
    { key: 'markets', labelKey: 'filters.market', options: MARKETS.map((m) => ({ id: m.id, label: (l) => (l === 'fr' ? m.nameFr : m.name) })) },
    { key: 'regions', labelKey: 'filters.region', options: [...new Set(MARKETS.map((m) => m.region))].map((r) => ({ id: r, label: () => r })) },
    { key: 'languages', labelKey: 'filters.language', options: [...new Set(MARKETS.map((m) => m.lang))].map((l) => ({ id: l, label: () => l.toUpperCase() })) },
    { key: 'channels', labelKey: 'filters.channel', options: CHANNELS.map((c) => ({ id: c.id, label: (l) => (l === 'fr' ? c.nameFr : c.name) })) },
    { key: 'platforms', labelKey: 'filters.platform', options: PLATFORMS.map((p) => ({ id: p.id, label: () => p.name })) },
    { key: 'devices', labelKey: 'filters.device', options: DEVICES.map((d) => ({ id: d.id, label: (l) => (l === 'fr' ? d.nameFr : d.name) })) },
    { key: 'campaigns', labelKey: 'filters.campaign', options: CAMPAIGN_DEFS.map((c) => ({ id: c.id, label: () => c.name })) },
    { key: 'themes', labelKey: 'filters.theme', options: THEMES.map((t) => ({ id: t.id, label: (l) => (l === 'fr' ? t.nameFr : t.name) })) },
    { key: 'formats', labelKey: 'filters.format', options: FORMATS.map((f) => ({ id: f.id, label: (l) => (l === 'fr' ? f.nameFr : f.name) })) },
    { key: 'advocacyPrograms', labelKey: 'filters.advocacyProgram', options: ADVOCACY_PROGRAMS.map((p) => ({ id: p.id, label: (l) => (l === 'fr' ? p.nameFr : p.name) })) },
    { key: 'advocateGroups', labelKey: 'filters.advocateGroup', options: ADVOCATE_GROUPS.map((g) => ({ id: g.id, label: (l) => (l === 'fr' ? g.nameFr : g.name) })) },
];
const PRESETS = [
    ['today', 'Today', "Aujourd’hui"],
    ['yesterday', 'Yesterday', 'Hier'],
    ['7d', 'Last 7 days', '7 derniers jours'],
    ['30d', 'Last 30 days', '30 derniers jours'],
    ['90d', 'Last 90 days', '90 derniers jours'],
    ['mtd', 'Month to date', 'Mois en cours'],
    ['qtd', 'Quarter to date', 'Trimestre en cours'],
    ['ytd', 'Year to date', 'Année en cours'],
    ['prev-month', 'Previous month', 'Mois précédent'],
    ['prev-quarter', 'Previous quarter', 'Trimestre précédent'],
    ['prev-year', 'Previous year', 'Année précédente'],
];
function isoDate(day) {
    return dayToDate(day).toISOString().slice(0, 10);
}
function dayFromIso(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return null;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()))
        return null;
    const day = dateToDay(date);
    return day >= 0 && day < DAYS ? day : null;
}
function exactDate(day, lang) {
    return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
    }).format(dayToDate(day));
}
function DimensionSection({ dim, applicable }) {
    const { filters, toggle } = useFilters();
    const { t, lang } = useI18n();
    const selected = filters[dim.key];
    const [query, setQuery] = useState('');
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? dim.options.filter((o) => o.label(lang).toLowerCase().includes(q)) : dim.options;
    }, [dim.options, query, lang]);
    return (_jsxs("details", { className: clsx('group rounded-[6px] border bg-card', applicable ? 'border-brd' : 'border-brd opacity-60'), children: [_jsxs("summary", { className: "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[12.5px] font-semibold text-t1 marker:hidden", children: [_jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [_jsx("span", { className: "truncate", children: t(dim.labelKey) }), selected.length > 0 && _jsx("span", { className: "rounded-full bg-acc px-1.5 text-[10px] font-bold leading-[18px] text-white", children: selected.length })] }), _jsx("span", { className: "text-[10.5px] font-normal text-t3", children: applicable ? (lang === 'fr' ? 'Disponible' : 'Available') : (lang === 'fr' ? 'Non utilisé sur cette page' : 'Not used on this page') })] }), _jsxs("div", { className: "border-t border-brd p-2.5", children: [dim.options.length > 6 && (_jsxs("label", { className: "relative mb-2 block", children: [_jsx("span", { className: "sr-only", children: t('filters.search') }), _jsx(Search, { size: 14, className: "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-t3", "aria-hidden": true }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('filters.search'), disabled: !applicable, className: "h-10 w-full rounded-[6px] border border-brd bg-inset pl-8 pr-2.5 text-[13px] text-t1 placeholder:text-t3" })] })), _jsxs("div", { className: "grid gap-1 sm:grid-cols-2", children: [visible.map((o) => {
                                const active = selected.includes(o.id);
                                return (_jsxs("label", { className: clsx('flex min-h-10 items-center gap-2.5 rounded-[5px] px-2.5 py-2 text-[12.5px]', applicable ? 'cursor-pointer hover:bg-hov' : 'cursor-not-allowed'), children: [_jsx("input", { type: "checkbox", disabled: !applicable, checked: active, onChange: () => toggle(dim.key, o.id), className: "h-4 w-4 shrink-0 accent-[var(--accent)]" }), _jsx("span", { className: "min-w-0 flex-1 truncate text-t2", children: o.label(lang) }), active && _jsx(Check, { size: 14, className: "shrink-0 text-acctext", "aria-hidden": true })] }, o.id));
                            }), visible.length === 0 && _jsx("p", { className: "col-span-full m-0 px-2 py-2 text-[12px] text-t3", children: t('tbl.noResults') })] })] })] }));
}
export function FilterBar() {
    const { filters, set, reset, setRangePreset } = useFilters();
    const { t, lang } = useI18n();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const [from, setFrom] = useState(() => isoDate(filters.from));
    const [to, setTo] = useState(() => isoDate(filters.to));
    const [dateError, setDateError] = useState('');
    const drawerRef = useRef(null);
    useEffect(() => {
        setFrom(isoDate(filters.from));
        setTo(isoDate(filters.to));
    }, [filters.from, filters.to]);
    useEffect(() => {
        const openFilters = () => setOpen(true);
        window.addEventListener('dp:open-filters', openFilters);
        return () => window.removeEventListener('dp:open-filters', openFilters);
    }, []);
    useEffect(() => {
        if (!open)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => drawerRef.current?.focus());
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                requestAnimationFrame(() => document.getElementById('global-filter-trigger')?.focus());
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
    if (!FILTERED_PAGES.has(pathname))
        return null;
    const applicable = new Set(PAGE_META[pathname]?.filterDims ?? []);
    const dateSummary = `${exactDate(filters.from, lang)} → ${exactDate(filters.to, lang)}`;
    const min = isoDate(0);
    const max = isoDate(DAYS - 1);
    const applyCustomDates = () => {
        const f = dayFromIso(from);
        const tt = dayFromIso(to);
        if (f === null || tt === null || f > tt) {
            setDateError(lang === 'fr' ? `Choisissez une période valide entre ${exactDate(0, lang)} et ${exactDate(DAYS - 1, lang)}.` : `Choose a valid period between ${exactDate(0, lang)} and ${exactDate(DAYS - 1, lang)}.`);
            return false;
        }
        set({ from: f, to: tt, rangePreset: 'custom' });
        setDateError('');
        return true;
    };
    const closeWithDatesApplied = () => {
        const datesChanged = from !== isoDate(filters.from) || to !== isoDate(filters.to);
        if (datesChanged && !applyCustomDates())
            return;
        setOpen(false);
        requestAnimationFrame(() => document.getElementById('global-filter-trigger')?.focus());
    };
    return (_jsx(_Fragment, { children: open && createPortal(_jsxs("div", { className: "fixed inset-0 z-[90]", children: [_jsx("button", { type: "button", "aria-label": lang === 'fr' ? 'Fermer les filtres' : 'Close filters', onClick: () => setOpen(false), className: "absolute inset-0 h-full w-full cursor-default bg-black/25" }), _jsxs("div", { ref: drawerRef, tabIndex: -1, role: "dialog", "aria-modal": "true", "aria-label": t('filters.title'), className: "drawer-in absolute inset-y-0 right-0 flex w-full max-w-[470px] flex-col border-l border-brds bg-app shadow-[var(--shadow-pop)] focus:outline-none", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 border-b border-brd bg-card px-5 py-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "m-0 text-[18px] font-bold text-t1", children: t('filters.title') }), _jsx("p", { className: "m-0 mt-1 text-[12px] text-t3", children: lang === 'fr' ? 'Tous les filtres sont regroupés ici pour garder le tableau de bord dégagé.' : 'All filters are grouped here to keep the dashboard clear.' })] }), _jsx("button", { type: "button", onClick: () => setOpen(false), "aria-label": lang === 'fr' ? 'Fermer' : 'Close', className: "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] text-t3 hover:bg-hov hover:text-t1", children: _jsx(X, { size: 18, "aria-hidden": true }) })] }), _jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto px-5 py-4", children: [_jsxs("section", { "aria-labelledby": "period-heading", className: "rounded-[6px] border border-brd bg-card p-4", children: [_jsxs("div", { className: "flex items-start gap-2", children: [_jsx(CalendarDays, { size: 16, className: "mt-0.5 text-acctext", "aria-hidden": true }), _jsxs("div", { children: [_jsx("h3", { id: "period-heading", className: "m-0 text-[14px] font-semibold text-t1", children: lang === 'fr' ? 'Période' : 'Date range' }), _jsx("p", { className: "m-0 mt-0.5 text-[11.5px] text-t3", children: dateSummary })] })] }), _jsx("div", { className: "mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3", children: PRESETS.map(([id, en, fr]) => (_jsx("button", { type: "button", onClick: () => { setRangePreset(id); setDateError(''); }, className: clsx('min-h-10 rounded-[6px] border px-2 py-1.5 text-[11.5px] font-semibold leading-4', filters.rangePreset === id ? 'border-acc bg-accsoft text-acctext' : 'border-brd bg-card2 text-t2 hover:border-brds hover:text-t1'), children: lang === 'fr' ? fr : en }, id))) }), _jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [_jsxs("label", { className: "text-[11.5px] font-semibold text-t2", children: [_jsx("span", { className: "mb-1 block", children: lang === 'fr' ? 'Date de début' : 'Start date' }), _jsx("input", { type: "date", min: min, max: max, value: from, onChange: (e) => { setFrom(e.target.value); setDateError(''); }, className: "h-11 w-full rounded-[6px] border border-brd bg-card px-2.5 text-[16px] text-t1 sm:text-[13px]" })] }), _jsxs("label", { className: "text-[11.5px] font-semibold text-t2", children: [_jsx("span", { className: "mb-1 block", children: lang === 'fr' ? 'Date de fin' : 'End date' }), _jsx("input", { type: "date", min: min, max: max, value: to, onChange: (e) => { setTo(e.target.value); setDateError(''); }, className: "h-11 w-full rounded-[6px] border border-brd bg-card px-2.5 text-[16px] text-t1 sm:text-[13px]" })] })] }), dateError && _jsx("p", { role: "alert", className: "mb-0 mt-2 rounded-[6px] bg-negsoft px-3 py-2 text-[11.5px] text-neg", children: dateError }), _jsx("button", { type: "button", onClick: () => applyCustomDates(), className: "mt-3 inline-flex h-10 items-center justify-center rounded-full border border-acc bg-acc px-4 text-[12px] font-semibold text-white hover:bg-card hover:text-acc", children: lang === 'fr' ? 'Appliquer les dates exactes' : 'Apply exact dates' })] }), _jsxs("section", { className: "mt-3 rounded-[6px] border border-brd bg-card p-4", children: [_jsx("label", { className: "block text-[12px] font-semibold text-t1", htmlFor: "filter-compare", children: lang === 'fr' ? 'Comparer avec' : 'Compare with' }), _jsxs("select", { id: "filter-compare", value: filters.compare, onChange: (e) => set({ compare: e.target.value }), className: "mt-2 h-11 w-full rounded-[6px] border border-brd bg-card px-3 text-[13px] text-t1", children: [_jsx("option", { value: "previous", children: t('compare.previous') }), _jsx("option", { value: "previous-month", children: lang === 'fr' ? 'Mois précédent' : 'Previous month' }), _jsx("option", { value: "previous-quarter", children: lang === 'fr' ? 'Trimestre précédent' : 'Previous quarter' }), _jsx("option", { value: "previous-year", children: lang === 'fr' ? 'Période - 1 an' : 'Previous-year period' }), _jsx("option", { value: "same-period-last-year", children: lang === 'fr' ? 'Même période N-1' : 'Same period last year' }), _jsx("option", { value: "none", children: t('compare.none') })] })] }), _jsxs("div", { className: "mt-4 flex items-baseline justify-between gap-3", children: [_jsx("h3", { className: "m-0 text-[14px] font-semibold text-t1", children: lang === 'fr' ? 'Dimensions' : 'Dimensions' }), _jsx("span", { className: "text-[10.5px] text-t3", children: lang === 'fr' ? 'Les filtres indisponibles sont signalés.' : 'Unavailable filters are clearly marked.' })] }), _jsx("div", { className: "mt-2 grid gap-2", children: DIMS.map((dim) => _jsx(DimensionSection, { dim: dim, applicable: applicable.has(dim.key) }, dim.key)) })] }), _jsxs("div", { className: "flex items-center justify-between gap-3 border-t border-brd bg-card px-5 py-3", children: [_jsxs("button", { type: "button", onClick: reset, className: "inline-flex h-10 items-center gap-2 rounded-[6px] px-3 text-[12px] font-semibold text-t2 hover:bg-hov hover:text-acctext", children: [_jsx(RotateCcw, { size: 14, "aria-hidden": true }), t('filters.clearAll')] }), _jsx("button", { type: "button", onClick: closeWithDatesApplied, className: "inline-flex h-10 items-center justify-center rounded-full border border-acc bg-acc px-5 text-[12px] font-semibold text-white hover:bg-card hover:text-acc", children: lang === 'fr' ? 'Appliquer et voir les résultats' : 'Apply & view results' })] })] })] }), document.body) }));
}
