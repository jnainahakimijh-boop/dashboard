/** Server-side number formatting for generated texts (alerts, recommendations, reports). */
import type { Unit } from '@shared/metrics';

export type Lang = 'en' | 'fr';

export function fmt(value: number | null | undefined, unit: Unit, lang: Lang, currency = 'EUR'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB';
  switch (unit) {
    case 'percent':
      return new Intl.NumberFormat(loc, { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);
    case 'currency':
      return new Intl.NumberFormat(loc, { style: 'currency', currency, maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0 }).format(value);
    case 'position':
      return new Intl.NumberFormat(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);
    case 'decimal':
      return new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(value);
    case 'seconds': {
      const m = Math.floor(value / 60);
      const s = Math.round(value % 60);
      return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
    }
    case 'minutes':
      return `${new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(value)} min`;
    default:
      return new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(value);
  }
}

export function fmtPct(x: number | null | undefined, lang: Lang, signed = true): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const s = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { style: 'percent', maximumFractionDigits: 1, signDisplay: signed ? 'exceptZero' : 'auto' }).format(x);
  return s;
}

/** Absolute change in the metric's unit, signed (rates in percentage points). */
export function fmtDelta(delta: number | null | undefined, unit: Unit, lang: Lang): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return '—';
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  if (unit === 'percent') {
    const pts = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 }).format(Math.abs(delta * 100));
    return `${sign}${pts} ${lang === 'fr' ? 'pt' : 'pts'}`;
  }
  return `${sign}${fmt(Math.abs(delta), unit, lang)}`;
}

export function fmtDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

export function fmtRange(r: { from: string; to: string } | null | undefined, lang: Lang): string {
  if (!r) return '—';
  return `${fmtDate(r.from, lang)} – ${fmtDate(r.to, lang)}`;
}
