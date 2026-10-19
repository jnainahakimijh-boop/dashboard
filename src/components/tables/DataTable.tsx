/** Sortable, paginated data table with CSV/XLSX export (server-side, audited, with metadata). */
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import type { Unit } from '@shared/metrics';
import { download } from '@/api/client';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { formatValue } from '@/lib/format';
import { Button, EmptyState, Popover, useToast } from '@/components/ui';

export interface Column<T> {
  key: string;
  header: string;
  /** value used for sorting and export */
  value: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  unit?: Unit | 'text';
  align?: 'left' | 'right';
  width?: string;
  sortable?: boolean;
  hideOnMobile?: boolean;
}

export function DataTable<T>({ rows, columns, exportTitle, exportMeta = [], pageSize = 15, initialSort, caption, onRowClick, rowKey, empty, dense }: { rows: T[]; columns: Column<T>[]; exportTitle?: string; exportMeta?: Array<[string, string]>; pageSize?: number; initialSort?: { key: string; desc: boolean }; caption: string; onRowClick?: (row: T) => void; rowKey?: (row: T) => string; empty?: ReactNode; dense?: boolean }) {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const [sorting, setSorting] = useState<SortingState>(initialSort ? [{ id: initialSort.key, desc: initialSort.desc }] : []);
  const defs = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((c) => ({
        id: c.key,
        accessorFn: (r: T) => c.value(r),
        header: c.header,
        enableSorting: c.sortable !== false,
        sortUndefined: 'last',
        sortingFn: (a, b, id) => {
          const x = a.getValue(id) as string | number | null;
          const y = b.getValue(id) as string | number | null;
          if (x === null && y === null) return 0;
          if (x === null) return -1;
          if (y === null) return 1;
          return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), lang);
        },
        cell: (ctx) => {
          const r = ctx.row.original;
          if (c.render) return c.render(r);
          const v = c.value(r);
          return typeof v === 'number' ? formatValue(v, c.unit === 'text' ? undefined : (c.unit ?? 'count'), lang) : (v ?? '—');
        },
      })),
    [columns, lang],
  );
  const table = useReactTable({ data: rows, columns: defs, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize } } });

  const doExport = async (format: 'csv' | 'xlsx') => {
    try {
      const sorted = table.getSortedRowModel().rows.map((r) => r.original);
      await download('/api/exports/table', { method: 'POST', body: { format, title: exportTitle ?? caption, columns: columns.map((c) => ({ key: c.key, label: c.header, unit: c.unit })), rows: sorted.map((r) => Object.fromEntries(columns.map((c) => [c.key, c.value(r)]))), meta: exportMeta } }, `${exportTitle ?? 'export'}.${format}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'neg');
    }
  };

  const pages = table.getPageCount();
  return (
    <div className="min-w-0">
      {exportTitle && can('analytics.export') && (
        <div className="mb-2 flex justify-end">
          <Popover
            align="right"
            width={200}
            label={t('common.export')}
            trigger={({ toggle, open, id }) => (
              <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} onClick={toggle} aria-expanded={open} aria-controls={id}>
                {t('common.export')}
              </Button>
            )}
          >
            {(close) => (
              <div className="flex flex-col">
                <Button size="sm" variant="ghost" className="justify-start" onClick={() => (close(), doExport('csv'))}>
                  {t('common.exportCsv')}
                </Button>
                <Button size="sm" variant="ghost" className="justify-start" onClick={() => (close(), doExport('xlsx'))}>
                  {t('common.exportXlsx')}
                </Button>
              </div>
            )}
          </Popover>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-brd">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-card2">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const col = columns.find((c) => c.key === h.column.id)!;
                  const sorted = h.column.getIsSorted();
                  const right = col.align === 'right' || (col.unit && col.unit !== 'text');
                  return (
                    <th key={h.id} scope="col" aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'} className={clsx('border-b border-brd px-3 py-2 font-semibold whitespace-nowrap text-t2', right ? 'text-right' : 'text-left', col.hideOnMobile && 'hidden md:table-cell')} style={{ width: col.width }}>
                      {h.column.getCanSort() ? (
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className={clsx('inline-flex items-center gap-1 hover:text-t1', right && 'flex-row-reverse')}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : sorted === 'desc' ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={rowKey ? rowKey(r.original) : r.id} className={clsx('border-b border-brd last:border-0', onRowClick && 'cursor-pointer hover:bg-hov')} onClick={onRowClick ? () => onRowClick(r.original) : undefined} tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r.original) : undefined}>
                {r.getVisibleCells().map((cell) => {
                  const col = columns.find((c) => c.key === cell.column.id)!;
                  const right = col.align === 'right' || (col.unit && col.unit !== 'text');
                  return (
                    <td key={cell.id} className={clsx('px-3 align-middle text-t1', dense ? 'py-1.5' : 'py-2.5', right && 'text-right tnum', col.hideOnMobile && 'hidden md:table-cell')}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (empty ?? <EmptyState />)}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 px-1 pt-2 text-[12.5px] text-t2">
          <span>
            {t('common.page')} {table.getState().pagination.pageIndex + 1} {t('common.of')} {pages} · {t('common.rows', { n: rows.length })}
          </span>
          <span className="flex gap-1">
            <Button size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
              {t('common.previous')}
            </Button>
            <Button size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              {t('common.next')}
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}
