import { describe, expect, it } from 'vitest';
import { dataset } from '@/data';
import { generateDataset } from '@/data/generate';
import { CHANNELS, DAYS, MARKETS } from '@/data/dimensions';
import { acquisitionFunnel, campaignBy, campaignTotals, pagesBy, prevQ, socialTotals, webBy, webTotals, type FilterQ } from './aggregate';
import { computeInsights } from './insights';
import { CAMPAIGN_DEFS } from '@/data/campaigns';
import { cpa } from './metrics';

const mkQ = (len: number): FilterQ => ({
  from: DAYS - len,
  to: DAYS - 1,
  markets: [],
  channels: [],
  platforms: [],
  devices: [],
  campaigns: [],
  themes: [],
  formats: [],
});
const q28 = mkQ(28);
const q7 = mkQ(7);
const q90 = mkQ(90);

describe('dataset invariants (every row)', () => {
  it('web: users <= sessions, newUsers <= users, conversions <= engaged <= sessions', () => {
    for (const f of dataset.web) {
      expect(f.users).toBeLessThanOrEqual(f.sessions);
      expect(f.newUsers).toBeLessThanOrEqual(f.users);
      expect(f.engaged).toBeLessThanOrEqual(f.sessions);
      expect(f.conversions).toBeLessThanOrEqual(f.engaged);
      expect(f.sessions).toBeGreaterThanOrEqual(0);
    }
  });
  it('social: clicks <= impressions, engagements <= impressions, reach <= impressions', () => {
    for (const f of dataset.social) {
      expect(f.clicks).toBeLessThanOrEqual(f.impressions);
      expect(f.reactions + f.comments + f.shares).toBeLessThanOrEqual(f.impressions);
      expect(f.reach).toBeLessThanOrEqual(f.impressions);
      expect(f.reactions).toBeGreaterThanOrEqual(0);
      expect(f.comments).toBeGreaterThanOrEqual(0);
      expect(f.shares).toBeGreaterThanOrEqual(0);
    }
  });
  it('campaigns: conversions <= sessions <= clicks <= impressions', () => {
    for (const f of dataset.campaignFacts) {
      expect(f.clicks).toBeLessThanOrEqual(f.impressions);
      expect(f.sessions).toBeLessThanOrEqual(f.clicks);
      expect(f.conversions).toBeLessThanOrEqual(f.sessions);
      expect(f.spend).toBeGreaterThan(0);
    }
  });
  it('content: engagements <= impressions, conversions <= clicks <= impressions', () => {
    for (const c of dataset.content) {
      expect(c.reactions + c.comments + c.shares).toBeLessThanOrEqual(c.impressions);
      expect(c.clicks).toBeLessThanOrEqual(c.impressions);
      expect(c.conversions).toBeLessThanOrEqual(c.clicks);
    }
  });
  it('pages: conversions <= engaged <= sessions', () => {
    for (const f of dataset.pages) {
      expect(f.engaged).toBeLessThanOrEqual(f.sessions);
      expect(f.conversions).toBeLessThanOrEqual(f.engaged);
    }
  });
});

describe('funnel integrity', () => {
  const queries: FilterQ[] = [
    q28,
    q7,
    q90,
    { ...q28, markets: ['fr'] },
    { ...q28, platforms: ['linkedin'] },
    { ...q28, markets: ['pl'], devices: ['mobile'] },
    { ...q28, channels: ['social'] },
  ];
  it('every stage <= previous stage for varied filters', () => {
    for (const q of queries) {
      const stages = acquisitionFunnel(q);
      for (let i = 1; i < stages.length; i++) {
        expect(stages[i].value, `stage ${stages[i].id} for ${JSON.stringify(q)}`).toBeLessThanOrEqual(stages[i - 1].value);
      }
    }
  });
});

describe('aggregation reconciliation', () => {
  it('channel totals sum to the overall web total', () => {
    const total = webTotals(q28);
    const byChannel = webBy(q28, 'channel');
    let sum = 0;
    for (const t of byChannel.values()) sum += t.sessions;
    expect(sum).toBe(total.sessions);
  });
  it('market totals sum to the overall web total', () => {
    const total = webTotals(q28);
    const byMarket = webBy(q28, 'market');
    let sum = 0;
    for (const t of byMarket.values()) sum += t.conversions;
    expect(sum).toBe(total.conversions);
  });
  it('landing-page sessions reconcile with web sessions (rounding tolerance < 1%)', () => {
    const total = webTotals(q28);
    const byPage = pagesBy(q28, 'page');
    let sum = 0;
    for (const t of byPage.values()) sum += t.sessions;
    expect(Math.abs(sum - total.sessions) / total.sessions).toBeLessThan(0.01);
  });
  it('campaign sessions are a subset of paid-channel sessions', () => {
    const cmp = campaignTotals(q28);
    const paid = (webBy(q28, 'channel').get('paid') ?? { sessions: 0 }).sessions;
    expect(cmp.sessions).toBeLessThanOrEqual(paid);
  });
});

describe('filter recalculation', () => {
  it('single market is a strict subset of global', () => {
    const global = webTotals(q28);
    const fr = webTotals({ ...q28, markets: ['fr'] });
    expect(fr.sessions).toBeGreaterThan(0);
    expect(fr.sessions).toBeLessThan(global.sessions);
  });
  it('markets partition the total exactly', () => {
    const global = webTotals(q28);
    let sum = 0;
    for (const m of MARKETS) sum += webTotals({ ...q28, markets: [m.id] }).sessions;
    expect(sum).toBe(global.sessions);
  });
  it('channel filter changes social and campaign scoping consistently', () => {
    const one = campaignTotals({ ...q28, campaigns: ['c-sustain'] });
    const all = campaignTotals(q28);
    expect(one.spend).toBeGreaterThan(0);
    expect(one.spend).toBeLessThan(all.spend);
  });
  it('social platform filter is a strict subset', () => {
    const all = socialTotals(q28);
    const li = socialTotals({ ...q28, platforms: ['linkedin'] });
    expect(li.impressions).toBeGreaterThan(0);
    expect(li.impressions).toBeLessThan(all.impressions);
  });
});

describe('deterministic generation', () => {
  it('regenerating the dataset produces identical totals', () => {
    const again = generateDataset();
    const sum = (rows: Array<{ sessions?: number; impressions?: number }>) => rows.reduce((s, r) => s + (r.sessions ?? r.impressions ?? 0), 0);
    expect(again.web.length).toBe(dataset.web.length);
    expect(sum(again.web)).toBe(sum(dataset.web));
    expect(sum(again.social)).toBe(sum(dataset.social));
    expect(again.content.length).toBe(dataset.content.length);
  });
});

describe('edge cases', () => {
  it('planned campaigns have no facts and CPA stays null (no NaN/Infinity)', () => {
    const facts = dataset.campaignFacts.filter((f) => f.campaign === 'c-summit');
    expect(facts.length).toBe(0);
    const tot = campaignBy(q90, 'campaign').get('c-summit');
    expect(tot).toBeUndefined();
    expect(cpa(0, 0)).toBeNull();
  });
  it('an empty selection returns zero totals, not errors', () => {
    // campaign filtered to a theme it does not have → nothing matches
    const none = campaignTotals({ ...q28, campaigns: ['c-sustain'], themes: ['innovation'] });
    expect(none.spend).toBe(0);
    expect(cpa(none.spend, none.conversions)).toBeNull();
  });
  it('insights compute without errors across ranges and produce finite evidence', () => {
    for (const q of [q7, q28, q90, { ...q28, markets: ['fr' as const] }]) {
      const insights = computeInsights(q);
      for (const i of insights) {
        expect(i.evidence.en).not.toMatch(/NaN|Infinity|undefined/);
        expect(i.signal.en).not.toMatch(/NaN|Infinity|undefined/);
        expect(i.signal.fr).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });
  it('previous-period query has the same length as the current one', () => {
    const p = prevQ(q28);
    expect(p.to - p.from).toBe(q28.to - q28.from);
    expect(p.to).toBe(q28.from - 1);
    expect(p.from).toBeGreaterThanOrEqual(0);
  });
  it('90d comparison stays inside the dataset window', () => {
    const p = prevQ(q90);
    expect(p.from).toBeGreaterThanOrEqual(0);
    expect(DAYS).toBeGreaterThanOrEqual(180);
  });
  it('campaign targets exist for all campaigns', () => {
    for (const c of CAMPAIGN_DEFS) expect(c.targetCpa).toBeGreaterThan(0);
  });
  it('all channels are represented in the default range', () => {
    const byChannel = webBy(q28, 'channel');
    for (const c of CHANNELS) expect(byChannel.get(c.id)?.sessions ?? 0).toBeGreaterThan(0);
  });
});
