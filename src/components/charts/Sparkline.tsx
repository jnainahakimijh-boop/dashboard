import { useId } from 'react';

/** Tiny inline sparkline. Renders real series values scaled to its own
 *  min/max (context, not measurement — exact values live in the KPI card). */
export function Sparkline({ values, width = 72, height = 22, color, label }: { values: (number | null)[]; width?: number; height?: number; color?: string; label?: string }) {
  const id = useId();
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (finite.length < 2) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const pad = 2;
  const n = values.length;
  const pts: string[] = [];
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) return;
    const x = pad + (i / (n - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="shrink-0">
      <title>{label}</title>
      <polyline id={id} points={pts.join(' ')} fill="none" stroke={color ?? 'currentColor'} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
    </svg>
  );
}
