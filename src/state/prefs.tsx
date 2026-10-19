/** UI preferences (language, theme, density) persisted per browser and mirrored to the user profile. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';
export interface Prefs {
  language: 'en' | 'fr';
  theme: Theme;
  density: Density;
  sidebarCollapsed: boolean;
}

const KEY = 'vdi.prefs';
const DEFAULTS: Prefs = { language: 'fr', theme: 'light', density: 'comfortable', sidebarCollapsed: false };

function stored(): Partial<Prefs> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
  } catch {
    return {};
  }
}

function read(): Prefs {
  return { ...DEFAULTS, ...stored() };
}

interface Ctx {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  /** Organisation default theme: applies only while the user has not chosen a theme themselves. */
  applyOrgTheme: (theme: Theme | undefined) => void;
}
const PrefsCtx = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, set] = useState<Prefs>(read);
  const setPrefs = useCallback((p: Partial<Prefs>) => {
    set((cur) => {
      const next = { ...cur, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    root.dataset.density = prefs.density;
    root.lang = prefs.language;
    if (prefs.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [prefs.theme, prefs.density, prefs.language]);

  const applyOrgTheme = useCallback((theme: Theme | undefined) => {
    if (!theme || stored().theme) return;
    set((cur) => (cur.theme === theme ? cur : { ...cur, theme }));
  }, []);

  const value = useMemo(() => ({ prefs, setPrefs, applyOrgTheme }), [prefs, setPrefs, applyOrgTheme]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefsCtx);
  if (!c) throw new Error('usePrefs outside provider');
  return c;
}
