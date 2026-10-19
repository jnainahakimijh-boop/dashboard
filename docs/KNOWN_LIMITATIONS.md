# Known limitations and production blockers

This list is deliberately complete. Every item was checked against the code in this repository on 19 October 2026. Anything not listed here is implemented and covered by the automated tests described in [ACCEPTANCE.md](ACCEPTANCE.md).

## Production blockers

These must be resolved before the platform is used with real Veolia data.

| # | Blocker | Why it blocks | What resolves it |
|---|---|---|---|
| 1 | **Single sign-on is not implemented.** Only the OpenID Connect configuration and a discovery-document test exist | Corporate accounts must sign in through the identity provider; local passwords are a stop-gap | Register the application with the identity team, then implement the authorisation-code flow with PKCE and map identity groups to roles |
| 2 | **The Veolia design system was not supplied.** The interface uses interim, neutral tokens (`src/styles/app.css`) and the open-source Inter typeface | The brief requires the official design system; no brand colour, font or logo was invented | Supply the design system; replace the tokens and fonts in `src/styles/app.css`; upload the official logo in Administration → Organisation |
| 3 | **No source is connected or verified live.** Every figure is demonstration data | Connectors follow the official documentation and pass fixture tests, but none has run against a real Veolia account | Obtain the access listed below, connect each source, and compare the first syncs with the native interfaces (GA4, Search Console, LinkedIn, YouTube, ChatGPT Ads) |
| 4 | **No security review or penetration test** | The application handles credentials and corporate data | Corporate security review, including the dependency advisories below |
| 5 | **No hosting set-up.** No container image, infrastructure code or monitoring integration has been built or tested | The application must run in a managed corporate environment | Provision PostgreSQL 14+ (tested on 16), a TLS reverse proxy, the secret manager for `APP_ENCRYPTION_KEY`, backups ([SETUP.md](SETUP.md)) and log collection |

## Missing access and credentials

Nothing below can be obtained from this environment. Each item needs a Veolia owner.

| Source | Needed | Owner |
|---|---|---|
| Google Analytics 4 (FR, EN) | Service account with Viewer access on both properties | Analytics team |
| Google Search Console | The same service account added to both properties | Property owner |
| LinkedIn | Community Management API approval for the Veolia app, and a page administrator's token (renewed every 60 days) | Social media team, LinkedIn review |
| X | **Paid API tier** (needs purchase authorisation) and a bearer token | Social media team, purchasing |
| YouTube | OAuth client and a channel manager's consent (`yt-analytics.readonly`) | Video team |
| ChatGPT Ads | Read-only Ads API key; external ids of each ad | Paid media team |
| Drupal Webform | A remote-post handler on the Drupal sites, and the shared secret | Web team |
| GEO providers (OpenAI, Perplexity) | API keys, **paid usage**, and the recorded approval of a Super admin | Digital team, purchasing |
| AI wording | API key of an approved provider and the organisation's approval | Data protection, IT |
| E-mail | Corporate SMTP relay and sender address | IT |
| Single sign-on | Application registration (issuer, client id, secret) | Identity team |

## Features that require an explicit decision

These are implemented but stay off until someone with authority decides:

- **Paid services:**
  - the X API tier;
  - GEO measurements (OpenAI, Perplexity) and their weekly schedule;
  - the AI wording provider.
- **Sending data outside:**
  - GEO prompt texts (public questions) need a Super admin's typed approval per provider;
  - the AI wording provider receives aggregated figures only, after the organisation's approval.
- **Crawling Veolia websites:** each audit scope must be authorised with a typed confirmation. The monthly crawl schedule is off by default.
- **Never implemented, by design:**
  - creating or editing ads, budgets or campaigns;
  - publishing content;
  - installing tags, pixels or trackers on Veolia websites.

## Unsupported or partial API capabilities

- **GA4:** users cannot be added across days, so period totals are an approximation (flagged). Thresholding can hide small rows. There is no user-level, demographic, funnel or real-time data.
- **Search Console:**
  - Anonymised queries are missing from query rows.
  - Average position is an impression-weighted average, not a rank-tracker reading.
  - Discover, News and indexing data are not collected.
- **LinkedIn:** organisation statistics do not separate link clicks. Post-level metrics come from the *posts* import, not the API.
- **X:**
  - There are no daily account statistics; post metrics are lifetime totals attributed to the publication day.
  - Follower history starts at the first sync.
- **YouTube:** thumbnail impressions and the subscriber total are not requested from the API. Per-video metrics come from the *posts* import.
- **ChatGPT Ads:**
  - The documentation pages could not be fetched from this environment. The endpoint and field names follow official excerpts and can be changed in the connection settings without code changes.
  - Budgets are recorded in this platform, not read from the ad account.
  - Platform conversions are never added to GA4 conversions.
- **Google AI features (GEO):** there is no official API. Observations are recorded manually and imported.
- **GEO in general:** API answers can differ from what people see in consumer apps. Rates describe the monitored prompt sample only.

## Functional limitations

**Configuration**

- Roles and permissions are fixed in code (five roles, 27 permissions). Administrators assign roles and restrict users to websites and modules; there is no custom role editor and no restriction by region.
- The executive dashboard has one layout for everyone. There are no per-team layouts and no default filters per dashboard.
- The time zone is Europe/Paris for days, schedules and reports. Each source keeps its own reporting time zone (for example the GA4 property's).
- Amounts are shown in the organisation's reporting currency and are never converted. It must match the ChatGPT Ads billing currency.
- Weeks start on Monday (ISO 8601).
- Website countries, regions and content categories are descriptive and not used in calculations.
- Page and query topics come from the classification catalogue. Pages and posts reclassified in Content intelligence update the content views, not the topic breakdowns of website and search metrics.

**AI**

- Only the executive summary wording is implemented as an AI feature. Recommendations, alerts and every number are rule-based and deterministic.

**Delivery and notifications**

- Without an SMTP relay, scheduled reports and alert e-mails are recorded as "not sent", and invitations are not sent. Delivery through a relay is tested against a local SMTP server, not a corporate one.
- There are no Teams or Slack notifications.

**Data and operations**

- Demo data ends on 18 October 2026 (fixed for reproducibility).
- Analytics data is held in memory by each instance (about 65 MB and 2 seconds to build for the 660,000 demo rows). Size instance memory for the real warehouse volume.
- Scheduled jobs are de-duplicated on a best-effort basis when several instances run them; run one instance with `JOBS_ENABLED=true`.
- PNG export is available on the chart cards that offer it. Data tables offer CSV and XLSX export to users with the export permission; small reference lists inside cards do not.
- The application serves one organisation.

## Testing limits

- **Browsers:** automated tests run in Chromium only. Firefox, Safari and Edge were not tested.
- **Accessibility:** axe checks (WCAG 2.1/2.2 A and AA) run on every primary page, in light and dark themes and in French. No manual screen-reader or keyboard-only audit has been carried out.
- **Load:** no load or soak test has been run.
- **Connectors:** connector code is tested with recorded fixtures, not live accounts.
- **PostgreSQL:** the API test suite and a backup/restore round trip were run on PostgreSQL 16. Other versions were not tested.

## Dependency advisories

`npm audit --omit=dev` on 19 October 2026:

| Package | Severity | Status |
|---|---|---|
| `uuid` < 11.1.1 (through `exceljs`) | Moderate | **Not exploitable here.** The advisory concerns `v3`/`v5`/`v6` called with a caller-supplied buffer, while `exceljs` only calls `v4()` without one. Newer `uuid` versions are ESM-only and would break `exceljs`. Re-check when `exceljs` updates |

Fixed in this version:

- `nodemailer` was upgraded to 10.1.7.
- `react-router-dom` was upgraded to 7.18.4.
- `d3-color` is overridden to 3.1.0 (it came in through `react-simple-maps`).
