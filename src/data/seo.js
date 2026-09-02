import { DAYS, LANDING_PAGES, MARKETS, WEEKDAY_FACTOR, weekdayOf } from '/src/data/dimensions.js';
import { dayRng, Rng } from '/src/data/random.js';
export function generateSeoFacts() {
    const out = [];
    for (let d = 0; d < DAYS; d++) {
        const wf = 0.72 + 0.28 * WEEKDAY_FACTOR[weekdayOf(d)];
        for (const m of MARKETS) {
            const r = dayRng(`seo:${m.id}`, d);
            const growth = Math.pow(1 + 0.0015 + m.growth, d);
            const impressions = Math.round(178000 * m.weight * wf * growth * r.noise(0.11));
            const position = Math.max(4.2, Math.min(19, 11.4 - d * 0.012 + r.range(-1.1, 1.1)));
            const ctr = Math.max(0.012, Math.min(0.075, 0.052 - position * 0.0019 + r.range(-0.003, 0.003)));
            const clicks = Math.min(impressions, Math.round(impressions * ctr));
            const brandedShare = Math.max(0.18, Math.min(0.42, 0.27 + m.weight * 0.18 + r.range(-0.025, 0.025)));
            const brandedImpressions = Math.round(impressions * brandedShare);
            const nonBrandedImpressions = impressions - brandedImpressions;
            const brandedClicks = Math.min(clicks, Math.round(clicks * Math.min(0.62, brandedShare + 0.18)));
            const nonBrandedClicks = clicks - brandedClicks;
            const rankingKeywords = Math.max(100, Math.round(860 * m.weight * growth * r.noise(0.08)));
            const conversions = Math.min(clicks, Math.round(clicks * r.range(0.025, 0.055)));
            out.push({ d, market: m.id, impressions, clicks, brandedImpressions, nonBrandedImpressions, brandedClicks, nonBrandedClicks, positionWeighted: impressions * position, rankingKeywords, conversions });
        }
    }
    return out;
}
const QUERIES = [
    'veolia', 'veolia careers', 'veolia sustainability', 'veolia water solutions', 'veolia waste management',
    'enterprise analytics platform', 'digital performance dashboard', 'data intelligence software', 'sustainability analytics', 'marketing intelligence platform', 'web analytics enterprise', 'employee advocacy platform', 'social analytics dashboard', 'campaign performance analytics', 'content performance tool', 'analytics reporting software', 'conversion optimisation platform', 'digital strategy dashboard', 'SEO reporting platform', 'website performance analytics'
];
export function generateSearchQueries() {
    const rows = [];
    let id = 0;
    for (const m of MARKETS) {
        QUERIES.forEach((query, i) => {
            const r = new Rng(`query:${m.id}:${i}`);
            const position = r.range(2.8, 18.5);
            const impressions = Math.round(r.range(6000, 78000) * m.weight * 3.2);
            const ctr = Math.max(0.009, Math.min(0.14, 0.13 * Math.exp(-position / 7.8) * r.noise(0.14)));
            const clicks = Math.round(impressions * ctr);
            const conversions = Math.min(clicks, Math.round(clicks * r.range(0.018, 0.07)));
            const branded = query.toLowerCase().includes('veolia');
            rows.push({ id: `q-${++id}`, query, branded, market: m.id, clicks, impressions, position, landingPage: LANDING_PAGES[(i + MARKETS.indexOf(m)) % LANDING_PAGES.length].path, conversions });
        });
    }
    return rows;
}
export const seoFacts = generateSeoFacts();
export const searchQueries = generateSearchQueries();
export const technicalHealth = {
    lcp: 2.1,
    inp: 168,
    cls: 0.07,
    brokenLinks: 14,
    errors404: 87,
    errors5xx: 9,
    redirectErrors: 18,
    crawlIssues: 24,
    indexedPages: 1842,
    mobileIssues: 7,
};
