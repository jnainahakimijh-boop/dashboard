/** Locale-aware formatting for every number shown in the UI (single source of truth). */
import type { Unit } from '@shared/metrics';

type Lang = 'en' | 'fr';

/** Organisation-wide formatting defaults (Administration → Organisation), applied once meta is loaded. */
const overrides: { numberLocale?: string; dateFormat?: 'locale' | 'iso'; currency?: string } = {};
export function configureFormatting(o: { numberLocale?: string; dateFormat?: 'locale' | 'iso'; currency?: string }): void {
  overrides.numberLocale = o.numberLocale;
  overrides.dateFormat = o.dateFormat;
  overrides.currency = o.currency && /^[A-Z]{3}$/.test(o.currency) ? o.currency : undefined;
}
const loc = (lang: Lang) => overrides.numberLocale ?? (lang === 'fr' ? 'fr-FR' : 'en-GB');
const dloc = (lang: Lang) => (lang === 'fr' ? 'fr-FR' : 'en-GB');

export function formatValue(v: number | null | undefined, unit: Unit | 'text' | undefined, lang: Lang, opts: { compact?: boolean; currency?: string } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const L = loc(lang);
  switch (unit) {
    case 'percent':
      return new Intl.NumberFormat(L, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: Math.abs(v) < 0.01 ? 2 : 1 }).format(v);
    case 'currency':
      return new Intl.NumberFormat(L, { style: 'currency', currency: opts.currency ?? overrides.currency ?? 'EUR', notation: opts.compact && Math.abs(v) >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }).format(v);
    case 'position':
      return new Intl.NumberFormat(L, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
    case 'decimal':
      return new Intl.NumberFormat(L, { maximumFractionDigits: 2 }).format(v);
    case 'seconds': {
      const m = Math.floor(v / 60);
      const s = Math.round(v % 60);
      return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
    }
    case 'minutes':
      return `${new Intl.NumberFormat(L, { notation: opts.compact && v >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: v < 10 ? 1 : 0 }).format(v)} min`;
    case 'count':
      return new Intl.NumberFormat(L, { notation: opts.compact && Math.abs(v) >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: opts.compact && Math.abs(v) >= 10_000 ? 1 : 0 }).format(v);
    default:
      return new Intl.NumberFormat(L, { maximumFractionDigits: 2 }).format(v);
  }
}

export function formatPct(x: number | null | undefined, lang: Lang, signed = true): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return new Intl.NumberFormat(loc(lang), { style: 'percent', maximumFractionDigits: Math.abs(x) < 0.1 ? 1 : 0, minimumFractionDigits: Math.abs(x) < 0.1 ? 1 : 0, signDisplay: signed ? 'exceptZero' : 'auto' }).format(x);
}

/** Absolute difference in the metric's unit (rates in percentage points). */
export function formatDelta(d: number | null | undefined, unit: Unit, lang: Lang, currency?: string): string {
  if (d === null || d === undefined || !Number.isFinite(d)) return '—';
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  if (unit === 'percent') return `${sign}${new Intl.NumberFormat(loc(lang), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(d * 100))} ${lang === 'fr' ? 'pt' : 'pts'}`;
  return `${sign}${formatValue(Math.abs(d), unit, lang, { compact: true, currency })}`;
}

export function formatDate(iso: string | null | undefined, lang: Lang, style: 'short' | 'medium' | 'long' = 'medium'): string {
  if (!iso) return '—';
  if (overrides.dateFormat === 'iso') return iso.slice(0, 10);
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const opts: Intl.DateTimeFormatOptions = style === 'short' ? { day: 'numeric', month: 'short' } : style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(dloc(lang), { ...opts, timeZone: iso.length === 10 ? 'UTC' : 'Europe/Paris' }).format(d);
}

export function formatDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  if (overrides.dateFormat === 'iso') return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(iso));
  return new Intl.DateTimeFormat(dloc(lang), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(iso));
}

export function formatRange(r: { from: string; to: string } | null | undefined, lang: Lang): string {
  if (!r) return '—';
  if (r.from === r.to) return formatDate(r.from, lang);
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  return `${sameYear ? formatDate(r.from, lang, 'short') : formatDate(r.from, lang)} – ${formatDate(r.to, lang)}`;
}

export function relativeTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(dloc(lang), { numeric: 'auto' });
  if (Math.abs(diff) < 60) return rtf.format(-Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86400), 'day');
}

export function formatBucket(key: string, granularity: 'day' | 'week' | 'month', lang: Lang): string {
  if (granularity === 'month') return new Intl.DateTimeFormat(loc(lang), { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
  return formatDate(key, lang, 'short');
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
