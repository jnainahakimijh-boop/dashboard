import { useMemo } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useChartTheme } from './useChartTheme';
import { fmtAxis, fmtDayFull, fmtPpDelta, fmtRelDelta, type Locale } from '@/lib/format';
import { useI18n } from '@/i18n';

export interface TrendPoint {
  d: number;
  value: number | null;
  prev: number | null;
  prevD: number | null;
}

interface Props {
  points: TrendPoint[];
  format: (v: number | null) => string;
  metricLabel: string;
  /** 'rel' for counts (Δ%), 'pp' for rates (Δ in points) */
  deltaKind: 'rel' | 'pp';
  showCompare: boolean;
  lang: Locale;
  height?: number;
  /** rates get a little headroom; counts keep a zero baseline */
  isRate?: boolean;
  description: string;
}

interface RowDatum extends TrendPoint {
  i: number;
}

export function TrendChart({ points, format, metricLabel, deltaKind, showCompare, lang, height = 280, isRate = false, description }: Props) {
  const theme = useChartTheme();
  const { t } = useI18n();

  const data: RowDatum[] = useMemo(() => points.map((p, i) => ({ ...p, i })), [points]);
  const tickIndices = useMemo(() => {
    const n = data.length;
    const step = Math.max(1, Math.ceil(n / 8));
    const ticks: number[] = [];
    for (let i = 0; i < n; i += step) ticks.push(i);
    if (ticks[ticks.length - 1] !== n - 1) ticks.push(n - 1);
    return ticks;
  }, [data]);

  return (
    <figure className="m-0" role="img" aria-label={description}>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 18, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.series[0]} stopOpacity={0.16} />
                <stop offset="100%" stopColor={theme.series[0]} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="i"
              ticks={tickIndices}
              tickFormatter={(i: number) => (data[i] ? fmtDayFull(data[i].d, lang).replace(/ \d{4}$/, '') : '')}
              tickLine={false}
              axisLine={{ stroke: theme.grid }}
              interval={0}
              tick={{ fill: theme.axis }}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              domain={isRate ? [0, (max: number) => Math.ceil(max * 1.15 * 10) / 10] : [0, 'auto']}
              tickFormatter={(v: number) => (isRate ? `${v}%` : fmtAxis(v, lang))}
              tick={{ fill: theme.axis }}
            />
            <Tooltip
              cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as RowDatum;
                const delta =
                  row.value !== null && row.prev !== null && row.prev !== 0
                    ? deltaKind === 'pp'
                      ? fmtPpDelta(row.value - row.prev, lang)
                      : fmtRelDelta(((row.value - row.prev) / row.prev) * 100, lang)
                    : null;
                return (
                  <div className="rounded-[10px] border border-brds bg-card2 p-3 shadow-[var(--shadow-pop)]">
                    <div className="mono mb-1.5 text-[10px] tracking-[0.08em] text-t3">{fmtDayFull(row.d, lang)}</div>
                    <div className="flex items-baseline justify-between gap-6">
                      <span className="text-[11.5px] text-t2">{metricLabel}</span>
                      <span className="mono text-[13px] font-semibold text-t1 tnum">{format(row.value)}</span>
                    </div>
                    {showCompare && row.prevD !== null && (
                      <>
                        <div className="mt-1 flex items-baseline justify-between gap-6">
                          <span className="text-[11.5px] text-t3">{t('compare.prevShort')} · {fmtDayFull(row.prevD, lang)}</span>
                          <span className="mono text-[12px] text-t2 tnum">{format(row.prev)}</span>
                        </div>
                        {delta && (
                          <div className="mt-1.5 border-t border-brd pt-1.5 text-right">
                            <span className="mono text-[11px] text-t2 tnum">{delta}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              }}
            />
            {showCompare && (
              <Line
                type="monotone"
                dataKey="prev"
                stroke={theme.compare}
                strokeWidth={1.3}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={theme.animate}
                animationDuration={350}
                connectNulls={false}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={theme.series[0]}
              strokeWidth={1.7}
              fill="url(#trendFill)"
              dot={false}
              activeDot={{ r: 3, stroke: theme.series[0], fill: theme.series[0] }}
              isAnimationActive={theme.animate}
              animationDuration={350}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  );
}
