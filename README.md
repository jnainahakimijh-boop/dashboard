# Digital Performance — Intelligence Platform

An enterprise digital-analytics platform demo: web, social, content, campaign and
journey performance with a computed intelligence layer (insights, recommendations),
data-quality governance, KPI catalogue, settings and administration.

**All data is synthetic** (deterministic, seeded) and clearly labelled `DEMO DATA`
in the product. The dataset exists to demonstrate product behaviour — every figure
on every page is computed from it, never hard-coded.

## Run

```bash
npm install
npm run dev        # dev server
npm run build      # production build (includes typecheck)
npm run preview    # serve the production build
npm test           # data-accuracy test suite (vitest)
```

## Stack

React 18 · TypeScript (strict) · Vite · Tailwind CSS 4 (token-driven) ·
Recharts · react-router · date-fns · zod · lucide-react · Vitest.
Fonts are self-hosted (Inter Variable + IBM Plex Mono via Fontsource).

## Architecture

```
src/
  data/            seeded deterministic dataset generator + dimension catalogues
  lib/
    metrics.ts     central metric formulas (null-safe: no NaN/Infinity ever)
    aggregate.ts   memoised aggregation selectors — all pages read through these
    insights.ts    rule-based insight engine (computed evidence, EN/FR copy)
    recommendations.ts  backlog derived from insights + standing items
    dataQuality.ts real checks executed against the dataset at load
    format.ts      locale-aware formatters (en-GB / fr-FR), "—" for invalid input
    kpis.ts        KPI registry: value, format and delta semantics per metric
    export.ts      self-describing CSV export with methodology
  state/           Settings (persisted, zod-validated), Filters (URL-synced), Toasts
  i18n/            EN/FR dictionaries — no copy hard-coded in components
  components/      layout shell, charts, tables, filters, KPI cards, primitives
  pages/           one focused page per route (14 routes)
```

## Data & metric integrity rules

- Derived metrics are always computed from source values:
  `CTR = clicks / impressions × 100`, `CVR = conversions / sessions × 100`,
  `CPA = spend / conversions`, `ER(web) = engaged / sessions × 100`, etc.
- Zero denominators render `—` (with an explanatory tooltip where relevant),
  never `NaN` / `Infinity`.
- Rate comparisons are expressed in **percentage points**; absolute metrics in
  relative %.
- Generator invariants (tested): `users ≤ sessions`, `conversions ≤ engaged ≤
  sessions`, `clicks ≤ impressions`, `engagements ≤ impressions`, campaign
  `conversions ≤ sessions ≤ clicks ≤ impressions`.
- Funnels are monotonic by construction and by test.
- Missing data stays missing: the X connector has a simulated 3-day outage —
  charts show gaps, the Data Quality page reports it, totals are footnoted.

### Documented attribution rules

1. Web **Social** channel sessions are modelled from social platform clicks
   (~82% click-through), so social clicks and social-channel sessions reconcile.
2. **Campaign** delivery is a subset of the **Paid Media** channel
   (paid sessions = campaign sessions + always-on base).
3. Landing-page sessions are a distribution of web sessions per market/day —
   page totals reconcile with web totals (tested, <1% rounding divergence).
4. The journey/funnel views are scoped to paid & social and labelled
   deterministic vs **modelled** per stage.

## Tests

`npm test` validates: metric formulas, zero-denominator safety, delta semantics
(pp vs relative), formatter output, every generator invariant across all rows,
funnel monotonicity under varied filters, aggregation reconciliation
(channels/markets/pages/campaigns), filter recalculation (subset + partition),
deterministic regeneration, and edge cases (planned campaign with no delivery,
impossible filter combinations).

## Feature notes

- **Filters** are global, URL-synced (shareable views) and genuinely recompute
  every aggregate. Dimensions that don't apply to a page are visibly dimmed.
- **Saved views** persist locally and are exposed in the header and Reports.
- **Command palette** (`⌘K` / `Ctrl+K`) searches pages, actions, campaigns,
  landing pages, KPIs, markets and content.
- **Dark theme is the flagship**; light and system themes are fully supported.
- **EN/FR** via dictionaries; language, theme, density and preferences persist.
- Accessibility: semantic HTML, keyboard-navigable controls, aria labels on
  icon-only buttons, chart descriptions, non-colour delta indicators (arrows),
  `prefers-reduced-motion` respected.
