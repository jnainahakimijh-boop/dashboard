import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from '/src/components/ui/primitives.js';
import { useI18n } from '/src/i18n/index.js';
export function DataTable({ columns, rows, rowKey, defaultSort, searchable = false, pageSize = 0, onRowClick, ariaLabel, toolbar, maxHeight }) {
    const { t } = useI18n();
    const [sort, setSort] = useState(defaultSort ?? null);
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const filtered = useMemo(() => {
        if (!query.trim())
            return rows;
        const q = query.trim().toLowerCase();
        return rows.filter((r) => columns.some((c) => c.searchText?.(r).toLowerCase().includes(q)));
    }, [rows, query, columns]);
    const sorted = useMemo(() => {
        if (!sort)
            return filtered;
        const col = columns.find((c) => c.id === sort.id);
        if (!col?.sortValue)
            return filtered;
        const dir = sort.dir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            const va = col.sortValue(a);
            const vb = col.sortValue(b);
            if (va === null && vb === null)
                return 0;
            if (va === null)
                return 1;
            if (vb === null)
                return -1;
            if (typeof va === 'number' && typeof vb === 'number')
                return (va - vb) * dir;
            return String(va).localeCompare(String(vb)) * dir;
        });
    }, [filtered, sort, columns]);
    const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
    const safePage = Math.min(page, pageCount - 1);
    const visible = pageSize > 0 ? sorted.slice(safePage * pageSize, (safePage + 1) * pageSize) : sorted;
    const toggleSort = (id) => {
        setPage(0);
        setSort((prev) => (prev?.id === id ? { id, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { id, dir: 'desc' }));
    };
    return (_jsxs("div", { className: "min-w-0", children: [(searchable || toolbar) && (_jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-2", children: [searchable && (_jsxs("label", { className: "relative flex items-center", children: [_jsx(Search, { size: 13, className: "pointer-events-none absolute left-2.5 text-t3", "aria-hidden": true }), _jsx("input", { type: "search", value: query, onChange: (e) => {
                                    setQuery(e.target.value);
                                    setPage(0);
                                }, placeholder: t('tbl.searchPlaceholder'), "aria-label": t('tbl.searchPlaceholder'), className: "h-8 w-48 rounded-[6px] border border-brd bg-inset pl-8 pr-2.5 text-[12px] text-t1 placeholder:text-t3 focus:border-brds" })] })), toolbar, _jsx("span", { className: "mono ml-auto text-[11px] tracking-[0.08em] text-t3", children: t('tbl.rows', { n: sorted.length }) })] })), _jsxs("div", { className: "overflow-x-auto overscroll-x-contain rounded-[6px] border border-brd", style: maxHeight ? { maxHeight, overflowY: 'auto' } : undefined, children: [_jsxs("table", { className: "w-full border-collapse text-[12px]", "aria-label": ariaLabel, children: [_jsx("thead", { className: "sticky top-0 z-10", children: _jsx("tr", { className: "bg-card2", children: columns.map((c) => {
                                        const sortable = Boolean(c.sortValue);
                                        const active = sort?.id === c.id;
                                        return (_jsx("th", { scope: "col", title: c.headerTitle, style: c.width ? { width: c.width } : undefined, "aria-sort": active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined, className: clsx('border-b border-brd px-3 py-2 align-middle', c.align === 'right' ? 'text-right' : 'text-left'), children: sortable ? (_jsxs("button", { type: "button", onClick: () => toggleSort(c.id), className: clsx('mono inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.1em] hover:text-t1', active ? 'text-t1' : 'text-t3', c.align === 'right' && 'flex-row-reverse'), children: [c.header, active && (sort.dir === 'asc' ? _jsx(ArrowUp, { size: 10, "aria-hidden": true }) : _jsx(ArrowDown, { size: 10, "aria-hidden": true }))] })) : (_jsx("span", { className: "mono text-[10.5px] uppercase tracking-[0.1em] text-t3", children: c.header })) }, c.id));
                                    }) }) }), _jsx("tbody", { children: visible.map((r) => (_jsx("tr", { onClick: onRowClick ? () => onRowClick(r) : undefined, onKeyDown: onRowClick
                                        ? (e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onRowClick(r);
                                            }
                                        }
                                        : undefined, tabIndex: onRowClick ? 0 : undefined, className: clsx('border-b border-brd last:border-b-0', onRowClick && 'cursor-pointer transition-colors hover:bg-hov focus-visible:bg-hov'), children: columns.map((c) => (_jsx("td", { className: clsx('px-3 py-2 align-middle', c.align === 'right' ? 'text-right' : 'text-left'), children: c.cell(r) }, c.id))) }, rowKey(r)))) })] }), visible.length === 0 && _jsx(EmptyState, { title: t('state.empty.title'), body: t('tbl.noResults') })] }), pageSize > 0 && pageCount > 1 && (_jsxs("div", { className: "mt-2.5 flex items-center justify-end gap-2", children: [_jsx("span", { className: "mono text-[11px] tracking-[0.08em] text-t3", children: t('tbl.page', { a: safePage + 1, b: pageCount }) }), _jsx("button", { type: "button", "aria-label": t('tbl.prev'), disabled: safePage === 0, onClick: () => setPage((p) => Math.max(0, p - 1)), className: "rounded-[4px] border border-brd p-1 text-t2 hover:bg-hov disabled:opacity-35", children: _jsx(ChevronLeft, { size: 13, "aria-hidden": true }) }), _jsx("button", { type: "button", "aria-label": t('tbl.next'), disabled: safePage >= pageCount - 1, onClick: () => setPage((p) => Math.min(pageCount - 1, p + 1)), className: "rounded-[4px] border border-brd p-1 text-t2 hover:bg-hov disabled:opacity-35", children: _jsx(ChevronRight, { size: 13, "aria-hidden": true }) })] }))] }));
}
/** Right-aligned numeric cell with tabular numerals */
export function Num({ children, strong = false, muted = false }) {
    return _jsx("span", { className: clsx('mono whitespace-nowrap text-[11.5px] tnum', strong ? 'font-semibold text-t1' : muted ? 'text-t3' : 'text-t2'), children: children });
}
