import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function HeatmapGrid({ rows, cols, cells, format, ariaLabel }) {
    const values = cells.map(c => c.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.0001, max - min);
    const lookup = new Map(cells.map(c => [`${c.row}|${c.col}`, c]));
    return _jsx("div", { className: "overflow-x-auto", role: "region", "aria-label": ariaLabel, tabIndex: 0, children: _jsxs("div", { className: "grid min-w-[640px] gap-1.5", style: { gridTemplateColumns: `110px repeat(${cols.length},minmax(62px,1fr))` }, children: [_jsx("div", {}), cols.map(c => _jsx("div", { className: "text-center text-[10.5px] font-semibold text-t3", children: c }, c)), rows.flatMap(row => [
                    _jsx("div", { className: "flex items-center text-[11px] font-medium text-t2", children: row }, `${row}-label`),
                    ...cols.map(col => { const cell = lookup.get(`${row}|${col}`); const v = cell?.value ?? 0; const intensity = (v - min) / span; return _jsx("div", { title: `${row} · ${col}: ${format(v)}`, "aria-label": `${row}, ${col}, ${format(v)}`, className: "flex min-h-11 items-center justify-center rounded-[4px] border border-brd text-[10.5px] font-semibold tnum", style: { background: `color-mix(in srgb, var(--accent) ${Math.round(8 + intensity * 42)}%, var(--card))`, color: intensity > .58 ? 'var(--text-1)' : 'var(--text-2)' }, children: format(v) }, `${row}-${col}`); })
                ])] }) });
}
