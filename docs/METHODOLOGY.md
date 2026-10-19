# Methodology

Every number in the product is computed by the semantic metric layer (`shared/metrics.ts`, `server/analytics/engine.ts`). Calculations are deterministic: the same period, filters and data always give the same result. Administration → KPI registry shows each indicator's definition, calculation, sources, unit, supported dimensions, direction and availability.

## Periods and comparisons

- **Presets:**
  - last 7, 30 or 90 days;
  - month, quarter or year to date;
  - previous month, quarter or year;
  - custom.

  Quarters and years follow the fiscal year set in Administration → Organisation (January by default).
- Days are complete calendar days in Europe/Paris. "Data up to" is the last complete day available across sources.
- **Previous period:** the same number of days immediately before the selected period. **Year over year:** the same calendar dates one year earlier.
- **Coverage:**
  - When a source has no data for part of the period (it started later, or has a processing delay such as Search Console's ~2 days), the period is clipped to the available days. The comparison is clipped to the same length, so both sides cover the same number of days.
  - When the comparison period is not covered at all, the change is not shown ("comparison not available").
- **Missing days** of an entity (for example a social account with no collected rows) are detected and noted. Totals for those days are under-estimated, and the note says so.
- **Change:**
  - Counts show a percentage change and the absolute difference.
  - Rates and averages show the absolute difference (percentage points for rates), because a relative change of a rate is misleading.
  - A change that rounds to zero is shown as flat.
- **Filters** that a source cannot apply (for example *country* on social metrics) are not silently dropped. The result lists them as "filters not applied".

## Website (GA4 and Drupal)

| Indicator | Definition |
|---|---|
| Sessions, engaged sessions, views | Sums of GA4 daily values |
| Engagement rate | Engaged sessions ÷ sessions |
| Average engagement time | Engagement time ÷ sessions |
| Users | GA4 daily users summed over the period, then de-duplicated with the factor 1 ÷ (1 + 0.06 × ln(days)). This is an **approximation**, flagged as such, because GA4 users cannot be added across days |
| Key events, conversions | GA4 event counts. *Conversions* covers the events selected in Administration → KPI registry (default: contact request, qualified lead, newsletter sign-up) |
| Conversion rate | Conversions ÷ sessions |
| Form submissions | Drupal Webform submissions (counts only, received by signed webhook or import) |
| Form tracking coverage | GA4 form events ÷ Drupal submissions for the same forms. Values well below the usual level indicate a tracking problem, not a drop in demand |
| AI-referral sessions and share | Sessions whose source is chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com or claude.ai. Share = AI-referral sessions ÷ all sessions |

## Social media

- **Impressions, engagements, link clicks and posts:** sums of the daily account statistics for LinkedIn and X. YouTube views and watch minutes are reported separately.
- **Engagement rate:**
  - LinkedIn and X: engagements ÷ impressions.
  - YouTube: engagements ÷ views.
  - The denominators differ, so cross-platform comparisons show trends rather than levels. The interface states this next to every comparison.
- **Followers:** end-of-period audience per account, summed across accounts. Net change = gained − lost.

## SEO (Search Console)

- **Clicks and impressions** are sums. **CTR** = clicks ÷ impressions.
- **Average position** = Σ(position × impressions) ÷ Σ(impressions), which re-aggregates Search Console's averages correctly. It is not a rank-tracker reading.
- **Keyword visibility (top 10)** = the share of tracked keywords whose impression-weighted average position over the period is 10 or better. Tracked keywords are managed in SEO → Keywords. It applies to the tracked list only.
- **Branded / non-branded clicks:** a query is branded when it contains the brand name ("veolia", including common misspellings) or is flagged as branded in the query catalogue. Search Console's anonymised queries are not in query-level data, so branded and non-branded clicks do not add up to total clicks.
- **Technical audit:**
  - It runs only inside an authorised scope (Administration → SEO & GEO), on monitored websites, within the page, depth and delay limits, respecting robots.txt.
  - Nineteen rules are checked: HTTP 5xx and 4xx; broken internal links and internal links to redirects; missing, duplicate or over-long titles; missing or duplicate meta descriptions; missing or multiple H1; missing or foreign canonical; noindex; missing hreflang; thin content; images without alt text; slow responses; pages blocked by robots.txt.
  - Issues that are no longer detected are resolved automatically, with history.
  - The demo audit is a synthetic snapshot: no request is sent to the website.

## GEO (AI-answer visibility)

- The **monitored sample** is a versioned library of prompts (language, topic, intent, market, priority, expected Veolia pages). Each connected provider measures it on demand (*Run measurement*, administrators) or weekly when that schedule is enabled. Google AI features are observed manually and imported.
- **Per measurement:**
  - *Mentioned* means a brand term appears in the answer text.
  - *Cited* means a veolia.com URL appears among the answer's sources.
  - *Mention rank* is the brand's order of appearance among the brands found.
  - *Competitors present* are listed brands found in the text or in cited domains.
  - Failed runs are excluded and counted separately.
- **Mention rate** = measurements with a mention ÷ completed measurements. **Citation rate** = measurements with a veolia.com citation ÷ completed measurements. **Share of voice** = brand mentions ÷ all brand mentions in the sampled answers.
- **Limits:**
  - These rates describe the monitored prompts and providers only, not all AI usage.
  - Answers vary with model version, location, time and personalisation.
  - API answers can differ from consumer apps.
  - Google AI features have no API and are observed manually.
  - Prompts with fewer than 6 measurements in the period are flagged as low samples. Recommendations based on fewer than 8 measurements are given low confidence.
- Changing a prompt's wording creates a new version. Measurements keep their version, so trends across versions are visible rather than hidden.

## ChatGPT Ads

- Spend, impressions, clicks and conversions are platform-reported. **CTR** = clicks ÷ impressions, **CPC** = spend ÷ clicks, **cost per conversion** = spend ÷ platform conversions.
- **Platform-attributed conversions are never added to GA4 conversions.** GA4 key events from ChatGPT Ads sessions (`utm_source=chatgpt`, `utm_medium=cpc`) are shown alongside.
- **Pacing** = month-to-date spend ÷ (monthly budget × elapsed days ÷ days in month). **Projected month** = month-to-date spend ÷ elapsed days × days in month. Budgets are those recorded in this platform, not read from the ad platform.
- Spend can be revised for several hours, and conversions can appear 24–48 hours late.

## Content intelligence

Each content type keeps its own channel metrics: web pages use GA4 and Search Console metrics; posts use impressions and engagements; videos use views and watch time. **No combined content score is computed**, because these units are not comparable. Freshness and gap lists describe observations, not causes.

## Targets

Target progress is shown separately from the period-over-period change:

- **Cumulative indicators** (sums) are compared with a time-proportional share of the target: target × elapsed days ÷ period days.
- **Rates and averages** are compared with the target itself.
- For "lower is better" indicators (such as average position or cost per conversion), the status is *ahead* when the actual value is at or below the target.
- The status is *behind* when progress falls below the warning threshold, which defaults to 90% of the expectation.

## Alerts

Rules (Administration → Alerts) evaluate an indicator over a window, optionally with a site filter. The condition is one of:

- above or below a value;
- increase or decrease by more than a percentage or an absolute amount, versus the previous period or year over year;
- missing data;
- spend pacing above a level.

Behaviour:

- **De-duplication:** one open alert per rule and entity. Repeated triggers increment its count.
- **Auto-resolution:** an alert is resolved when its condition stops.
- **Cool-down:** a resolved alert can re-open only after the cool-down.
- Alerts are notified in the app. E-mail is sent only when an SMTP relay is configured; otherwise the message is recorded as not sent.

## Recommendations

Recommendations are generated daily by documented rules. Each one carries its evidence (values, periods, sources), priority, impact, effort and confidence. The wording describes observations and associations, never proven causes, and recommends measuring the effect after implementation.

| Rule | Trigger |
|---|---|
| Search position drop | Last 7 days versus a non-overlapping baseline (days −41 to −14): average position worse by ≥ 0.5, with ≥ 2,000 impressions |
| Tracking gap | Days in the last 45 where form tracking coverage is below 75% of the period median |
| Ads over-pacing | Pacing above 110% after at least 5 days of the month |
| Ads without conversions | Ads with ≥ €300 spend and no platform conversion over 28 days |
| GEO missing page | High-priority prompt with no expected Veolia page |
| GEO low visibility | High-priority prompt with ≥ 8 measurements over 8 weeks, mention rate < 25%, and a competitor present in ≥ 35% of answers |
| AI-referral growth | AI-referral sessions up ≥ 12% over 28 days |
| Declining evergreen pages | 90 days year over year: pages with ≥ 1,500 sessions last year down more than 8%, excluding campaign pages, reported with the site trend for context |
| Open high-severity SEO issues | Critical or high audit issues still open, per site |
| X audience decline | Negative net follower change on X over 90 days, shown with LinkedIn for context |
| Social format | LinkedIn formats with ≥ 8 posts over 180 days, when the best format's engagement rate exceeds the weakest by ≥ 25% (an association, not a cause) |

## Executive summary

The executive summary is computed deterministically:

- **What changed:** the largest movements, by magnitude.
- **Drivers:** the contribution of each segment (channel, site, platform) to the change. This says where the change happened, not why.
- **Attention points:** open alerts and recommendations.
- **Recommended actions.**
- **Data limitations:** demo or partial sources, coverage notes and sampling.

The executive report follows a seven-part structure:

1. Executive summary
2. Performance highlights
3. Significant changes
4. Possible drivers
5. Risks and opportunities
6. Recommended actions
7. Data limitations

An optional AI narrative can rephrase these computed facts. It is used only when it is enabled, keyed and approved, and it receives aggregated figures only.

## Demo data

The demo dataset is deterministic: a seeded generator produces the same values on every run. It covers 1 July 2024 to 18 October 2026 for every source. The end date is fixed (`DEMO_END` in `shared/demo/generate.ts`) so that figures, tests and screenshots stay reproducible, so "Data up to" shows 18 October 2026 while demo data is in use. It reconciles across sources:

- Social account totals equal the sum of their posts.
- GA4 paid sessions are at most the ad clicks.
- GA4 organic sessions are about 93% of Search Console clicks.
- GA4 records about 86% of Drupal form submissions.
- Breakdown tables add up to their totals.

It includes deliberate edge cases:

- a GA4 contact-form tracking failure on the FR site (14–16 September 2026);
- a three-day X collection gap;
- Search Console's two-day processing delay;
- a search-position drop on the EN site (from 6 October 2026);
- campaign launches;
- seasonality and growth in AI-referral traffic.

Competitor names in demo GEO data are fictional, and every demo figure is labelled DEMO.
