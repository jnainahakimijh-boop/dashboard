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

function read(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { ...DEFAULTS, ...raw };
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
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

  const value = useMemo(() => ({ prefs, setPrefs }), [prefs, setPrefs]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefsCtx);
  if (!c) throw new Error('usePrefs outside provider');
  return c;
}
