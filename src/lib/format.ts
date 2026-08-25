import { dayToDate } from '@/data/dimensions';

/** ------------------------------------------------------------------
 *  Locale-aware formatters. All null-safe: invalid input renders "—".
 *  The UI must never show NaN / Infinity / undefined.
 *  ------------------------------------------------------------------ */

export const EM_DASH = '—';

export type Locale = 'en' | 'fr';

const localeTag = (l: Locale) => (l === 'fr' ? 'fr-FR' : 'en-GB');

function valid(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Integer with thousands grouping: 248,420 */
export function fmtInt(v: number | null | undefined, l: Locale = 'en'): string {
  if (!valid(v)) return EM_DASH;
  return new Intl.NumberFormat(localeTag(l), { maximumFractionDigits: 0 }).format(v);
}

/** Compact: 248.4k / 1.2M */
export function fmtCompact(v: number | null | undefined, l: Locale = 'en'): string {
  if (!valid(v)) return EM_DASH;
  if (Math.abs(v) < 10000) return fmtInt(v, l);
  return new Intl.NumberFormat(localeTag(l), { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

/** Percentage with 1 decimal (value already in %): 3.8% */
export function fmtPct(v: number | null | undefined, l: Locale = 'en', digits = 1): string {
  if (!valid(v)) return EM_DASH;
  return `${new Intl.NumberFormat(localeTag(l), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)}%`;
}

/** Signed relative change: +12.4% */
export function fmtRelDelta(v: number | null | undefined, l: Locale = 'en'): string {
  if (!valid(v)) return EM_DASH;
  const sign = v > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat(localeTag(l), { maximumFractionDigits: 1 }).format(v)}%`;
}

/** Signed percentage-point change: +0.4 pp (always 1 decimal — a rate delta of
 *  "+0 pp" would hide the direction of a real, small movement) */
export function fmtPpDelta(v: number | null | undefined, l: Locale = 'en'): string {
  if (!valid(v)) return EM_DASH;
  const sign = v > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat(localeTag(l), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)} pp`;
}

/** Axis ticks: consistent compact notation from 1,000 upward (5K, 10K, 1.2M) */
export function fmtAxis(v: number | null | undefined, l: Locale = 'en'): string {
  if (!valid(v)) return '';
  if (Math.abs(v) >= 1000) return new Intl.NumberFormat(localeTag(l), { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  return fmtInt(v, l);
}

/** EUR currency: €12,480 / €4.20 for small values */
export function fmtEur(v: number | null | undefined, l: Locale = 'en'): string {
  if (!valid(v)) return EM_DASH;
  return new Intl.NumberFormat(localeTag(l), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0,
  }).format(v);
}

/** Duration in seconds → 2m 18s */
export function fmtDuration(v: number | null | undefined): string {
  if (!valid(v)) return EM_DASH;
  const s = Math.round(v);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

/** Day index → short date: 12 Jun */
export function fmtDay(d: number, l: Locale = 'en'): string {
  return new Intl.DateTimeFormat(localeTag(l), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dayToDate(d));
}

/** Day index → full date: 12 Jun 2026 */
export function fmtDayFull(d: number, l: Locale = 'en'): string {
  return new Intl.DateTimeFormat(localeTag(l), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(dayToDate(d));
}

/** Range label: 28 Jul – 24 Aug 2026 */
export function fmtRange(from: number, to: number, l: Locale = 'en'): string {
  return `${fmtDay(from, l)} – ${fmtDayFull(to, l)}`;
}

/** Signed integer for absolute deltas: +1,204 */
export function fmtSignedInt(v: number | null | undefined, l: Locale = 'en'): string {
  if (!valid(v)) return EM_DASH;
  const sign = v > 0 ? '+' : '';
  return `${sign}${fmtInt(v, l)}`;
}

/** Multiplier: 3.4× */
export function fmtX(v: number | null | undefined, l: Locale = 'en'): string {
  if (!valid(v)) return EM_DASH;
  return `${new Intl.NumberFormat(localeTag(l), { maximumFractionDigits: 1 }).format(v)}×`;
}
