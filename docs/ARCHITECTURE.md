# Architecture

## Technology stack

| Layer | Choice |
|---|---|
| Web app | React 18, TypeScript (strict), Vite 6, Tailwind CSS 4 (token-driven), TanStack Query, TanStack Table, React Router 6, Recharts, react-simple-maps (bundled world atlas), @dnd-kit, lucide-react |
| API server | Node.js 22, Hono 4 (`@hono/node-server`), zod validation |
| Database | PostgreSQL through Drizzle ORM. PGlite (embedded PostgreSQL in WebAssembly) when `DATABASE_URL` is empty |
| Files | PDF with pdfkit, XLSX with ExcelJS, CSV built in |
| Tests | Vitest (unit and API), Playwright with @axe-core/playwright (end-to-end, WCAG 2.2 AA) |

## System overview

```
 Browser (React SPA, EN/FR)
   │  same-origin fetch, httpOnly session cookie, x-vdi-request header
   ▼
 Hono API ── security headers · CSRF/Origin check · rate limits · session · RBAC + scopes · audit
   │
   ├── /api/meta, /api/analytics/query ─► Semantic layer (shared/metrics.ts) ─► Query engine (server/analytics)
   │                                                                          ├── warehouse tables (fact_rows, real data)
   │                                                                          └── demo tables (deterministic generator)
   ├── module routes (web, social, seo, geo, ads, content)
   ├── insights (summary, recommendations, alerts) · reports · exports · personal (views, favourites, search)
   ├── admin (organisation, users, integrations, KPI, dashboards, imports, targets, AI, audit, system)
   └── ingest (signed Drupal webhook)
   │
   ▼
 PostgreSQL (50 tables) ◄── job worker (DB queue): connector sync · alert evaluation · recommendations ·
                                                   scheduled reports · crawls · GEO measurements · maintenance
   │
 External APIs (only when configured and approved): GA4 Data API · Search Console · LinkedIn · X · YouTube
                                                    Analytics · ChatGPT Ads · OpenAI/Perplexity (GEO) · AI provider · SMTP
```

The system is a modular monolith: one deployable process serves the API, the built web app and the job worker.

## Semantic metric layer

`shared/metrics.ts` is the single definition of every indicator: 59 user-facing metrics, 20 of them eligible for the executive overview. Each definition sets:

- id, EN/FR label and description;
- unit and direction (whether higher is better);
- module and sources;
- aggregation, one of:
  - `sum` over tables and measures, optionally with fixed filters;
  - `users` (de-duplication approximation, flagged);
  - `last` (end-of-period value, e.g. followers);
  - `ratio` (numerator ÷ denominator metrics, computed on the intersection of the filters both support);
  - `diff`;
  - `custom` (keyword visibility, GEO rates).

`server/analytics/engine.ts` resolves a query (metrics, period, comparison, filters, granularity or breakdown):

1. **Table planning.** For each metric it picks the table that supports the most active filters and the requested breakdown. Filters a table cannot apply are returned as `ignoredFilters` and shown in the UI ("filters not applied").
2. **Coverage.** Periods are clipped to the data actually available, and the comparison period is clipped to the same length (like for like). Missing days per entity are detected from presence bitmaps and returned as notes.
3. **Origins.** Real (warehouse) data replaces demo data table by table. A calculation never combines demo and real data: a ratio whose numerator and denominator come from different origins is returned as unavailable (`mixed_origins`).
4. **Result meta.** Every result carries `mode` (demo / connected / partial / unavailable), sources, freshness, coverage and structured notes. The UI turns these into the per-widget DEMO badges and footnotes.

Configurable conversions: the `@conversions` sentinel expands to the GA4 events selected in the KPI registry.

## Data model (main groups)

- **Identity and governance:** organizations, users, sessions, audit_logs, system_events.
- **Sources:** websites, social_accounts, ad_accounts, ad_campaigns, ad_groups, ads, campaigns, data_connections (encrypted credentials), sync_executions, imports, fact_rows (warehouse: dataset, day, dims jsonb, measures jsonb).
- **Measurement configuration:** metric_definitions (local overrides), metric_targets, taxonomy_terms, dashboards, saved_views, favorites.
- **SEO and GEO:** keyword_groups, keywords, seo_crawl_scopes, seo_crawls, seo_crawl_pages, seo_issues, seo_issue_history, competitors, competitor_observations, geo_prompts, geo_prompt_versions, geo_measurements.
- **Insights:** alert_rules, alert_events, notifications, recommendations, recommendation_comments, recommendation_history, ai_settings, ai_prompt_templates, ai_executions.
- **Content:** content_items, content_tags.
- **Reporting:** report_templates, report_schedules, report_runs (generated file bytes).
- **Jobs:** jobs, schedules.

## Data flow

1. **API connectors** (`server/connectors/*`). A job calls the provider API with credentials decrypted on the server, maps the response to `fact_rows` and replaces the same dataset, period and entities. Each run is recorded in `sync_executions`. A source becomes **Connected** only after a successful run.
2. **File imports** (`server/imports`). CSV or XLSX files are validated against a per-dataset specification (types, known entities, non-negative values, duplicates). The validation step previews mapped fields, missing values and schema differences. Existing rows for the same period and entities are replaced only after explicit confirmation. Rejected rows can be downloaded.
3. **Webhook** (`/api/ingest/drupal/:id`). An HMAC-signed request carries only the form id and timestamp; any other field is discarded on receipt.
4. **GEO measurements.** A job sends the monitored prompts to the configured provider (only after approval), analyses each answer for brand mentions, veolia.com citations and competitors, and stores one measurement per prompt version and provider.
5. **Derived data.** Alerts are evaluated daily (de-duplicated by fingerprint, with a cool-down and auto-resolution), and recommendations are regenerated daily from rules. Executive summaries are computed on request.

## Jobs and scheduling

`jobs` is a PostgreSQL-backed queue. Workers claim jobs with `FOR UPDATE SKIP LOCKED`. Failed jobs retry with exponential backoff, stale locks are recovered, and final failures are recorded as system events. `schedules` and `report_schedules` hold the frequencies (daily, weekly, monthly, quarterly), computed in the Europe/Paris time zone and safe across daylight-saving changes.

## Security model

- **Authentication:**
  - Passwords are hashed with scrypt. The policy requires at least 12 characters with three character classes.
  - An account is locked for 15 minutes after 5 failed attempts.
  - Sessions are random tokens. Only their SHA-256 hash is stored. They live in an httpOnly, SameSite=Lax cookie (Secure over HTTPS) and expire after an idle period and an absolute lifetime.
  - Demo sign-in is disabled in production and as soon as any source is connected.
- **Request protection:** state-changing requests require the `x-vdi-request: 1` header and, when present, a same-origin `Origin`. Rate limits apply to sign-in, demo sign-in, the API and ingestion. Responses carry a strict Content-Security-Policy, `X-Frame-Options: DENY`, a referrer policy and COOP.
- **Authorisation:**
  - Five roles with 27 permissions (`shared/rbac.ts`), checked by middleware on every route.
  - Per-user website scopes filter data inside the engine.
  - Per-user module scopes are checked on module routes and inside `/api/analytics/query`, where restricted metrics are returned as unavailable.
  - The interface hides controls only for convenience; hiding is never the protection.
- **Secrets:**
  - Connector credentials are encrypted with AES-256-GCM using `APP_ENCRYPTION_KEY` and are write-only: the API returns `hasSecret` only.
  - AI keys stay on the server.
  - Logs and audit details pass through a redactor (passwords, tokens, keys, authorisation headers, e-mail and phone fields).
- **Privacy:** analytics views contain aggregates only. The Drupal webhook drops personal fields. The AI provider, when enabled and approved, receives aggregated figures only.
- **External effects:**
  - The crawler reaches only monitored websites inside an authorised scope (typed confirmation), follows robots.txt and crawl-delay, and respects page, depth and size budgets.
  - The ChatGPT Ads connector only reads.
  - Nothing is installed on Veolia websites.

## Internationalisation and accessibility

- All interface text comes from `src/i18n/*` (EN/FR namespaces). A unit test checks that both languages have the same keys and that every literal key used in the code exists.
- Charts use one y-axis, a validated colour palette (fixed order, CVD-checked), legends for two or more series and a table alternative. The map is keyboard-explorable and has a table view.
- Playwright and axe scan every page in light and dark themes and in EN and FR. There must be no serious or critical WCAG 2.2 AA violation.

## Decision records

1. **Modular monolith.** One process keeps deployment and the security perimeter simple for an internal tool. The module boundaries (routes, connectors, engine) allow a later split if needed.
2. **Semantic layer in shared TypeScript.** The same metric definitions drive the API, the UI labels, KPI cards, reports and alerts, which prevents divergent formulas between pages.
3. **Fact table with jsonb dimensions.** One warehouse table covers the heterogeneous sources at this scale (millions of rows) and keeps imports and syncs uniform. It is loaded into in-memory columnar tables per dataset for fast aggregation.
4. **Embedded PostgreSQL for development.** PGlite runs the same SQL and migrations with nothing to install. Production requires a real PostgreSQL.
5. **Database-backed job queue.** It avoids a separate broker. The volumes (a few hundred jobs per day) are well within what PostgreSQL handles.
6. **Deterministic demo data.** A seeded generator produces consistent multi-year data, including edge cases (gaps, tracking failures, campaign launches). It is labelled everywhere and never mixed with real data in one calculation.
7. **No dual axes and no composite scores.** Different units are shown as separate panels or an explicit index, and content is compared channel by channel. This follows the brief and avoids misleading comparisons.
8. **AI as optional wording.** All numbers and recommendations are deterministic. A language model is used only to rephrase computed facts, and only when it is enabled, keyed and approved.
9. **Write-only secrets.** Credentials can be replaced or removed but never read back through the API or the interface.
10. **Read-only advertising.** Campaign publishing permissions are deliberately absent, so the platform cannot create or change ads or budgets.
