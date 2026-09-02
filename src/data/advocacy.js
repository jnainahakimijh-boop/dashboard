import { DAYS, MARKETS, WEEKDAY_FACTOR, weekdayOf } from '/src/data/dimensions.js';
import { dayRng, Rng } from '/src/data/random.js';
export const ADVOCACY_PROGRAMS = [
    { id: 'ambassadors', name: 'Employee Ambassadors', nameFr: 'Ambassadeurs collaborateurs', weight: 0.48 },
    { id: 'experts', name: 'Subject Matter Experts', nameFr: 'Experts métiers', weight: 0.34 },
    { id: 'leaders', name: 'Leadership Voices', nameFr: 'Voix dirigeantes', weight: 0.18 },
];
export const ADVOCATE_GROUPS = [
    { id: 'operations', name: 'Operations', nameFr: 'Opérations', weight: 0.31 },
    { id: 'engineering', name: 'Engineering', nameFr: 'Ingénierie', weight: 0.29 },
    { id: 'commercial', name: 'Commercial', nameFr: 'Commercial', weight: 0.22 },
    { id: 'corporate', name: 'Corporate', nameFr: 'Corporate', weight: 0.18 },
];
const MARKET_REGISTERED = { fr: 310, us: 270, uk: 190, de: 175, es: 120, pl: 105 };
export function generateAdvocacyFacts() {
    const out = [];
    for (let d = 0; d < DAYS; d++) {
        const wf = 0.68 + 0.32 * WEEKDAY_FACTOR[weekdayOf(d)];
        const adoption = 0.72 + d / DAYS * 0.18;
        for (const m of MARKETS) {
            for (const p of ADVOCACY_PROGRAMS) {
                for (const g of ADVOCATE_GROUPS) {
                    const r = dayRng(`adv:${m.id}:${p.id}:${g.id}`, d);
                    const registered = Math.max(3, Math.round(MARKET_REGISTERED[m.id] * p.weight * g.weight));
                    const activeRate = Math.min(0.78, (0.27 + p.weight * 0.3 + m.growth * 18) * adoption * r.noise(0.08));
                    const active = Math.min(registered, Math.max(0, Math.round(registered * activeRate)));
                    const posts = Math.max(0, Math.round(active * r.range(0.1, 0.2) * wf));
                    const reachPerPost = p.id === 'leaders' ? r.range(1800, 3200) : p.id === 'experts' ? r.range(900, 1700) : r.range(650, 1250);
                    const reach = Math.round(posts * reachPerPost * r.noise(0.13));
                    const impressions = Math.max(reach, Math.round(reach * r.range(1.18, 1.55)));
                    const er = p.id === 'experts' ? r.range(0.042, 0.071) : p.id === 'leaders' ? r.range(0.031, 0.055) : r.range(0.027, 0.05);
                    const engagements = Math.min(impressions, Math.round(impressions * er));
                    const ctr = p.id === 'experts' ? r.range(0.016, 0.029) : r.range(0.009, 0.019);
                    const clicks = Math.min(impressions, Math.round(impressions * ctr));
                    const sessions = Math.min(clicks, Math.round(clicks * r.range(0.72, 0.9)));
                    const conversions = Math.min(sessions, Math.round(sessions * r.range(0.018, 0.055)));
                    out.push({ d, market: m.id, program: p.id, group: g.id, registered, active, posts, reach, impressions, engagements, clicks, sessions, conversions });
                }
            }
        }
    }
    return out;
}
const FIRST = ['Alex', 'Sam', 'Jordan', 'Camille', 'Taylor', 'Morgan', 'Chris', 'Nora', 'Robin', 'Jamie', 'Maya', 'Leo', 'Sofia', 'Noah', 'Lina', 'Owen', 'Emma', 'Lucas', 'Mila', 'Daniel', 'Eva', 'Theo', 'Sara', 'Adam'];
const LAST = ['Martin', 'Bernard', 'Wilson', 'Clark', 'Meyer', 'Schmidt', 'Taylor', 'Brown', 'Dubois', 'Moreau', 'Garcia', 'Lopez', 'Walker', 'Hall', 'King', 'Young', 'Allen', 'Scott', 'Green', 'Baker', 'Hill', 'Moore', 'Wright', 'Lewis'];
export function generateAdvocates() {
    return FIRST.map((first, i) => {
        const r = new Rng(`advocate:${i}`);
        const market = MARKETS[i % MARKETS.length].id;
        const program = ADVOCACY_PROGRAMS[i % ADVOCACY_PROGRAMS.length].id;
        const group = ADVOCATE_GROUPS[(i * 3) % ADVOCATE_GROUPS.length].id;
        const posts = r.int(8, 46);
        const reach = Math.round(posts * r.range(850, 3600));
        // impressions ≥ reach, matching the methodology used for the daily facts,
        // so engagement rate is always engagements ÷ impressions everywhere.
        const impressions = Math.max(reach, Math.round(reach * r.range(1.18, 1.55)));
        const engagements = Math.min(impressions, Math.round(impressions * r.range(0.027, 0.062)));
        const clicks = Math.min(impressions, Math.round(impressions * r.range(0.009, 0.026)));
        const sessions = Math.min(clicks, Math.round(clicks * r.range(0.75, 0.92)));
        const conversions = Math.min(sessions, Math.round(sessions * r.range(0.018, 0.075)));
        return { id: `adv-${i + 1}`, name: `${first} ${LAST[i]}`, department: ADVOCATE_GROUPS.find(x => x.id === group).name, market, program, group, posts, reach, impressions, engagements, clicks, sessions, conversions };
    }).sort((a, b) => b.reach - a.reach);
}
export const advocacyFacts = generateAdvocacyFacts();
export const advocates = generateAdvocates();
