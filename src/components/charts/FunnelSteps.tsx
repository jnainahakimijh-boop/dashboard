import { Fragment } from 'react';
import { ArrowRight } from 'lucide-react';
import { fmtInt, fmtPct, type Locale } from '@/lib/format';
import { ratio } from '@/lib/metrics';

export interface FunnelStageView {
  id: string;
  label: string;
  desc?: string;
  value: number;
}

/** Sequential funnel with per-step conversion. Stage widths are proportional
 *  to real values; each inter-stage rate is next ÷ previous × 100. */
export function FunnelSteps({ stages, lang, ariaLabel }: { stages: FunnelStageView[]; lang: Locale; ariaLabel: string }) {
  const first = stages[0]?.value ?? 0;
  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-1">
      {stages.map((s, i) => {
        const widthPct = first > 0 ? Math.max((s.value / first) * 100, 0.5) : 0;
        const stepRate = i > 0 ? ratio(s.value, stages[i - 1].value) : null;
        return (
          <Fragment key={s.id}>
            {i > 0 && (
              <div className="flex items-center gap-1.5 py-0.5 pl-1">
                <ArrowRight size={11} className="text-t3" aria-hidden />
                <span className="mono text-[10.5px] text-t2 tnum">{stepRate === null ? '—' : fmtPct(stepRate * 100, lang)}</span>
                <span className="mono text-[9.5px] text-t3">
                  {stages[i - 1].label} → {s.label}
                </span>
              </div>
            )}
            <div className="grid grid-cols-[minmax(110px,150px)_1fr_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium text-t1">{s.label}</div>
                {s.desc && <div className="truncate text-[10px] text-t3">{s.desc}</div>}
              </div>
              <div className="h-[18px] overflow-hidden rounded-[4px] bg-hov">
                <div
                  className="h-full rounded-[4px]"
                  style={{ width: `${widthPct}%`, background: 'var(--ch-1)', opacity: 0.28 + 0.72 * (i / Math.max(stages.length - 1, 1)) }}
                />
              </div>
              <span className="mono w-16 text-right text-[12px] font-medium text-t1 tnum">{fmtInt(s.value, lang)}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
