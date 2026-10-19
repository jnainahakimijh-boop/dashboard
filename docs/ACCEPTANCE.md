# Acceptance criteria status

Status of the 24 acceptance criteria of the brief on 19 October 2026, for commit `claude/digital-performance-platform-37qrju`.

**Summary:**

| Status | Count | Criteria |
|---|---|---|
| Met | 21 | All except those below |
| Partially met | 2 | 8 (interim branding), 10 (not verified against the live ChatGPT Ads API) |
| Not met | 1 | 3: the Veolia design system was not supplied |

Automated tests at this commit:

- **Vitest: 114 tests**, all passing:
  - engine (23);
  - connectors (13);
  - crawler (3);
  - API (68), also passing on PostgreSQL 16;
  - e-mail delivery (3);
  - i18n (4).
- **Playwright: 25 end-to-end tests**, all passing, against the production build. They include axe WCAG 2.2 AA scans of every primary page, in light and dark themes and in French.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | The application starts successfully | **Met** | `npm run dev`. `npm run build && npm start` on the embedded database and on PostgreSQL 16, including production mode. The e2e suite starts the production build on a fresh database |
| 2 | Every primary navigation page loads | **Met** | e2e *primary pages*: each of the 11 pages loads with its heading, demo labelling and no console error. *Administration sections all render*: 17 sections |
| 3 | The dashboard follows Veolia's supplied design system | **Not met** | No design system was supplied with the brief. Interim, neutral tokens are isolated in `src/styles/app.css`, and no brand colour, font or logo was invented. Production blocker 2 in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) |
| 4 | KPI calculations are consistent | **Met** | One semantic metric layer computes every number: pages, KPIs, reports, alerts and exports. Engine tests check: <ul><li>sums against raw rows;</li><li>rates as ratios of totals;</li><li>series that add up to totals;</li><li>coverage clipping and comparison periods;</li><li>per-website conversion events;</li><li>fiscal periods.</li></ul> The demo data reconciles across sources ([METHODOLOGY.md](METHODOLOGY.md)) |
| 5 | Charts respond to filters | **Met** | e2e *charts and KPIs respond to the global filters*. Filters live in the URL and are applied server-side; filters a source cannot apply are named, never dropped silently |
| 6 | Detailed views support drill-down | **Met** | <ul><li>KPI cards open their module with the current filters.</li><li>The world map comes with its region and country table.</li><li>Tables sort and link to detail drawers: recommendations with evidence, SEO issues with history, content items.</li><li>Search opens the matching view.</li></ul> Verified manually; the drawers are exercised by the e2e flows |
| 7 | Demo data is realistic and clearly labelled | **Met** | <ul><li>Deterministic, 1 July 2024 – 18 October 2026, with seasonality and documented edge cases.</li><li>DEMO badges, a banner, and a label on every export and report page.</li><li>e2e checks the labelling on every page.</li></ul> |
| 8 | Executive reporting is useful and visually professional | **Partially met** | <ul><li>The seven-part executive report is in PDF, XLSX and CSV, with metadata, definitions and freshness.</li><li>e2e *keeps its seven-part structure* and *can be downloaded*.</li></ul> The layout uses the interim branding until the design system is supplied (criterion 3) |
| 9 | SEO and GEO measurements have transparent methodologies | **Met** | [METHODOLOGY.md](METHODOLOGY.md); in-app method cards; sample-size flags; GEO rates always labelled "monitored sample only"; the demo crawl is labelled as synthetic |
| 10 | ChatGPT Ads reporting is mapped to documented capabilities | **Partially met** | Read-only insights at the documented endpoint, with a configurable field mapping, campaign categories (Industries, Collectivities), pacing, and platform conversions kept separate from GA4. The documentation pages could not be fetched from this environment, and the connector has not run against a live account |
| 11 | Administrators can manage websites and accounts | **Met** | Administration → Websites, Social accounts, Advertising, Users. Registry changes feed every breakdown and display name (API test *uses the registry for account names, reported metrics and derived dimensions*) |
| 12 | Administrators can configure dashboard widgets | **Met** | Dashboard builder: add, remove, reorder, resize, rename, hide, and choose KPIs. e2e *the dashboard builder controls the executive overview* |
| 13 | Administrators can manage KPI definitions and targets | **Met** | KPI registry: local names, definitions, owners, enable or disable, conversion events, taxonomy. Targets: scope, objective, warning threshold, progress on cards and in the widget. Calculation formulas stay in code by design, so overrides never silently change a number |
| 14 | Alerts can be created, modified, enabled and disabled | **Met** | e2e *administrators can create, disable and delete an alert rule*; editing in the rule dialog; *Evaluate now* |
| 15 | Reports can be generated and exported | **Met** | e2e *a generated report can be downloaded and appears in the history*. PDF, XLSX, CSV, PNG charts; schedules with delivery history. E-mail delivery is tested against a local SMTP server |
| 16 | Settings persist after refresh | **Met** | e2e *settings persist after a reload*. Preferences, organisation settings, layouts, saved views and favourites are stored in the database |
| 17 | Users cannot access unauthorised settings or data | **Met** | Checked server-side on every route. API tests cover: <ul><li>role blocks;</li><li>module and website scopes;</li><li>super-admin protections;</li><li>GEO approval by Super admin only;</li><li>write-only secrets;</li><li>stored links restricted to the application.</li></ul> e2e *executive viewers cannot reach administration or build reports* |
| 18 | Disconnected sources do not cause application crashes | **Met** | e2e *every page and tab renders without any data*: demo off, nothing connected, 11 pages, 40 tabs. A route-level error boundary keeps any unexpected rendering error inside the page |
| 19 | Empty, loading and failure states are handled | **Met** | Skeletons while loading; "Not available" and "No data" states naming the source; error states with *Retry*; "No data yet" in the top bar. Covered by the same e2e test |
| 20 | No application screen depends on unconfigured external accounts to render | **Met** | The same e2e test renders every screen with no account configured and no demo data |
| 21 | No dummy buttons or misleading success messages remain | **Met** | A full review of settings and actions found these issues and fixed them: <ul><li>GEO measurement could never be activated; now API mode, key, model and approval are required.</li><li>Inert settings now apply: website conversion events, fiscal year, currency, account metrics and display names, AI review label.</li><li>The time zone is shown as fixed, with the reason.</li><li>Schedule links pointed to non-existent jobs; the jobs were added.</li><li>The `.env` comment about session settings was corrected.</li></ul> Disabled controls state why; e-mail is reported as "not sent" without a relay |
| 22 | Technical documentation is provided | **Met** | README, [SETUP](SETUP.md), [ARCHITECTURE](ARCHITECTURE.md), [USER_GUIDE](USER_GUIDE.md), [ADMINISTRATION](ADMINISTRATION.md), [INTEGRATIONS](INTEGRATIONS.md) (readiness matrix and connector sheets), [METHODOLOGY](METHODOLOGY.md), [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md) and `.env.example` |
| 23 | Automated tests pass | **Met** | `npm test`: 114 passed. `npm run test:e2e`: 25 passed. The API suite also passes on PostgreSQL 16 |
| 24 | Production blockers are explicitly documented | **Met** | [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md): five blockers, access to obtain, decisions required, API limits, testing limits, dependency advisories |

## How to re-run the checks

```bash
npm test                          # unit and API tests
npm run test:e2e                  # build, then end-to-end and accessibility tests
TEST_DATABASE_URL=postgres://… npx vitest run server/api.test.ts   # API tests on a disposable PostgreSQL database
```
