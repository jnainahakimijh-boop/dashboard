import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react';
import { NAV_SECTIONS } from '/src/lib/nav.js';
import { CAMPAIGN_DEFS, LANDING_PAGES, MARKETS, PLATFORMS, dataset } from '/src/data/index.js';
import { WEB_KPIS, SOCIAL_KPIS } from '/src/lib/kpis.js';
import { useI18n } from '/src/i18n/index.js';
import { useSettings } from '/src/state/SettingsContext.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useToast } from '/src/state/ToastContext.js';
import { buildOverviewCsv, downloadCsv } from '/src/lib/export.js';
export function CommandPalette({ open, onClose }) {
    const { t, lang } = useI18n();
    const navigate = useNavigate();
    const { settings, update } = useSettings();
    const { filters } = useFilters();
    const { toast } = useToast();
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const items = useMemo(() => {
        const nav = NAV_SECTIONS.flatMap((s) => s.items.map((i) => ({
            id: `nav-${i.path}`,
            category: t('cmd.pages'),
            label: t(i.labelKey),
            hint: t('cmd.hint.nav'),
            run: () => navigate(i.path),
        })));
        const actions = [
            {
                id: 'act-export',
                category: t('cmd.actions'),
                label: t('cmd.exportReport'),
                run: () => {
                    downloadCsv(buildOverviewCsv(filters, { methodology: settings.exportMethodology, comparison: settings.exportComparison }), `digital-performance_${new Date().toISOString().slice(0, 10)}.csv`);
                    toast(t('rep.exportCsv') + ' ✓');
                },
            },
            {
                id: 'act-theme',
                category: t('cmd.actions'),
                label: t('cmd.toggleTheme'),
                run: () => update({ theme: settings.theme === 'light' ? 'dark' : 'light' }),
            },
        ];
        const campaigns = CAMPAIGN_DEFS.map((c) => ({
            id: `cmp-${c.id}`,
            category: t('cmd.campaigns'),
            label: c.name,
            run: () => navigate(`/campaigns?cp=${c.id}`),
        }));
        const pages = LANDING_PAGES.map((p) => ({
            id: `lp-${p.path}`,
            category: t('cmd.landingPages'),
            label: p.path,
            run: () => navigate('/web'),
        }));
        const kpis = [...WEB_KPIS, ...SOCIAL_KPIS.filter((k) => !WEB_KPIS.some((w) => w.id === k.id))].map((k) => ({
            id: `kpi-${k.id}`,
            category: t('cmd.kpis'),
            label: t(k.labelKey),
            run: () => navigate('/kpi-catalogue'),
        }));
        const markets = MARKETS.map((m) => ({
            id: `mk-${m.id}`,
            category: t('cmd.markets'),
            label: lang === 'fr' ? m.nameFr : m.name,
            run: () => navigate(`/audience?mk=${m.id}`),
        }));
        const content = dataset.content.slice(0, 60).map((c) => ({
            id: `ct-${c.id}`,
            category: t('cmd.contentItems'),
            label: lang === 'fr' ? c.titleFr : c.title,
            hint: PLATFORMS.find((p) => p.id === c.platform)?.name,
            run: () => navigate('/content'),
        }));
        return [...nav, ...actions, ...campaigns, ...pages, ...kpis, ...markets, ...content];
    }, [t, lang, navigate, filters, settings, update, toast]);
    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q)
            return items.slice(0, 14);
        return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 14);
    }, [items, query]);
    useEffect(() => {
        if (open) {
            setQuery('');
            setActive(0);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);
    useEffect(() => setActive(0), [query]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open)
        return null;
    const runItem = (item) => {
        onClose();
        item.run();
    };
    let lastCategory = '';
    return (_jsx("div", { className: "fixed inset-0 z-[90] flex items-start justify-center bg-black/50 p-4 pt-[12vh]", onMouseDown: (e) => e.target === e.currentTarget && onClose(), children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": t('header.search'), className: "pop-in w-full max-w-xl overflow-hidden rounded-[6px] border border-brds bg-card shadow-[var(--shadow-pop)]", children: [_jsxs("div", { className: "flex items-center gap-2.5 border-b border-brd px-4", children: [_jsx(Search, { size: 15, className: "shrink-0 text-t3", "aria-hidden": true }), _jsx("input", { ref: inputRef, value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setActive((a) => Math.min(a + 1, results.length - 1));
                                }
                                else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setActive((a) => Math.max(a - 1, 0));
                                }
                                else if (e.key === 'Enter' && results[active]) {
                                    runItem(results[active]);
                                }
                            }, placeholder: t('cmd.placeholder'), "aria-label": t('cmd.placeholder'), className: "h-12 w-full bg-transparent text-[14px] text-t1 outline-none placeholder:text-t3" }), _jsx("kbd", { className: "mono shrink-0 rounded-[5px] border border-brd bg-inset px-1.5 py-0.5 text-[10.5px] text-t3", children: "ESC" })] }), _jsxs("ul", { ref: listRef, className: "m-0 max-h-[46vh] list-none overflow-y-auto p-1.5", role: "listbox", children: [results.map((item, i) => {
                            const showCat = item.category !== lastCategory;
                            lastCategory = item.category;
                            return (_jsxs("li", { role: "option", "aria-selected": i === active, children: [showCat && _jsx("div", { className: "eyebrow px-2.5 pb-1 pt-2 text-[10.5px]", children: item.category }), _jsxs("button", { type: "button", onMouseEnter: () => setActive(i), onClick: () => runItem(item), className: clsx('flex w-full items-center justify-between gap-3 rounded-[6px] px-2.5 py-2 text-left text-[13px]', i === active ? 'bg-act text-t1' : 'text-t2'), children: [_jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [item.hint && _jsx("span", { className: "mono shrink-0 text-[10.5px] uppercase tracking-[0.08em] text-t3", children: item.hint }), _jsx("span", { className: "truncate", children: item.label })] }), i === active && _jsx(CornerDownLeft, { size: 12, className: "shrink-0 text-t3", "aria-hidden": true })] })] }, item.id));
                        }), results.length === 0 && (_jsxs("li", { className: "flex items-center gap-2 px-3 py-4 text-[12.5px] text-t3", children: [_jsx(ArrowRight, { size: 13, "aria-hidden": true }), t('cmd.noResults', { q: query })] }))] })] }) }));
}
