import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MiniBar } from '/src/components/ui/primitives.js';
import { fmtPct } from '/src/lib/format.js';
/** Horizontal ranked bars — the honest choice for ranking comparisons.
 *  Bars are proportional to the max value; exact values sit beside them. */
export function RankedList({ rows, lang, ariaLabel, showShare = true }) {
    const max = Math.max(...rows.map((r) => r.value), 1);
    return (_jsx("ol", { className: "m-0 flex list-none flex-col gap-2.5 p-0", "aria-label": ariaLabel, children: rows.map((r, i) => (_jsxs("li", { className: "grid grid-cols-[16px_minmax(96px,190px)_1fr_auto] items-center gap-2.5", children: [_jsx("span", { className: "mono text-[10px] text-t3 tnum", children: String(i + 1).padStart(2, '0') }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate text-[12px] font-medium text-t1", title: r.label, children: r.label }), r.sub && _jsx("div", { className: "truncate text-[10.5px] text-t3", children: r.sub })] }), _jsx(MiniBar, { pct: (r.value / max) * 100, color: r.color }), _jsxs("div", { className: "flex items-center gap-2 justify-self-end", children: [_jsx("span", { className: "mono w-14 text-right text-[11.5px] text-t1 tnum", children: r.valueLabel }), showShare && (_jsx("span", { className: "mono w-11 text-right text-[10.5px] text-t3 tnum", children: r.share === null || r.share === undefined ? '' : fmtPct(r.share, lang, 1) })), r.right] })] }, r.id))) }));
}
