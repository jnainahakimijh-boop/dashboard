import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useChartTheme } from './useChartTheme';
import { fmtAxis, fmtInt, type Locale } from '@/lib/format';

export interface StackSeries {
  key: string;
  label: string;
}

/** Vertical stacked bars (absolute counts, zero baseline). */
export function StackedBars({ data, series, lang, ariaLabel, height = 260 }: { data: Array<Record<string, number | string>>; series: StackSeries[]; lang: Locale; ariaLabel: string; height?: number }) {
  const theme = useChartTheme();
  return (
    <figure className="m-0" role="img" aria-label={ariaLabel}>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: theme.grid }} tick={{ fill: theme.axis }} />
            <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtAxis(v, lang)} tick={{ fill: theme.axis }} domain={[0, 'auto']} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ fill: 'transparent' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const total = payload.reduce((s, p) => s + (typeof p.value === 'number' ? p.value : 0), 0);
                return (
                  <div className="rounded-[11px] border border-brd bg-card p-3.5 shadow-[var(--shadow-pop)]">
                    <div className="mono mb-2 text-[11px] tracking-[0.06em] text-t3">{label}</div>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-6 py-px">
                        <span className="flex items-center gap-1.5 text-[12.5px] text-t2">
                          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} aria-hidden />
                          {p.name}
                        </span>
                        <span className="mono text-[12.5px] text-t1 tnum">{fmtInt(typeof p.value === 'number' ? p.value : null, lang)}</span>
                      </div>
                    ))}
                    <div className="mt-1.5 flex items-center justify-between gap-6 border-t border-brd pt-1.5">
                      <span className="text-[12px] text-t3">Total</span>
                      <span className="mono text-[12.5px] font-semibold text-t1 tnum">{fmtInt(total, lang)}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: 12.5, color: 'var(--text-2)' }}
              formatter={(value: string) => <span style={{ color: 'var(--text-2)' }}>{value}</span>}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="stack"
                fill={theme.series[(i + 1) % theme.series.length]}
                isAnimationActive={theme.animate}
                animationDuration={350}
                radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{ariaLabel}</figcaption>
    </figure>
  );
}
