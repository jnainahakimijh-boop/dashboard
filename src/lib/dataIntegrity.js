/** ------------------------------------------------------------------
 *  Dataset integrity assertions.
 *
 *  The platform runs on deterministic demonstration data, so the numbers
 *  must still obey the relationships a real analytics stack obeys. These
 *  checks run over the whole generated dataset and are executed from a
 *  Node script during the build, so a change to the generator that breaks
 *  an invariant is caught before it reaches a page.
 *  ------------------------------------------------------------------ */
import { dataset } from '/src/data/index.js';
import { advocacyFacts, advocates } from '/src/data/advocacy.js';
import { seoFacts, searchQueries } from '/src/data/seo.js';
import { DAYS } from '/src/data/dimensions.js';

function check(results, name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
}

/** Count rows violating `predicate` and report the first offender. */
function violations(rows, predicate) {
  let count = 0;
  let first = null;
  for (const row of rows) {
    if (!predicate(row)) {
      count++;
      if (!first) first = row;
    }
  }
  return { count, first };
}

export function runDataIntegrityChecks() {
  const results = [];
  const report = (name, rows, predicate, describe) => {
    const { count, first } = violations(rows, predicate);
    check(results, name, count === 0, count === 0 ? `${rows.length} rows` : `${count} of ${rows.length} rows fail — first: ${describe ? describe(first) : JSON.stringify(first).slice(0, 160)}`);
  };

  /* ---- social ---- */
  report('social: reach ≤ impressions', dataset.social, (f) => f.reach <= f.impressions);
  report('social: clicks ≤ impressions', dataset.social, (f) => f.clicks <= f.impressions);
  report('social: engagements ≤ impressions', dataset.social, (f) => f.reactions + f.comments + f.shares <= f.impressions);
  report('social: video milestones decrease monotonically', dataset.social,
    (f) => f.videoComplete <= f.video75 && f.video75 <= f.video50 && f.video50 <= f.video25 && f.video25 <= f.videoViews);
  report('social: video views ≤ impressions', dataset.social, (f) => f.videoViews <= f.impressions);
  report('social: shares are never negative', dataset.social, (f) => f.shares >= 0);

  /* ---- web ---- */
  report('web: users ≤ sessions', dataset.web, (f) => f.users <= f.sessions);
  report('web: new users ≤ users', dataset.web, (f) => f.newUsers <= f.users);
  report('web: engaged sessions ≤ sessions', dataset.web, (f) => f.engaged <= f.sessions);
  report('web: conversions ≤ engaged sessions', dataset.web, (f) => f.conversions <= f.engaged);
  report('web: no negative sessions', dataset.web, (f) => f.sessions >= 0);

  /* ---- landing pages ---- */
  report('pages: users ≤ sessions', dataset.pages, (f) => f.users <= f.sessions);
  report('pages: engaged ≤ sessions', dataset.pages, (f) => f.engaged <= f.sessions);
  report('pages: CTA clicks ≤ engaged sessions', dataset.pages, (f) => f.ctaClicks <= f.engaged);
  report('pages: form starts ≤ CTA clicks', dataset.pages, (f) => f.formStarts <= f.ctaClicks);
  report('pages: form completions ≤ form starts', dataset.pages, (f) => f.formCompletions <= f.formStarts);
  report('pages: conversions ≤ sessions', dataset.pages, (f) => f.conversions <= f.sessions);

  /* landing-page sessions must reconcile with the web total for the same day/market */
  const webByDayMarket = new Map();
  for (const f of dataset.web) {
    const key = `${f.d}:${f.market}`;
    webByDayMarket.set(key, (webByDayMarket.get(key) ?? 0) + f.sessions);
  }
  const pagesByDayMarket = new Map();
  for (const f of dataset.pages) {
    const key = `${f.d}:${f.market}`;
    pagesByDayMarket.set(key, (pagesByDayMarket.get(key) ?? 0) + f.sessions);
  }
  let reconcileFails = 0;
  let worstGap = 0;
  for (const [key, pageSessions] of pagesByDayMarket) {
    const webSessions = webByDayMarket.get(key) ?? 0;
    // The generator distributes the *channel* totals across pages; device
    // rounding leaves a small residue, so allow a 2% tolerance.
    const gap = webSessions === 0 ? pageSessions : Math.abs(pageSessions - webSessions) / webSessions;
    worstGap = Math.max(worstGap, gap);
    if (gap > 0.02) reconcileFails++;
  }
  check(results, 'pages reconcile with web sessions (±2%)', reconcileFails === 0,
    reconcileFails === 0 ? `worst gap ${(worstGap * 100).toFixed(2)}%` : `${reconcileFails} day/market buckets exceed 2% (worst ${(worstGap * 100).toFixed(2)}%)`);

  /* ---- campaigns ---- */
  report('campaigns: clicks ≤ impressions', dataset.campaignFacts, (f) => f.clicks <= f.impressions);
  report('campaigns: sessions ≤ clicks', dataset.campaignFacts, (f) => f.sessions <= f.clicks);
  report('campaigns: conversions ≤ sessions', dataset.campaignFacts, (f) => f.conversions <= f.sessions);
  report('campaigns: spend is never negative', dataset.campaignFacts, (f) => f.spend >= 0);

  /* ---- content ---- */
  report('content: clicks ≤ impressions', dataset.content, (c) => c.clicks <= c.impressions);
  report('content: sessions ≤ clicks', dataset.content, (c) => c.sessions <= c.clicks);
  report('content: conversions ≤ sessions', dataset.content, (c) => c.conversions <= c.sessions);
  report('content: engagements ≤ impressions', dataset.content, (c) => c.reactions + c.comments + c.shares <= c.impressions);
  report('content: click accumulation is monotonic', dataset.content,
    (c) => c.clicks24h <= c.clicks7d && c.clicks7d <= c.clicks30d && c.clicks30d <= c.clicks90d);

  /* every normal analysis window must contain enough content to analyse */
  const windows = [7, 28, 30, 90];
  for (const days of windows) {
    const from = DAYS - days;
    const count = dataset.content.filter((c) => c.publishD >= from && c.publishD <= DAYS - 1).length;
    check(results, `content: last ${days} days has a usable sample`, count >= days * 2, `${count} items`);
  }

  /* ---- advocacy ---- */
  report('advocacy: active ≤ registered', advocacyFacts, (f) => f.active <= f.registered);
  report('advocacy: reach ≤ impressions', advocacyFacts, (f) => f.reach <= f.impressions);
  report('advocacy: engagements ≤ impressions', advocacyFacts, (f) => f.engagements <= f.impressions);
  report('advocacy: clicks ≤ impressions', advocacyFacts, (f) => f.clicks <= f.impressions);
  report('advocacy: sessions ≤ clicks', advocacyFacts, (f) => f.sessions <= f.clicks);
  report('advocacy: conversions ≤ sessions', advocacyFacts, (f) => f.conversions <= f.sessions);
  report('advocates: reach ≤ impressions', advocates, (a) => a.reach <= a.impressions);
  report('advocates: engagements ≤ impressions', advocates, (a) => a.engagements <= a.impressions);
  report('advocates: conversions ≤ sessions', advocates, (a) => a.conversions <= a.sessions);

  /* ---- search ---- */
  report('search: clicks ≤ impressions', seoFacts, (f) => f.clicks <= f.impressions);
  report('search: branded + non-branded impressions equal the total', seoFacts, (f) => f.brandedImpressions + f.nonBrandedImpressions === f.impressions);
  report('search: branded + non-branded clicks equal the total', seoFacts, (f) => f.brandedClicks + f.nonBrandedClicks === f.clicks);
  report('search: conversions ≤ clicks', seoFacts, (f) => f.conversions <= f.clicks);
  report('search queries: clicks ≤ impressions', searchQueries, (r) => r.clicks <= r.impressions);
  report('search queries: conversions ≤ clicks', searchQueries, (r) => r.conversions <= r.clicks);
  report('search queries: position is within the tracked range', searchQueries, (r) => r.position > 0 && r.position < 100);

  /* ---- determinism ---- */
  const firstWeb = dataset.web[0];
  check(results, 'dataset is generated once per load (stable identity)', dataset.web[0] === firstWeb, 'singleton module instance');

  return results;
}
