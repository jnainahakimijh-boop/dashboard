import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';

const SettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).default('light'),
  density: z.enum(['comfortable', 'compact']).default('comfortable'),
  lang: z.enum(['en', 'fr']).default('en'),
  chartAnimations: z.boolean().default(true),
  defaultPage: z.string().default('/'),
  defaultRange: z.enum(['7d', '28d', '90d']).default('28d'),
  notifAnomalies: z.boolean().default(true),
  notifSources: z.boolean().default(true),
  notifDigest: z.boolean().default(false),
  notifReports: z.boolean().default(true),
  exportFormat: z.enum(['csv', 'xlsx']).default('csv'),
  exportMethodology: z.boolean().default(true),
  exportComparison: z.boolean().default(true),
  profileName: z.string().default('Alex Moreau'),
  profileRole: z.string().default('Analyst'),
  profileEmail: z.string().default('alex.moreau@example.com'),
});

export type Settings = z.infer<typeof SettingsSchema>;

const STORAGE_KEY = 'dp.settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return SettingsSchema.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return SettingsSchema.parse({});
  }
}

interface SettingsCtx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  resolvedTheme: 'dark' | 'light';
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  const [systemLight, setSystemLight] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (e: MediaQueryListEvent) => setSystemLight(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'dark' | 'light' = settings.theme === 'system' ? (systemLight ? 'light' : 'dark') : settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.lang = settings.lang;
  }, [resolvedTheme, settings.density, settings.lang]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — settings stay in memory */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update, resolvedTheme }), [settings, update, resolvedTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}
