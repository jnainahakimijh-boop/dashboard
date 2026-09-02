import { useCallback } from 'react';
import { useSettings } from '/src/state/SettingsContext.js';
import { en, fr } from '/src/i18n/messages.js';
function interpolate(template, vars) {
    if (!vars)
        return template;
    return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
export function useI18n() {
    const { settings } = useSettings();
    const dict = settings.lang === 'fr' ? fr : en;
    const t = useCallback((key, vars) => interpolate(dict[key] ?? en[key] ?? key, vars), [dict]);
    return { t, lang: settings.lang };
}
