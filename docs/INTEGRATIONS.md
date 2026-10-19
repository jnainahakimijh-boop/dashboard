# Integrations

No source has been connected to a real Veolia account from this build environment. Every connector below is therefore **not verified live**. Its code follows the official API documentation listed, and its request and response handling is covered by unit tests with recorded fixtures. A source is shown as **Connected** only after a real synchronisation or file import succeeds. Saving credentials never changes the status to Connected.

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
| GEO — OpenAI (web search) | Implemented (Responses API with web search tool) | No | API · demo | OpenAI API key | **Paid usage**, plus approval to send prompt texts |
| GEO — Perplexity | Implemented (chat completions with citations) | No | API · demo | Perplexity API key | **Paid usage**, plus approval to send prompt texts |
| GEO — Google AI features | Manual observations (file import) | Yes (file import) | File · demo | None | No official API exists |
| CSV / XLSX importer | Implemented for 11 datasets | Yes (tests and e2e) | File | None | — |
| AI wording provider (Anthropic, OpenAI, Azure OpenAI) | Implemented, disabled by default | No | API | API key | Organisational approval recorded with a typed confirmation |
| SMTP e-mail | Implemented (nodemailer) | No | Environment | `SMTP_*` variables | Corporate relay |
| SSO (OpenID Connect) | **Partial: configuration and discovery test only** | No | — | Issuer, client id, secret | Identity team app registration. **Production blocker** |

The documentation URLs used by each connector are shown in the Integration manager (*Readiness & history*) and in `server/connectors/*.ts`.

## Google Analytics 4

- Requests: `properties/{id}:runReport` with daily `date` plus dimensions per dataset:
  - `country`, `sessionDefaultChannelGroup`, `deviceCategory`;
  - `sessionSourceMedium`, `sessionCampaignName`;
  - `landingPagePlusQueryString`;
  - `deviceCategory` with `browser`;
  - `languageCode`.
- Metrics: sessions, engaged sessions, views, user engagement duration, users and new users. Key events come from separate `eventName` reports and are merged per row.
- Channels are mapped to the platform's channel list:
  - Sources `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com` and `claude.ai` are classified as **AI referral**.
  - `utm_source=chatgpt` with `utm_medium=cpc` is classified as paid ChatGPT Ads.
- Configuration: property (`properties/123456789`) and website key.

## Google Search Console

- `searchanalytics/query` per day by country and device (property totals), by query, and by page.
- Rows with `position` are weighted by impressions so averages can be re-aggregated. Search Console finalises data after about two days, and the most recent days are excluded from comparisons.

## LinkedIn, X and YouTube

- LinkedIn: organisation share statistics (impressions, engagements, clicks) and follower statistics per day. Post-level metrics come from the *posts* import.
- X: metrics of the account's posts grouped by publication day; the follower count is captured at each sync.
- YouTube: daily views, watch minutes and engagement for the channel.

## ChatGPT Ads (read-only)

- Reads insights from `/ad_account/insights` with `aggregation_level=ad`, using cursor pagination (`after`, `has_more`).
- Default field mapping: `{"date":"readable_time","adId":"ad_id","spend":"spend","impressions":"impressions","clicks":"clicks","conversions":"conversions"}`. It can be changed in *Configure* if the API reference differs.
- Ads are matched with the external ids recorded in Administration → Advertising. Unknown ads are reported in the sync details.
- **Platform-attributed conversions are never added to GA4 conversions.** Both are displayed side by side.
- No ad creation, budget change, publishing or pixel installation is implemented.
- The official documentation pages could not be fetched from this environment, so the endpoint and fields follow the documented excerpts and remain configurable (see Known limitations).

## Drupal Webform

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

## GEO measurement providers

Measurements run only when the provider has a key and external processing is approved. Each measurement stores:

- the prompt version;
- the provider;
- the status (completed, partial or failed);
- whether Veolia is **mentioned** (a brand term appears in the answer);
- whether it is **cited** (a veolia.com URL is among the sources);
- the mention rank;
- the cited URLs and domains;
- the competitors present;
- a confidence level.

The methodology is described in [METHODOLOGY.md](METHODOLOGY.md#geo-ai-answer-visibility).

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
