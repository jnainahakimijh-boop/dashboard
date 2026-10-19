/** ------------------------------------------------------------------
 *  PostgreSQL schema (Drizzle ORM). Migrations are generated with
 *  `npm run db:generate` into server/db/migrations and applied at
 *  start-up or with `npm run db:migrate`.
 *  ------------------------------------------------------------------ */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ---------------- organisation, identity, access ---------------- */

export const organizations = pgTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  timezone: text('timezone').notNull().default('Europe/Paris'),
  defaultLanguage: text('default_language').notNull().default('fr'),
  currency: text('currency').notNull().default('EUR'),
  /** optional brand logo uploaded by an administrator (data URL, validated image) */
  logoDataUrl: text('logo_data_url'),
  demoMode: boolean('demo_mode').notNull().default(true),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  /** bumped on every write that changes analytics inputs, so every instance rebuilds its in-memory dataset */
  dataVersion: integer('data_version').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  'users',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    /** null → password sign-in disabled (SSO only) */
    passwordHash: text('password_hash'),
    status: text('status').notNull().default('active'),
    language: text('language').notNull().default('fr'),
    /** optional data scope, e.g. { websites: ['veolia-fr'] } — enforced server-side */
    scopes: jsonb('scopes').$type<{ websites?: string[] }>().notNull().default({}),
    isDemo: boolean('is_demo').notNull().default(false),
    failedLogins: integer('failed_logins').notNull().default(0),
    lockedUntil: ts('locked_until'),
    lastLoginAt: ts('last_login_at'),
    preferences: jsonb('preferences').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_uq').on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    method: text('method').notNull().default('password'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    orgId: uuid('org_id'),
    userId: uuid('user_id'),
    userEmail: text('user_email'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    outcome: text('outcome').notNull().default('success'),
    ip: text('ip'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt), index('audit_action_idx').on(t.action)],
);

/* ---------------- monitored estate ---------------- */

export const websites = pgTable('websites', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  basePath: text('base_path').notNull().default('/'),
  language: text('language').notNull(),
  businessUnit: text('business_unit'),
  ga4Property: text('ga4_property'),
  gscProperty: text('gsc_property'),
  drupalEnabled: boolean('drupal_enabled').notNull().default(true),
  status: text('status').notNull().default('active'),
  /** { countries?: string[]; regions?: string[]; contentCategories?: string[]; conversionEvents?: string[] } */
  settings: jsonb('settings').$type<{ countries?: string[]; regions?: string[]; contentCategories?: string[]; conversionEvents?: string[] }>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const socialAccounts = pgTable('social_accounts', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  key: text('key').notNull().unique(),
  platform: text('platform').notNull(),
  name: text('name').notNull(),
  handle: text('handle'),
  externalId: text('external_id'),
  language: text('language').notNull(),
  region: text('region'),
  businessUnit: text('business_unit'),
  status: text('status').notNull().default('active'),
  connectionId: uuid('connection_id'),
  /** metrics reported for this account (subset of the platform's supported metrics) */
  metrics: jsonb('metrics').$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const adAccounts = pgTable('ad_accounts', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  platform: text('platform').notNull().default('chatgpt_ads'),
  name: text('name').notNull(),
  externalId: text('external_id'),
  currency: text('currency').notNull().default('EUR'),
  timezone: text('timezone').notNull().default('Europe/Paris'),
  status: text('status').notNull().default('active'),
  connectionId: uuid('connection_id'),
  createdAt: createdAt(),
});

export const adCampaigns = pgTable('ad_campaigns', {
  id: id(),
  adAccountId: uuid('ad_account_id').notNull(),
  key: text('key').notNull().unique(),
  externalId: text('external_id'),
  name: text('name').notNull(),
  category: text('category').notNull(),
  objective: text('objective'),
  status: text('status').notNull(),
  monthlyBudget: doublePrecision('monthly_budget'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  utmCampaign: text('utm_campaign'),
  businessUnit: text('business_unit'),
  updatedAt: updatedAt(),
});

export const adGroups = pgTable('ad_groups', {
  id: id(),
  campaignId: uuid('campaign_id').notNull(),
  key: text('key').notNull().unique(),
  externalId: text('external_id'),
  name: text('name').notNull(),
  status: text('status').notNull(),
  statusSince: date('status_since'),
  updatedAt: updatedAt(),
});

export const ads = pgTable('ads', {
  id: id(),
  adGroupId: uuid('ad_group_id').notNull(),
  key: text('key').notNull().unique(),
  externalId: text('external_id'),
  name: text('name').notNull(),
  headline: text('headline'),
  landingUrl: text('landing_url'),
  siteKey: text('site_key'),
  status: text('status').notNull().default('active'),
  reviewStatus: text('review_status'),
  updatedAt: updatedAt(),
});

export const campaigns = pgTable('campaigns', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  key: text('key').notNull().unique(),
  utm: text('utm').notNull(),
  nameEn: text('name_en').notNull(),
  nameFr: text('name_fr').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  topic: text('topic'),
  businessUnit: text('business_unit'),
  objective: text('objective'),
  createdAt: createdAt(),
});

export const taxonomyTerms = pgTable(
  'taxonomy_terms',
  {
    id: id(),
    orgId: uuid('org_id').notNull(),
    kind: text('kind').notNull(), // topic | pillar | objective | audience | business_unit | tag
    key: text('key').notNull(),
    labelEn: text('label_en').notNull(),
    labelFr: text('label_fr').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [uniqueIndex('taxonomy_kind_key_uq').on(t.kind, t.key)],
);

/* ---------------- integrations & sync ---------------- */

export const dataConnections = pgTable('data_connections', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  provider: text('provider').notNull(),
  name: text('name').notNull(),
  /** connected | disconnected | degraded | paused | not_configured | demo */
  status: text('status').notNull().default('not_configured'),
  /** api | csv | demo */
  mode: text('mode').notNull().default('demo'),
  /** non-secret configuration (property ids, field mappings, base URLs, schedule) */
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  /** AES-256-GCM ciphertext of the secret payload — never returned by the API */
  secretCiphertext: text('secret_ciphertext'),
  secretUpdatedAt: ts('secret_updated_at'),
  scopeRefs: jsonb('scope_refs').$type<string[]>().notNull().default([]),
  lastSyncAt: ts('last_sync_at'),
  lastSuccessAt: ts('last_success_at'),
  lastError: text('last_error'),
  dataFrom: date('data_from'),
  dataTo: date('data_to'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const syncExecutions = pgTable(
  'sync_executions',
  {
    id: id(),
    connectionId: uuid('connection_id').notNull(),
    jobId: uuid('job_id'),
    kind: text('kind').notNull().default('sync'),
    status: text('status').notNull(),
    startedAt: ts('started_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
    rowsWritten: integer('rows_written').notNull().default(0),
    error: text('error'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('sync_conn_idx').on(t.connectionId, t.startedAt)],
);

/** Warehouse facts: one row per (dataset, day, dimension combination). */
export const factRows = pgTable(
  'fact_rows',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    dataset: text('dataset').notNull(),
    connectionId: uuid('connection_id'),
    importId: uuid('import_id'),
    day: date('day').notNull(),
    dims: jsonb('dims').$type<Record<string, string>>().notNull(),
    measures: jsonb('measures').$type<Record<string, number>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('fact_dataset_day_idx').on(t.dataset, t.day)],
);

export const imports = pgTable('imports', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  dataset: text('dataset').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  status: text('status').notNull(),
  rowsTotal: integer('rows_total').notNull().default(0),
  rowsAccepted: integer('rows_accepted').notNull().default(0),
  rowsRejected: integer('rows_rejected').notNull().default(0),
  rejected: jsonb('rejected').$type<Array<{ row: number; errors: string[] }>>().notNull().default([]),
  dateFrom: date('date_from'),
  dateTo: date('date_to'),
  replaceExisting: boolean('replace_existing').notNull().default(true),
  connectionId: uuid('connection_id'),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
});

/* ---------------- jobs & scheduling ---------------- */

export const jobs = pgTable(
  'jobs',
  {
    id: id(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('queued'), // queued | running | succeeded | failed | cancelled
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    runAt: ts('run_at').notNull().defaultNow(),
    lockedAt: ts('locked_at'),
    lockedBy: text('locked_by'),
    lastError: text('last_error'),
    result: jsonb('result').$type<Record<string, unknown>>(),
    dedupeKey: text('dedupe_key'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    finishedAt: ts('finished_at'),
  },
  (t) => [index('jobs_status_run_idx').on(t.status, t.runAt)],
);

export const schedules = pgTable('schedules', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  jobType: text('job_type').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  /** { kind: 'interval', minutes } | { kind: 'daily', time } | { kind: 'weekly', weekday, time } | { kind: 'monthly', day, time } */
  frequency: jsonb('frequency').$type<Record<string, unknown>>().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastRunAt: ts('last_run_at'),
  nextRunAt: ts('next_run_at'),
  createdAt: createdAt(),
});

export const systemEvents = pgTable(
  'system_events',
  {
    id: id(),
    level: text('level').notNull(),
    source: text('source').notNull(),
    message: text('message').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('system_events_created_idx').on(t.createdAt)],
);

/* ---------------- KPI governance ---------------- */

export const metricDefinitions = pgTable('metric_definitions', {
  metricId: text('metric_id').primaryKey(),
  orgId: uuid('org_id').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  labelEn: text('label_en'),
  labelFr: text('label_fr'),
  definitionEn: text('definition_en'),
  definitionFr: text('definition_fr'),
  owner: text('owner'),
  notes: text('notes'),
  updatedBy: uuid('updated_by'),
  updatedAt: updatedAt(),
});

export const metricTargets = pgTable('metric_targets', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  metricId: text('metric_id').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  value: doublePrecision('value').notNull(),
  filters: jsonb('filters').$type<Record<string, string[]>>().notNull().default({}),
  owner: text('owner'),
  note: text('note'),
  /** business objective the target supports */
  objective: text('objective'),
  /** warn when progress falls below this share of the time-proportional expectation (e.g. 0.9) */
  warningRatio: doublePrecision('warning_ratio'),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
});

/* ---------------- content ---------------- */

export const contentItems = pgTable(
  'content_items',
  {
    id: id(),
    orgId: uuid('org_id').notNull(),
    kind: text('kind').notNull(), // web_page | social_post | video | ad
    sourceKey: text('source_key').notNull().unique(),
    channel: text('channel').notNull(),
    title: text('title').notNull(),
    url: text('url'),
    language: text('language'),
    publishedAt: date('published_at'),
    updatedAt: date('content_updated_at'),
    topic: text('topic'),
    businessUnit: text('business_unit'),
    pillar: text('pillar'),
    objective: text('objective'),
    audience: text('audience'),
    campaign: text('campaign'),
    format: text('format'),
    owner: text('owner'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('content_kind_idx').on(t.kind)],
);

export const contentTags = pgTable(
  'content_tags',
  {
    contentId: uuid('content_id').notNull(),
    tag: text('tag').notNull(),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.tag] })],
);

/* ---------------- SEO ---------------- */

export const keywordGroups = pgTable('keyword_groups', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: createdAt(),
});

export const keywords = pgTable(
  'keywords',
  {
    id: id(),
    orgId: uuid('org_id').notNull(),
    groupId: uuid('group_id'),
    keyword: text('keyword').notNull(),
    siteKey: text('site_key').notNull(),
    country: text('country'),
    language: text('language').notNull(),
    targetUrl: text('target_url'),
    brand: boolean('brand').notNull().default(false),
    /** gsc = Search Console average position; rank_tracker = dedicated rank tracking (not configured by default) */
    trackingSource: text('tracking_source').notNull().default('gsc'),
    active: boolean('active').notNull().default(true),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('keywords_site_kw_uq').on(t.siteKey, t.keyword)],
);

export const seoCrawlScopes = pgTable('seo_crawl_scopes', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  websiteKey: text('website_key').notNull(),
  name: text('name').notNull(),
  allowedHosts: jsonb('allowed_hosts').$type<string[]>().notNull(),
  startUrls: jsonb('start_urls').$type<string[]>().notNull(),
  includePatterns: jsonb('include_patterns').$type<string[]>().notNull().default([]),
  excludePatterns: jsonb('exclude_patterns').$type<string[]>().notNull().default([]),
  maxPages: integer('max_pages').notNull().default(200),
  maxDepth: integer('max_depth').notNull().default(4),
  delayMs: integer('delay_ms').notNull().default(1500),
  /** explicit authorisation by an administrator is required before any crawl */
  authorized: boolean('authorized').notNull().default(false),
  authorizedBy: uuid('authorized_by'),
  authorizedAt: ts('authorized_at'),
  enabled: boolean('enabled').notNull().default(false),
  createdAt: createdAt(),
});

export const seoCrawls = pgTable('seo_crawls', {
  id: id(),
  scopeId: uuid('scope_id').notNull(),
  status: text('status').notNull(),
  source: text('source').notNull().default('crawler'), // crawler | demo_snapshot
  startedAt: ts('started_at').notNull().defaultNow(),
  finishedAt: ts('finished_at'),
  pagesCrawled: integer('pages_crawled').notNull().default(0),
  issuesFound: integer('issues_found').notNull().default(0),
  stats: jsonb('stats').$type<Record<string, unknown>>().notNull().default({}),
  error: text('error'),
  triggeredBy: uuid('triggered_by'),
});

export const seoCrawlPages = pgTable(
  'seo_crawl_pages',
  {
    id: id(),
    crawlId: uuid('crawl_id').notNull(),
    url: text('url').notNull(),
    statusCode: integer('status_code'),
    contentType: text('content_type'),
    title: text('title'),
    metaDescription: text('meta_description'),
    h1Count: integer('h1_count'),
    canonical: text('canonical'),
    robotsMeta: text('robots_meta'),
    hreflang: jsonb('hreflang').$type<Array<{ lang: string; href: string }>>().notNull().default([]),
    wordCount: integer('word_count'),
    imagesMissingAlt: integer('images_missing_alt'),
    internalLinks: integer('internal_links'),
    responseMs: integer('response_ms'),
    depth: integer('depth').notNull().default(0),
    redirectedTo: text('redirected_to'),
    blockedByRobots: boolean('blocked_by_robots').notNull().default(false),
  },
  (t) => [index('crawl_pages_crawl_idx').on(t.crawlId)],
);

export const seoIssues = pgTable(
  'seo_issues',
  {
    id: id(),
    orgId: uuid('org_id').notNull(),
    websiteKey: text('website_key').notNull(),
    rule: text('rule').notNull(),
    severity: text('severity').notNull(),
    url: text('url').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('open'), // open | in_progress | resolved | ignored
    ownerId: uuid('owner_id'),
    firstSeenAt: ts('first_seen_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    resolvedAt: ts('resolved_at'),
    lastCrawlId: uuid('last_crawl_id'),
  },
  (t) => [uniqueIndex('seo_issue_rule_url_uq').on(t.rule, t.url)],
);

export const seoIssueHistory = pgTable('seo_issue_history', {
  id: id(),
  issueId: uuid('issue_id').notNull(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  fromValue: text('from_value'),
  toValue: text('to_value'),
  comment: text('comment'),
  createdAt: createdAt(),
});

export const competitors = pgTable('competitors', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  topics: jsonb('topics').$type<string[]>().notNull().default([]),
  notes: text('notes'),
  /** fictional entries ship with the demo; real competitors are added by administrators */
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: createdAt(),
});

/** Manually entered or imported benchmark observations from legitimate sources (no scraping). */
export const competitorObservations = pgTable('competitor_observations', {
  id: id(),
  competitorId: uuid('competitor_id').notNull(),
  metric: text('metric').notNull(),
  value: doublePrecision('value').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  source: text('source').notNull(),
  sourceUrl: text('source_url'),
  note: text('note'),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
});

/* ---------------- GEO ---------------- */

export const geoPrompts = pgTable('geo_prompts', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  key: text('key').notNull().unique(),
  currentVersion: integer('current_version').notNull().default(1),
  language: text('language').notNull(),
  topic: text('topic').notNull(),
  intent: text('intent').notNull(),
  market: text('market').notNull(),
  priority: text('priority').notNull(),
  expectedPages: jsonb('expected_pages').$type<string[]>().notNull().default([]),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const geoPromptVersions = pgTable(
  'geo_prompt_versions',
  {
    id: id(),
    promptId: uuid('prompt_id').notNull(),
    version: integer('version').notNull(),
    text: text('text').notNull(),
    changeNote: text('change_note'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('geo_prompt_version_uq').on(t.promptId, t.version)],
);

export const geoMeasurements = pgTable(
  'geo_measurements',
  {
    id: id(),
    orgId: uuid('org_id').notNull(),
    promptKey: text('prompt_key').notNull(),
    promptVersion: integer('prompt_version').notNull(),
    provider: text('provider').notNull(),
    measuredOn: date('measured_on').notNull(),
    status: text('status').notNull(),
    mentioned: boolean('mentioned'),
    cited: boolean('cited'),
    mentionRank: integer('mention_rank'),
    citedUrls: jsonb('cited_urls').$type<string[]>().notNull().default([]),
    citedDomains: jsonb('cited_domains').$type<string[]>().notNull().default([]),
    competitors: jsonb('competitors').$type<string[]>().notNull().default([]),
    confidence: text('confidence'),
    model: text('model'),
    /** short excerpt for audit (no personal data) */
    excerpt: text('excerpt'),
    error: text('error'),
    origin: text('origin').notNull(), // api | manual_import
    createdAt: createdAt(),
  },
  (t) => [index('geo_meas_day_idx').on(t.measuredOn)],
);

/* ---------------- personalisation ---------------- */

export const dashboards = pgTable('dashboards', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  /** ordered widgets: [{ id, type, metrics?, size, config }] */
  layout: jsonb('layout').$type<Array<Record<string, unknown>>>().notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: updatedAt(),
});

export const savedViews = pgTable('saved_views', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  route: text('route').notNull(),
  state: jsonb('state').$type<Record<string, unknown>>().notNull(),
  shared: boolean('shared').notNull().default(false),
  isPreset: boolean('is_preset').notNull().default(false),
  createdAt: createdAt(),
});

export const favorites = pgTable(
  'favorites',
  {
    id: id(),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    ref: text('ref').notNull(),
    label: text('label').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('favorites_user_ref_uq').on(t.userId, t.kind, t.ref)],
);

/* ---------------- alerts & notifications ---------------- */

export const alertRules = pgTable('alert_rules', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  metricId: text('metric_id').notNull(),
  filters: jsonb('filters').$type<Record<string, string[]>>().notNull().default({}),
  /** above | below | change_up | change_down | missing_data */
  condition: text('condition').notNull(),
  threshold: doublePrecision('threshold'),
  windowDays: integer('window_days').notNull().default(7),
  compare: text('compare').notNull().default('previous'),
  severity: text('severity').notNull().default('medium'),
  cooldownHours: integer('cooldown_hours').notNull().default(24),
  channels: jsonb('channels').$type<string[]>().notNull().default(['in_app']),
  recipients: jsonb('recipients').$type<string[]>().notNull().default([]),
  enabled: boolean('enabled').notNull().default(true),
  lastEvaluatedAt: ts('last_evaluated_at'),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
});

export const alertEvents = pgTable(
  'alert_events',
  {
    id: id(),
    orgId: uuid('org_id').notNull(),
    ruleId: uuid('rule_id'),
    fingerprint: text('fingerprint').notNull(),
    source: text('source').notNull(),
    severity: text('severity').notNull(),
    status: text('status').notNull().default('open'), // open | acknowledged | resolved
    title: text('title').notNull(),
    titleFr: text('title_fr'),
    evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}),
    occurrences: integer('occurrences').notNull().default(1),
    firstTriggeredAt: ts('first_triggered_at').notNull().defaultNow(),
    lastTriggeredAt: ts('last_triggered_at').notNull().defaultNow(),
    acknowledgedBy: uuid('acknowledged_by'),
    acknowledgedAt: ts('acknowledged_at'),
    resolvedAt: ts('resolved_at'),
  },
  (t) => [index('alert_events_fp_idx').on(t.fingerprint)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

/* ---------------- recommendations ---------------- */

export const recommendations = pgTable('recommendations', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  fingerprint: text('fingerprint').notNull().unique(),
  ruleKey: text('rule_key'),
  origin: text('origin').notNull(), // rule | ai | manual
  title: text('title').notNull(),
  titleFr: text('title_fr'),
  summary: text('summary').notNull(),
  summaryFr: text('summary_fr'),
  evidence: jsonb('evidence').$type<Array<Record<string, unknown>>>().notNull().default([]),
  kpis: jsonb('kpis').$type<string[]>().notNull().default([]),
  channels: jsonb('channels').$type<string[]>().notNull().default([]),
  priority: text('priority').notNull(), // critical | high | medium | low
  impact: text('impact').notNull(), // high | medium | low
  effort: text('effort'),
  action: text('action').notNull(),
  actionFr: text('action_fr'),
  ownerId: uuid('owner_id'),
  status: text('status').notNull().default('new'), // new | under_review | approved | in_progress | completed | dismissed
  dueDate: date('due_date'),
  sources: jsonb('sources').$type<string[]>().notNull().default([]),
  confidence: text('confidence'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  statusChangedAt: ts('status_changed_at'),
});

export const recommendationComments = pgTable('recommendation_comments', {
  id: id(),
  recommendationId: uuid('recommendation_id').notNull(),
  userId: uuid('user_id').notNull(),
  body: text('body').notNull(),
  createdAt: createdAt(),
});

export const recommendationHistory = pgTable('recommendation_history', {
  id: id(),
  recommendationId: uuid('recommendation_id').notNull(),
  userId: uuid('user_id'),
  field: text('field').notNull(),
  fromValue: text('from_value'),
  toValue: text('to_value'),
  createdAt: createdAt(),
});

/* ---------------- reporting ---------------- */

export const reportTemplates = pgTable('report_templates', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull(),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const reportSchedules = pgTable('report_schedules', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  templateId: uuid('template_id').notNull(),
  name: text('name').notNull(),
  frequency: jsonb('frequency').$type<Record<string, unknown>>().notNull(),
  format: text('format').notNull(),
  recipients: jsonb('recipients').$type<string[]>().notNull().default([]),
  enabled: boolean('enabled').notNull().default(true),
  nextRunAt: ts('next_run_at'),
  lastRunAt: ts('last_run_at'),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
});

export const reportRuns = pgTable('report_runs', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  templateId: uuid('template_id'),
  scheduleId: uuid('schedule_id'),
  title: text('title').notNull(),
  status: text('status').notNull(),
  format: text('format').notNull(),
  fileName: text('file_name'),
  fileBytes: bytea('file_bytes'),
  sizeBytes: integer('size_bytes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  /** not_sent_no_provider | sent | failed | not_requested */
  deliveryStatus: text('delivery_status').notNull().default('not_requested'),
  deliveryLog: jsonb('delivery_log').$type<Array<Record<string, unknown>>>().notNull().default([]),
  error: text('error'),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
});

/* ---------------- AI ---------------- */

export const aiSettings = pgTable('ai_settings', {
  orgId: uuid('org_id').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  provider: text('provider').notNull().default('none'), // none | anthropic | openai | azure_openai
  model: text('model'),
  baseUrl: text('base_url'),
  /** the organisation authorised sending aggregated, non-personal metrics to the provider */
  externalProcessingApproved: boolean('external_processing_approved').notNull().default(false),
  approvedBy: uuid('approved_by'),
  approvedAt: ts('approved_at'),
  maxOutputTokens: integer('max_output_tokens').notNull().default(800),
  temperature: doublePrecision('temperature').notNull().default(0.2),
  /** hard cap on input + output tokens per calendar month; null = no cap configured */
  monthlyTokenBudget: integer('monthly_token_budget'),
  /** AI features the organisation allows (currently: executive_summary) */
  allowedFeatures: jsonb('allowed_features').$type<string[]>().notNull().default(['executive_summary']),
  /** AI text is shown as a draft that a person must review before it is shared */
  requireHumanReview: boolean('require_human_review').notNull().default(true),
  connectionId: uuid('connection_id'),
  updatedAt: updatedAt(),
});

export const aiPromptTemplates = pgTable(
  'ai_prompt_templates',
  {
    id: id(),
    orgId: uuid('org_id').notNull(),
    key: text('key').notNull(),
    version: integer('version').notNull(),
    body: text('body').notNull(),
    active: boolean('active').notNull().default(true),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('ai_tpl_key_version_uq').on(t.key, t.version)],
);

export const aiExecutions = pgTable('ai_executions', {
  id: id(),
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id'),
  purpose: text('purpose').notNull(),
  provider: text('provider').notNull(),
  model: text('model'),
  status: text('status').notNull(),
  inputHash: text('input_hash'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  latencyMs: integer('latency_ms'),
  output: text('output'),
  error: text('error'),
  createdAt: createdAt(),
});
