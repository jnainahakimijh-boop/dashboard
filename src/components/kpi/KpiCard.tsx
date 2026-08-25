import { Sparkline } from '@/components/charts/Sparkline';
import { DeltaTag, InfoTip } from '@/components/ui/primitives';
import type { Delta } from '@/lib/metrics';
import type { Locale } from '@/lib/format';

export interface KpiCardProps {
  label: string;
  definition: string;
  value: string;
  prevValue?: string;
  delta?: Delta;
  /** short visible label; full text goes into the tooltip via compareLabelFull */
  compareLabel?: string;
  compareLabelFull?: string;
  spark?: (number | null)[];
  lang: Locale;
}

export function KpiCard({ label, definition, value, prevValue, delta, compareLabel, compareLabelFull, spark, lang }: KpiCardProps) {
  return (
    <div className="min-w-0 rounded-[14px] border border-brd bg-card p-[var(--pad-card)]">
      <div className="flex items-start justify-between gap-1">
        <span className="eyebrow flex min-w-0 items-start gap-1">
          <span className="leading-[1.35]" title={label}>
            {label}
          </span>
          <InfoTip text={definition} className="mt-px" />
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="mono text-[24px] font-semibold leading-none tracking-[-0.02em] text-t1 tnum">{value}</span>
        {spark && spark.length > 1 && <Sparkline values={spark} color="var(--text-3)" />}
      </div>
      {delta && (
        <div className="mt-2 flex items-baseline gap-1.5 whitespace-nowrap">
          <DeltaTag delta={delta} lang={lang} label={compareLabelFull ?? compareLabel} />
          {compareLabel && (
            <span className="truncate text-[10.5px] text-t3" title={prevValue ? `${compareLabelFull ?? compareLabel}: ${prevValue}` : (compareLabelFull ?? compareLabel)}>
              {compareLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ children, dense = false }: { children: React.ReactNode; dense?: boolean }) {
  return <div className={`grid gap-[var(--gap-grid)] ${dense ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 lg:grid-cols-4'}`}>{children}</div>;
}
