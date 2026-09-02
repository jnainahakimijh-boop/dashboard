VEOLIA DIGITAL PERFORMANCE
Communication & Marketing Intelligence platform — Netlify Drop edition


DEPLOY
1. Extract this ZIP.
2. Open https://app.netlify.com/drop in a browser.
3. Drag the extracted folder (the one containing index.html) onto the drop zone.
4. Wait for Netlify to publish, then open the generated URL.

No build step, no Netlify Functions, no environment variables, no backend.
Everything the application needs is inside this folder, including the browser
runtime libraries in /vendor. The site therefore also works behind corporate
proxies that block public JavaScript CDNs.


PROTOTYPE ACCESS
Username: veolia-demo
Password: VeoliaDemo#2026

"Continue with Veolia SSO" runs a prototype simulation by default. See
SSO_SETUP.txt to connect a real authorised OIDC application.

Security note: the username/password check in this edition runs in the browser
so the package can be deployed by drag and drop. It is appropriate for a
demonstration prototype only, never for confidential production data.


WHAT IS IN THE FOLDER
index.html            Application shell, design tokens and the Tailwind source
/src                  Application modules (pages, components, data, libraries)
/vendor               Pinned browser runtime: React, Router, Recharts, Lucide,
                      clsx, zod and the Tailwind browser compiler
sso-config.js         Optional OIDC configuration (empty by default)
veolia-logo.webp      Brand assets
veolia-mark.png
_redirects            SPA fallback so deep links resolve on Netlify
_headers              Security headers and cache policy


HOW THE PLATFORM IS ORGANISED
Navigation is grouped by the decision a user is making:

  Executive              Executive Overview · Global Digital Performance
  Channel performance    Web · Social Media · Employee Advocacy · Content ·
                         SEO & Search · AI Search & AEO · Campaigns
  Conversion & audience  Conversion Journey · Audience & Markets
  Intelligence           Insights & Recommendations · Reports
  Data & governance      Data Quality · KPI Catalogue
  System                 Settings & Back Office

Every analytical page follows the same five-step reading order, numbered in the
section headings:

  1  What is happening      primary KPIs against the comparison period
  2  How is it evolving     one metric at a time, one unit per axis
  3  Where is it happening  channel, platform, market, device, content breakdown
  4  Why is it happening    diagnostics that explain the movement
  5  What should we do      risks, opportunities and the action queue


DEMONSTRATION DATA
The dataset is synthetic and deterministic: the same numbers appear on every
load, so screenshots and walkthroughs stay reproducible. Metric relationships
follow real analytics rules — clicks never exceed impressions, engaged sessions
never exceed sessions, conversions never exceed sessions, landing-page sessions
reconcile with the web total, CPA is spend ÷ conversions, CTR is clicks ÷
impressions, and bounce rate is non-engaged sessions ÷ sessions.

AI Search & AEO figures are clearly marked as prototype data throughout: they
are not Veolia measurements and must not be presented as such.
