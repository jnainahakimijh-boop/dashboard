# Integrations

No source has been connected to a real Veolia account from this build environment. Every connector below is therefore **not verified live**. Its code follows the official API documentation listed, and its request and response handling is covered by unit tests with recorded fixtures. A source is shown as **Connected** only after a real synchronisation, file import, webhook delivery or GEO measurement succeeds. Saving credentials never changes the status to Connected.

Credentials are entered in Administration → Integration manager → *Connect* or *Reauthorise*. They are encrypted (AES-256-GCM) and write-only.

## Readiness matrix

| Source | Implementation | Verified live | Modes | Credentials needed | Authorisation or cost to obtain first |
|---|---|---|---|---|---|
| Google Analytics 4 (veolia.com FR, EN) | Implemented (Data API `runReport`, with test) | No | API · file · demo | Service account JSON with Viewer access on each property | Veolia analytics team grants Viewer access |
| Google Search Console | Implemented (Search Analytics `query`, with test) | No | API · file · demo | Service account added as a restricted user of each property | Property owner adds the service account |
| LinkedIn Pages | Implemented (organisation share and follower statistics) | No | API · file · demo | OAuth access token from a page administrator; app approved for the Community Management API | LinkedIn must approve API access; tokens expire after 60 days |
| X | Implemented (posts and user metrics, API v2) | No | API · file · demo | Bearer token of an X developer project | **Paid X API tier required, not purchased** (needs authorisation) |
| YouTube | Implemented (YouTube Analytics `reports.query`) | No | API · file · demo | OAuth client id, secret and refresh token from a channel manager | Channel owner grants `yt-analytics.readonly` |
| ChatGPT Ads | Partial (read-only insights at `/ad_account/insights`, configurable field mapping, with test) | No | API · file · demo | Ads API key for the advertiser account | Ad account administrator creates a read-only key |
| Drupal Webform | Implemented (signed webhook, counts only) | No | Webhook · file · demo | Shared signing secret | Drupal team adds a remote-post handler (no change made by this platform) |
| GEO — OpenAI (web search) | Implemented (Responses API with web search tool) | No | API · demo | OpenAI API key | **Paid usage**, plus a Super admin's recorded approval to send prompt texts |
| GEO — Perplexity | Implemented (chat completions with citations) | No | API · demo | Perplexity API key | **Paid usage**, plus a Super admin's recorded approval to send prompt texts |
| GEO — Google AI features | Manual observations (file import) | Yes (file import) | File · demo | None | No official API exists |
| CSV / XLSX importer | Implemented for 11 datasets | Yes (tests and e2e) | File | None | — |
| AI wording provider (Anthropic, OpenAI, Azure OpenAI) | Implemented, disabled by default | No | API | API key | Organisational approval recorded with a typed confirmation |
| SMTP e-mail | Implemented (nodemailer 10); delivery tested against a local SMTP server | No (no corporate relay) | Environment | `SMTP_*` variables | Corporate relay |
| SSO (OpenID Connect) | **Partial: configuration and discovery test only** | No | — | Issuer, client id, secret | Identity team app registration. **Production blocker** |

The documentation URLs used by each connector are shown in the Integration manager (*Readiness & history*) and in `server/connectors/*.ts`.

**Refresh, for every API source:**

- The daily job `connectors.sync_all` runs at 05:30 Europe/Paris. It reads the last 7 complete days up to yesterday, and the first sync of a connection reads 90 days.
- Each run replaces the rows of the same dataset, period and entity, so late revisions by the provider are picked up.
- *Sync now* runs the same request on demand.
- Data is never real time.

## Connector sheets

### Google Analytics 4

| | |
|---|---|
| Status | Implemented (Data API v1beta `runReport`; *Test connection* reads the property metadata). Not verified live |
| Authentication | Google service account: signed JWT exchanged for an access token, scope `analytics.readonly` |
| Credentials | Service-account JSON key. Configuration: property (`properties/123456789`) and website key |
| Permissions | The service account's e-mail is added as **Viewer** on each GA4 property |
| Collected | Five daily reports per property: <ul><li>`countryId`, `sessionDefaultChannelGroup`, `sessionSource`, `sessionMedium`, `deviceCategory`</li><li>channel, source and medium, `sessionCampaignName`</li><li>`landingPagePlusQueryString`</li><li>`deviceCategory` with `browser`</li><li>`languageCode`</li></ul>Metrics: sessions, engaged sessions, views and engagement time on all reports; users and new users on the first. Key events come from `eventName` / `eventCount` reports for the configured conversion events |
| Not collected | User-level data, demographics and interests, audiences, funnels and paths, real-time data, revenue |
| Limitations | <ul><li>Users are daily values. Period totals are an approximation, flagged as such.</li><li>GA4 thresholding can hide small rows.</li><li>Query strings are removed from landing pages.</li><li>AI-assistant sources are classified by source name, and new assistants must be added to the list.</li></ul> |
| Refresh | Daily. GA4 itself can take 24–48 hours to finalise a day; the daily window re-reads the last 7 days |
| To activate | <ol><li>Create a service account in the corporate Google Cloud project and enable the Analytics Data API.</li><li>Grant it Viewer on veolia.com FR and EN.</li><li>*Connect* each GA4 connection (API mode, property, website, key).</li><li>*Test connection*, then *Sync now*.</li><li>Check the conversion events in the KPI registry.</li></ol> |

The source mapping:

- Sources `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com` and `claude.ai` are classified as **AI referral**.
- `utm_source=chatgpt` with `utm_medium=cpc` is classified as paid ChatGPT Ads.

### Google Search Console

| | |
|---|---|
| Status | Implemented (Search Analytics `query` with `dataState: final`; *Test connection* reads the property). Not verified live |
| Authentication | Same service-account mechanism, scope `webmasters.readonly` |
| Credentials | Service-account JSON key. Configuration: property URL (`https://www.veolia.com/fr/` or `sc-domain:`) and website key |
| Permissions | The service account is added as a (restricted) user of each property |
| Collected | Clicks, impressions and impression-weighted position, in three reports: by day, country and device; by query; by page. Paginated to 25,000 rows per request |
| Not collected | Discover, News, image and video search types; URL inspection and indexing coverage; Core Web Vitals |
| Limitations | <ul><li>Anonymised queries are absent from query rows, so query totals are below property totals.</li><li>Average position is not a rank-tracker reading.</li></ul> |
| Refresh | Daily. Search Console data is final after about 2 days; the most recent days are excluded from comparisons |
| To activate | <ol><li>The property owner adds the service account in Search Console (Settings → Users and permissions).</li><li>*Connect* each property.</li><li>*Test connection*, then *Sync now*.</li></ol> |

### LinkedIn Pages

| | |
|---|---|
| Status | Implemented (`organizationalEntityShareStatistics`, `organizationalEntityFollowerStatistics`, `networkSizes`). No connection test. Not verified live |
| Authentication | OAuth 2.0 access token of a page administrator, headers `LinkedIn-Version` and Rest.li 2.0 |
| Credentials | Access token. Configuration: organisation URN (`urn:li:organization:…`), account key and API version (`YYYYMM`) |
| Permissions | The Veolia LinkedIn app is approved for the Community Management API, and a page administrator authorises it |
| Collected | Daily impressions, clicks, reactions, comments, shares and engagements; followers gained; current follower total |
| Not collected | Link clicks separately from other clicks; follower demographics; post-level and video metrics through the API (the *posts* import covers posts) |
| Limitations | Tokens expire after 60 days and must be renewed with *Reauthorise* |
| Refresh | Daily |
| To activate | <ol><li>Request Community Management API access for the Veolia app (LinkedIn review).</li><li>A page administrator authorises the app.</li><li>Store the token and the URN.</li><li>*Sync now*.</li><li>Plan the token renewal.</li></ol> |

### X

| | |
|---|---|
| Status | Implemented (API v2 user posts with `public_metrics`, user `public_metrics`). No connection test. Not verified live |
| Authentication | App bearer token |
| Credentials | Bearer token. Configuration: numeric user id and account key |
| Permissions | **A paid X API tier is required to read post metrics. It has not been purchased; buying it needs authorisation** |
| Collected | Posts, impressions, likes, replies, reposts and quotes, grouped by publication day; the follower count at each sync |
| Not collected | Daily account-level impressions; link clicks; follower history before the first sync; post-level analytics beyond public metrics |
| Limitations | Post metrics are lifetime totals to date, assigned to the publication day, not daily activity |
| Refresh | Daily, within the tier's rate limits |
| To activate | <ol><li>Obtain authorisation and purchase the API tier.</li><li>Create the project and token.</li><li>*Connect*, then *Sync now*.</li></ol> |

### YouTube

| | |
|---|---|
| Status | Implemented (YouTube Analytics `reports.query`, dimension `day`). No connection test. Not verified live |
| Authentication | OAuth 2.0 refresh token, exchanged for an access token at each run |
| Credentials | OAuth client id, client secret and refresh token. Configuration: account key |
| Permissions | A channel owner or manager grants `yt-analytics.readonly` once |
| Collected | Daily views, watch minutes, likes, comments, shares, subscribers gained and lost |
| Not collected | Thumbnail impressions and click-through rate; subscriber total (needs the Data API, not implemented); per-video metrics (the *posts* import covers videos) |
| Limitations | Engagement rate uses views as the denominator, unlike LinkedIn and X |
| Refresh | Daily. YouTube Analytics data usually lags by a few days |
| To activate | <ol><li>Create an OAuth client in the corporate Google Cloud project.</li><li>A channel manager authorises it and the refresh token is stored.</li><li>*Sync now*.</li></ol> |

### ChatGPT Ads (read-only)

| | |
|---|---|
| Status | **Partial.** Insights read at `/ad_account/insights` with `aggregation_level=ad` and cursor pagination (`after`, `has_more`); *Test connection* lists one campaign. Not verified live |
| Authentication | Ads API key (bearer) |
| Credentials | API key for the advertiser account. Configuration: API base URL and optional field mapping |
| Permissions | An ad account administrator creates a read-only key |
| Collected | Daily spend, impressions, clicks and platform-attributed conversions per ad, matched with the external ids recorded in Administration → Advertising |
| Not collected | Creatives, audiences, placements, bids; any write operation (no ad creation, budget change, publishing or pixel) |
| Limitations | <ul><li>The official documentation pages could not be fetched from this environment, so the endpoint and field names follow the documented excerpts and remain configurable.</li><li>Budgets are those recorded in this platform.</li><li>Unknown ads are reported in the sync details and ignored.</li></ul> |
| Refresh | Daily. Spend can be revised for several hours, and conversions can appear 24–48 hours late; the 7-day window re-reads them |
| To activate | <ol><li>Create the read-only key.</li><li>Record each ad's external id and the campaigns' categories and budgets.</li><li>Confirm the field names against the API reference (adjust the mapping if needed).</li><li>*Test connection*, then *Sync now*.</li></ol> |

The default field mapping is `{"date":"readable_time","adId":"ad_id","spend":"spend","impressions":"impressions","clicks":"clicks","conversions":"conversions"}`. **Platform-attributed conversions are never added to GA4 conversions.** Both are displayed side by side.

### GEO providers (OpenAI with web search, Perplexity)

| | |
|---|---|
| Status | Implemented (OpenAI Responses API with the `web_search` tool; Perplexity chat completions with citations). Not verified live |
| Authentication | API key (bearer) |
| Credentials | API key and model. Configuration: brand terms (default "Veolia") |
| Permissions | **Paid usage**, and a Super admin records the organisation's approval to send the prompt texts (typed APPROVE, audited, revocable) |
| Collected | Per prompt and provider: answer status, mention, veolia.com citation, mention rank, cited URLs and domains, competitors present, a short excerpt |
| Not collected | What end users see in consumer apps; Google AI features (manual observations instead) |
| Limitations | Answers vary with model version, location and time; rates describe the monitored sample only |
| Refresh | On demand (*Run measurement*, administrators) or weekly when the *Measure GEO prompts* schedule is enabled (off by default) |
| To activate | <ol><li>Obtain authorisation for the paid usage.</li><li>*Configure*: API mode and model.</li><li>Store the key.</li><li>A Super admin records approval.</li><li>*Run measurement* on the GEO page. The provider becomes Connected after the first completed answer.</li><li>Optionally enable the weekly schedule.</li></ol> |

### Platform services

| Service | Status and activation |
|---|---|
| AI wording provider (Anthropic, OpenAI, Azure OpenAI) | Implemented, disabled by default. Enable it in Administration → AI administration. Choose the provider and model, store the key, set the budget and record approval. Only aggregated figures are sent |
| SMTP e-mail | Implemented with nodemailer, configured by the `SMTP_*` environment variables. Until it is set, alerts and scheduled reports are recorded as "not sent" |
| Single sign-on (OpenID Connect) | **Partial.** Only the configuration and the discovery-document test exist; the sign-in flow is not implemented. **Production blocker** |

## Drupal Webform

| | |
|---|---|
| Status | Implemented (signed webhook, counts only). Not verified with the Veolia Drupal sites |
| Authentication | HMAC-SHA256 signature over the timestamp and the raw body, with a shared secret |
| Credentials | Webhook signing secret. Configuration: website key and optional webform mapping |
| Permissions | The Drupal team adds the sending handler. This platform changes nothing on the websites |
| Collected | Submissions per day, website and form |
| Not collected | Any field of the submission (name, e-mail, message, attachments) |
| Limitations | Past submissions are loaded with the *forms* import. Tracking coverage needs GA4 form events for the same forms |
| Refresh | Each submission is counted on receipt |
| To activate | <ol><li>*Configure*: webhook mode, website, mapping.</li><li>Store the secret.</li><li>Share the endpoint and the secret with the Drupal team through a secure channel.</li><li>Check the first delivery in *Readiness & history*.</li></ol> |

The platform receives counts only. The Drupal team adds a remote-post handler, or a small module, that sends **only** the webform id and submission time:

```
POST /api/ingest/drupal/<connection id>
Content-Type: application/json
X-VDI-Timestamp: <unix seconds>
X-VDI-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>

{"form_id":"contact","submitted_at":"2026-10-18T09:12:44+02:00","site":"veolia-fr"}
```

- The timestamp must be within 5 minutes of the server time, and signatures are compared in constant time.
- Any other field in the payload (name, e-mail, message…) is discarded on receipt and never stored.
- `formMap` (JSON) maps Drupal webform ids to platform form keys, for example `{"demande_projet":"lead_request"}`.
- Ingestion is rate-limited (600 requests per minute per connection).
- History is loaded with the *forms* import.

## GEO measurement details

The methodology is described in [METHODOLOGY.md](METHODOLOGY.md#geo-ai-answer-visibility). Each measurement records:

- the prompt version and the provider;
- the status: completed, partial or failed (failed runs keep the error and are excluded from rates);
- the model reported by the provider.

## File imports

Administration → Data management → *Import*. Download a template for any dataset. Validation reports:

- rejected rows with reasons;
- duplicates;
- empty optional values;
- unknown or missing columns;
- the mapped fields;
- the number of existing rows that would be replaced.

Replacement requires an explicit confirmation.

| Dataset | Required columns | Optional columns |
|---|---|---|
| `web` (GA4 sessions) | date, site, country, channel, device, sessions | engaged_sessions, views, engagement_time_seconds, users, new_users, `event_<id>` |
| `webacq` (GA4 acquisition) | date, site, channel, source_medium, campaign, sessions | engaged_sessions, views, engagement_time_seconds, `event_<id>` |
| `webpage` (GA4 landing pages) | date, site, page_path, sessions | engaged_sessions, views, engagement_time_seconds, `event_<id>` |
| `search` (GSC totals) | date, site, country, device, clicks, impressions | position |
| `searchquery` (GSC queries) | date, site, query, clicks, impressions | position |
| `searchpage` (GSC pages) | date, site, page_path, clicks, impressions | position |
| `social` (daily account statistics) | date, account | impressions, engagements, reactions, comments, shares, clicks, link_clicks, video_views, watch_minutes, followers_gained, followers_lost, followers, posts |
| `posts` (social posts) | published_at, post_id, account, platform | format, topic, campaign, language, hour, text, url, impressions, reactions, comments, shares, clicks, link_clicks, video_views, watch_minutes, engagements |
| `ads` (ChatGPT Ads export) | date, ad, spend, impressions, clicks | conversions |
| `forms` (Drupal daily counts) | date, site, form, submissions | — |
| `geo_measurements` (manual observations) | date, prompt, provider, status, mentioned, cited | mention_rank, cited_urls, competitors, confidence |

GA4 event columns: `event_contact_form_submit`, `event_generate_lead`, `event_newsletter_signup`, `event_brochure_download`, `event_career_apply_click`, `event_file_download`.

## What this platform never does

- It does not install trackers, tags, pixels or scripts on Veolia websites.
- It does not crawl outside authorised scopes on monitored websites, and it does not bypass robots.txt or access controls.
- It does not create, edit or publish ads, posts or website content.
- It does not send personal data to AI providers. GEO providers receive public prompt texts; the wording provider receives aggregated figures. Both run only after approval.
