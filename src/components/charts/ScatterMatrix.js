import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell } from 'recharts';
import { useChartTheme } from '/src/components/charts/useChartTheme.js';
import { fmtCompact, fmtInt, fmtPct } from '/src/lib/format.js';
function median(values) {
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
export function classifyQuadrant(p, mx, my) {
    if (p.x >= mx && p.y >= my)
        return 'amplify';
    if (p.x >= mx)
        return 'optimise';
    if (p.y >= my)
        return 'distribute';
    return 'reconsider';
}
/** Reach × engagement performance matrix with median-split quadrants.
 *  Medians are computed from the plotted points, not invented. */
export function ScatterMatrix({ points, lang, copy, xLabel, yLabel, zLabel, ariaLabel, height = 320 }) {
    const theme = useChartTheme();
    const mx = useMemo(() => median(points.map((p) => p.x)), [points]);
    const my = useMemo(() => median(points.map((p) => p.y)), [points]);
    const quadColor = {
        amplify: theme.pos,
        optimise: theme.series[4],
        distribute: theme.series[1],
        reconsider: theme.axis,
    };
    return (_jsxs("figure", { className: "m-0", role: "img", "aria-label": ariaLabel, children: [_jsx("div", { style: { height }, className: "w-full", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(ScatterChart, { margin: { top: 10, right: 14, bottom: 4, left: 0 }, children: [_jsx(CartesianGrid, { stroke: theme.grid }), _jsx(XAxis, { type: "number", dataKey: "x", name: xLabel, tickFormatter: (v) => fmtCompact(v, lang), tick: { fill: theme.axis }, tickLine: false, axisLine: { stroke: theme.grid }, domain: [0, 'auto'] }), _jsx(YAxis, { type: "number", dataKey: "y", name: yLabel, width: 40, tickFormatter: (v) => `${v}%`, tick: { fill: theme.axis }, tickLine: false, axisLine: false, domain: [0, (max) => Math.ceil(max * 1.1)] }), _jsx(ZAxis, { type: "number", dataKey: "z", range: [36, 420], name: zLabel }), _jsx(ReferenceLine, { x: mx, stroke: theme.axis, strokeDasharray: "4 4", strokeOpacity: 0.5 }), _jsx(ReferenceLine, { y: my, stroke: theme.axis, strokeDasharray: "4 4", strokeOpacity: 0.5 }), _jsx(Tooltip, { isAnimationActive: false, cursor: { strokeDasharray: '3 3', stroke: theme.axis }, content: ({ active, payload }) => {
                                    if (!active || !payload?.length)
                                        return null;
                                    const p = payload[0].payload;
                                    const q = classifyQuadrant(p, mx, my);
                                    return (_jsxs("div", { className: "max-w-64 rounded-[6px] border border-brds bg-card2 p-3 shadow-[var(--shadow-pop)]", children: [_jsx("div", { className: "mb-1 text-[12px] font-semibold leading-snug text-t1", children: p.label }), p.sub && _jsx("div", { className: "mono mb-1.5 text-[9.5px] tracking-[0.06em] text-t3", children: p.sub }), _jsxs("dl", { className: "m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[11px]", children: [_jsx("dt", { className: "text-t3", children: xLabel }), _jsx("dd", { className: "mono m-0 text-right text-t1 tnum", children: fmtInt(p.x, lang) }), _jsx("dt", { className: "text-t3", children: yLabel }), _jsx("dd", { className: "mono m-0 text-right text-t1 tnum", children: fmtPct(p.y, lang) }), _jsx("dt", { className: "text-t3", children: zLabel }), _jsx("dd", { className: "mono m-0 text-right text-t1 tnum", children: fmtInt(p.z, lang) })] }), _jsxs("div", { className: "mt-1.5 border-t border-brd pt-1.5 text-[10.5px]", style: { color: quadColor[q] }, children: [copy[q].label, " \u2014 ", copy[q].desc] })] }));
                                } }), _jsx(Scatter, { data: points, isAnimationActive: theme.animate, animationDuration: 350, fillOpacity: 0.75, children: points.map((p) => (_jsx(Cell, { fill: quadColor[classifyQuadrant(p, mx, my)] }, p.id))) })] }) }) }), _jsx("div", { className: "mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4", children: Object.keys(copy).map((q) => (_jsxs("div", { className: "flex items-start gap-1.5", children: [_jsx("span", { className: "mt-1 h-2 w-2 shrink-0 rounded-full", style: { background: quadColor[q] }, "aria-hidden": true }), _jsxs("div", { children: [_jsx("div", { className: "text-[11px] font-medium text-t1", children: copy[q].label }), _jsx("div", { className: "text-[10px] leading-snug text-t3", children: copy[q].desc })] })] }, q))) }), _jsx("figcaption", { className: "sr-only", children: ariaLabel })] }));
}
