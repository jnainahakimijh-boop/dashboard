# User guide

## Signing in, language and preferences

- Sign in with your e-mail address and password. During a demo, use one of the role buttons on the sign-in page.
- Switch between **FR** and **EN** at the top of any page. Choose the theme (light, dark or follow the device) and the density in **Settings**. These choices are saved to your profile.
- **DEMO** badges mark figures computed from demonstration data. A banner at the top repeats it while any demo source is in use. Demo figures are not Veolia data.

## Finding your way

- The left navigation groups the modules into *Performance*, *Intelligence* and *Governance*. What you see depends on your role and on any website or module restriction set by an administrator.
- **Search** (Ctrl K / ⌘ K) finds pages, indicators, campaigns, websites, content, tracked keywords, GEO prompts, recommendations, SEO issues and report templates, and opens the matching view.
- The **star** next to a page title adds it to your favourites, available from the top bar and from Settings.
- **Data up to …** in the top bar shows the last complete day of data and, per source, whether it is demo or connected and how fresh it is. Data is refreshed daily; it is not real time.

## Filters, comparisons and saved views

The filter bar below each page title controls the period, the comparison and the dimensions:

- period presets, or a custom range;
- comparison with the previous period, the same period last year, or none;
- dimensions: site, country, region, language, channel, campaign, business unit and more.

Filters are kept in the address, so a link reproduces exactly what you see. On a phone, the dimension filters are folded behind **Filters**.

- When a source cannot apply one of your filters, the widget says **"filters not applied"** and names them; it never ignores them silently.
- **Saved views** store the current filters for reuse. Analysts and administrators can share them with everyone.

## Reading indicators and charts

- **KPI cards** show:
  - the value and the change (a percentage for counts, an absolute difference in points for rates);
  - the comparison value;
  - a sparkline;
  - the source;
  - when a target exists, the target progress, shown separately from the change.
- The **ⓘ** button gives the definition. Other icons flag notes such as partial coverage, missing days or sampled data.
- Changes are green when they are favourable for that indicator. Average position and costs are better when lower. Colour is never the only signal: an arrow and the wording carry the meaning.
- Charts never use two axes. Indicators with different units are shown as separate panels or as an index (base 100). Every chart can switch to a table, and many can be exported to PNG.
- Tables can be sorted, and exported to CSV or XLSX with the period, filters and sources. Exports are recorded in the audit log.

## Modules

**Executive overview.** Its layout is set by administrators in the dashboard builder. It shows:

- KPI cards;
- the evolution chart (day, week or month);
- channel breakdown;
- the world map with a region and country table;
- top pages and posts;
- strategic alerts;
- target progress;
- the executive summary: what changed, drivers (contributions, not causes), attention points, actions and data limitations.

**Website analytics.** Six tabs:

- overview, including AI-assistant referrals;
- acquisition (channels, source / medium, campaigns);
- audience (countries, devices, browsers, languages);
- content (landing pages);
- conversions: GA4 key events next to Drupal form submissions, with tracking coverage;
- quality (measurement checks).

**Social media.**

- Overview and one tab per platform.
- Posts, which editors can classify.
- Cross-platform comparison. Rates have different denominators, so compare trends rather than levels.
- Publication timing.

**SEO intelligence.**

- Search Console totals.
- Tracked keywords: positions are Search Console averages.
- Queries and pages.
- The technical audit, which runs only inside an authorised scope.
- Issues, with a workflow: open, in progress, resolved or ignored, with owner, comments and history.
- Competitor benchmarks.

**GEO & AI visibility.**

- Mention and citation rates from the monitored prompt sample, share of voice, most-cited domains, providers and methods.
- The prompt library: editing a prompt creates a new version.
- Measurements, opportunities, and a side-by-side view with organic search.
- Administrators can **run a measurement** once a provider is ready (API mode, key, model and a super administrator's approval). Until then the button is disabled, and the reason is shown.

All rates describe the monitored sample only.

**ChatGPT Ads (read-only).**

- Campaigns with their ad groups and ads.
- Month-to-date budget pacing.
- Platform-attributed conversions shown next to GA4 key events. The two are never added together.
- Landing pages and integration status.

**Content intelligence.**

- A catalogue of web pages, social posts and videos, each with its own channel metrics. There is no combined score.
- Topic view.
- Freshness and gap lists (pages not updated for a year, pages without AI citations in the sample, pages not linked from social posts).

**Insights & recommendations.**

- The executive summary and how it is produced.
- Recommendations, with their evidence, sources and confidence. Analysts and administrators move them through *New → Under review → Approved → In progress → Completed* (or *Dismissed*), assign an owner and set a due date. Editors can comment. Every change is kept in the history, and assignments notify the owner.
- Alerts, which can be acknowledged or resolved.

**Reporting center.**

- *Report builder*: choose a type, sections, indicators and charts; add a written commentary (shown as author commentary); select the language and format; then **Preview** or **Generate & download**. The period and filters come from the filter bar, and the shortcuts select weekly, monthly or quarterly periods.
- The **executive report** always contains seven parts: summary, highlights, significant changes, possible drivers, risks and opportunities, recommended actions, data limitations. Channel appendices follow.
- *Generated reports* keeps every file with its metadata and e-mail delivery status.
- *Schedules* runs a template daily, weekly, monthly or quarterly (Europe/Paris). Without an e-mail service, scheduled reports are generated and kept here, marked **"Not sent — no e-mail service"**.
- *Templates* stores saved report configurations.

Every file states its title, period, comparison, filters, sources, data freshness, generation time and metric definitions. Demo data is marked on every page of the file.

## Roles at a glance

| Role | Can |
|---|---|
| Executive viewer | Read dashboards, summaries and published reports |
| Editor | Plus: classify content, comment on recommendations, work on SEO issues, create reports, acknowledge alerts, export tables |
| Analyst | Plus: manage recommendations, keywords, prompts, targets, alert rules, imports, schedules; generate AI wording when enabled |
| Admin | Plus: administration (users, integrations, KPIs, dashboards, data, audit, system) except AI settings |
| Super admin | Everything, including AI settings and other administrators |

The full matrix is in Administration → Roles & permissions. Permissions are enforced by the server, whatever the interface shows.
