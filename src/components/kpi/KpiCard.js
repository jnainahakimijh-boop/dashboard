import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { DeltaTag, InfoTip } from '/src/components/ui/primitives.js';
export function KpiCard({ label, definition, value, prevValue, delta, compareLabel, compareLabelFull, href, lang }) {
    const location = useLocation();
    const from = `${location.pathname}${location.search}`;
    const target = href && location.search && !href.includes('?')
        ? (() => { const [path, hash] = href.split('#'); return `${path}${location.search}${hash ? `#${hash}` : ''}`; })()
        : href;
    const drillLabel = lang === 'fr' ? `Voir le détail de ${label}` : `View ${label} detail`;
    return (_jsxs("article", { className: `surface-card relative min-w-0 rounded-[6px] border border-brds bg-card p-[var(--pad-card)] ${href ? 'interactive cursor-pointer hover:border-acc/55' : ''}`, "aria-label": `${label}: ${value}`, children: [href && (_jsx(Link, { to: target, state: { from, fromLabel: label }, "aria-label": `${drillLabel}. ${label}: ${value}`, className: "absolute inset-0 z-10 rounded-[6px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc", children: _jsx("span", { className: "sr-only", children: drillLabel }) })), _jsxs("div", { className: "relative z-20 flex min-w-0 items-start gap-1.5 pointer-events-none", children: [_jsx("span", { className: "eyebrow min-w-0 leading-[1.35]", title: label, children: label }), _jsx(InfoTip, { text: definition, className: "pointer-events-auto" }), href && _jsx(ArrowUpRight, { size: 13, className: "ml-auto shrink-0 text-t3", "aria-hidden": true })] }), _jsx("div", { className: "mt-3 text-[30px] font-bold leading-none tracking-[-0.025em] text-t1 tnum", "aria-hidden": "true", children: value }), delta ? (_jsxs("div", { className: "mt-3 flex min-w-0 items-center gap-2 border-t border-brd pt-2.5", children: [_jsx(DeltaTag, { delta: delta, lang: lang, label: compareLabelFull ?? compareLabel }), compareLabel && (_jsxs("span", { className: "min-w-0 truncate text-[11px] text-t3", title: prevValue ? `${compareLabelFull ?? compareLabel}: ${prevValue}` : (compareLabelFull ?? compareLabel), children: [compareLabel, prevValue ? ` · ${prevValue}` : ''] }))] })) : (_jsx("div", { className: "mt-3 h-[20px] border-t border-brd pt-2.5 text-[11px] text-t3", children: "\u00A0" }))] }));
}
export function KpiGrid({ children, dense = false }) {
    return _jsx("div", { className: `grid gap-[var(--gap-grid)] sm:grid-cols-2 md:grid-cols-3 ${dense ? 'xl:grid-cols-6' : 'xl:grid-cols-6'}`, children: children });
}
