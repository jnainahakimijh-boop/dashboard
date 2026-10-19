# Administration guide

Administration is available to the Admin and Super admin roles. The audit log needs *View audit log*, and system monitoring needs *View system monitoring*. Every change is checked by the server against the user's role and written to the audit log (actor, time, action, target, outcome). Credentials, passwords and personal data are never logged.

The sections follow the brief (14.1–14.17), plus an overview.

## Overview

Production readiness checks:

- encryption key;
- e-mail relay;
- demo data;
- AI status.

It also shows connection states, active users by role, open alerts, failed jobs and recent administrative activity.

## 14.1 Organisation

- Organisation and application names, and the logo (PNG, JPEG or WebP up to 500 KB; use only the official files from the brand team).
- Default language and available languages, number and date formats.
- **Currency**: the currency in which ad spend is reported. Set it to the ChatGPT Ads account's billing currency. Amounts are displayed in it and never converted.
- **Fiscal-year start**: year-to-date, quarter-to-date, previous quarter and previous year follow it, in the interface and in reports.
- **Time zone** is fixed to Europe/Paris in this version (days, "Data up to", schedules and reports). Each source keeps its own reporting time zone.
- Defaults for the reporting period, the comparison and the theme. Users can override the theme.
- Retention:
  - imported and synced analytics data;
  - GEO measurements;
  - audit log;
  - report files.

  The nightly maintenance job applies them. Leaving analytics and GEO retention empty keeps everything.
- Demo data switch. Demo figures are always labelled and never mixed with real data.

## 14.2 Users

- Create users (e-mail, name, role, language, optional initial password).
- Restrict a user to some **websites** (data is filtered on the server) and/or some **modules** (routes and analytics queries are refused for other modules).
- Activate or deactivate users, set a password, unlock an account after failed sign-ins, and open the user's history in the audit log.
- Deactivating a user or changing their role ends their sessions immediately.
- Protections:
  - you cannot deactivate yourself or change your own role;
  - at least one active Super admin must remain;
  - Admins cannot create or modify Super admins.
- Invitations by e-mail are not sent (no e-mail service). Single sign-on is a production blocker (see [SETUP.md](SETUP.md#single-sign-on)).

## 14.3 Roles & permissions

This section shows the matrix of five roles and 27 permissions. Roles are defined in code (`shared/rbac.ts`) and enforced on every API route; they are not editable in the interface. Per-website and per-module restrictions apply on top of the role. A per-region restriction is not implemented.

## 14.4 Integration manager

Each connection shows:

- provider, mode (API, file, demo or webhook) and status (Connected, Disconnected, Degraded, Paused, Not configured, Demo);
- identifier, connected resources and authentication state;
- last successful sync, last attempt and next scheduled sync;
- records processed, data range and last error;
- readiness: implementation level, live verification, credentials, prerequisites, limitations, official documentation and recent executions.

Actions:

- **Connect / Reauthorise** stores credentials. They are write-only and encrypted.
- **Configure** sets the mode and settings.
- **Test connection** makes a real call when the provider supports it.
- **Sync now** queues a job, for API mode with credentials.
- **Pause / Resume** and **Disconnect**.
- **Remove credentials.**
- **Record approval / Revoke approval** (GEO providers only, Super admin, typed APPROVE): authorises sending the monitored prompt texts to that provider. The card states what is still missing before measurements can run.

A connection becomes **Connected** only after a real successful sync, import, webhook delivery or GEO measurement.

## 14.5 Websites

For each website you can set:

- key, name, domain and language path;
- language and business unit;
- GA4 property and Search Console property;
- associated countries and regions, content categories and whether Drupal submissions are received. These are descriptive: they document the website and are not used in calculations;
- the website's own **conversion events**. *Conversions* and the conversion rate then count those events for that website, and the organisation default from the KPI registry still applies to the other websites.

Language and business unit feed the language and business-unit breakdowns of every module.

Archived websites keep their history.

## 14.6 Social accounts

Register official LinkedIn, X and YouTube accounts:

- display name (used everywhere the account appears, including reports), handle, external id (organisation URN, user id or channel id);
- language and platform, which feed the language and platform breakdowns, plus region and business unit;
- the indicators to report. Social media shows only those for the account, in the accounts table and the KPI cards of its platform tab. None selected means all supported indicators.

Adding an account creates its connection in the Integration manager.

## 14.7 Advertising

ChatGPT Ads reporting metadata, stored only in this platform:

- per campaign: reporting category (Industries or Collectivities), objective, business unit, monthly budget used for pacing, external id and `utm_campaign`;
- the UTM convention for each campaign;
- the conversion-mapping note.

Advertising configuration is separate from publishing: the platform has no permission to create or change ads or budgets.

## 14.8 SEO & GEO

- **Audit scopes:**
  - allowed hosts (monitored websites only), start URLs, include and exclude patterns;
  - page budget, maximum depth and delay between requests.
  - Each scope must be **authorised** by typing AUTHORISE. Editing a scope withdraws its authorisation.
- GEO providers (status), the citation rule, competitors, and links to keyword lists, the prompt library, schedules and retention.
- Audits and measurements run on demand. Two scheduled jobs (System monitoring) can run them automatically. Both are **off by default** because they create crawl traffic or paid provider usage:
  - *Run audits of authorised crawl scopes*, monthly;
  - *Measure GEO prompts with connected providers*, weekly.

## 14.9 KPI registry & taxonomy

- Every indicator, with its identifier, name, standard definition, calculation, source, unit, aggregation, supported dimensions, granularity, direction, default visualisation, availability and owner.
- **Local overrides:** display names, notes and owner, plus enable or disable. Overrides are shown next to the standard definition and never replace it silently.
- **Conversion events:** the GA4 events counted as conversions.
- **Taxonomy:** topics, pillars, objectives, audiences, business units and tags used to classify content. Values can be added, or deactivated without being deleted.

## 14.10 Dashboard builder

The executive overview layout:

- add and remove widgets;
- reorder them by drag and drop, or with the keyboard on the handle;
- choose full or half width;
- set custom titles;
- show or hide widgets;
- choose and order the KPI cards and the evolution chart's indicators;
- save, or reset to the default layout.

The layout is stored in the database and applies to everyone. Default filters per dashboard and team-level templates are not available (see Known limitations).

## 14.11 Alerts & notifications

Each rule sets:

- indicator and optional website;
- condition: above, below, increase or decrease by a percentage or an absolute amount, missing data, or pacing;
- threshold, window and comparison;
- severity;
- cool-down (hours before a resolved alert can reopen);
- channels (in-app, or e-mail when configured) and recipients;
- enabled or not.

Rules are evaluated daily and on demand (**Evaluate now**). De-duplication keeps one open alert per rule and entity.

## 14.12 Data management

- **Import** a CSV or XLSX file into one of 11 datasets. Templates are downloadable.
- **Validate & preview** before importing. It shows:
  - accepted, rejected and duplicate rows;
  - empty optional values;
  - unknown or missing columns (schema changes);
  - the field mapping and the first mapped rows;
  - the number of **existing rows that would be replaced**. Importing then requires the explicit authorisation checkbox; nothing is ever added on top of existing data.
- **Import history:** download rejected rows as CSV, or delete an import (which removes exactly the rows it added).
- **Datasets in use:** origin (demo or real), rows, coverage, freshness and entities with gaps.

## 14.13 Targets & benchmarks

For each target, set:

- indicator, period and value;
- scope: website, country, channel or campaign;
- business objective, warning threshold (default 90% of the time-proportional expectation), owner and notes.

Progress appears on KPI cards and in the *Target progress* widget, independently of the period-over-period change.

## 14.14 Reporting

- Counts of templates, schedules, failed reports and reports not sent.
- Recipients per schedule, failed report jobs, and the report access rules.
- Templates and schedules are managed in the Reporting center.

## 14.15 AI administration

Disabled by default. To enable it:

- choose the provider (Anthropic, OpenAI or Azure OpenAI), model and endpoint;
- set the maximum output tokens and temperature, and the **monthly token budget** (requests are refused once it is reached);
- choose the allowed features (currently the executive summary narrative) and whether human review is required. When it is, AI text is labelled **Draft — check before sharing**;
- store the API key (write-only);
- record the organisation's **approval** to send aggregated, non-personal figures, by typing APPROVE. Approval can be revoked.

This section also holds versioned analysis templates and the execution log (model, tokens, latency, status; inputs stored as a hash only). Numbers and recommendations never depend on AI.

## 14.16 Security & audit log

- Filter by action prefix, user, outcome (success, failure or denied) and date; open the details of an entry; export to CSV.
- Recorded events include:
  - sign-ins and failures, password changes;
  - role and user changes;
  - integration and credential changes, imports;
  - exports and report downloads;
  - settings changes;
  - denied access attempts.

## 14.17 System monitoring

- Application health and uptime, database type and size, report storage.
- Job queue (queued, running, failed), recent jobs with retry.
- Scheduled jobs with their frequency, last and next run, and an on/off switch. Re-enabling a job starts from its next regular slot; missed runs are not replayed.
- Error log (API errors, failed jobs, connector failures), connector executions, failed imports, rate-limit warnings.
- Data freshness per dataset.

## Common tasks

| Task | Where |
|---|---|
| Create an account | Users → *Add user*. Without single sign-on, set an initial password (12+ characters, three character classes) and give it to the person through a secure channel |
| Set permissions | Choose the role (Roles & permissions shows the matrix), then optionally restrict websites and modules on the user |
| Add a website | Websites → *Add website*, then create its GA4 and Search Console connections in the Integration manager |
| Connect an analytics account | Integration manager → *Connect* on the source → choose API mode, enter the identifiers and credentials → *Test connection* → *Sync now*. Prerequisites per source are in [INTEGRATIONS.md](INTEGRATIONS.md) |
| Configure KPI cards | Dashboard builder → KPI grid → choose and order the indicators. Names, notes and owners are changed in the KPI registry |
| Customise the executive dashboard | Dashboard builder: add, order, resize, rename or hide widgets, then *Save* |
| Define alerts | Alerts & notifications → *Add rule*. Use *Evaluate now* to check it immediately |
| Manage SEO monitoring | SEO & GEO → audit scope → *Authorise* (typed AUTHORISE). Keywords and competitors are managed in SEO → Tracked keywords |
| Manage GEO monitoring | GEO → Prompt library for the prompts. For live measurement: Integration manager → provider → API mode, key and model, then a Super admin records approval |
| Configure ChatGPT Ads | Advertising: category, objective, budget, external ids and UTM convention per campaign. Then Integration manager → ChatGPT Ads → API key → *Sync now* |
| Schedule reports | Reporting center → Templates → save a template → Schedules → *New schedule* (frequency, format, recipients) |

## Troubleshooting failed integrations

Start from the connection card in the Integration manager. It shows the last error. *Readiness & history* lists recent executions with their errors. System monitoring shows the error log, connector executions and rate-limit warnings.

| Symptom | Likely cause | What to do |
|---|---|---|
| *Sync now* is disabled | The connection is not in API mode, has no credentials, or is paused | *Connect* or *Configure*: choose API mode and store the credentials; resume a paused connection |
| "Credentials have not been configured for this connection" | No stored secret | Store the credentials (they are write-only, so re-enter them in full) |
| "HTTP 401" or "HTTP 403" | Expired or revoked token, missing access on the property or page, API not enabled for the project | Reauthorise. Check the access listed under *Prerequisites* (for example the service account as a Viewer of the GA4 property, or a LinkedIn page administrator token, which expires after 60 days) |
| "HTTP 429" or a rate-limit warning | Provider quota reached | Wait for the quota to reset; avoid repeated manual syncs. The daily sync resumes automatically |
| "Request timed out" or "HTTP 5xx" | Provider unavailable | Retry later with *Sync now*, or retry the failed job in System monitoring |
| "The service-account key is not valid JSON" | Truncated or wrongly pasted key | Paste the complete JSON key file content |
| "Configure the website this property measures" | GA4 or Search Console identifiers incomplete | *Configure*: set the property and the website |
| "No ad has an external id yet" | ChatGPT Ads ads not mapped | Advertising: enter each ad's external id |
| Status **Degraded** | A previously working source failed its last run | Fix the cause, then *Sync now*. Data already loaded remains available |
| GEO *Run measurement* disabled | Provider not ready | The connection card names what is missing: API mode, key, model, approval, or a pause |
| "All measurements failed" | Invalid key or model, or provider error | Check the key and the model name, then run again |
| Drupal webhook returns 401 | Wrong secret, or the clock differs by more than 5 minutes | Re-share the secret with the Drupal team and check server time synchronisation |
| Import rejected | Columns or values do not match the template | Download the rejected rows (with reasons) from the import history, correct them and re-import |

If a source keeps failing, pause it so that the daily sync stops retrying, and keep the last good data. Demo data is never used to fill the gap of a connected source.
