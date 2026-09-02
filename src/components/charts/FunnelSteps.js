import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment } from 'react';
import { ArrowRight } from 'lucide-react';
import { fmtInt, fmtPct } from '/src/lib/format.js';
import { ratio } from '/src/lib/metrics.js';
/** Sequential funnel with per-step conversion. Stage widths are proportional
 *  to real values; each inter-stage rate is next ÷ previous × 100. */
export function FunnelSteps({ stages, lang, ariaLabel }) {
    const first = stages[0]?.value ?? 0;
    return (_jsx("div", { role: "img", "aria-label": ariaLabel, className: "flex flex-col gap-1", children: stages.map((s, i) => {
            const widthPct = first > 0 ? Math.max(0, Math.min(100, (s.value / first) * 100)) : 0;
            const stepRate = i > 0 ? ratio(s.value, stages[i - 1].value) : null;
            return (_jsxs(Fragment, { children: [i > 0 && (_jsxs("div", { className: "flex items-center gap-1.5 py-0.5 pl-1", children: [_jsx(ArrowRight, { size: 11, className: "text-t3", "aria-hidden": true }), _jsx("span", { className: "mono text-[10.5px] text-t2 tnum", children: stepRate === null ? '—' : fmtPct(stepRate * 100, lang) }), _jsxs("span", { className: "mono text-[9.5px] text-t3", children: [stages[i - 1].label, " \u2192 ", s.label] })] })), _jsxs("div", { className: "grid grid-cols-[minmax(110px,150px)_1fr_auto] items-center gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate text-[12.5px] font-semibold text-t1", children: s.label }), s.desc && _jsx("div", { className: "truncate text-[10px] text-t3", children: s.desc })] }), _jsx("div", { className: "h-[18px] overflow-hidden rounded-[4px] bg-hov", children: _jsx("div", { className: "h-full rounded-[4px]", style: { width: `${widthPct}%`, background: 'var(--ch-1)', opacity: 0.28 + 0.72 * (i / Math.max(stages.length - 1, 1)) } }) }), _jsx("span", { className: "mono min-w-[86px] text-right text-[12.5px] font-semibold text-t1 tnum", children: fmtInt(s.value, lang) })] })] }, s.id));
        }) }));
}
