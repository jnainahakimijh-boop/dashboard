import { useMemo } from 'react';
import { useSettings } from '/src/state/SettingsContext.js';
/** SVG presentation attributes can't resolve CSS var(); read computed values
 *  once per theme change and hand concrete colours to Recharts. */
export function useChartTheme() {
    const { resolvedTheme, settings } = useSettings();
    return useMemo(() => {
        const cs = getComputedStyle(document.documentElement);
        const v = (name) => cs.getPropertyValue(name).trim();
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return {
            series: [v('--ch-1'), v('--ch-2'), v('--ch-3'), v('--ch-4'), v('--ch-5'), v('--ch-6')],
            compare: v('--ch-compare'),
            grid: v('--ch-grid'),
            axis: v('--ch-axis'),
            accent: v('--accent'),
            pos: v('--pos'),
            neg: v('--neg'),
            animate: settings.chartAnimations && !reduced,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedTheme, settings.chartAnimations]);
}
