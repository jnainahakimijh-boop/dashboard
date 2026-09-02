import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
const SettingsSchema = z.object({
    theme: z.enum(['dark', 'light', 'system']).default('light'),
    density: z.enum(['comfortable', 'compact']).default('comfortable'),
    lang: z.enum(['en', 'fr']).default('en'),
    chartAnimations: z.boolean().default(true),
    highContrast: z.boolean().default(false),
    fontScale: z.enum(['100', '110', '120']).default('100'),
    defaultPage: z.string().default('/'),
    defaultRange: z.enum(['7d', '28d', '30d', '90d']).default('30d'),
    defaultCompare: z.enum(['previous', 'previous-month', 'previous-quarter', 'previous-year', 'same-period-last-year', 'none']).default('previous'),
    timezone: z.string().default('Europe/Paris'),
    sessionTimeoutMinutes: z.enum(['15', '30', '60', '120']).default('60'),
    notifAnomalies: z.boolean().default(true),
    notifSources: z.boolean().default(true),
    notifDigest: z.boolean().default(false),
    notifReports: z.boolean().default(true),
    exportFormat: z.enum(['pdf', 'csv', 'xlsx']).default('pdf'),
    exportMethodology: z.boolean().default(true),
    exportComparison: z.boolean().default(true),
    profileName: z.string().default('Veolia Digital User'),
    profileRole: z.string().default('Digital Performance User'),
    profileEmail: z.string().default('digital.user@veolia.demo'),
});
const STORAGE_KEY = 'dp.settings';
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return SettingsSchema.parse(raw ? JSON.parse(raw) : {});
    }
    catch {
        return SettingsSchema.parse({});
    }
}
const Ctx = createContext(null);
export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(load);
    const [systemLight, setSystemLight] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const onChange = (e) => setSystemLight(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    const resolvedTheme = settings.theme === 'system' ? (systemLight ? 'light' : 'dark') : settings.theme;
    useEffect(() => {
        document.documentElement.dataset.theme = resolvedTheme;
        document.documentElement.dataset.density = settings.density;
        document.documentElement.dataset.contrast = settings.highContrast ? 'high' : 'normal';
        document.documentElement.dataset.fontScale = settings.fontScale;
        document.documentElement.lang = settings.lang;
    }, [resolvedTheme, settings.density, settings.highContrast, settings.fontScale, settings.lang]);
    const update = useCallback((patch) => {
        setSettings((prev) => {
            const next = SettingsSchema.parse({ ...prev, ...patch });
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            }
            catch {
                /* storage unavailable — settings stay in memory */
            }
            return next;
        });
    }, []);
    const value = useMemo(() => ({ settings, update, resolvedTheme }), [settings, update, resolvedTheme]);
    return _jsx(Ctx.Provider, { value: value, children: children });
}
export function useSettings() {
    const ctx = useContext(Ctx);
    if (!ctx)
        throw new Error('useSettings outside SettingsProvider');
    return ctx;
}
