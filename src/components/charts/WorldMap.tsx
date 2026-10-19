/** Choropleth of a single metric by country (sequential one-hue ramp). Bundled topology — no network request. */
import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import world from 'world-atlas/countries-110m.json';
import type { Unit } from '@shared/metrics';
import { useI18n } from '@/i18n';
import { formatPct, formatValue } from '@/lib/format';

export interface MapDatum {
  isoNum: string;
  name: string;
  value: number;
}

export default function WorldMap({ data, unit, ariaLabel }: { data: MapDatum[]; unit: Unit; ariaLabel: string }) {
  const { lang } = useI18n();
  const [hover, setHover] = useState<{ name: string; value: number | null; x: number; y: number } | null>(null);
  const byIso = useMemo(() => new Map(data.map((d) => [d.isoNum.padStart(3, '0'), d])), [data]);
  const total = data.reduce((s, d) => s + d.value, 0);
  const max = Math.max(1, ...data.map((d) => d.value));
  // log scale keeps small markets visible next to France / United States
  const step = (v: number) => 1 + Math.min(6, Math.floor((Math.log10(1 + v) / Math.log10(1 + max)) * 6.999));
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 150 }} width={800} height={380} style={{ width: '100%', height: 'auto' }} role="group" aria-label={ariaLabel} data-chart>
        <ZoomableGroup center={[10, 20]} zoom={1} minZoom={1} maxZoom={4}>
          <Geographies geography={world as unknown as object}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const d = byIso.get(String(geo.id).padStart(3, '0'));
                const fill = d && d.value > 0 ? `var(--seq-${step(d.value)})` : 'var(--seq-none)';
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="var(--bg-card)"
                    strokeWidth={0.5}
                    tabIndex={d ? 0 : -1}
                    className="map-shape"
                    role={d ? 'img' : undefined}
                    aria-hidden={d ? undefined : true}
                    aria-label={d ? `${d.name}: ${formatValue(d.value, unit, lang)}` : undefined}
                    onMouseMove={(e: React.MouseEvent) => {
                      const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
                      setHover({ name: d?.name ?? String(geo.properties?.name ?? ''), value: d?.value ?? null, x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }}
                    onFocus={() => d && setHover({ name: d.name, value: d.value, x: 20, y: 20 })}
                    onBlur={() => setHover(null)}
                    style={{ default: { outline: 'none' }, hover: { outline: 'none', stroke: 'var(--text-1)', strokeWidth: 0.8 }, pressed: { outline: 'none' } }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-brd bg-card px-3 py-2 text-[12.5px] shadow-[var(--shadow-pop)]" style={{ left: Math.min(hover.x + 12, 600), top: hover.y + 12 }}>
          <p className="font-medium text-t1">{hover.name}</p>
          <p className="tnum text-t2">{hover.value === null ? '—' : `${formatValue(hover.value, unit, lang)} · ${formatPct(hover.value / (total || 1), lang, false)}`}</p>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-[11.5px] text-t3" aria-hidden>
        <span>{formatValue(0, unit, lang)}</span>
        <div className="flex h-2 w-40 overflow-hidden rounded-full">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex-1" style={{ background: `var(--seq-${i})` }} />
          ))}
        </div>
        <span>{formatValue(max, unit, lang, { compact: true })} (log)</span>
      </div>
    </div>
  );
}
