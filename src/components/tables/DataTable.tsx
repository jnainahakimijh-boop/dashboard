import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { useI18n } from '@/i18n';

export interface Column<T> {
  id: string;
  header: string;
  /** raw value used for sorting; strings sort alphabetically, numbers numerically, null last */
  sortValue?: (row: T) => string | number | null;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** included in text search */
  searchText?: (row: T) => string;
  width?: string;
  headerTitle?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  defaultSort?: { id: string; dir: 'asc' | 'desc' };
  searchable?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  ariaLabel: string;
  toolbar?: ReactNode;
  maxHeight?: number;
}

export function DataTable<T>({ columns, rows, rowKey, defaultSort, searchable = false, pageSize = 0, onRowClick, ariaLabel, toolbar, maxHeight }: Props<T>) {
  const { t } = useI18n();
  const [sort, setSort] = useState(defaultSort ?? null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => columns.some((c) => c.searchText?.(r).toLowerCase().includes(q)));
  }, [rows, query, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtered, sort, columns]);

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = pageSize > 0 ? sorted.slice(safePage * pageSize, (safePage + 1) * pageSize) : sorted;

  const toggleSort = (id: string) => {
    setPage(0);
    setSort((prev) => (prev?.id === id ? { id, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { id, dir: 'desc' }));
  };

  return (
    <div className="min-w-0">
      {(searchable || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {searchable && (
            <label className="relative flex items-center">
              <Search size={13} className="pointer-events-none absolute left-2.5 text-t3" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={t('tbl.searchPlaceholder')}
                aria-label={t('tbl.searchPlaceholder')}
                className="h-8 w-48 rounded-[9px] border border-brd bg-inset pl-8 pr-2.5 text-[12px] text-t1 placeholder:text-t3 focus:border-brds"
              />
            </label>
          )}
          {toolbar}
          <span className="mono ml-auto text-[10px] tracking-[0.08em] text-t3">{t('tbl.rows', { n: sorted.length })}</span>
        </div>
      )}
      <div className="overflow-x-auto overscroll-x-contain rounded-[10px] border border-brd" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        <table className="w-full border-collapse text-[12px]" aria-label={ariaLabel}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-card2">
              {columns.map((c) => {
                const sortable = Boolean(c.sortValue);
                const active = sort?.id === c.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    title={c.headerTitle}
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={clsx('border-b border-brd px-3 py-2 align-middle', c.align === 'right' ? 'text-right' : 'text-left')}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.id)}
                        className={clsx(
                          'mono inline-flex items-center gap-1 text-[9.5px] uppercase tracking-[0.1em] hover:text-t1',
                          active ? 'text-t1' : 'text-t3',
                          c.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {c.header}
                        {active && (sort!.dir === 'asc' ? <ArrowUp size={10} aria-hidden /> : <ArrowDown size={10} aria-hidden />)}
                      </button>
                    ) : (
                      <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-t3">{c.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(r);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={clsx('border-b border-brd last:border-b-0', onRowClick && 'cursor-pointer transition-colors hover:bg-hov focus-visible:bg-hov')}
              >
                {columns.map((c) => (
                  <td key={c.id} className={clsx('px-3 py-2 align-middle', c.align === 'right' ? 'text-right' : 'text-left')}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <EmptyState title={t('state.empty.title')} body={t('tbl.noResults')} />}
      </div>
      {pageSize > 0 && pageCount > 1 && (
        <div className="mt-2.5 flex items-center justify-end gap-2">
          <span className="mono text-[10px] tracking-[0.08em] text-t3">{t('tbl.page', { a: safePage + 1, b: pageCount })}</span>
          <button
            type="button"
            aria-label={t('tbl.prev')}
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-[7px] border border-brd p-1 text-t2 hover:bg-hov disabled:opacity-35"
          >
            <ChevronLeft size={13} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t('tbl.next')}
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="rounded-[7px] border border-brd p-1 text-t2 hover:bg-hov disabled:opacity-35"
          >
            <ChevronRight size={13} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/** Right-aligned numeric cell with tabular numerals */
export function Num({ children, strong = false, muted = false }: { children: ReactNode; strong?: boolean; muted?: boolean }) {
  return <span className={clsx('mono whitespace-nowrap text-[11.5px] tnum', strong ? 'font-semibold text-t1' : muted ? 'text-t3' : 'text-t2')}>{children}</span>;
}
