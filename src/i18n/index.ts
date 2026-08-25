import { useCallback } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { en, fr, type MsgKey } from './messages';
import type { Locale } from '@/lib/format';

export type { MsgKey };

export interface I18n {
  t: (key: MsgKey, vars?: Record<string, string | number>) => string;
  lang: Locale;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function useI18n(): I18n {
  const { settings } = useSettings();
  const dict = settings.lang === 'fr' ? fr : en;
  const t = useCallback(
    (key: MsgKey, vars?: Record<string, string | number>) => interpolate(dict[key] ?? en[key] ?? key, vars),
    [dict],
  );
  return { t, lang: settings.lang };
}
