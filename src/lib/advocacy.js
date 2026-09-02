import { advocacyFacts, advocates } from '/src/data/advocacy.js';
const zero = () => ({ registered: 0, active: 0, posts: 0, reach: 0, impressions: 0, engagements: 0, clicks: 0, sessions: 0, conversions: 0 });
export function advocacyTotals(q, programs = [], groups = []) {
    const t = zero();
    const registeredKeys = new Set();
    for (const f of advocacyFacts) {
        if (f.d < q.from || f.d > q.to)
            continue;
        if (q.markets.length && !q.markets.includes(f.market))
            continue;
        if (programs.length && !programs.includes(f.program))
            continue;
        if (groups.length && !groups.includes(f.group))
            continue;
        const k = `${f.market}:${f.program}:${f.group}`;
        if (!registeredKeys.has(k)) {
            t.registered += f.registered;
            registeredKeys.add(k);
        }
        t.active += f.active;
        t.posts += f.posts;
        t.reach += f.reach;
        t.impressions += f.impressions;
        t.engagements += f.engagements;
        t.clicks += f.clicks;
        t.sessions += f.sessions;
        t.conversions += f.conversions;
    }
    const days = Math.max(1, q.to - q.from + 1);
    t.active = Math.round(t.active / days);
    return t;
}
export function advocacyBy(q, key, programs = [], groups = []) {
    const out = new Map();
    const reg = new Map();
    for (const f of advocacyFacts) {
        if (f.d < q.from || f.d > q.to)
            continue;
        if (q.markets.length && !q.markets.includes(f.market))
            continue;
        if (programs.length && !programs.includes(f.program))
            continue;
        if (groups.length && !groups.includes(f.group))
            continue;
        const k = key === 'day' ? f.d : f[key];
        let t = out.get(k);
        if (!t)
            out.set(k, t = zero());
        let rs = reg.get(k);
        if (!rs)
            reg.set(k, rs = new Set());
        const rk = `${f.market}:${f.program}:${f.group}`;
        if (!rs.has(rk)) {
            t.registered += f.registered;
            rs.add(rk);
        }
        t.active += f.active;
        t.posts += f.posts;
        t.reach += f.reach;
        t.impressions += f.impressions;
        t.engagements += f.engagements;
        t.clicks += f.clicks;
        t.sessions += f.sessions;
        t.conversions += f.conversions;
    }
    if (key !== 'day') {
        const days = Math.max(1, q.to - q.from + 1);
        for (const t of out.values())
            t.active = Math.round(t.active / days);
    }
    return out;
}
export function topAdvocates(q, groups = []) {
    const markets = q.markets;
    const periodShare = Math.max(0.08, Math.min(1, (q.to - q.from + 1) / 90));
    return advocates.filter(a => (!markets.length || markets.includes(a.market)) && (!groups.length || groups.includes(a.group))).map(a => ({
        ...a,
        posts: Math.max(1, Math.round(a.posts * periodShare)),
        reach: Math.round(a.reach * periodShare),
        impressions: Math.round((a.impressions ?? a.reach) * periodShare),
        engagements: Math.round(a.engagements * periodShare),
        clicks: Math.round(a.clicks * periodShare),
        sessions: Math.round(a.sessions * periodShare),
        conversions: Math.round(a.conversions * periodShare),
    })).sort((a, b) => b.reach - a.reach);
}
