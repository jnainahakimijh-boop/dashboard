/** ------------------------------------------------------------------
 *  Charts. Rules (see docs/ARCHITECTURE.md → Data visualisation):
 *  one y-axis per chart (mixed units → panels or index 100), fixed
 *  categorical slot order, comparison drawn dashed, missing data as
 *  gaps, legend for ≥ 2 series, tooltips on hover/focus, and a table
 *  alternative for every chart.
 *  ------------------------------------------------------------------ */
import clsx from 'clsx';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Unit } from '@shared/metrics';
import { useI18n } from '@/i18n';
import { formatDelta, formatPct, formatValue } from '@/lib/format';

export const SLOT = (i: number) => `var(--ch-${(i % 8) + 1})`;

export interface SeriesPoint {
  key: string;
  label: string;
  value: number | null;
  compare?: number | null;
  partial?: boolean;
}

export interface Series {
  id: string;
  label: string;
  slot: number;
  unit: Unit;
  points: SeriesPoint[];
}

/* ---------------- PNG export ---------------- */

export async function exportChartPng(container: HTMLElement | null, filename: string): Promise<void> {
  const svg = container?.querySelector('svg.recharts-surface, svg[data-chart]') as SVGSVGElement | null;
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rootStyle = getComputedStyle(document.documentElement);
  const resolve = (v: string) => v.replace(/var\((--[a-z0-9-]+)\)/gi, (_, name: string) => rootStyle.getPropertyValue(name).trim() || '#888');
  clone.querySelectorAll('*').forEach((el) => {
    for (const attr of ['stroke', 'fill', 'stop-color']) {
      const v = el.getAttribute(attr);
      if (v?.includes('var(')) el.setAttribute(attr, resolve(v));
    }
    const st = el.getAttribute('style');
    if (st?.includes('var(')) el.setAttribute('style', resolve(st));
  });
  const { width, height } = svg.getBoundingClientRect();
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const bg = rootStyle.getPropertyValue('--bg-card').trim() || '#ffffff';
  const data = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('render failed'));
    img.src = url;
  });
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  a.click();
}

/* ---------------- legend ---------------- */

export function Legend({ items, compareLabel }: { items: Array<{ label: string; color: string }>; compareLabel?: string }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-t2" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
      {compareLabel && (
        <li className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden>
            <line x1="0" y1="2" x2="16" y2="2" stroke="var(--ch-compare)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          {compareLabel}
        </li>
      )}
    </ul>
  );
}

/* ---------------- time series ---------------- */

interface TipPayload {
  payload?: Record<string, unknown>;
}

export function TimeSeriesChart({ series, height = 260, showCompare = true, compareLabel, indexed = false, ariaLabel, showLegend }: { series: Series[]; height?: number; showCompare?: boolean; compareLabel?: string; indexed?: boolean; ariaLabel: string; showLegend?: boolean }) {
  const { lang, t } = useI18n();
  const unit: Unit = indexed ? 'decimal' : series[0]?.unit ?? 'count';
  const rows = useMemo(() => {
    const base = series.map((s) => s.points.find((p) => p.value !== null && p.value !== 0)?.value ?? null);
    const n = Math.max(0, ...series.map((s) => s.points.length));
    return Array.from({ length: n }, (_, i) => {
      const row: Record<string, unknown> = { key: series[0]?.points[i]?.key, label: series[0]?.points[i]?.label, partial: series.some((s) => s.points[i]?.partial) };
      series.forEach((s, si) => {
        const p = s.points[i];
        const v = p?.value ?? null;
        const c = p?.compare ?? null;
        row[s.id] = indexed ? (v !== null && base[si] ? (v / base[si]!) * 100 : null) : v;
        row[`${s.id}__cmp`] = indexed ? (c !== null && base[si] ? (c / base[si]!) * 100 : null) : c;
        row[`${s.id}__raw`] = v;
        row[`${s.id}__rawcmp`] = c;
      });
      return row;
    });
  }, [series, indexed]);
  const single = series.length === 1;
  const tick = (v: number) => formatValue(v, unit, lang, { compact: true });
  const Tip = ({ active, payload }: { active?: boolean; payload?: TipPayload[] }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as Record<string, unknown>;
    return (
      <div className="min-w-44 rounded-lg border border-brd bg-card px-3 py-2 text-[12.5px] shadow-[var(--shadow-pop)]">
        <p className="mb-1 font-medium text-t1">
          {String(row.label)}
          {row.partial ? <span className="ml-1 text-t3">({t('common.partialPeriod')})</span> : null}
        </p>
        {series.map((s) => {
          const v = row[`${s.id}__raw`] as number | null;
          const c = row[`${s.id}__rawcmp`] as number | null;
          return (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-t2">
                <span className="inline-block size-2 rounded-full" style={{ background: SLOT(s.slot) }} aria-hidden />
                {s.label}
              </span>
              <span className="tnum font-medium text-t1">
                {formatValue(v, s.unit, lang)}
                {showCompare && c !== null && v !== null && <span className="ml-1.5 font-normal text-t3">({s.unit === 'percent' || s.unit === 'position' ? formatDelta(v - c, s.unit, lang) : formatPct(c ? (v - c) / Math.abs(c) : null, lang)})</span>}
              </span>
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <figure className="m-0" aria-label={ariaLabel}>
      {(showLegend ?? !single) && (
        <div className="mb-2">
          <Legend items={series.map((s) => ({ label: s.label, color: SLOT(s.slot) }))} compareLabel={showCompare && rows.some((r) => series.some((s) => r[`${s.id}__cmp`] !== null)) ? compareLabel : undefined} />
        </div>
      )}
      {single && showCompare && compareLabel && !showLegend && (
        <div className="mb-2">
          <Legend items={[{ label: series[0].label, color: SLOT(series[0].slot) }]} compareLabel={compareLabel} />
        </div>
      )}
      <div style={{ height }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--ch-grid)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--ch-grid)' }} minTickGap={24} />
            <YAxis tickFormatter={tick} tickLine={false} axisLine={false} width={64} reversed={!indexed && unit === 'position'} domain={unit === 'position' ? ['dataMin - 0.5', 'dataMax + 0.5'] : [indexed ? 'auto' : 0, 'auto']} />
            {indexed && <ReferenceLine y={100} stroke="var(--border-strong)" />}
            <Tooltip content={<Tip />} cursor={{ stroke: 'var(--border-strong)' }} />
            {showCompare &&
              series.map((s) => (
                <Line key={`${s.id}-c`} type="monotone" dataKey={`${s.id}__cmp`} stroke={single ? 'var(--ch-compare)' : SLOT(s.slot)} strokeOpacity={single ? 1 : 0.45} strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
              ))}
            {series.map((s) => (
              <Line key={s.id} type="monotone" dataKey={s.id} stroke={SLOT(s.slot)} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--bg-card)' }} isAnimationActive={false} connectNulls={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/* ---------------- sparkline ---------------- */

export function Sparkline({ values, slot = 0, height = 32, ariaLabel }: { values: Array<number | null>; slot?: number; height?: number; ariaLabel?: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null && Number.isFinite(p.v));
  if (pts.length < 2) return <div style={{ height }} />;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const w = 120;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  // break the line where data is missing
  const segs: string[] = [];
  let cur = '';
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      if (cur) segs.push(cur);
      cur = '';
      return;
    }
    cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  return (
    <svg data-chart viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true}>
      {segs.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={SLOT(slot)} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/* ---------------- ranked bars ---------------- */

export interface BarItem {
  key: string;
  label: ReactNode;
  value: number | null;
  compare?: number | null;
  sublabel?: ReactNode;
  href?: string;
  onClick?: () => void;
}

export function BarList({ items, unit, slot = 0, showDelta = true, max: maxIn, ariaLabel }: { items: BarItem[]; unit: Unit; slot?: number; showDelta?: boolean; max?: number; ariaLabel: string }) {
  const { lang } = useI18n();
  const max = maxIn ?? Math.max(1e-9, ...items.map((i) => Math.abs(i.value ?? 0)));
  return (
    <ul className="flex flex-col gap-2.5" aria-label={ariaLabel}>
      {items.map((it) => {
        const pct = Math.max(0, Math.min(100, ((it.value ?? 0) / max) * 100));
        const d = it.value !== null && it.compare !== null && it.compare !== undefined ? (unit === 'percent' || unit === 'position' ? formatDelta(it.value - it.compare, unit, lang) : formatPct(it.compare ? (it.value - it.compare) / Math.abs(it.compare) : null, lang)) : null;
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-t1">{it.label}</span>
              <span className="tnum shrink-0 font-medium text-t1">
                {formatValue(it.value, unit, lang, { compact: true })}
                {showDelta && d && <span className="ml-2 text-[12px] font-normal text-t3">{d}</span>}
              </span>
            </div>
            {it.sublabel && <div className="truncate text-[11.5px] text-t3">{it.sublabel}</div>}
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-inset" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SLOT(slot) }} />
            </div>
          </>
        );
        return (
          <li key={it.key}>
            {it.onClick ? (
              <button type="button" onClick={it.onClick} className="block w-full rounded-md p-1 text-left hover:bg-hov">
                {inner}
              </button>
            ) : (
              <div className="p-1">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- 100% split bar ---------------- */

export function SplitBar({ parts, unit = 'count', ariaLabel }: { parts: Array<{ key: string; label: string; value: number }>; unit?: Unit; ariaLabel: string }) {
  const { lang } = useI18n();
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={ariaLabel}>
        {parts.map((p, i) => (
          <div key={p.key} title={`${p.label}: ${formatPct(p.value / total, lang, false)}`} style={{ width: `${(Math.max(0, p.value) / total) * 100}%`, background: SLOT(i) }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-t2">
        {parts.map((p, i) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ background: SLOT(i) }} aria-hidden />
            {p.label} <span className="tnum font-medium text-t1">{formatPct(p.value / total, lang, false)}</span>
            <span className="tnum text-t3">({formatValue(p.value, unit, lang, { compact: true })})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- heatmap ---------------- */

export function Heatmap({ rows, cols, cell, ariaLabel }: { rows: Array<{ key: string; label: string }>; cols: Array<{ key: string; label: string }>; cell: (r: string, c: string) => { value: number | null; label: string; muted?: boolean }; ariaLabel: string }) {
  const values = rows.flatMap((r) => cols.map((c) => cell(r.key, c.key).value)).filter((v): v is number => v !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (v: number | null) => (v === null ? 'var(--seq-none)' : `var(--seq-${1 + Math.round(((v - min) / (max - min || 1)) * 6)})`);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-[12px]" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              —
            </th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="px-1 pb-1 text-center font-medium text-t2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="pr-2 text-left font-medium whitespace-nowrap text-t2">
                {r.label}
              </th>
              {cols.map((c) => {
                const x = cell(r.key, c.key);
                const v = x.value;
                const dark = v !== null && (v - min) / (max - min || 1) > 0.55;
                return (
                  <td key={c.key} title={x.label} className={clsx('h-9 min-w-12 rounded-[4px] text-center tnum', x.muted && 'opacity-45')} style={{ background: step(v), color: dark ? '#ffffff' : 'var(--text-1)' }}>
                    <span className="sr-only">{x.label}</span>
                    <span aria-hidden>{x.muted ? '·' : ''}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Small multiples of single-unit charts, used when metrics have different units. */
export function Panels({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{children}</div>;
}

export function useChartRef() {
  return useRef<HTMLDivElement>(null);
}

export function useHover<T>() {
  return useState<T | null>(null);
}
