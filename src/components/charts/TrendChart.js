import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useChartTheme } from '/src/components/charts/useChartTheme.js';
import { fmtAxis, fmtDayFull, fmtPpDelta, fmtRelDelta } from '/src/lib/format.js';
import { useI18n } from '/src/i18n/index.js';
export function TrendChart({ points, format, metricLabel, deltaKind, showCompare, lang, height = 280, isRate = false, description }) {
    const theme = useChartTheme();
    const { t } = useI18n();
    const data = useMemo(() => points.map((p, i) => ({ ...p, i })), [points]);
    const tickIndices = useMemo(() => {
        const n = data.length;
        const step = Math.max(1, Math.ceil(n / 8));
        const ticks = [];
        for (let i = 0; i < n; i += step)
            ticks.push(i);
        // Always label the final day, but drop the previous tick when it would
        // collide with it — two overlapping dates are worse than one fewer tick.
        const last = ticks[ticks.length - 1];
        if (last !== n - 1) {
            if (n - 1 - last < step * 0.6)
                ticks.pop();
            ticks.push(n - 1);
        }
        return ticks;
    }, [data]);
    return (_jsxs("figure", { className: "m-0", role: "img", "aria-label": description, children: [_jsx("div", { style: { height }, className: "w-full", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(ComposedChart, { data: data, margin: { top: 6, right: 18, bottom: 0, left: 0 }, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "trendFill", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: theme.series[0], stopOpacity: 0.16 }), _jsx("stop", { offset: "100%", stopColor: theme.series[0], stopOpacity: 0.01 })] }) }), _jsx(CartesianGrid, { stroke: theme.grid, vertical: false }), _jsx(XAxis, { dataKey: "i", ticks: tickIndices, tickFormatter: (i) => (data[i] ? fmtDayFull(data[i].d, lang).replace(/ \d{4}$/, '') : ''), tickLine: false, axisLine: { stroke: theme.grid }, interval: 0, tick: { fill: theme.axis } }), _jsx(YAxis, { width: 44, tickLine: false, axisLine: false, domain: isRate ? [0, (max) => Math.ceil(max * 1.15 * 10) / 10] : [0, 'auto'], tickFormatter: (v) => (isRate ? `${v}%` : fmtAxis(v, lang)), tick: { fill: theme.axis } }), _jsx(Tooltip, { cursor: { stroke: theme.axis, strokeDasharray: '3 3' }, isAnimationActive: false, content: ({ active, payload }) => {
                                    if (!active || !payload?.length)
                                        return null;
                                    const row = payload[0].payload;
                                    const delta = row.value !== null && row.prev !== null && row.prev !== 0
                                        ? deltaKind === 'pp'
                                            ? fmtPpDelta(row.value - row.prev, lang)
                                            : fmtRelDelta(((row.value - row.prev) / row.prev) * 100, lang)
                                        : null;
                                    return (_jsxs("div", { className: "rounded-[6px] border border-brds bg-card2 p-3 shadow-[var(--shadow-pop)]", children: [_jsx("div", { className: "mono mb-1.5 text-[10px] tracking-[0.08em] text-t3", children: fmtDayFull(row.d, lang) }), _jsxs("div", { className: "flex items-baseline justify-between gap-6", children: [_jsx("span", { className: "text-[11.5px] text-t2", children: metricLabel }), _jsx("span", { className: "mono text-[13px] font-semibold text-t1 tnum", children: format(row.value) })] }), showCompare && row.prevD !== null && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mt-1 flex items-baseline justify-between gap-6", children: [_jsxs("span", { className: "text-[11.5px] text-t3", children: [t('compare.prevShort'), " \u00B7 ", fmtDayFull(row.prevD, lang)] }), _jsx("span", { className: "mono text-[12px] text-t2 tnum", children: format(row.prev) })] }), delta && (_jsx("div", { className: "mt-1.5 border-t border-brd pt-1.5 text-right", children: _jsx("span", { className: "mono text-[11px] text-t2 tnum", children: delta }) }))] }))] }));
                                } }), showCompare && (_jsx(Line, { type: "monotone", dataKey: "prev", stroke: theme.compare, strokeWidth: 1.3, strokeDasharray: "5 4", dot: false, isAnimationActive: theme.animate, animationDuration: 350, connectNulls: false })), _jsx(Area, { type: "monotone", dataKey: "value", stroke: theme.series[0], strokeWidth: 1.7, fill: "url(#trendFill)", dot: false, activeDot: { r: 3, stroke: theme.series[0], fill: theme.series[0] }, isAnimationActive: theme.animate, animationDuration: 350, connectNulls: false })] }) }) }), _jsx("figcaption", { className: "sr-only", children: description })] }));
}
