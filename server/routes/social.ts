/** Social media module: accounts, posts, content comparison and publishing-time analysis. */
import { Hono } from 'hono';
import { inArray } from 'drizzle-orm';
import { addDays } from '@shared/calendar';
import { registeredAccounts } from '../analytics/registry';
import { analyticsQuerySchema, type FilterKey } from '@shared/filters';
import { requirePermission } from '../auth/middleware';
import { currentUser, type HonoEnv, type Ctx } from '../context';
import { contentItems, contentTags } from '../db/schema';
import { runQuery } from '../analytics/engine';
import type { PostRecord } from '../analytics/dataset';
import { parseList, periodParams } from './util';

const POST_FILTERS: FilterKey[] = ['language', 'platform', 'campaign', 'bu'];

/** Engagement per impression (LinkedIn, X) or per view (YouTube) — labelled separately in the UI. */
export function postRate(p: PostRecord): number | null {
  if (p.platform === 'youtube') return p.videoViews > 0 ? p.engagements / p.videoViews : null;
  return p.impressions > 0 ? p.engagements / p.impressions : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function socialRoutes() {
  const r = new Hono<HonoEnv>();
  r.use('*', requirePermission('analytics.view'));

  const loadPosts = async (c: Ctx) => {
    const app = c.get('app');
    const ds = await app.analytics.dataset();
    const p = periodParams(c, { from: addDays(ds.asOf, -89), to: ds.asOf });
    const qp = c.req.query();
    const accounts = parseList(qp.account);
    const topics = parseList(qp.topic);
    const formats = parseList(qp.format);
    const text = (qp.q ?? '').toLowerCase().slice(0, 100);
    const rows = (ds.posts?.rows ?? []).filter(
      (x) =>
        x.date >= p.range.from &&
        x.date <= p.range.to &&
        (!p.filters.platform || p.filters.platform.includes(x.platform)) &&
        (!p.filters.language || p.filters.language.includes(x.language)) &&
        (!p.filters.campaign || (x.campaign !== null && p.filters.campaign.includes(x.campaign))) &&
        (!p.filters.bu || p.filters.bu.includes(x.bu)) &&
        (!accounts || accounts.includes(x.account)) &&
        (!topics || topics.includes(x.topic)) &&
        (!formats || formats.includes(x.format)) &&
        (!text || x.text.toLowerCase().includes(text)),
    );
    const ignored = (Object.keys(p.filters) as FilterKey[]).filter((k) => !POST_FILTERS.includes(k));
    return { p, rows, ignored, origin: ds.posts?.origin ?? null, freshness: ds.posts?.freshness ?? null };
  };

  r.get('/posts', async (c) => {
    const app = c.get('app');
    const { p, rows, ignored, origin, freshness } = await loadPosts(c);
    const qp = c.req.query();
    const sort = ['date', 'impressions', 'engagements', 'rate', 'linkClicks', 'videoViews', 'comments', 'shares'].includes(qp.sort ?? '') ? qp.sort! : 'date';
    const dir = qp.dir === 'asc' ? 1 : -1;
    const keyOf = (x: PostRecord) => (sort === 'date' ? x.date + String(x.hour).padStart(2, '0') : sort === 'rate' ? postRate(x) ?? -1 : (x[sort as keyof PostRecord] as number));
    const sorted = [...rows].sort((a, b) => (keyOf(a) > keyOf(b) ? dir : keyOf(a) < keyOf(b) ? -dir : 0));
    const page = Math.max(1, Number(qp.page) || 1);
    const pageSize = Math.min(200, Math.max(5, Number(qp.pageSize) || 25));
    const slice = sorted.slice((page - 1) * pageSize, page * pageSize);
    const items = slice.length ? await app.db.select().from(contentItems).where(inArray(contentItems.sourceKey, slice.map((x) => x.id))) : [];
    const tags = items.length ? await app.db.select().from(contentTags).where(inArray(contentTags.contentId, items.map((i) => i.id))) : [];
    const tagsByPost = new Map(items.map((i) => [i.sourceKey, tags.filter((t) => t.contentId === i.id).map((t) => t.tag)]));
    const overrides = new Map(items.map((i) => [i.sourceKey, i]));
    const acct = await registeredAccounts(app.db);
    const totals = rows.reduce(
      (s, x) => ({ posts: s.posts + 1, impressions: s.impressions + (x.platform === 'youtube' ? 0 : x.impressions), engagements: s.engagements + (x.platform === 'youtube' ? 0 : x.engagements), videoViews: s.videoViews + x.videoViews, linkClicks: s.linkClicks + x.linkClicks }),
      { posts: 0, impressions: 0, engagements: 0, videoViews: 0, linkClicks: 0 },
    );
    return c.json({
      range: p.range,
      total: rows.length,
      page,
      pageSize,
      totals,
      ignoredFilters: ignored,
      mode: origin === 'demo' ? 'demo' : origin ? 'connected' : 'unavailable',
      freshness,
      items: slice.map((x) => {
        const o = overrides.get(x.id);
        return {
          ...x,
          topic: o?.topic ?? x.topic,
          pillar: o?.pillar ?? x.pillar,
          objective: o?.objective ?? x.objective,
          audience: o?.audience ?? x.audience,
          campaign: o?.campaign ?? x.campaign,
          rate: postRate(x),
          rateBasis: x.platform === 'youtube' ? 'views' : 'impressions',
          tags: tagsByPost.get(x.id) ?? [],
          accountName: acct(x.account).name,
        };
      }),
    });
  });

  /** Aggregated comparison of posts by topic, format, campaign, pillar or account. */
  r.get('/compare', async (c) => {
    const { p, rows, ignored, origin } = await loadPosts(c);
    const by = (['topic', 'format', 'campaign', 'pillar', 'account', 'objective', 'audience'] as const).find((k) => k === c.req.query('by')) ?? 'topic';
    const groups = new Map<string, PostRecord[]>();
    for (const x of rows) {
      const k = String(x[by] ?? '(none)');
      groups.set(k, [...(groups.get(k) ?? []), x]);
    }
    const out = [...groups.entries()].map(([key, xs]) => {
      const imp = xs.filter((x) => x.platform !== 'youtube');
      const sumImp = imp.reduce((s, x) => s + x.impressions, 0);
      const sumEng = imp.reduce((s, x) => s + x.engagements, 0);
      const yt = xs.filter((x) => x.platform === 'youtube');
      return {
        key,
        posts: xs.length,
        impressions: sumImp,
        engagements: sumEng,
        rate: sumImp > 0 ? sumEng / sumImp : null,
        medianImpressions: median(imp.map((x) => x.impressions)),
        linkClicks: xs.reduce((s, x) => s + x.linkClicks, 0),
        videoViews: yt.reduce((s, x) => s + x.videoViews, 0),
        lowSample: xs.length < 5,
      };
    });
    out.sort((a, b) => b.posts - a.posts);
    return c.json({ range: p.range, by, groups: out, ignoredFilters: ignored, mode: origin === 'demo' ? 'demo' : origin ? 'connected' : 'unavailable', rateBasis: 'impressions (LinkedIn + X only)' });
  });

  /** Weekday × time-slot analysis. No "best time" is suggested unless the sample supports it. */
  r.get('/timing', async (c) => {
    const { p, rows, origin } = await loadPosts(c);
    const platform = (c.req.query('platform') as PostRecord['platform']) ?? 'linkedin';
    const xs = rows.filter((x) => x.platform === platform && postRate(x) !== null);
    const slots = [
      { id: 'early', from: 6, to: 8 },
      { id: 'morning', from: 9, to: 10 },
      { id: 'late_morning', from: 11, to: 12 },
      { id: 'afternoon', from: 13, to: 15 },
      { id: 'late_afternoon', from: 16, to: 18 },
      { id: 'evening', from: 19, to: 23 },
    ];
    const MIN_CELL = 5;
    const MIN_TOTAL = 40;
    const cells = [];
    for (let wd = 0; wd < 7; wd++) {
      for (const s of slots) {
        const inCell = xs.filter((x) => x.weekday === wd && x.hour >= s.from && x.hour <= s.to);
        cells.push({ weekday: wd, slot: s.id, posts: inCell.length, medianRate: median(inCell.map((x) => postRate(x)!)), medianImpressions: median(inCell.map((x) => x.impressions)) });
      }
    }
    const overall = median(xs.map((x) => postRate(x)!));
    const eligible = cells.filter((x) => x.posts >= MIN_CELL && x.medianRate !== null);
    let recommendation: { weekday: number; slot: string; lift: number } | null = null;
    let reason: string;
    if (xs.length < MIN_TOTAL) reason = 'insufficient_posts';
    else if (eligible.length < 3) reason = 'insufficient_cells';
    else {
      const best = eligible.sort((a, b) => b.medianRate! - a.medianRate!)[0];
      const lift = overall ? best.medianRate! / overall - 1 : 0;
      if (lift >= 0.1) {
        recommendation = { weekday: best.weekday, slot: best.slot, lift };
        reason = 'sufficient';
      } else reason = 'no_clear_difference';
    }
    return c.json({
      range: p.range,
      platform,
      slots,
      cells,
      posts: xs.length,
      overallMedianRate: overall,
      rateBasis: platform === 'youtube' ? 'views' : 'impressions',
      thresholds: { minPostsPerCell: MIN_CELL, minPostsTotal: MIN_TOTAL, minLift: 0.1 },
      recommendation,
      reason,
      caveat: 'Timing is associated with, not proven to cause, performance: topics, formats and campaigns differ between slots.',
      mode: origin === 'demo' ? 'demo' : origin ? 'connected' : 'unavailable',
    });
  });

  r.get('/accounts', async (c) => {
    const app = c.get('app');
    const ctx = await app.analytics.engineContext(currentUser(c));
    const p = periodParams(c, { from: addDays(ctx.dataset.asOf, -29), to: ctx.dataset.asOf });
    const Q = (metrics: string[], from: string, to: string, compare = p.compare) =>
      runQuery(ctx, analyticsQuerySchema.parse({ metrics, from, to, compare, filters: { language: p.filters.language, platform: p.filters.platform }, groupBy: 'account' })).results;
    const sums = Q(['social_posts', 'followers_gained', 'followers_lost', 'followers', 'social_link_clicks'], p.range.from, p.range.to);
    const platformRows = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['social_impressions', 'social_engagements', 'yt_views', 'yt_watch_minutes', 'yt_impressions'], from: p.range.from, to: p.range.to, compare: p.compare, groupBy: 'account', filters: { language: p.filters.language } })).results;
    const start = Q(['followers'], addDays(p.range.from, -1), addDays(p.range.from, -1), 'none')[0];
    const ds = ctx.dataset;
    const acct = await registeredAccounts(app.db);
    const accounts = (ds.tables.social?.dicts.account ?? []).map((key) => {
      const def = acct(key);
      const get = (res: (typeof sums)[number]) => res.rows?.find((x) => x.key === key) ?? null;
      const m = Object.fromEntries([...sums, ...platformRows].map((res) => [res.metric, get(res)]));
      const isYt = def.platform === 'youtube';
      const imp = m.social_impressions?.value ?? 0;
      const eng = m.social_engagements?.value ?? 0;
      return {
        key,
        name: def.name,
        platform: def.platform,
        language: def.language,
        reported: def.metrics,
        followersStart: start.rows?.find((x) => x.key === key)?.value ?? null,
        followersEnd: m.followers?.value ?? null,
        followersGained: m.followers_gained?.value ?? 0,
        followersLost: m.followers_lost?.value ?? 0,
        posts: m.social_posts?.value ?? 0,
        postsCompare: m.social_posts?.compare ?? null,
        impressions: isYt ? m.yt_impressions?.value ?? 0 : imp,
        impressionsCompare: isYt ? m.yt_impressions?.compare ?? null : m.social_impressions?.compare ?? null,
        impressionsKind: isYt ? 'thumbnail' : 'post',
        engagements: isYt ? null : eng,
        rate: isYt ? null : imp > 0 ? eng / imp : null,
        rateCompare: isYt ? null : (m.social_impressions?.compare ?? 0) > 0 ? (m.social_engagements?.compare ?? 0) / m.social_impressions!.compare! : null,
        videoViews: isYt ? m.yt_views?.value ?? 0 : null,
        watchMinutes: isYt ? m.yt_watch_minutes?.value ?? 0 : null,
        linkClicks: isYt ? null : m.social_link_clicks?.value ?? 0,
      };
    });
    const notes = [...new Map(sums.flatMap((s) => s.meta.notes).map((n) => [JSON.stringify(n), n])).values()];
    return c.json({ range: p.range, compareRange: sums[0].meta.compareRange, accounts: accounts.filter((a) => !p.filters.platform || p.filters.platform.includes(a.platform)), notes, mode: sums[0].meta.mode, freshness: sums[0].meta.freshness });
  });

  return r;
}
