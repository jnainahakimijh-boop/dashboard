import { CHANNELS, DAYS, DEVICES, FORMATS, LANDING_PAGES, MARKETS, PLATFORMS, THEMES, WEEKDAY_FACTOR, weekdayOf } from '/src/data/dimensions.js';
import { CAMPAIGN_DEFS } from '/src/data/campaigns.js';
import { Rng, dayRng } from '/src/data/random.js';
/** ------------------------------------------------------------------
 *  Synthetic dataset generator.
 *
 *  Cross-table attribution rules (documented, tested):
 *  1. Web "Social" channel sessions are derived from social platform
 *     clicks (click-through modelled at ~82%) — so social clicks and
 *     social-channel sessions reconcile.
 *  2. Campaign delivery is a subset of the Paid Media channel: paid
 *     sessions = campaign sessions + always-on paid base.
 *  3. Landing-page sessions are a distribution of total web sessions
 *     per market/day — page totals reconcile with web totals.
 *  4. X (platform) has a simulated collection outage on the three
 *     most recent days minus ~12 (missing rows, not zeros) — this is
 *     surfaced on the Data Quality page and appears as a gap in charts.
 *  ------------------------------------------------------------------ */
/** Base daily sessions (global, all non-social/non-paid channels combined scale). */
const BASE_SESSIONS = 9200;
/** Always-on paid sessions per day (global) on top of campaign traffic. */
const PAID_BASE = 340;
export const SOCIAL_TO_SESSION = 0.82;
/** Days with a simulated X data-collection outage (missing, not zero). */
export const X_OUTAGE_DAYS = [DAYS - 14, DAYS - 13, DAYS - 12];
function ramp(d, startD) {
    const age = d - startD;
    return age >= 5 ? 1 : 0.5 + 0.1 * age;
}
export function generateDataset() {
    const social = [];
    const campaignFacts = [];
    const web = [];
    const pages = [];
    /* ---------------- social ---------------- */
    // social clicks per (day, market) — feeds web social channel
    const socialClicks = new Map();
    for (let d = 0; d < DAYS; d++) {
        const wf = 0.55 + 0.45 * WEEKDAY_FACTOR[weekdayOf(d)]; // social dips less on weekends
        for (const p of PLATFORMS) {
            if (p.id === 'x' && X_OUTAGE_DAYS.includes(d))
                continue; // simulated outage: rows absent
            const growth = Math.pow(1 + p.growth, d);
            for (const m of MARKETS) {
                const r = dayRng(`soc:${p.id}:${m.id}`, d);
                let impressions = p.baseImpressions * m.weight * wf * growth * r.noise(0.16);
                // occasional viral post (mostly LinkedIn / Instagram)
                if ((p.id === 'linkedin' || p.id === 'instagram') && r.f() < 0.02) {
                    impressions *= r.range(1.9, 3.2);
                }
                impressions = Math.round(impressions);
                const reach = Math.round(impressions * r.range(0.58, 0.75));
                const engagements = Math.min(impressions, Math.round(impressions * p.engagementRate * r.noise(0.2)));
                const reactions = Math.round(engagements * r.range(0.74, 0.82));
                const comments = Math.round((engagements - reactions) * r.range(0.45, 0.6));
                const shares = engagements - reactions - comments;
                const clicks = Math.min(impressions, Math.round(impressions * p.ctr * r.noise(0.15)));
                const videoViews = p.hasVideo ? Math.round(impressions * r.range(0.16, 0.3)) : 0;
                const video25 = p.hasVideo ? Math.round(videoViews * r.range(0.68, 0.84)) : 0;
                const video50 = p.hasVideo ? Math.round(video25 * r.range(0.7, 0.87)) : 0;
                const video75 = p.hasVideo ? Math.round(video50 * r.range(0.65, 0.82)) : 0;
                const videoComplete = p.hasVideo ? Math.round(video75 * r.range(0.55, 0.76)) : 0;
                const watchBase = p.id === 'youtube' ? 44 : p.id === 'linkedin' ? 28 : p.id === 'instagram' ? 20 : 16;
                const videoWatchSeconds = p.hasVideo ? Math.round(videoViews * watchBase * r.noise(0.12)) : 0;
                const followerNet = Math.round((p.id === 'x' ? r.range(-14, 8) : r.range(2, 30)) * m.weight * 6);
                social.push({ d, platform: p.id, market: m.id, impressions, reach, reactions, comments, shares, clicks, videoViews, video25, video50, video75, videoComplete, videoWatchSeconds, followerNet });
                const k = `${d}:${m.id}`;
                socialClicks.set(k, (socialClicks.get(k) ?? 0) + clicks);
            }
        }
    }
    /* ---------------- campaigns ---------------- */
    // campaign sessions per (day, market) — feeds web paid channel
    const campaignSessions = new Map();
    const campaignConversions = new Map();
    for (const c of CAMPAIGN_DEFS) {
        if (c.status === 'planned')
            continue;
        const end = Math.min(c.endD, DAYS - 1);
        const mWeightSum = c.markets.reduce((s, id) => s + (MARKETS.find((m) => m.id === id)?.weight ?? 0), 0);
        for (let d = c.startD; d <= end; d++) {
            const r = dayRng(`cmp:${c.id}`, d);
            const wf = WEEKDAY_FACTOR[weekdayOf(d)];
            const spend = Math.round(c.dailyBudget * ramp(d, c.startD) * (0.75 + 0.25 * wf) * r.noise(0.12) * 100) / 100;
            const impressions = Math.round((spend / c.cpm) * 1000);
            const clicks = Math.min(impressions, Math.round(impressions * c.ctr * r.noise(0.1)));
            const sessions = Math.min(clicks, Math.round(clicks * 0.85 * r.noise(0.04)));
            const conversions = Math.min(sessions, Math.round(sessions * c.cvr * r.noise(0.28)));
            campaignFacts.push({ d, campaign: c.id, impressions, clicks, sessions, conversions, spend });
            // distribute campaign traffic across its markets by weight
            for (const mid of c.markets) {
                const mw = (MARKETS.find((m) => m.id === mid)?.weight ?? 0) / mWeightSum;
                const k = `${d}:${mid}`;
                campaignSessions.set(k, (campaignSessions.get(k) ?? 0) + sessions * mw);
                campaignConversions.set(k, (campaignConversions.get(k) ?? 0) + conversions * mw);
            }
        }
    }
    /* ---------------- web ---------------- */
    const webTotalByDayMarket = new Map();
    for (let d = 0; d < DAYS; d++) {
        const wf = WEEKDAY_FACTOR[weekdayOf(d)];
        for (const m of MARKETS) {
            const k = `${d}:${m.id}`;
            for (const c of CHANNELS) {
                let channelSessions;
                const r = dayRng(`web:${c.id}:${m.id}`, d);
                if (c.id === 'social') {
                    channelSessions = Math.floor((socialClicks.get(k) ?? 0) * SOCIAL_TO_SESSION * Math.min(1 / SOCIAL_TO_SESSION - 0.01, r.noise(0.05)));
                }
                else if (c.id === 'paid') {
                    const cmp = campaignSessions.get(k) ?? 0;
                    const base = PAID_BASE * m.weight * wf * r.noise(0.14);
                    channelSessions = Math.round(cmp + base);
                }
                else {
                    const growth = Math.pow(1 + c.growth + m.growth, d);
                    channelSessions = Math.round(BASE_SESSIONS * c.weight * m.weight * wf * growth * r.noise(0.11));
                }
                // split across devices
                let remaining = channelSessions;
                for (let di = 0; di < DEVICES.length; di++) {
                    const dev = DEVICES[di];
                    const last = di === DEVICES.length - 1;
                    const rr = dayRng(`web:${c.id}:${m.id}:${dev.id}`, d);
                    const sessions = last ? remaining : Math.min(remaining, Math.round(channelSessions * dev.weight * rr.noise(0.05)));
                    remaining -= sessions;
                    if (sessions <= 0) {
                        continue;
                    }
                    const users = Math.max(1, Math.min(sessions, Math.round(sessions * rr.range(0.72, 0.86))));
                    const newShare = c.id === 'paid' || c.id === 'social' ? rr.range(0.55, 0.72) : c.id === 'direct' || c.id === 'email' ? rr.range(0.18, 0.32) : rr.range(0.36, 0.52);
                    const newUsers = Math.min(users, Math.round(users * newShare));
                    const engaged = Math.min(sessions, Math.round(sessions * Math.min(0.92, c.engagedRate * dev.engFactor * rr.noise(0.06))));
                    let conversions = Math.min(engaged, Math.round(engaged * c.convOfEngaged * dev.convFactor * rr.noise(0.3)));
                    // fold campaign conversions into paid channel so campaign CVR reconciles with channel CVR
                    if (c.id === 'paid' && di === 1) {
                        const cc = campaignConversions.get(k) ?? 0;
                        conversions = Math.min(engaged, Math.round(conversions * 0.4 + cc * 0.55));
                    }
                    const engTime = Math.round(sessions * c.avgEngSec * dev.engFactor * rr.noise(0.09));
                    web.push({ d, market: m.id, channel: c.id, device: dev.id, sessions, users, newUsers, engaged, conversions, engTime });
                }
                webTotalByDayMarket.set(k, (webTotalByDayMarket.get(k) ?? 0) + channelSessions);
            }
        }
    }
    /* ---------------- landing pages ---------------- */
    const PAGE_WEIGHTS = {
        '/': { w: 0.22, engaged: 0.55, cvr: 0.012 },
        '/products/analytics-suite': { w: 0.13, engaged: 0.62, cvr: 0.03 },
        '/products/data-platform': { w: 0.09, engaged: 0.6, cvr: 0.027 },
        '/solutions/enterprise': { w: 0.1, engaged: 0.64, cvr: 0.034 },
        '/solutions/public-sector': { w: 0.06, engaged: 0.61, cvr: 0.024 },
        '/pricing': { w: 0.07, engaged: 0.68, cvr: 0.085 },
        '/customers': { w: 0.05, engaged: 0.66, cvr: 0.018 },
        '/resources/blog': { w: 0.11, engaged: 0.51, cvr: 0.006 },
        '/resources/whitepapers': { w: 0.05, engaged: 0.7, cvr: 0.065 },
        '/careers': { w: 0.06, engaged: 0.63, cvr: 0.041 },
        '/events/annual-summit': { w: 0.03, engaged: 0.65, cvr: 0.048 },
        '/contact': { w: 0.03, engaged: 0.72, cvr: 0.14 },
    };
    for (let d = 0; d < DAYS; d++) {
        for (const m of MARKETS) {
            const total = webTotalByDayMarket.get(`${d}:${m.id}`) ?? 0;
            if (total <= 0)
                continue;
            // noisy weights normalised to 1 so page sessions sum to the web total
            const noisy = LANDING_PAGES.map((p) => PAGE_WEIGHTS[p.path].w * dayRng(`pg:${p.path}:${m.id}`, d).noise(0.13));
            const wSum = noisy.reduce((a, b) => a + b, 0);
            let assigned = 0;
            LANDING_PAGES.forEach((p, i) => {
                const last = i === LANDING_PAGES.length - 1;
                const sessions = last ? total - assigned : Math.round((total * noisy[i]) / wSum);
                assigned += sessions;
                if (sessions <= 0)
                    return;
                const cfg = PAGE_WEIGHTS[p.path];
                const r = dayRng(`pgm:${p.path}:${m.id}`, d);
                const users = Math.max(1, Math.min(sessions, Math.round(sessions * r.range(0.74, 0.87))));
                const engaged = Math.min(sessions, Math.round(sessions * Math.min(0.93, cfg.engaged * r.noise(0.07))));
                const conversions = Math.min(engaged, Math.round(sessions * cfg.cvr * r.noise(0.3)));
                const ctaClicks = Math.min(engaged, Math.max(conversions, Math.round(engaged * r.range(0.08, 0.22))));
                const formStarts = Math.min(ctaClicks, Math.max(conversions, Math.round(ctaClicks * r.range(0.34, 0.64))));
                const formCompletions = Math.min(formStarts, conversions);
                pages.push({ d, page: p.path, market: m.id, sessions, users, engaged, ctaClicks, formStarts, formCompletions, conversions });
            });
        }
    }
    /* ---------------- content ---------------- */
    const content = generateContent();
    return { web, social, campaignFacts, pages, content };
}
const CONTENT_TITLES = {
    sustainability: [
        ['Inside our 2030 decarbonisation roadmap', 'Notre feuille de route décarbonation 2030'],
        ['Circular economy: what we learned this year', "Économie circulaire : les enseignements de l'année"],
        ['How our teams cut site emissions by a third', 'Comment nos équipes ont réduit les émissions d’un tiers'],
        ['Water stewardship in practice', "La gestion responsable de l'eau en pratique"],
        ['Sustainability report — key figures', 'Rapport développement durable — chiffres clés'],
        ['Five questions on our net-zero pathway', 'Cinq questions sur notre trajectoire net-zéro'],
        ['Biodiversity commitments: one year on', 'Engagements biodiversité : un an après'],
        ['The business case for greener operations', "L'argument économique d'opérations plus vertes"],
    ],
    innovation: [
        ['Predictive maintenance with edge AI', "Maintenance prédictive grâce à l'IA embarquée"],
        ['Our R&D lab opens its doors', 'Notre laboratoire R&D ouvre ses portes'],
        ['Digital twins for industrial sites', 'Jumeaux numériques pour sites industriels'],
        ['Three patents that changed our industry', "Trois brevets qui ont changé notre secteur"],
        ['Data platform architecture, explained', 'Architecture de la plateforme data, expliquée'],
        ['From analytics foundation to production in 90 days', 'De la fondation analytique à la production en 90 jours'],
        ['Machine learning at industrial scale', "Le machine learning à l'échelle industrielle"],
    ],
    careers: [
        ['Meet the engineers behind Meridian', 'Rencontrez les ingénieurs derrière Meridian'],
        ['A day with our field operations team', 'Une journée avec nos équipes terrain'],
        ['Graduate programme — applications open', 'Programme jeunes diplômés — candidatures ouvertes'],
        ['Why I moved from finance to operations', "Pourquoi j'ai quitté la finance pour les opérations"],
        ['Our apprenticeship class of 2026', 'Notre promotion d’alternants 2026'],
        ['Women in engineering: three journeys', "Femmes ingénieures : trois parcours"],
        ['Life at our Warsaw hub', 'La vie dans notre hub de Varsovie'],
    ],
    product: [
        ['Meridian Platform: launch overview', 'Plateforme Meridian : présentation du lancement'],
        ['Analytics Suite 4.2 release notes', 'Notes de version Analytics Suite 4.2'],
        ['Customer webinar: getting started', 'Webinaire client : bien démarrer'],
        ['Enterprise deployment guide', "Guide de déploiement entreprise"],
        ['Product roadmap — H2 2026', 'Feuille de route produit — S2 2026'],
        ['Benchmark: performance at scale', 'Benchmark : la performance à grande échelle'],
    ],
    'thought-leadership': [
        ['CEO perspective: the decade of data', 'Vision du PDG : la décennie de la donnée'],
        ['Perspectives #12 — regulation and growth', 'Perspectives n°12 — régulation et croissance'],
        ['Whitepaper: resilient supply chains', 'Livre blanc : chaînes d’approvisionnement résilientes'],
        ['Op-ed: infrastructure needs software', "Tribune : l'infrastructure a besoin de logiciel"],
        ['Annual outlook 2026', 'Perspectives annuelles 2026'],
        ['Panel replay: financing the transition', 'Replay : financer la transition'],
    ],
    community: [
        ['Annual Summit 2026 — save the date', 'Sommet annuel 2026 — réservez la date'],
        ['Volunteering week in numbers', 'La semaine du bénévolat en chiffres'],
        ['Partner spotlight: Nordics', 'Partenaire à l’honneur : pays nordiques'],
        ['Community grant winners announced', 'Lauréats des bourses communautaires'],
        ['Hackathon highlights', 'Temps forts du hackathon'],
    ],
};
function generateContent() {
    // A realistic communication portfolio needs enough content in every normal
    // analysis window. Generate three deterministic items per day so a 30-day
    // selection contains ~90 posts rather than one or two isolated records.
    const items = [];
    let id = 0;
    for (let d = 0; d < DAYS; d++) {
        for (let slot = 0; slot < 3; slot++) {
            const r = new Rng(`content:${d}:${slot}`);
            const theme = THEMES[(d + slot * 2 + r.int(0, THEMES.length - 1)) % THEMES.length];
            const titles = CONTENT_TITLES[theme.id] || CONTENT_TITLES.sustainability;
            const titlePair = titles[(d + slot + r.int(0, titles.length - 1)) % titles.length];

            // LinkedIn is intentionally the largest corporate channel, while
            // Instagram and YouTube still receive substantial volume.
            const platformRoll = r.f();
            const platform = platformRoll < 0.46 ? PLATFORMS.find((p) => p.id === 'linkedin')
                : platformRoll < 0.70 ? PLATFORMS.find((p) => p.id === 'instagram')
                : platformRoll < 0.90 ? PLATFORMS.find((p) => p.id === 'youtube')
                : PLATFORMS.find((p) => p.id === 'x');

            let format;
            if (platform.id === 'youtube') format = FORMATS.find((f) => f.id === 'video');
            else if (platform.id === 'instagram' && r.f() < 0.42) format = FORMATS.find((f) => f.id === 'video');
            else format = FORMATS[r.int(0, FORMATS.length - 1)];

            const market = MARKETS[(d + slot + r.int(0, MARKETS.length - 1)) % MARKETS.length];
            const scale = r.range(0.55, 2.15) * (r.f() < 0.035 ? r.range(1.8, 2.8) : 1);
            const impressions = Math.max(650, Math.round(platform.baseImpressions * 0.31 * format.reachFactor * scale));
            const er = Math.min(0.16, Math.max(0.006, platform.engagementRate * theme.erFactor * format.erFactor * r.noise(0.22)));
            const engagements = Math.min(impressions, Math.round(impressions * er));
            const reactions = Math.round(engagements * r.range(0.70, 0.82));
            const comments = Math.round((engagements - reactions) * r.range(0.38, 0.58));
            const shares = Math.max(0, engagements - reactions - comments);

            const clickFactor = (format.id === 'article' || format.id === 'document') ? 1.55 : (format.id === 'video' ? 1.1 : 1);
            const clicks = Math.min(impressions, Math.max(8, Math.round(impressions * platform.ctr * clickFactor * r.noise(0.22))));
            const sessions = Math.min(clicks, Math.round(clicks * r.range(0.76, 0.91)));
            const conversions = Math.min(sessions, Math.round(sessions * r.range(0.012, 0.055)));

            const clicks24h = Math.round(clicks * r.range(0.35, 0.50));
            const clicks7d = Math.max(clicks24h, Math.round(clicks * r.range(0.64, 0.79)));
            const clicks30d = Math.max(clicks7d, Math.round(clicks * r.range(0.84, 0.95)));
            const clicks90d = Math.max(clicks30d, clicks);
            const utmTagged = r.f() > 0.075;
            const titleSuffix = slot === 0 ? '' : slot === 1 ? ' — Update' : ' — Insight';
            const titleSuffixFr = slot === 0 ? '' : slot === 1 ? ' — Mise à jour' : ' — Éclairage';

            items.push({
                id: `ct-${++id}`,
                title: `${titlePair[0]}${titleSuffix}`,
                titleFr: `${titlePair[1]}${titleSuffixFr}`,
                platform: platform.id,
                theme: theme.id,
                format: format.id,
                market: market.id,
                lang: market.lang,
                publishD: d,
                impressions,
                reactions,
                comments,
                shares,
                clicks,
                sessions,
                clicks24h,
                clicks7d,
                clicks30d,
                clicks90d,
                utmTagged,
                conversions,
            });
        }
    }
    return items.sort((a, b) => a.publishD - b.publishD || a.id.localeCompare(b.id));
}
