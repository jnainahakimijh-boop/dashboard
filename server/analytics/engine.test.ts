import { describe, expect, it } from 'vitest';
import { addDays, resolvePreset } from '@shared/calendar';
import { CODES, DEMO_END, dayOf } from '@shared/demo/generate';
import { analyticsQuerySchema, type AnalyticsQuery } from '@shared/filters';
import { buildDemoDataset } from './dataset';
import { defaultEngineContext, runQuery, usersDedup } from './engine';

const ds = buildDemoDataset();
const ctx = defaultEngineContext(ds);
const q = (x: AnalyticsQuery) => runQuery(ctx, analyticsQuerySchema.parse(x));
const one = (x: AnalyticsQuery) => q(x).results[0];
const last30 = { from: addDays(DEMO_END, -29), to: DEMO_END };

function manualSum(table: 'web' | 'social' | 'forms', measure: string, from: string, to: string, pred: (i: number) => boolean = () => true) {
  const t = ds.tables[table]!.table;
  const [s, e] = t.rows(dayOf(from), dayOf(to));
  let sum = 0;
  for (let i = s; i < e; i++) if (pred(i)) sum += t.meas[measure][i];
  return sum;
}

describe('sums and ratios', () => {
  it('sessions equal the raw row sum and compare to the previous equal-length period', () => {
    const r = one({ metrics: ['sessions'], ...last30 });
    expect(r.value).toBe(manualSum('web', 'sessions', last30.from, last30.to));
    expect(r.meta.compareRange).toEqual({ from: addDays(last30.from, -30), to: addDays(last30.from, -1) });
    expect(r.compare).toBe(manualSum('web', 'sessions', r.meta.compareRange!.from, r.meta.compareRange!.to));
    expect(r.deltaPct).toBeCloseTo((r.value! - r.compare!) / r.compare!, 10);
    expect(r.meta.mode).toBe('demo');
  });

  it('engagement rate is a ratio of totals, not an average of rates', () => {
    const [rate, eng, ses] = q({ metrics: ['engagement_rate', 'engaged_sessions', 'sessions'], ...last30, granularity: 'week' }).results;
    expect(rate.value).toBeCloseTo(eng.value! / ses.value!, 12);
    const avgOfWeekly = rate.series!.reduce((s, p) => s + (p.value ?? 0), 0) / rate.series!.length;
    expect(Math.abs(avgOfWeekly - rate.value!)).toBeGreaterThan(0); // demonstrates they differ
  });

  it('daily series of a sum metric adds up to the period total', () => {
    const r = one({ metrics: ['key_events'], ...last30, granularity: 'day' });
    const total = r.series!.reduce((s, p) => s + (p.value ?? 0), 0);
    expect(total).toBeCloseTo(r.value!, 6);
    expect(r.series).toHaveLength(30);
  });

  it('breakdown rows reconcile with the total', () => {
    const r = one({ metrics: ['sessions'], ...last30, groupBy: 'channel' });
    const sum = r.rows!.reduce((s, x) => s + (x.value ?? 0), 0);
    expect(sum).toBe(r.value);
    expect(r.rows!.map((x) => x.key)).toContain('ai_referral');
  });

  it('platform-attributed ad conversions, GA4 conversions and Drupal submissions are separate metrics', () => {
    const [ads, ga, dru] = q({ metrics: ['ads_conversions', 'conversions', 'form_submissions'], ...last30 }).results;
    expect(ads.meta.sources).toEqual(['chatgpt_ads']);
    expect(ga.meta.sources).toEqual(['ga4']);
    expect(dru.meta.sources).toEqual(['drupal']);
    expect(ads.value).not.toBe(ga.value);
  });

  it('cost per conversion is null (not infinite) when an ad has zero conversions', () => {
    const r = one({ metrics: ['ads_cpa'], ...last30, groupBy: 'ad' });
    const zero = r.rows!.find((x) => x.key === 'ad-ind-decarb-b');
    expect(zero).toBeUndefined(); // ratio undefined → row omitted rather than shown as 0 or ∞
    const spend = one({ metrics: ['ads_spend'], ...last30, groupBy: 'ad' }).rows!.find((x) => x.key === 'ad-ind-decarb-b');
    expect(spend!.value).toBeGreaterThan(0);
  });
});

describe('conversion events per website', () => {
  it('counts a website’s own conversion events and keeps the default elsewhere', () => {
    const custom = { ...ctx, siteConversionEvents: { 'veolia-fr': ['newsletter_signup'] } };
    const run = (c: typeof ctx, site?: string) => runQuery(c, analyticsQuerySchema.parse({ metrics: ['conversions', 'ev_newsletter_signup'], ...last30, compare: 'none', filters: site ? { site: [site] } : {} })).results;
    const [frConv, frNewsletter] = run(custom, 'veolia-fr');
    expect(frConv.value).toBe(frNewsletter.value);
    const [enCustom] = run(custom, 'veolia-en');
    const [enDefault] = run(ctx, 'veolia-en');
    expect(enCustom.value).toBe(enDefault.value);
    const [all] = run(custom);
    expect(all.value).toBe(frNewsletter.value! + enDefault.value!);
    const [allDefault] = run(ctx);
    expect(all.value).not.toBe(allDefault.value);
  });
});

describe('filter applicability', () => {
  it('campaign filter switches sessions to the acquisition table and is applied', () => {
    const r = one({ metrics: ['sessions'], ...last30, filters: { campaign: ['datacentres-2026'] } });
    expect(r.meta.table).toBe('webacq');
    expect(r.meta.ignoredFilters).toEqual([]);
    expect(r.value).toBeGreaterThan(0);
  });

  it('reports filters a table cannot apply instead of silently ignoring them', () => {
    const r = one({ metrics: ['sessions'], ...last30, filters: { campaign: ['datacentres-2026'], country: ['FR'] } });
    expect(r.meta.ignoredFilters.length).toBe(1);
    const s = one({ metrics: ['social_impressions'], ...last30, filters: { country: ['FR'] } });
    expect(s.meta.ignoredFilters).toEqual(['country']);
  });

  it('ratio components only apply filters both sides support', () => {
    const r = one({ metrics: ['form_tracking_coverage'], ...last30, filters: { country: ['FR'], site: ['veolia-fr'] } });
    expect(r.meta.ignoredFilters).toEqual(['country']);
    const [ga, dr] = q({ metrics: ['ga4_form_events', 'form_submissions'], ...last30, filters: { site: ['veolia-fr'] } }).results;
    expect(r.value).toBeCloseTo(ga.value! / dr.value!, 12);
    expect(r.value!).toBeLessThan(1);
  });

  it('a filter that excludes a metric definition makes it unavailable rather than zero', () => {
    const r = one({ metrics: ['social_engagement_rate'], ...last30, filters: { platform: ['youtube'] } });
    expect(r.value).toBeNull();
    expect(r.meta.notes.some((n) => n.code === 'unavailable')).toBe(true);
  });

  it('server-side site scope restricts every website figure', () => {
    const all = one({ metrics: ['sessions'], ...last30 }).value!;
    const scoped = runQuery({ ...ctx, scopeSites: ['veolia-fr'] }, analyticsQuerySchema.parse({ metrics: ['sessions'], ...last30 })).results[0].value!;
    const fr = one({ metrics: ['sessions'], ...last30, filters: { site: ['veolia-fr'] } }).value!;
    expect(scoped).toBe(fr);
    expect(scoped).toBeLessThan(all);
  });
});

describe('coverage, gaps and non-additive metrics', () => {
  it('Search Console processing delay clips the period and compares like for like', () => {
    const r = one({ metrics: ['organic_clicks'], from: addDays(DEMO_END, -6), to: DEMO_END });
    expect(r.meta.range).toEqual({ from: addDays(DEMO_END, -6), to: addDays(DEMO_END, -2) });
    expect(r.meta.compareRange).toEqual({ from: addDays(DEMO_END, -11), to: addDays(DEMO_END, -7) });
    expect(r.meta.notes.find((n) => n.code === 'coverage_clipped')).toBeTruthy();
    const s = one({ metrics: ['organic_clicks'], from: addDays(DEMO_END, -6), to: DEMO_END, granularity: 'day' });
    expect(s.series!.slice(-2).every((p) => p.value === null)).toBe(true);
  });

  it('missing X collection days are reported, never filled with zeros', () => {
    const r = one({ metrics: ['social_impressions'], from: '2026-10-01', to: '2026-10-15', filters: { platform: ['x'] } });
    const gap = r.meta.notes.find((n) => n.code === 'missing_days');
    expect(gap?.params).toMatchObject({ days: 3, from: '2026-10-08', to: '2026-10-10' });
    const li = one({ metrics: ['social_impressions'], from: '2026-10-01', to: '2026-10-15', filters: { platform: ['linkedin'] } });
    expect(li.meta.notes.find((n) => n.code === 'missing_days')).toBeUndefined();
  });

  it('followers are end-of-period values summed across accounts', () => {
    const r = one({ metrics: ['followers'], ...last30 });
    const last = ds.tables.social!.table;
    const [s, e] = last.rows(dayOf(DEMO_END), dayOf(DEMO_END));
    let sum = 0;
    for (let i = s; i < e; i++) sum += last.meas.followers[i];
    expect(r.value).toBe(sum);
  });

  it('users are de-duplicated across days and flagged as approximate in demo', () => {
    const r = one({ metrics: ['users'], ...last30 });
    expect(r.value).toBeCloseTo(manualSum('web', 'users', last30.from, last30.to) * usersDedup(30), 3);
    expect(r.meta.notes.some((n) => n.code === 'users_approx')).toBe(true);
  });

  it('YoY comparison before the start of the data is reported as incomplete', () => {
    const r = one({ metrics: ['sessions'], from: '2025-01-01', to: '2025-01-31', compare: 'yoy' });
    expect(r.compare).toBeNull();
    expect(r.meta.notes.some((n) => n.code === 'compare_incomplete')).toBe(true);
  });

  it('the EN water-treatment ranking drop after 6 Oct 2026 is visible in average position', () => {
    const f = { site: ['veolia-en'], bu: ['water_tech'] };
    const r = one({ metrics: ['avg_position'], from: '2026-10-09', to: '2026-10-16', filters: f });
    expect(r.meta.table).toBe('searchpage');
    expect(r.delta!).toBeGreaterThan(0.3); // position number went up = worse
  });
});

describe('custom metrics', () => {
  it('keyword visibility is a share of tracked keywords', () => {
    const r = one({ metrics: ['keyword_visibility'], ...last30, granularity: 'week', groupBy: 'site' });
    expect(r.value!).toBeGreaterThan(0);
    expect(r.value!).toBeLessThanOrEqual(1);
    expect(r.rows!.length).toBe(2);
    expect(r.meta.notes.some((n) => n.code === 'sample_only')).toBe(true);
  });

  it('GEO rates apply to the monitored sample only and say so', () => {
    const r = one({ metrics: ['geo_mention_rate'], ...last30, groupBy: 'language' });
    expect(r.value!).toBeGreaterThan(0);
    expect(r.value!).toBeLessThan(1);
    const note = r.meta.notes.find((n) => n.code === 'sample_only');
    expect(Number(note!.params!.measurements)).toBeGreaterThan(10);
    expect(r.rows!.map((x) => x.key).sort()).toEqual(['en', 'fr']);
  });

  it('paid sessions in GA4 match the ad platform landing sessions (demo reconciliation)', () => {
    const r = one({ metrics: ['ads_ga_sessions'], ...last30 });
    const t = ds.tables.ads!.table;
    const [s, e] = t.rows(dayOf(last30.from), dayOf(last30.to));
    let sum = 0;
    for (let i = s; i < e; i++) sum += t.meas.gaSessions[i];
    expect(r.value).toBe(sum);
    expect(CODES.channel).toContain('paid');
  });
});

describe('period presets', () => {
  it('uses calendar quarters and years by default', () => {
    expect(resolvePreset('qtd', '2026-10-18')).toEqual({ from: '2026-10-01', to: '2026-10-18' });
    expect(resolvePreset('ytd', '2026-10-18')).toEqual({ from: '2026-01-01', to: '2026-10-18' });
    expect(resolvePreset('prevQuarter', '2026-01-10')).toEqual({ from: '2025-10-01', to: '2025-12-31' });
    expect(resolvePreset('prevYear', '2026-10-18')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(resolvePreset('prevMonth', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('follows a fiscal year that starts in April', () => {
    expect(resolvePreset('ytd', '2026-10-18', 4)).toEqual({ from: '2026-04-01', to: '2026-10-18' });
    expect(resolvePreset('ytd', '2026-02-10', 4)).toEqual({ from: '2025-04-01', to: '2026-02-10' });
    expect(resolvePreset('qtd', '2026-10-18', 4)).toEqual({ from: '2026-10-01', to: '2026-10-18' });
    expect(resolvePreset('qtd', '2026-02-10', 4)).toEqual({ from: '2026-01-01', to: '2026-02-10' });
    expect(resolvePreset('prevQuarter', '2026-05-02', 4)).toEqual({ from: '2026-01-01', to: '2026-03-31' });
    expect(resolvePreset('prevYear', '2026-10-18', 4)).toEqual({ from: '2025-04-01', to: '2026-03-31' });
    // quarters not aligned with calendar quarters
    expect(resolvePreset('qtd', '2026-10-18', 2)).toEqual({ from: '2026-08-01', to: '2026-10-18' });
    expect(resolvePreset('prevQuarter', '2026-10-18', 2)).toEqual({ from: '2026-05-01', to: '2026-07-31' });
  });
});
