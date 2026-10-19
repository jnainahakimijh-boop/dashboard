# Setup, deployment and operations

## Requirements

- Node.js 22.13 or later (the server uses `process.loadEnvFile` and native `fetch`).
- PostgreSQL 14 or later for production. Locally, an embedded PostgreSQL (PGlite, WebAssembly) is used when `DATABASE_URL` is empty. It is stored in `DATA_DIR/pgdata`.
- About 300 MB of disk space for `node_modules`.

## Local installation

```bash
npm install
npm run setup     # creates .env from .env.example with generated secrets (never overwrites an existing .env)
npm run dev       # API on http://127.0.0.1:8787 (watch mode) + web app on http://localhost:5173
```

On first start, the server applies the migrations and seeds the database. The seed creates:

- The organisation "Veolia — Group Communications" (time zone Europe/Paris, EUR, French by default).
- A super administrator `SEED_ADMIN_EMAIL`. Their password is `SEED_ADMIN_PASSWORD`, which is hashed with scrypt and never logged.
- Demo accounts for each role (`demo.admin@`, `demo.analyst@`, `demo.editor@`, `demo.fr-editor@`, `demo.executive@veolia.example`). Their password is `DEMO_USERS_PASSWORD` when set. They can also use the one-click demo sign-in.
- Reference data: the two veolia.com websites, five social accounts, the ChatGPT Ads account with its Industries and Collectivities campaigns, a taxonomy, a GEO prompt library, keyword groups, crawl scopes (not authorised), alert rules, report templates and a schedule.
- All connections in **Demo** status, or **Not configured** for platform services (AI, SMTP, SSO).

The seed never overwrites an existing organisation.

## Environment variables

Every variable is documented in `.env.example`. The server validates them at start-up and refuses to start in production when a required one is missing; it prints a single-line error.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` enforces the checks below and disables demo sign-in |
| `PORT` / `HOST` | `8787` / `127.0.0.1` | Use `HOST=0.0.0.0` inside a container |
| `APP_BASE_URL` | `http://localhost:5173` | Public URL. Used for the Origin check and secure cookies (`https://…` makes cookies `Secure`) |
| `DATABASE_URL` | empty | **Required in production.** Example: `postgres://user:pass@host:5432/veolia_di?sslmode=require` |
| `DATA_DIR` | `./.data` | Embedded database location (development and demo only) |
| `APP_ENCRYPTION_KEY` | empty | **Required in production.** 32 bytes, base64. Encrypts connector credentials (AES-256-GCM). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SESSION_IDLE_MINUTES` / `SESSION_ABSOLUTE_HOURS` | `60` / `12` | Session expiry |
| `DEMO_MODE` | `true` | Serve synthetic data for sources that have no real data. Set `false` in production once sources are connected |
| `DEMO_LOGIN` | `true` | One-click demo sign-in. Always disabled when `NODE_ENV=production` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@veolia.example` / empty | Password is required to seed a production database |
| `DEMO_USERS_PASSWORD` | empty | Password for the seeded demo accounts (empty means no password sign-in for them) |
| `JOBS_ENABLED` / `JOBS_POLL_MS` | `true` / `2000` | Background job worker (syncs, alerts, reports, crawls, maintenance) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | empty | E-mail delivery (see below) |
| `CRAWLER_USER_AGENT` | `VeoliaDigitalIntelligenceAudit/1.0 (+internal)` | Sent by the SEO crawler |
| `CRAWLER_EXTRA_ALLOWED_HOSTS` | empty | Extra hosts the crawler may reach (normally empty) |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-For` behind a reverse proxy |
| `SERVE_SPA` | `true` | Serve `dist/` from the API server. `npm run dev` sets it to `false` |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. Logs are JSON lines on stdout, and secrets are redacted |

## Database

- Schema: `server/db/schema.ts` (Drizzle ORM).
- Migrations: `server/db/migrations/*.sql`. They are applied automatically at start-up, or explicitly with `npm run db:migrate`.
- To change the schema, edit `schema.ts`, run `npm run db:generate -- --name <change>`, review the SQL and commit it.
- `npm run db:seed` seeds an empty database. `npm run db:reset -- --yes` deletes everything and re-seeds; it is refused in production.

## Production deployment

1. Provision PostgreSQL and a database user that owns the schema.
2. Set at least these environment variables: `NODE_ENV=production`, `DATABASE_URL`, `APP_ENCRYPTION_KEY`, `APP_BASE_URL=https://…`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `HOST=0.0.0.0` (in a container) and `TRUST_PROXY=true` (behind a proxy).
3. Build and start:
   ```bash
   npm ci
   npm run build          # typecheck + web app (dist/) + server bundle (dist-server/, includes migrations)
   npm start              # node dist-server/index.js
   ```
4. Put the service behind the corporate reverse proxy or load balancer with TLS. The application sets CSP, `X-Frame-Options: DENY`, `Referrer-Policy` and other headers itself. It expects to be served from the root path of its own host.
5. Run one instance with `JOBS_ENABLED=true`, and set `JOBS_ENABLED=false` on any extra web instances. Job execution is safe across workers because jobs are claimed with `FOR UPDATE SKIP LOCKED`. Schedule ticks, however, are only de-duplicated on a best-effort basis.
6. Health check: `GET /api/health` returns `200 {"status":"ok"}`, or `503` when the database is unreachable.
7. Sign in as the seeded super administrator, change the password, then work through Administration → Overview → *Production readiness*.

The repository does not ship a container image. If one is needed, a minimal image is `node:22-slim` with `npm ci && npm run build`, `CMD ["node","dist-server/index.js"]` and `EXPOSE 8787`. It has not been built or tested in this environment.

**Before production use** (see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)):

- Finish single sign-on with the identity team.
- Apply the official Veolia design system.
- Connect and verify each data source against real accounts.
- Run a security review.

## Backups and restore

- **PostgreSQL:** take nightly `pg_dump -Fc "$DATABASE_URL" > vdi-$(date +%F).dump` backups, kept according to the corporate policy. Restore with `pg_restore --clean --no-owner -d "$DATABASE_URL" vdi-YYYY-MM-DD.dump`.
- **Encryption key:** store `APP_ENCRYPTION_KEY` separately from database backups, in the corporate secret manager. Without it, stored connector credentials cannot be decrypted and must be entered again. No other data is lost.
- **Embedded database (development):** stop the server and copy `DATA_DIR`.
- Generated report files are stored in the database (`report_runs`), so they are included in database backups. Their retention is set in Administration → Organisation.

## E-mail delivery

Scheduled reports and alert rules with the e-mail channel use SMTP. Assignments and comments create in-app notifications only. E-mails are sent only when both `SMTP_HOST` and `SMTP_FROM` are set:

```
SMTP_HOST=smtp-relay.example.internal
SMTP_PORT=587
SMTP_USER=…
SMTP_PASSWORD=…
SMTP_FROM="Veolia Digital Intelligence <no-reply@veolia.example>"
```

Without them, nothing is sent. Reports are still generated and kept in the Reporting Center, and their delivery status is recorded as **"Not sent — no e-mail service"**. The interface shows this status and never claims an e-mail was sent. In-app notifications always work.

## Single sign-on

Administration → Integration manager → *Single sign-on (OpenID Connect)* stores the issuer, client id and client secret, and *Test connection* validates the issuer's discovery document. **The sign-in flow itself is not implemented yet.** Users currently sign in with an e-mail address and password (scrypt, 12-character policy, lockout after 5 failures for 15 minutes). This is a production blocker.

## Monitoring

- Administration → System monitoring: health, database size, job queue, scheduled jobs (which can be enabled or disabled), recent errors (API 5xx, failed jobs, connector failures), failed imports, rate-limit warnings and data freshness.
- Logs: JSON lines on stdout (`t`, `level`, `msg` plus context), with secrets and credentials redacted.
