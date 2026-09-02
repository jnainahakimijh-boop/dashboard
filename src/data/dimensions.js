/** Dataset time window: DAYS daily buckets ending at ANCHOR_DATE (inclusive).
 *  The anchor is fixed so the synthetic dataset is fully deterministic. */
export const DAYS = 730;
const _today = new Date();
export const ANCHOR_DATE = new Date(Date.UTC(_today.getUTCFullYear(), _today.getUTCMonth(), _today.getUTCDate())); // Daily anchor so exact-date filters include the current day
export function dayToDate(d) {
    const t = new Date(ANCHOR_DATE);
    t.setUTCDate(t.getUTCDate() - (DAYS - 1 - d));
    return t;
}
export function dateToDay(date) {
    const ms = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const diff = Math.round((ANCHOR_DATE.getTime() - ms) / 86400000);
    return DAYS - 1 - diff;
}
/** 0 = Monday … 6 = Sunday */
export function weekdayOf(d) {
    return (dayToDate(d).getUTCDay() + 6) % 7;
}
export const MARKETS = [
    { id: 'fr', name: 'France', nameFr: 'France', region: 'Europe', lang: 'fr', weight: 0.26, growth: 0.0009 },
    { id: 'us', name: 'United States', nameFr: 'États-Unis', region: 'North America', lang: 'en', weight: 0.22, growth: 0.0016 },
    { id: 'uk', name: 'United Kingdom', nameFr: 'Royaume-Uni', region: 'Europe', lang: 'en', weight: 0.16, growth: 0.0007 },
    { id: 'de', name: 'Germany', nameFr: 'Allemagne', region: 'Europe', lang: 'de', weight: 0.14, growth: 0.0011 },
    { id: 'es', name: 'Spain', nameFr: 'Espagne', region: 'Europe', lang: 'es', weight: 0.12, growth: 0.0018 },
    { id: 'pl', name: 'Poland', nameFr: 'Pologne', region: 'Europe', lang: 'pl', weight: 0.1, growth: 0.0024 },
];
export const CHANNELS = [
    { id: 'organic', name: 'Organic Search', nameFr: 'Recherche organique', weight: 0.34, engagedRate: 0.63, convOfEngaged: 0.045, avgEngSec: 138, growth: 0.0014 },
    { id: 'direct', name: 'Direct', nameFr: 'Direct', weight: 0.18, engagedRate: 0.58, convOfEngaged: 0.052, avgEngSec: 126, growth: 0.0004 },
    { id: 'referral', name: 'Referral', nameFr: 'Référent', weight: 0.12, engagedRate: 0.6, convOfEngaged: 0.038, avgEngSec: 121, growth: 0.0006 },
    { id: 'social', name: 'Social', nameFr: 'Social', weight: 0.12, engagedRate: 0.49, convOfEngaged: 0.026, avgEngSec: 87, growth: 0.0012 },
    { id: 'email', name: 'Email', nameFr: 'Email', weight: 0.1, engagedRate: 0.71, convOfEngaged: 0.06, avgEngSec: 154, growth: 0.0002 },
    { id: 'paid', name: 'Paid Media', nameFr: 'Média payant', weight: 0.14, engagedRate: 0.51, convOfEngaged: 0.041, avgEngSec: 92, growth: 0.001 },
];
export const PLATFORMS = [
    { id: 'linkedin', name: 'LinkedIn', baseImpressions: 92000, engagementRate: 0.047, ctr: 0.0125, hasVideo: true, growth: 0.0013 },
    { id: 'youtube', name: 'YouTube', baseImpressions: 34000, engagementRate: 0.021, ctr: 0.006, hasVideo: true, growth: 0.0018 },
    { id: 'x', name: 'X', baseImpressions: 26000, engagementRate: 0.014, ctr: 0.0055, hasVideo: false, growth: -0.0011 },
    { id: 'instagram', name: 'Instagram', baseImpressions: 41000, engagementRate: 0.036, ctr: 0.0045, hasVideo: true, growth: 0.0009 },
];
export const DEVICES = [
    { id: 'mobile', name: 'Mobile', nameFr: 'Mobile', weight: 0.52, convFactor: 0.68, engFactor: 0.88 },
    { id: 'desktop', name: 'Desktop', nameFr: 'Ordinateur', weight: 0.42, convFactor: 1.42, engFactor: 1.14 },
    { id: 'tablet', name: 'Tablet', nameFr: 'Tablette', weight: 0.06, convFactor: 0.94, engFactor: 0.97 },
];
export const THEMES = [
    { id: 'sustainability', name: 'Sustainability', nameFr: 'Développement durable', erFactor: 1.3, weight: 0.24 },
    { id: 'innovation', name: 'Innovation & R&D', nameFr: 'Innovation & R&D', erFactor: 1.12, weight: 0.18 },
    { id: 'careers', name: 'Careers & People', nameFr: 'Carrières & talents', erFactor: 1.38, weight: 0.16 },
    { id: 'product', name: 'Product & Services', nameFr: 'Produits & services', erFactor: 0.86, weight: 0.18 },
    { id: 'thought-leadership', name: 'Thought Leadership', nameFr: "Leadership d'opinion", erFactor: 1.05, weight: 0.14 },
    { id: 'community', name: 'Community & Events', nameFr: 'Communauté & événements', erFactor: 1.18, weight: 0.1 },
];
export const FORMATS = [
    { id: 'video', name: 'Video', nameFr: 'Vidéo', erFactor: 1.35, reachFactor: 1.4 },
    { id: 'carousel', name: 'Carousel', nameFr: 'Carrousel', erFactor: 1.22, reachFactor: 1.05 },
    { id: 'image', name: 'Static image', nameFr: 'Image statique', erFactor: 0.95, reachFactor: 1.0 },
    { id: 'article', name: 'Article', nameFr: 'Article', erFactor: 0.88, reachFactor: 0.72 },
    { id: 'document', name: 'Document', nameFr: 'Document', erFactor: 1.1, reachFactor: 0.6 },
    { id: 'text', name: 'Text post', nameFr: 'Post texte', erFactor: 0.8, reachFactor: 0.9 },
];
export const LANDING_PAGES = [
    { path: '/', group: 'home' },
    { path: '/products/analytics-suite', group: 'product' },
    { path: '/products/data-platform', group: 'product' },
    { path: '/solutions/enterprise', group: 'solutions' },
    { path: '/solutions/public-sector', group: 'solutions' },
    { path: '/pricing', group: 'conversion' },
    { path: '/customers', group: 'company' },
    { path: '/resources/blog', group: 'resources' },
    { path: '/resources/whitepapers', group: 'resources' },
    { path: '/careers', group: 'company' },
    { path: '/events/annual-summit', group: 'resources' },
    { path: '/contact', group: 'conversion' },
];
export const marketById = new Map(MARKETS.map((m) => [m.id, m]));
export const channelById = new Map(CHANNELS.map((c) => [c.id, c]));
export const platformById = new Map(PLATFORMS.map((p) => [p.id, p]));
export const deviceById = new Map(DEVICES.map((d) => [d.id, d]));
export const themeById = new Map(THEMES.map((t) => [t.id, t]));
export const formatById = new Map(FORMATS.map((f) => [f.id, f]));
/** Weekly seasonality — B2B pattern: strong midweek, quiet weekends. */
export const WEEKDAY_FACTOR = [1.06, 1.12, 1.14, 1.08, 0.98, 0.58, 0.52];
