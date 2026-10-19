# Veolia Digital Intelligence

Internal platform for Veolia's digital performance: veolia.com (FR and EN), LinkedIn, X, YouTube, organic search, visibility in AI answers (GEO), content, ChatGPT Ads, and website conversions. It is built on one semantic metric layer and comes with a full administration back office.

> **Current state: demonstration data only.** No Veolia account is connected. Every figure comes from a deterministic synthetic dataset covering July 2024 to the present, and the product labels it **DEMO** in every view, export and report. Connecting real sources requires the credentials and authorisations listed in [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md). Production blockers are listed in [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

## Modules

| # | Module | What it covers |
|---|---|---|
| 1 | Executive overview | Configurable KPI cards (no composite score), evolution chart (day/week/month, separate panels or an index, never two axes), channels, map with table, content snapshot, alerts, target progress, deterministic executive summary |
| 2 | Website analytics | GA4 traffic, engagement, acquisition, landing pages, conversions (GA4 key events and Drupal Webform), tracking quality |
| 3 | Social media | LinkedIn, X and YouTube per account and per post, formats, timing, cross-platform comparison with explicit rate definitions |
| 4 | SEO intelligence | Search Console, tracked keywords, authorised technical audit with issue workflow, competitor benchmarks |
| 5 | GEO & AI visibility | Versioned prompt library, mention and citation rates from the monitored sample, share of voice, AI-referral traffic |
| 6 | ChatGPT Ads | Industries and Collectivities campaigns, budget pacing, platform conversions shown next to GA4 key events (never added together); read-only |
| 7 | Content intelligence | One catalogue of pages, posts and videos with each channel's own metrics, taxonomy classification, freshness gaps |
| 8 | Insights & recommendations | Rule-based recommendations with evidence, workflow (New → Dismissed), comments, assignment, history; alerts |
| 9 | Reporting center | Builder with preview; PDF, XLSX and CSV output; executive report with a seven-part structure; templates, schedules, delivery history |
| 10 | Administration | 17 sections, including RBAC, integration manager, dashboard builder, KPI registry, alerts, imports, targets, AI, audit and system monitoring |

## Quick start (local, demo data)

Requirements: Node.js 22.13 or later. No database server is needed; an embedded PostgreSQL (PGlite) is created in `./.data`.

```bash
npm install
npm run setup      # writes .env with a fresh encryption key (never commit it)
npm run dev        # API on :8787, web app on http://localhost:5173
```

Sign in with one of the demo role buttons on the login page (Admin, Analyst, Editor, Executive viewer, FR-only editor). Demo sign-in is disabled automatically in production and once any real source is connected.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | API (watch mode) and Vite dev server |
| `npm run build` | Typecheck, build the web app to `dist/`, bundle the server to `dist-server/` |
| `npm start` | Run the built server (serves the API and the web app on `PORT`) |
| `npm test` | Unit and API tests (Vitest): engine, crawler, connectors, RBAC, imports, reports, i18n |
| `npm run test:e2e` | Build, then Playwright end-to-end and WCAG 2.2 AA (axe) tests on a throw-away database |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Create the organisation, users and reference data if the database is empty |
| `npm run db:reset -- --yes` | Delete everything and re-seed (refused when `NODE_ENV=production`) |
| `npm run db:generate` | Generate a migration after changing `server/db/schema.ts` |

## Documentation

- [docs/SETUP.md](docs/SETUP.md): environment variables, database, deployment, backups, e-mail and SSO.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, components, data flow, security model and decision records.
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md): using the modules.
- [docs/ADMINISTRATION.md](docs/ADMINISTRATION.md): the back office, section by section.
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md): readiness matrix, credentials needed, the Drupal webhook specification and file imports.
- [docs/METHODOLOGY.md](docs/METHODOLOGY.md): metric definitions, comparisons, SEO and GEO methods, recommendation rules, demo data.
- [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md): what is incomplete and the production blockers.
- [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md): status of the 24 acceptance criteria.

## Repository layout

```
shared/     calendar, catalogue, metric registry (semantic layer), RBAC matrix, demo data generator
server/     Hono API: auth, routes, analytics engine, connectors, jobs, insights, reports, crawler, imports
  db/       Drizzle schema, SQL migrations, seed and CLI scripts
src/        React web app: shell, pages per module, components, i18n (EN/FR), state
e2e/        Playwright end-to-end and accessibility tests
docs/       documentation
```

## Brand

The Veolia Design System was not supplied with the brief. The interface uses interim, neutral design tokens isolated in `src/styles/app.css` (colours, radius, shadows, spacing, `--font-sans`). The interim typeface is Inter, an open-source font bundled with the app; it is a placeholder, not a brand choice. No Veolia logo is bundled: an administrator can upload the official logo file in Administration → Organisation. Replacing the tokens with the official design system is listed as a production blocker.
