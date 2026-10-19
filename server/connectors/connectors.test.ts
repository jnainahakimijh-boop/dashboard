import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildJwtAssertion, ga4Records, ga4ToFacts, gscToFacts, mapChannel, parseServiceAccount } from './google';
import { linkedinShareStatsUrl, linkedinToFacts, xToFacts, youtubeToFacts } from './social';
import { DEFAULT_FIELD_MAP, insightsToFacts, insightsUrl } from './chatgptAds';
import { analyseAnswer, parseOpenAiResponse, parsePerplexityResponse } from './geo';
import { signDrupal, verifyDrupalSignature } from './drupal';
import { parseCsv } from '../imports/import';

describe('Google connectors', () => {
  it('builds a valid RS256 service-account assertion', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = parseServiceAccount(JSON.stringify({ client_email: 'svc@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }));
    const jwt = buildJwtAssertion(sa, 'https://www.googleapis.com/auth/analytics.readonly', 1_700_000_000);
    const [h, c, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toMatchObject({ iss: 'svc@p.iam.gserviceaccount.com', aud: 'https://oauth2.googleapis.com/token', exp: 1_700_003_600 });
    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
    expect(() => parseServiceAccount('{"client_email":"x"}')).toThrow();
  });

  it('maps GA4 channels including AI assistants and ChatGPT Ads', () => {
    expect(mapChannel('Referral', 'chatgpt.com', 'referral')).toBe('ai_referral');
    expect(mapChannel('Paid Other', 'chatgpt', 'cpc')).toBe('paid');
    expect(mapChannel('Organic Search', 'google', 'organic')).toBe('organic_search');
    expect(mapChannel('Unassigned', 'x', 'y')).toBe('other');
  });

  it('merges GA4 event counts into base rows', () => {
    const base = ga4Records({ dimensionHeaders: [{ name: 'date' }, { name: 'landingPagePlusQueryString' }], metricHeaders: [{ name: 'sessions' }, { name: 'engagedSessions' }], rows: [{ dimensionValues: [{ value: '20261001' }, { value: '/fr/contact?utm=x' }], metricValues: [{ value: '120' }, { value: '80' }] }] });
    const ev = ga4Records({ dimensionHeaders: [{ name: 'date' }, { name: 'landingPagePlusQueryString' }, { name: 'eventName' }], metricHeaders: [{ name: 'eventCount' }], rows: [{ dimensionValues: [{ value: '20261001' }, { value: '/fr/contact' }, { value: 'contact_form_submit' }], metricValues: [{ value: '7' }] }] });
    const facts = ga4ToFacts('webpage', 'veolia-fr', base, ev, (r) => ({ page: `veolia-fr:${String(r.landingPagePlusQueryString).split('?')[0]}` }));
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ day: '2026-10-01', dims: { site: 'veolia-fr', page: 'veolia-fr:/fr/contact' }, measures: { sessions: 120, engaged: 80, ev_contact_form_submit: 7 } });
  });

  it('converts Search Console rows (position weighted by impressions, ISO-3 countries)', () => {
    const f = gscToFacts('search', 'veolia-fr', ['date', 'country', 'device'], { rows: [{ keys: ['2026-10-01', 'fra', 'MOBILE'], clicks: 10, impressions: 200, ctr: 0.05, position: 3.5 }] }, '/fr');
    expect(f[0]).toMatchObject({ dims: { site: 'veolia-fr', country: 'FR', device: 'mobile' }, measures: { clicks: 10, impressions: 200, posW: 700 } });
  });
});

describe('social connectors', () => {
  it('builds LinkedIn statistics URLs and reconstructs follower levels', () => {
    expect(linkedinShareStatsUrl('urn:li:organization:42', '2026-10-01', '2026-10-02')).toContain('timeGranularityType:DAY');
    const day = (d: string) => Date.parse(`${d}T00:00:00Z`);
    const facts = linkedinToFacts(
      'li-group',
      { elements: [{ timeRange: { start: day('2026-10-01'), end: day('2026-10-02') }, totalShareStatistics: { impressionCount: 1000, clickCount: 20, likeCount: 30, commentCount: 2, shareCount: 1 } }] },
      { elements: [{ timeRange: { start: day('2026-10-01'), end: day('2026-10-02') }, followerGains: { organicFollowerGain: 5, paidFollowerGain: 0 } }, { timeRange: { start: day('2026-10-02'), end: day('2026-10-03') }, followerGains: { organicFollowerGain: 7, paidFollowerGain: 0 } }] },
      1000,
      '2026-10-02',
    );
    const d1 = facts.find((f) => f.day === '2026-10-01')!;
    const d2 = facts.find((f) => f.day === '2026-10-02')!;
    expect(d1.measures).toMatchObject({ impressions: 1000, engagements: 53, followersGained: 5, followers: 993 });
    expect(d2.measures.followers).toBe(1000);
  });

  it('aggregates X posts by publication day', () => {
    const f = xToFacts('x-group', [{ id: '1', created_at: '2026-10-01T09:00:00Z', public_metrics: { impression_count: 500, like_count: 5, reply_count: 1, retweet_count: 2, quote_count: 0 } }, { id: '2', created_at: '2026-10-01T15:00:00Z', public_metrics: { impression_count: 300, like_count: 1 } }], 61_000, '2026-10-19');
    expect(f.find((x) => x.day === '2026-10-01')!.measures).toMatchObject({ posts: 2, impressions: 800, engagements: 9 });
    expect(f.find((x) => x.day === '2026-10-19')!.measures.followers).toBe(61_000);
  });

  it('parses YouTube Analytics reports', () => {
    const f = youtubeToFacts('yt-group', { columnHeaders: [{ name: 'day' }, { name: 'views' }, { name: 'estimatedMinutesWatched' }, { name: 'likes' }, { name: 'comments' }, { name: 'shares' }, { name: 'subscribersGained' }, { name: 'subscribersLost' }], rows: [['2026-10-01', 900, 2100, 30, 4, 2, 8, 1]] });
    expect(f[0].measures).toMatchObject({ videoViews: 900, watchMinutes: 2100, engagements: 36, followersGained: 8, followersLost: 1 });
  });
});

describe('ChatGPT Ads connector (read-only)', () => {
  it('builds an insights request with an exclusive end date and configured fields', () => {
    const u = new URL(insightsUrl('https://api.ads.openai.com/v1', '2026-10-01', '2026-10-07', Object.values(DEFAULT_FIELD_MAP)));
    expect(u.pathname).toBe('/v1/ad_account/insights');
    expect(u.searchParams.get('aggregation_level')).toBe('ad');
    expect(u.searchParams.get('time_granularity')).toBe('daily');
    expect(JSON.parse(u.searchParams.get('time_ranges[]')!)).toEqual({ since: '2026-10-01', until: '2026-10-08' });
    expect(u.searchParams.getAll('fields[]')).toContain('spend');
  });

  it('maps rows to known ads and reports unknown ones', () => {
    const { facts, unknownAds } = insightsToFacts(
      [
        { readable_time: '2026-10-01', ad_id: 'ad_1', spend: '12.5', impressions: 1000, clicks: 30, conversions: 1 },
        { readable_time: '2026-10-01', ad_id: 'ad_9', spend: 3, impressions: 10, clicks: 1 },
      ],
      DEFAULT_FIELD_MAP,
      new Map([['ad_1', 'ad-ind-reuse-a']]),
    );
    expect(facts).toEqual([{ dataset: 'ads', day: '2026-10-01', dims: { ad: 'ad-ind-reuse-a' }, measures: { spend: 12.5, impressions: 1000, clicks: 30, conversions: 1 } }]);
    expect(unknownAds).toEqual(['ad_9']);
  });
});

describe('GEO answer analysis', () => {
  const comps = [{ key: 'aquenta', name: 'Aquenta (fictional)', domain: 'aquenta.example' }];
  it('parses OpenAI Responses output with URL citations', () => {
    const ans = parseOpenAiResponse({ model: 'm', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Aquenta and Veolia offer PFAS treatment.', annotations: [{ type: 'url_citation', url: 'https://www.veolia.com/en/x' }] }] }] });
    const a = analyseAnswer(ans, ['Veolia'], 'veolia.com', comps);
    expect(a).toMatchObject({ mentioned: true, cited: true, mentionRank: 2, competitors: ['aquenta'], citedDomains: ['veolia.com'] });
  });
  it('parses Perplexity citations and handles absent brands', () => {
    const a = analyseAnswer(parsePerplexityResponse({ choices: [{ message: { content: 'Several firms exist.' } }], citations: ['https://aquenta.example/a'] }), ['Veolia'], 'veolia.com', comps);
    expect(a).toMatchObject({ mentioned: false, cited: false, mentionRank: null, competitors: ['aquenta'] });
  });
});

describe('Drupal webhook signatures and CSV parsing', () => {
  it('verifies HMAC signatures within the replay window', () => {
    const ts = '1760000000';
    const sig = signDrupal('s3cret', ts, '{"a":1}');
    expect(verifyDrupalSignature('s3cret', ts, sig, '{"a":1}', 1760000100)).toBe(true);
    expect(verifyDrupalSignature('s3cret', ts, sig, '{"a":2}', 1760000100)).toBe(false);
    expect(verifyDrupalSignature('s3cret', ts, sig, '{"a":1}', 1760001000)).toBe(false);
    expect(verifyDrupalSignature('other', ts, sig, '{"a":1}', 1760000100)).toBe(false);
  });
  it('parses quoted CSV and semicolon-delimited files', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
    expect(parseCsv('﻿a;b\r\n1;2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});
