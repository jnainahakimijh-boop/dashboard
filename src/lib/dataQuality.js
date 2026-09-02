import { dataset } from '/src/data/index.js';
import { DAYS } from '/src/data/dimensions.js';
import { X_OUTAGE_DAYS } from '/src/data/generate.js';
function runChecks() {
    let clicksOverImpressions = 0;
    let engOverImpressions = 0;
    for (const f of dataset.social) {
        if (f.clicks > f.impressions)
            clicksOverImpressions++;
        if (f.reactions + f.comments + f.shares > f.impressions)
            engOverImpressions++;
    }
    let convOverSessions = 0;
    let engagedOverSessions = 0;
    for (const f of dataset.web) {
        if (f.conversions > f.sessions)
            convOverSessions++;
        if (f.engaged > f.sessions)
            engagedOverSessions++;
    }
    let cmpViolations = 0;
    for (const f of dataset.campaignFacts) {
        if (f.clicks > f.impressions || f.sessions > f.clicks || f.conversions > f.sessions)
            cmpViolations++;
    }
    // pages ↔ web reconciliation per day
    const webByDay = new Map();
    for (const f of dataset.web)
        webByDay.set(f.d, (webByDay.get(f.d) ?? 0) + f.sessions);
    const pagesByDay = new Map();
    for (const f of dataset.pages)
        pagesByDay.set(f.d, (pagesByDay.get(f.d) ?? 0) + f.sessions);
    let reconMaxDiff = 0;
    for (let d = 0; d < DAYS; d++) {
        const w = webByDay.get(d) ?? 0;
        const pg = pagesByDay.get(d) ?? 0;
        if (w > 0)
            reconMaxDiff = Math.max(reconMaxDiff, Math.abs(w - pg) / w);
    }
    const missingDays = X_OUTAGE_DAYS.length;
    const utmIncomplete = 4.2; // simulated: % of paid sessions with incomplete UTMs
    const checks = [
        {
            id: 'freshness',
            label: { en: 'Source freshness within SLA', fr: 'Fraîcheur des sources dans le SLA' },
            detail: { en: 'All core sources are monitored against source-specific freshness SLAs; X is currently outside its target window.', fr: 'Toutes les sources cœur sont suivies selon un SLA de fraîcheur propre ; X est actuellement hors de sa fenêtre cible.' },
            status: 'warn',
        },
        {
            id: 'missing-periods',
            label: { en: 'Missing periods', fr: 'Périodes manquantes' },
            detail: {
                en: `X connector: ${missingDays} missing day(s) in the last 14 days. All other sources complete.`,
                fr: `Connecteur X : ${missingDays} jour(s) manquant(s) sur les 14 derniers jours. Autres sources complètes.`,
            },
            status: missingDays > 0 ? 'fail' : 'pass',
        },
        {
            id: 'utm',
            label: { en: 'UTM completeness', fr: 'Complétude UTM' },
            detail: {
                en: `${utmIncomplete}% of paid sessions missing utm_campaign — below the 5% alert threshold.`,
                fr: `${utmIncomplete.toString().replace('.', ',')} % des sessions payantes sans utm_campaign — sous le seuil d'alerte de 5 %.`,
            },
            status: 'warn',
        },
        {
            id: 'duplicates',
            label: { en: 'Duplicate event IDs', fr: 'Identifiants dupliqués' },
            detail: { en: '0 duplicate event IDs detected across fact tables.', fr: '0 identifiant dupliqué détecté dans les tables de faits.' },
            status: 'pass',
        },
        {
            id: 'invalid-dates',
            label: { en: 'Invalid dates', fr: 'Dates invalides' },
            detail: { en: 'All rows fall inside the collection window.', fr: 'Toutes les lignes sont dans la fenêtre de collecte.' },
            status: 'pass',
        },
        {
            id: 'schema',
            label: { en: 'Schema drift', fr: 'Dérive de schéma' },
            detail: { en: 'No schema changes detected in the last 30 days.', fr: 'Aucun changement de schéma détecté sur 30 jours.' },
            status: 'pass',
        },
        {
            id: 'recon-ratio',
            label: { en: 'Metric reconciliation: clicks ≤ impressions', fr: 'Réconciliation : clics ≤ impressions' },
            detail: {
                en: `${clicksOverImpressions + engOverImpressions} violations across ${dataset.social.length.toLocaleString()} social rows.`,
                fr: `${clicksOverImpressions + engOverImpressions} violations sur ${dataset.social.length.toLocaleString('fr-FR')} lignes sociales.`,
            },
            status: clicksOverImpressions + engOverImpressions === 0 ? 'pass' : 'fail',
        },
        {
            id: 'recon-web',
            label: { en: 'Metric reconciliation: conversions ≤ engaged ≤ sessions', fr: 'Réconciliation : conversions ≤ engagées ≤ sessions' },
            detail: {
                en: `${convOverSessions + engagedOverSessions} violations across ${dataset.web.length.toLocaleString()} web rows; campaigns: ${cmpViolations}.`,
                fr: `${convOverSessions + engagedOverSessions} violations sur ${dataset.web.length.toLocaleString('fr-FR')} lignes web ; campagnes : ${cmpViolations}.`,
            },
            status: convOverSessions + engagedOverSessions + cmpViolations === 0 ? 'pass' : 'fail',
        },
        {
            id: 'recon-pages',
            label: { en: 'Aggregation: page totals reconcile with web totals', fr: 'Agrégation : totaux pages réconciliés avec le web' },
            detail: {
                en: `Max daily divergence ${(reconMaxDiff * 100).toFixed(2)}% (threshold 1%).`,
                fr: `Divergence quotidienne max ${(reconMaxDiff * 100).toFixed(2).replace('.', ',')} % (seuil 1 %).`,
            },
            status: reconMaxDiff < 0.01 ? 'pass' : 'warn',
        },
    ];
    return { checks, invariantViolations: clicksOverImpressions + engOverImpressions + convOverSessions + engagedOverSessions + cmpViolations };
}
const { checks: CHECKS } = runChecks();
export { CHECKS };
export const SOURCES = [
    { id: 'ga4', name: 'Google Analytics 4', status: 'healthy', lastRefreshMin: 4, frequency: '15 min', slaHours: 1, rows: dataset.web.length, score: 98, issues: 0 },
    { id: 'gsc', name: 'Google Search Console', status: 'healthy', lastRefreshMin: 31, frequency: '6 h', slaHours: 12, rows: 128640, score: 97, issues: 0 },
    { id: 'linkedin', name: 'LinkedIn', status: 'healthy', lastRefreshMin: 38, frequency: '1 h', slaHours: 4, rows: dataset.social.filter((s) => s.platform === 'linkedin').length, score: 96, issues: 0 },
    { id: 'meta', name: 'Instagram / Meta', status: 'healthy', lastRefreshMin: 44, frequency: '1 h', slaHours: 4, rows: dataset.social.filter((s) => s.platform === 'instagram').length, score: 95, issues: 0 },
    { id: 'youtube', name: 'YouTube', status: 'healthy', lastRefreshMin: 52, frequency: '6 h', slaHours: 12, rows: dataset.social.filter((s) => s.platform === 'youtube').length, score: 95, issues: 0 },
    { id: 'x', name: 'X', status: 'degraded', lastRefreshMin: 1440 * 2, frequency: '6 h', slaHours: 12, rows: dataset.social.filter((s) => s.platform === 'x').length, score: 71, issues: 1 },
    { id: 'tiktok', name: 'TikTok', status: 'healthy', lastRefreshMin: 180, frequency: '6 h', slaHours: 12, rows: 18340, score: 92, issues: 0 },
    { id: 'advocacy', name: 'Employee Advocacy Platform', status: 'healthy', lastRefreshMin: 48, frequency: '3 h', slaHours: 6, rows: 28740, score: 94, issues: 0 },
    { id: 'cms', name: 'CMS', status: 'healthy', lastRefreshMin: 18, frequency: '1 h', slaHours: 2, rows: 12042, score: 97, issues: 0 },
    { id: 'crm', name: 'CRM', status: 'healthy', lastRefreshMin: 190, frequency: '24 h', slaHours: 36, rows: 48210, score: 93, issues: 0 },
    { id: 'paid', name: 'Paid Media', status: 'healthy', lastRefreshMin: 65, frequency: '3 h', slaHours: 6, rows: dataset.campaignFacts.length, score: 91, issues: 1 },
    { id: 'dwh', name: 'Data Warehouse', status: 'healthy', lastRefreshMin: 26, frequency: '1 h', slaHours: 2, rows: dataset.web.length + dataset.social.length + dataset.pages.length, score: 97, issues: 0 },
];
/** Health score = freshness 40% + completeness 40% + reconciliation 20% (documented in UI). */
export function healthScore() {
    const withinSla = SOURCES.filter((s) => s.lastRefreshMin / 60 <= s.slaHours).length;
    const freshness = Math.round((withinSla / SOURCES.length) * 100);
    const expectedSocialDays = DAYS * 4; // 4 platforms
    const presentDays = new Set(dataset.social.map((s) => `${s.platform}:${s.d}`)).size;
    const completeness = Math.round((presentDays / expectedSocialDays) * 100);
    const failing = CHECKS.filter((c) => c.id.startsWith('recon') && c.status !== 'pass').length;
    const reconChecks = CHECKS.filter((c) => c.id.startsWith('recon')).length;
    const reconciliation = Math.round(((reconChecks - failing) / reconChecks) * 100);
    const total = Math.round(0.4 * freshness + 0.4 * completeness + 0.2 * reconciliation);
    return { total, freshness, completeness, reconciliation };
}
