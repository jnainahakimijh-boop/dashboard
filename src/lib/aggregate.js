import { dataset } from '/src/data/index.js';
import { CAMPAIGN_DEFS } from '/src/data/campaigns.js';
import { MARKETS, dateToDay, dayToDate } from '/src/data/dimensions.js';
export function toQ(f) {
    const scopedMarkets = MARKETS.filter((m) => (f.regions.length === 0 || f.regions.includes(m.region)) &&
        (f.languages.length === 0 || f.languages.includes(m.lang))).map((m) => m.id);
    const markets = f.markets.length === 0 ? (f.regions.length || f.languages.length ? scopedMarkets : []) : f.markets.filter((m) => scopedMarkets.includes(m));
    return {
        from: f.from,
        to: f.to,
        markets,
        channels: f.channels,
        platforms: f.platforms,
        devices: f.devices,
        campaigns: f.campaigns,
        themes: f.themes,
        formats: f.formats,
    };
}
/** Previous period of identical length, immediately before the range. */
export function prevQ(q) {
    const len = q.to - q.from + 1;
    return { ...q, from: q.from - len, to: q.from - 1 };
}
function shiftCalendar(date, months, years) {
    const sourceDay = date.getUTCDate();
    const y = date.getUTCFullYear() + years;
    const m = date.getUTCMonth() + months;
    const first = new Date(Date.UTC(y, m, 1));
    const lastOfTarget = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(sourceDay, lastOfTarget)));
}
/** Resolve the comparison range selected in the global filter bar. */
export function comparisonQ(q, mode) {
    if (mode === 'none')
        return q;
    if (mode === 'previous')
        return prevQ(q);
    if (mode === 'previous-year') {
        const len = q.to - q.from + 1;
        return { ...q, from: q.from - 365, to: q.from - 365 + len - 1 };
    }
    const months = mode === 'previous-month' ? -1 : mode === 'previous-quarter' ? -3 : 0;
    const years = mode === 'same-period-last-year' ? -1 : 0;
    const from = dateToDay(shiftCalendar(dayToDate(q.from), months, years));
    const to = dateToDay(shiftCalendar(dayToDate(q.to), months, years));
    return { ...q, from, to };
}
const ZERO_WEB = { sessions: 0, users: 0, newUsers: 0, engaged: 0, conversions: 0, engTime: 0 };
const ZERO_SOCIAL = { impressions: 0, reach: 0, reactions: 0, comments: 0, shares: 0, engagements: 0, clicks: 0, videoViews: 0, video25: 0, video50: 0, video75: 0, videoComplete: 0, videoWatchSeconds: 0, followerNet: 0 };
const ZERO_CAMPAIGN = { impressions: 0, clicks: 0, sessions: 0, conversions: 0, spend: 0 };
/* small memo cache — selectors are pure over the static dataset */
const cache = new Map();
function memo(key, compute) {
    if (cache.has(key))
        return cache.get(key);
    if (cache.size > 400)
        cache.clear();
    const v = compute();
    cache.set(key, v);
    return v;
}
const inSet = (arr, v) => arr.length === 0 || arr.includes(v);
function qKey(q) {
    return [q.from, q.to, q.markets.join(','), q.channels.join(','), q.platforms.join(','), q.devices.join(','), q.campaigns.join(','), q.themes.join(','), q.formats.join(',')].join('|');
}
/* ---------------- web ---------------- */
function webMatch(q) {
    return (f) => f.d >= q.from && f.d <= q.to && inSet(q.markets, f.market) && inSet(q.channels, f.channel) && inSet(q.devices, f.device);
}
function addWeb(t, f) {
    t.sessions += f.sessions;
    t.users += f.users;
    t.newUsers += f.newUsers;
    t.engaged += f.engaged;
    t.conversions += f.conversions;
    t.engTime += f.engTime;
}
export function webTotals(q) {
    return memo(`wt:${qKey(q)}`, () => {
        const t = { ...ZERO_WEB };
        const match = webMatch(q);
        for (const f of dataset.web)
            if (match(f))
                addWeb(t, f);
        return t;
    });
}
export function webBy(q, key) {
    return memo(`wb:${key}:${qKey(q)}`, () => {
        const out = new Map();
        const match = webMatch(q);
        for (const f of dataset.web) {
            if (!match(f))
                continue;
            const k = key === 'day' ? f.d : f[key === 'channel' ? 'channel' : key === 'market' ? 'market' : 'device'];
            let t = out.get(k);
            if (!t)
                out.set(k, (t = { ...ZERO_WEB }));
            addWeb(t, f);
        }
        return out;
    });
}
/* ---------------- social ---------------- */
function socialMatch(q) {
    return (f) => f.d >= q.from && f.d <= q.to && inSet(q.markets, f.market) && inSet(q.platforms, f.platform);
}
function addSocial(t, f) {
    t.impressions += f.impressions;
    t.reach += f.reach;
    t.reactions += f.reactions;
    t.comments += f.comments;
    t.shares += f.shares;
    t.engagements += f.reactions + f.comments + f.shares;
    t.clicks += f.clicks;
    t.videoViews += f.videoViews;
    t.video25 += f.video25 ?? 0;
    t.video50 += f.video50 ?? 0;
    t.video75 += f.video75 ?? 0;
    t.videoComplete += f.videoComplete ?? 0;
    t.videoWatchSeconds += f.videoWatchSeconds ?? 0;
    t.followerNet += f.followerNet;
}
export function socialTotals(q) {
    return memo(`st:${qKey(q)}`, () => {
        const t = { ...ZERO_SOCIAL };
        const match = socialMatch(q);
        for (const f of dataset.social)
            if (match(f))
                addSocial(t, f);
        return t;
    });
}
export function socialBy(q, key) {
    return memo(`sb:${key}:${qKey(q)}`, () => {
        const out = new Map();
        const match = socialMatch(q);
        for (const f of dataset.social) {
            if (!match(f))
                continue;
            const k = key === 'day' ? f.d : key === 'platform' ? f.platform : f.market;
            let t = out.get(k);
            if (!t)
                out.set(k, (t = { ...ZERO_SOCIAL }));
            addSocial(t, f);
        }
        return out;
    });
}
/** Days in range where a platform has no rows at all (collection gaps).
 *  Missing days must stay missing — they are never rendered as zero. */
export function socialMissingDays(q, platform) {
    return memo(`smd:${platform}:${q.from}:${q.to}`, () => {
        const present = new Set();
        for (const f of dataset.social)
            if (f.platform === platform && f.d >= q.from && f.d <= q.to)
                present.add(f.d);
        const missing = [];
        for (let d = Math.max(0, q.from); d <= q.to; d++)
            if (!present.has(d))
                missing.push(d);
        return missing;
    });
}
/* ---------------- campaigns ---------------- */
function campaignAllowed(q) {
    const allowed = new Set();
    for (const c of CAMPAIGN_DEFS) {
        if (!inSet(q.campaigns, c.id))
            continue;
        if (!inSet(q.themes, c.theme))
            continue;
        if (q.markets.length > 0 && !c.markets.some((m) => q.markets.includes(m)))
            continue;
        allowed.add(c.id);
    }
    return allowed;
}
function addCampaign(t, f) {
    t.impressions += f.impressions;
    t.clicks += f.clicks;
    t.sessions += f.sessions;
    t.conversions += f.conversions;
    t.spend += f.spend;
}
export function campaignTotals(q) {
    return memo(`ct:${qKey(q)}`, () => {
        const t = { ...ZERO_CAMPAIGN };
        const allowed = campaignAllowed(q);
        for (const f of dataset.campaignFacts) {
            if (f.d < q.from || f.d > q.to || !allowed.has(f.campaign))
                continue;
            addCampaign(t, f);
        }
        return t;
    });
}
export function campaignBy(q, key) {
    return memo(`cb:${key}:${qKey(q)}`, () => {
        const out = new Map();
        const allowed = campaignAllowed(q);
        for (const f of dataset.campaignFacts) {
            if (f.d < q.from || f.d > q.to || !allowed.has(f.campaign))
                continue;
            const k = key === 'day' ? f.d : f.campaign;
            let t = out.get(k);
            if (!t)
                out.set(k, (t = { ...ZERO_CAMPAIGN }));
            addCampaign(t, f);
        }
        return out;
    });
}
export function pagesBy(q, key) {
    return memo(`pb:${key}:${qKey(q)}`, () => {
        const out = new Map();
        for (const f of dataset.pages) {
            if (f.d < q.from || f.d > q.to || !inSet(q.markets, f.market))
                continue;
            const k = key === 'day' ? f.d : f.page;
            let t = out.get(k);
            if (!t)
                out.set(k, (t = { sessions: 0, users: 0, engaged: 0, ctaClicks: 0, formStarts: 0, formCompletions: 0, conversions: 0 }));
            t.sessions += f.sessions;
            t.users += f.users;
            t.engaged += f.engaged;
            t.ctaClicks += f.ctaClicks ?? 0;
            t.formStarts += f.formStarts ?? 0;
            t.formCompletions += f.formCompletions ?? 0;
            t.conversions += f.conversions;
        }
        return out;
    });
}
/** Per-page daily sessions series (for table trend sparklines). */
export function pageDaySeries(q, page) {
    return memo(`pds:${page}:${q.from}:${q.to}:${q.markets.join(',')}`, () => {
        const len = q.to - q.from + 1;
        const series = new Array(len).fill(0);
        for (const f of dataset.pages) {
            if (f.page !== page || f.d < q.from || f.d > q.to || !inSet(q.markets, f.market))
                continue;
            series[f.d - q.from] += f.sessions;
        }
        return series;
    });
}
/* ---------------- content ---------------- */
export function contentItems(q) {
    return memo(`ci:${qKey(q)}`, () => dataset.content.filter((c) => c.publishD >= q.from &&
        c.publishD <= q.to &&
        inSet(q.markets, c.market) &&
        inSet(q.platforms, c.platform) &&
        inSet(q.themes, c.theme) &&
        inSet(q.formats, c.format)));
}
/** Web outcomes attributed to the currently selected social platforms.
 *  Web facts are collected at channel level, not platform level. When a
 *  platform filter is active we allocate the exact Social-channel web facts
 *  proportionally to platform clicks for the same day/market. With no
 *  platform filter this returns the source Social-channel totals exactly. */
export function socialAttributedWebTotals(q) {
    return memo(`saw:${qKey(q)}`, () => {
        if (q.channels.length > 0 && !q.channels.includes('social'))
            return { ...ZERO_WEB };
        const clickShare = new Map();
        for (const f of dataset.social) {
            if (f.d < q.from || f.d > q.to || !inSet(q.markets, f.market))
                continue;
            const key = `${f.d}:${f.market}`;
            const cur = clickShare.get(key) ?? { selected: 0, all: 0 };
            cur.all += f.clicks;
            if (q.platforms.length === 0 || q.platforms.includes(f.platform))
                cur.selected += f.clicks;
            clickShare.set(key, cur);
        }
        const t = { ...ZERO_WEB };
        for (const f of dataset.web) {
            if (f.channel !== 'social' || f.d < q.from || f.d > q.to || !inSet(q.markets, f.market) || !inSet(q.devices, f.device))
                continue;
            const shareRow = clickShare.get(`${f.d}:${f.market}`);
            const share = q.platforms.length === 0 ? 1 : (shareRow && shareRow.all > 0 ? shareRow.selected / shareRow.all : 0);
            t.sessions += Math.round(f.sessions * share);
            t.users += Math.round(f.users * share);
            t.newUsers += Math.round(f.newUsers * share);
            t.engaged += Math.round(f.engaged * share);
            t.conversions += Math.round(f.conversions * share);
            t.engTime += Math.round(f.engTime * share);
        }
        t.users = Math.min(t.users, t.sessions);
        t.newUsers = Math.min(t.newUsers, t.users);
        t.engaged = Math.min(t.engaged, t.sessions);
        t.conversions = Math.min(t.conversions, t.engaged);
        return t;
    });
}
/** Social → website funnel used by the executive mini-funnel.
 *  Every stage is calculated from the same selected date/market/platform scope,
 *  so the numbers reconcile with Social and Web rather than mixing paid base traffic. */
export function socialWebFunnel(q) {
    return memo(`swf:${qKey(q)}`, () => {
        if (q.channels.length > 0 && !q.channels.includes('social')) {
            return [
                { id: 'impressions', value: 0 }, { id: 'clicks', value: 0 }, { id: 'sessions', value: 0 },
                { id: 'engaged', value: 0 }, { id: 'conversions', value: 0 },
            ];
        }
        const soc = socialTotals(q);
        const web = socialAttributedWebTotals(q);
        return [
            { id: 'impressions', value: soc.impressions },
            { id: 'clicks', value: soc.clicks },
            { id: 'sessions', value: Math.min(soc.clicks, web.sessions) },
            { id: 'engaged', value: Math.min(web.sessions, web.engaged) },
            { id: 'conversions', value: Math.min(web.engaged, web.conversions) },
        ];
    });
}
/** Paid & social acquisition funnel. Scope: social platforms + paid
 *  campaigns → attributable sessions/conversions. Monotonicity holds by
 *  construction and the selected channel filter is respected. */
export function acquisitionFunnel(q) {
    return memo(`fn:${qKey(q)}`, () => {
        const includeSocial = q.channels.length === 0 || q.channels.includes('social');
        const includePaid = q.channels.length === 0 || q.channels.includes('paid');
        const soc = includeSocial ? socialTotals(q) : { ...ZERO_SOCIAL };
        const socWeb = includeSocial ? socialAttributedWebTotals(q) : { ...ZERO_WEB };
        const cmp = includePaid ? campaignTotals(q) : { ...ZERO_CAMPAIGN };
        // Campaign facts already contain attributable sessions/conversions. Engaged
        // sessions are estimated from the observed paid-channel engagement ratio,
        // capped so every stage remains a subset of the previous one.
        const paidWeb = includePaid ? webTotals({ ...q, channels: ['paid'] }) : { ...ZERO_WEB };
        const paidEngRate = paidWeb.sessions > 0 ? paidWeb.engaged / paidWeb.sessions : 0;
        const campaignEngaged = Math.min(cmp.sessions, Math.max(cmp.conversions, Math.round(cmp.sessions * paidEngRate)));
        const impressions = soc.impressions + cmp.impressions;
        const clicks = soc.clicks + cmp.clicks;
        const sessions = Math.min(clicks, socWeb.sessions + cmp.sessions);
        const engaged = Math.min(sessions, socWeb.engaged + campaignEngaged);
        const conversions = Math.min(engaged, socWeb.conversions + cmp.conversions);
        return [
            { id: 'impressions', value: impressions },
            { id: 'clicks', value: clicks },
            { id: 'sessions', value: sessions },
            { id: 'engaged', value: engaged },
            { id: 'conversions', value: conversions },
        ];
    });
}
/** Build an aligned daily series from a grouped-by-day map; missing days are null. */
export function daySeries(map, q, field, treatMissingAsZero = true) {
    const out = [];
    for (let d = q.from; d <= q.to; d++) {
        const t = map.get(d);
        out.push({ d, value: t ? t[field] : treatMissingAsZero ? 0 : null });
    }
    return out;
}
