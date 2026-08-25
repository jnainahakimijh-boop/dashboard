import type { ReactNode } from 'react';
import { MiniBar } from '@/components/ui/primitives';
import { fmtPct, type Locale } from '@/lib/format';

export interface RankedRow {
  id: string;
  label: string;
  sub?: string;
  value: number;
  valueLabel: string;
  /** share of total, in % (already computed from real sums) */
  share?: number | null;
  right?: ReactNode;
  color?: string;
}

/** Horizontal ranked bars — the honest choice for ranking comparisons.
 *  Bars are proportional to the max value; exact values sit beside them. */
export function RankedList({ rows, lang, ariaLabel, showShare = true }: { rows: RankedRow[]; lang: Locale; ariaLabel: string; showShare?: boolean }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label={ariaLabel}>
      {rows.map((r, i) => (
        <li key={r.id} className="grid grid-cols-[16px_minmax(72px,120px)_1fr_auto] items-center gap-2.5">
          <span className="mono text-[10px] text-t3 tnum">{String(i + 1).padStart(2, '0')}</span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-t1" title={r.label}>
              {r.label}
            </div>
            {r.sub && <div className="truncate text-[10.5px] text-t3">{r.sub}</div>}
          </div>
          <MiniBar pct={(r.value / max) * 100} color={r.color} />
          <div className="flex items-center gap-2 justify-self-end">
            <span className="mono w-14 text-right text-[11.5px] text-t1 tnum">{r.valueLabel}</span>
            {showShare && (
              <span className="mono w-11 text-right text-[10.5px] text-t3 tnum">{r.share === null || r.share === undefined ? '' : fmtPct(r.share, lang, 1)}</span>
            )}
            {r.right}
          </div>
        </li>
      ))}
    </ol>
  );
}
