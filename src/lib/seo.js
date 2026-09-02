import { searchQueries, seoFacts } from '/src/data/seo.js';
export function seoTotals(q) {
    let impressions = 0, clicks = 0, brandedImpressions = 0, nonBrandedImpressions = 0, brandedClicks = 0, nonBrandedClicks = 0, keywords = 0, conversions = 0, weighted = 0;
    let days = 0;
    for (const f of seoFacts) {
        if (f.d < q.from || f.d > q.to)
            continue;
        if (q.markets.length && !q.markets.includes(f.market))
            continue;
        impressions += f.impressions;
        clicks += f.clicks;
        brandedImpressions += f.brandedImpressions ?? 0;
        nonBrandedImpressions += f.nonBrandedImpressions ?? 0;
        brandedClicks += f.brandedClicks ?? 0;
        nonBrandedClicks += f.nonBrandedClicks ?? 0;
        conversions += f.conversions;
        weighted += f.positionWeighted;
        keywords += f.rankingKeywords;
        days++;
    }
    return { impressions, clicks, brandedImpressions, nonBrandedImpressions, brandedClicks, nonBrandedClicks, conversions, rankingKeywords: days ? Math.round(keywords / days) : 0, avgPosition: impressions ? weighted / impressions : null };
}
export function seoBy(q, key) {
    const out = new Map();
    for (const f of seoFacts) {
        if (f.d < q.from || f.d > q.to)
            continue;
        if (q.markets.length && !q.markets.includes(f.market))
            continue;
        const k = key === 'day' ? f.d : f.market;
        let t = out.get(k);
        if (!t)
            out.set(k, t = { impressions: 0, clicks: 0, brandedImpressions: 0, nonBrandedImpressions: 0, brandedClicks: 0, nonBrandedClicks: 0, rankingKeywords: 0, conversions: 0, weighted: 0, days: 0 });
        t.impressions += f.impressions;
        t.clicks += f.clicks;
        t.brandedImpressions += f.brandedImpressions ?? 0;
        t.nonBrandedImpressions += f.nonBrandedImpressions ?? 0;
        t.brandedClicks += f.brandedClicks ?? 0;
        t.nonBrandedClicks += f.nonBrandedClicks ?? 0;
        t.rankingKeywords += f.rankingKeywords;
        t.conversions += f.conversions;
        t.weighted += f.positionWeighted;
        t.days++;
    }
    return new Map([...out.entries()].map(([k, t]) => [k, { impressions: t.impressions, clicks: t.clicks, brandedImpressions: t.brandedImpressions, nonBrandedImpressions: t.nonBrandedImpressions, brandedClicks: t.brandedClicks, nonBrandedClicks: t.nonBrandedClicks, rankingKeywords: Math.round(t.rankingKeywords / Math.max(1, t.days)), conversions: t.conversions, avgPosition: t.impressions ? t.weighted / t.impressions : null }]));
}
export function filteredQueries(q) {
    return searchQueries.filter(r => !q.markets.length || q.markets.includes(r.market));
}
