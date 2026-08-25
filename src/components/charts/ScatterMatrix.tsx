import { useMemo } from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell } from 'recharts';
import { useChartTheme } from './useChartTheme';
import { fmtCompact, fmtInt, fmtPct, type Locale } from '@/lib/format';

export interface MatrixPoint {
  id: string;
  label: string;
  sub?: string;
  x: number; // impressions
  y: number; // engagement rate %
  z: number; // conversions (bubble size)
}

export type Quadrant = 'amplify' | 'optimise' | 'distribute' | 'reconsider';

export interface QuadrantCopy {
  label: string;
  desc: string;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function classifyQuadrant(p: { x: number; y: number }, mx: number, my: number): Quadrant {
  if (p.x >= mx && p.y >= my) return 'amplify';
  if (p.x >= mx) return 'optimise';
  if (p.y >= my) return 'distribute';
  return 'reconsider';
}

/** Reach × engagement performance matrix with median-split quadrants.
 *  Medians are computed from the plotted points, not invented. */
export function ScatterMatrix({ points, lang, copy, xLabel, yLabel, zLabel, ariaLabel, height = 320 }: { points: MatrixPoint[]; lang: Locale; copy: Record<Quadrant, QuadrantCopy>; xLabel: string; yLabel: string; zLabel: string; ariaLabel: string; height?: number }) {
  const theme = useChartTheme();
  const mx = useMemo(() => median(points.map((p) => p.x)), [points]);
  const my = useMemo(() => median(points.map((p) => p.y)), [points]);

  const quadColor: Record<Quadrant, string> = {
    amplify: theme.pos,
    optimise: theme.series[4],
    distribute: theme.series[1],
    reconsider: theme.axis,
  };

  return (
    <figure className="m-0" role="img" aria-label={ariaLabel}>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 14, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={theme.grid} />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tickFormatter={(v: number) => fmtCompact(v, lang)}
              tick={{ fill: theme.axis }}
              tickLine={false}
              axisLine={{ stroke: theme.grid }}
              domain={[0, 'auto']}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              width={40}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: theme.axis }}
              tickLine={false}
              axisLine={false}
              domain={[0, (max: number) => Math.ceil(max * 1.1)]}
            />
            <ZAxis type="number" dataKey="z" range={[36, 420]} name={zLabel} />
            <ReferenceLine x={mx} stroke={theme.axis} strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={my} stroke={theme.axis} strokeDasharray="4 4" strokeOpacity={0.5} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ strokeDasharray: '3 3', stroke: theme.axis }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as MatrixPoint;
                const q = classifyQuadrant(p, mx, my);
                return (
                  <div className="max-w-64 rounded-[10px] border border-brds bg-card2 p-3 shadow-[var(--shadow-pop)]">
                    <div className="mb-1 text-[12px] font-semibold leading-snug text-t1">{p.label}</div>
                    {p.sub && <div className="mono mb-1.5 text-[9.5px] tracking-[0.06em] text-t3">{p.sub}</div>}
                    <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[11px]">
                      <dt className="text-t3">{xLabel}</dt>
                      <dd className="mono m-0 text-right text-t1 tnum">{fmtInt(p.x, lang)}</dd>
                      <dt className="text-t3">{yLabel}</dt>
                      <dd className="mono m-0 text-right text-t1 tnum">{fmtPct(p.y, lang)}</dd>
                      <dt className="text-t3">{zLabel}</dt>
                      <dd className="mono m-0 text-right text-t1 tnum">{fmtInt(p.z, lang)}</dd>
                    </dl>
                    <div className="mt-1.5 border-t border-brd pt-1.5 text-[10.5px]" style={{ color: quadColor[q] }}>
                      {copy[q].label} — {copy[q].desc}
                    </div>
                  </div>
                );
              }}
            />
            <Scatter data={points} isAnimationActive={theme.animate} animationDuration={350} fillOpacity={0.75}>
              {points.map((p) => (
                <Cell key={p.id} fill={quadColor[classifyQuadrant(p, mx, my)]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {(Object.keys(copy) as Quadrant[]).map((q) => (
          <div key={q} className="flex items-start gap-1.5">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: quadColor[q] }} aria-hidden />
            <div>
              <div className="text-[11px] font-medium text-t1">{copy[q].label}</div>
              <div className="text-[10px] leading-snug text-t3">{copy[q].desc}</div>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">{ariaLabel}</figcaption>
    </figure>
  );
}
