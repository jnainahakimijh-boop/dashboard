# Veolia Digital Performance

A Communication & Marketing Intelligence platform covering web, social media,
Employee Advocacy, content, SEO, AI Search/AEO, campaigns, conversion journey and
market performance, with a computed intelligence layer (signals, recommendations),
data-quality governance, a KPI catalogue, personal settings and a Back Office.

This repository **is** the deployment folder. It is a static site: drag it onto
[Netlify Drop](https://app.netlify.com/drop) and it runs. There is no build step,
no server, no environment variables and no external CDN dependency at run time.

```
index.html      application shell, VDS design tokens, Tailwind source
src/            pages, components, data generator, metric libraries
vendor/         pinned browser runtime (React, Router, Recharts, Lucide, Tailwind)
_redirects      SPA fallback for deep links
_headers        security headers and cache policy
```

## Running it locally

Any static file server works, as long as unknown paths fall back to `index.html`:

```bash
npx serve -s .          # or python3 -m http.server, with a rewrite rule
```

Prototype sign-in: `veolia-demo` / `VeoliaDemo#2026`. The Veolia SSO button runs a
prototype simulation until `sso-config.js` is filled in with an authorised OIDC
application (Authorization Code + PKCE, no client secret in the browser).

## How the platform is organised

Navigation is grouped by the decision the user is making — Executive, Channel
performance, Conversion & audience, Intelligence, Data & governance, System — and
every analytical page follows the same numbered reading order:

| Step | Question | Typical content |
| --- | --- | --- |
| 1 | What is happening | primary KPIs vs the comparison period |
| 2 | How is it evolving | one metric at a time, one unit per axis |
| 3 | Where is it happening | channel, platform, market, device, content |
| 4 | Why is it happening | diagnostics that explain the movement |
| 5 | What should we do | risks, opportunities, the action queue |

## Data

All figures are synthetic and **deterministic** — regenerating produces the same
numbers, so demos and screenshots stay reproducible. Every value on every page is
computed from the dataset; nothing is hard-coded.

Metric relationships follow real analytics rules, and those rules are asserted in
`src/lib/dataIntegrity.js`: reach never exceeds impressions, clicks never exceed
impressions, sessions never exceed clicks, engaged sessions never exceed sessions,
conversions never exceed sessions, landing-page sessions reconcile with the web
total per day and market, branded plus non-branded splits sum to the total, and
video milestones decrease monotonically.

AI Search & AEO figures are prototype data and are labelled as such in the product.

## Verifying a change

The `tools/` folder is not part of the deployment and is not required to run the
site. To check a change locally you need Node 18+ and `esbuild` + `playwright-core`:

```bash
node tools/syntax-check.mjs .    # parse every module, resolve every local import
node tools/data-check.mjs .      # run the dataset invariants
```
