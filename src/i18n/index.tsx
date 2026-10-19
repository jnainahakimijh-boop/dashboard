/** Lightweight i18n: per-module dictionaries (EN/FR) merged under namespaces, `t('ns.key', {param})`. */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { L10n } from '@shared/catalog';
import { common } from './common';
import { nav } from './nav';
import { overview } from './overview';
import { modules } from './modules';
import { admin } from './admin';

export type Lang = 'en' | 'fr';
export type Dict = Record<string, string>;
export interface Messages {
  en: Dict;
  fr: Dict;
}

const NAMESPACES: Record<string, Messages> = { common, nav, overview, ...modules, admin };

function flatten(lang: Lang): Dict {
  const out: Dict = {};
  for (const [ns, m] of Object.entries(NAMESPACES)) for (const [k, v] of Object.entries(m[lang])) out[`${ns}.${k}`] = v;
  return out;
}
const FLAT: Record<Lang, Dict> = { en: flatten('en'), fr: flatten('fr') };

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = FLAT[lang][key] ?? FLAT.en[key];
  if (s === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key ${key}`);
    return key;
  }
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function allKeys(lang: Lang): string[] {
  return Object.keys(FLAT[lang]);
}

interface I18nCtx {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  L: (v: L10n | string | null | undefined) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(lang, key, params), [lang]);
  const L = useCallback((v: L10n | string | null | undefined) => (v === null || v === undefined ? '' : typeof v === 'string' ? v : (v[lang] ?? v.en)), [lang]);
  const value = useMemo(() => ({ lang, t, L }), [lang, t, L]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n outside provider');
  return c;
}
