import { describe, expect, it } from 'vitest';
import { cpa, cpm, cpc, ctr, cvr, deltaAbs, deltaRate, engagementRateWeb, ppChange, ratio, relChange, roas } from './metrics';
import { fmtCompact, fmtEur, fmtInt, fmtPct, fmtPpDelta, fmtRelDelta } from './format';

describe('metric formulas', () => {
  it('computes CTR = clicks / impressions × 100', () => {
    expect(ctr(38, 1000)).toBeCloseTo(3.8);
  });
  it('computes CVR = conversions / sessions × 100', () => {
    expect(cvr(21, 1000)).toBeCloseTo(2.1);
  });
  it('computes CPA = spend / conversions', () => {
    expect(cpa(500, 10)).toBe(50);
  });
  it('computes CPC and CPM', () => {
    expect(cpc(100, 400)).toBeCloseTo(0.25);
    expect(cpm(60, 12000)).toBeCloseTo(5);
  });
  it('computes ROAS', () => {
    expect(roas(4000, 1000)).toBe(4);
  });
  it('web engagement rate = engaged / sessions × 100', () => {
    expect(engagementRateWeb(550, 1000)).toBeCloseTo(55);
  });
});

describe('zero-denominator safety', () => {
  it('never returns NaN or Infinity — null instead', () => {
    expect(ratio(5, 0)).toBeNull();
    expect(ctr(0, 0)).toBeNull();
    expect(cvr(3, 0)).toBeNull();
    expect(cpa(500, 0)).toBeNull();
    expect(relChange(10, 0)).toBeNull();
    expect(ppChange(null, 2)).toBeNull();
  });
});

describe('delta semantics', () => {
  it('absolute metrics use relative % change', () => {
    const d = deltaAbs(112, 100);
    expect(d.kind).toBe('rel');
    expect(d.value).toBeCloseTo(12);
    expect(d.sentiment).toBe(1);
  });
  it('rates compare in percentage points, not relative %', () => {
    const d = deltaRate(2.4, 2.8);
    expect(d.kind).toBe('pp');
    expect(d.value).toBeCloseTo(-0.4);
    expect(d.sentiment).toBe(-1);
  });
  it('lower-is-better metrics invert sentiment', () => {
    const d = deltaAbs(120, 100, false);
    expect(d.sentiment).toBe(-1);
  });
});

describe('formatters never leak invalid values', () => {
  const bad = [NaN, Infinity, -Infinity, null, undefined];
  it('renders an em dash for invalid input', () => {
    for (const v of bad) {
      expect(fmtInt(v as never)).toBe('—');
      expect(fmtCompact(v as never)).toBe('—');
      expect(fmtPct(v as never)).toBe('—');
      expect(fmtEur(v as never)).toBe('—');
      expect(fmtRelDelta(v as never)).toBe('—');
      expect(fmtPpDelta(v as never)).toBe('—');
    }
  });
  it('formats valid values', () => {
    expect(fmtInt(248420)).toBe('248,420');
    expect(fmtPct(12.44)).toBe('12.4%');
    expect(fmtRelDelta(12.4)).toBe('+12.4%');
    expect(fmtPpDelta(-0.4)).toBe('-0.4 pp');
  });
});
