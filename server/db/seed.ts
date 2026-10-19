/** ------------------------------------------------------------------
 *  Idempotent seed. Creates the organisation, the monitored estate
 *  (websites, social accounts, ChatGPT Ads structure), governance data
 *  and demo users. Connections are created in DEMO or NOT CONFIGURED
 *  state — nothing is ever marked as genuinely connected by the seed.
 *  ------------------------------------------------------------------ */
import { eq } from 'drizzle-orm';
import {
  ADS,
  AD_CAMPAIGNS,
  AD_GROUPS,
  AUDIENCES,
  BUSINESS_UNITS,
  CAMPAIGNS,
  COMPETITORS,
  GEO_PROMPTS,
  OBJECTIVES,
  PAGES,
  PILLARS,
  QUERIES,
  SITES,
  SOCIAL_ACCOUNTS,
  TOPICS,
} from '@shared/catalog';
import { DEFAULT_CONVERSION_EVENTS, DEFAULT_EXECUTIVE_KPIS, METRICS } from '@shared/metrics';
import type { Role } from '@shared/rbac';
import type { Env } from '../env';
import { hashPassword } from '../security/crypto';
import { nextRun, type Frequency } from '../jobs/schedule';
import type { DB } from './client';
import * as s from './schema';
import { buildDemoCrawlSnapshot } from '../seo/demoSnapshot';

export const DEFAULT_EXECUTIVE_LAYOUT = [
  { id: 'kpis', type: 'kpi_grid', visible: true, metrics: DEFAULT_EXECUTIVE_KPIS },
  { id: 'evolution', type: 'evolution', visible: true, metrics: ['sessions', 'organic_clicks', 'social_engagements', 'ads_ga_sessions'] },
  { id: 'channels', type: 'channels', visible: true },
  { id: 'geography', type: 'geography', visible: true },
  { id: 'content', type: 'content_snapshot', visible: true },
  { id: 'alerts', type: 'alerts', visible: true },
  { id: 'summary', type: 'ai_summary', visible: true },
];

const DEMO_USERS: Array<{ email: string; name: string; role: Role; language: string }> = [
  { email: 'demo.admin@veolia.example', name: 'Demo Admin', role: 'admin', language: 'fr' },
  { email: 'demo.analyst@veolia.example', name: 'Demo Analyst', role: 'analyst', language: 'fr' },
  { email: 'demo.editor@veolia.example', name: 'Demo Editor', role: 'editor', language: 'en' },
  { email: 'demo.executive@veolia.example', name: 'Demo Executive', role: 'executive_viewer', language: 'fr' },
];

export async function seedIfEmpty(db: DB, env: Env, log: (m: string) => void = () => {}): Promise<{ orgId: string; created: boolean }> {
  const existing = await db.select({ id: s.organizations.id }).from(s.organizations).limit(1);
  if (existing[0]) return { orgId: existing[0].id, created: false };
  if (env.isProduction && !env.SEED_ADMIN_PASSWORD) throw new Error('SEED_ADMIN_PASSWORD is required to initialise a production database.');

  const [org] = await db
    .insert(s.organizations)
    .values({
      name: 'Veolia — Group Communications',
      slug: 'veolia',
      timezone: 'Europe/Paris',
      defaultLanguage: 'fr',
      currency: 'EUR',
      demoMode: env.DEMO_MODE,
      settings: {
        conversionEvents: DEFAULT_CONVERSION_EVENTS,
        fiscalYearStartMonth: 1,
        weekStartsOn: 1,
        dataRetentionMonths: 25,
        auditRetentionMonths: 24,
        reportRetentionDays: 180,
      },
    })
    .returning();
  const orgId = org.id;
  log(`organisation ${orgId}`);

  /* users */
  const adminHash = env.SEED_ADMIN_PASSWORD ? await hashPassword(env.SEED_ADMIN_PASSWORD) : null;
  const [admin] = await db
    .insert(s.users)
    .values({ orgId, email: env.SEED_ADMIN_EMAIL, name: 'Platform Administrator', role: 'super_admin', passwordHash: adminHash, language: 'fr' })
    .returning();
  if (env.DEMO_MODE) {
    const demoHash = env.DEMO_USERS_PASSWORD ? await hashPassword(env.DEMO_USERS_PASSWORD) : null;
    for (const u of DEMO_USERS) await db.insert(s.users).values({ orgId, ...u, passwordHash: demoHash, isDemo: true });
    await db.insert(s.users).values({ orgId, email: 'demo.fr-editor@veolia.example', name: 'Demo Editor (FR site only)', role: 'editor', language: 'fr', passwordHash: demoHash, isDemo: true, scopes: { websites: ['veolia-fr'] } });
  }

  /* estate */
  await db.insert(s.websites).values(
    SITES.map((w) => ({ orgId, key: w.id, name: w.name, domain: w.domain, basePath: w.basePath, language: w.language, businessUnit: w.businessUnit, ga4Property: w.ga4Property, gscProperty: w.gscProperty, drupalEnabled: true })),
  );

  const conn = async (provider: string, name: string, status: string, mode: string, config: Record<string, unknown> = {}, scopeRefs: string[] = []) => {
    const [row] = await db.insert(s.dataConnections).values({ orgId, provider, name, status, mode, config, scopeRefs }).returning();
    return row.id;
  };
  const demoStatus = env.DEMO_MODE ? 'demo' : 'not_configured';
  const demoMode = env.DEMO_MODE ? 'demo' : 'api';
  for (const w of SITES) {
    await conn('ga4', `GA4 — ${w.name}`, demoStatus, demoMode, { property: w.ga4Property, site: w.id, customChannelGroup: 'AI referral' }, [w.id]);
    await conn('gsc', `Search Console — ${w.name}`, demoStatus, demoMode, { siteUrl: w.gscProperty, site: w.id }, [w.id]);
    await conn('drupal', `Drupal Webform — ${w.name}`, demoStatus, demoMode, { site: w.id, forms: ['contact', 'lead_request', 'newsletter'] }, [w.id]);
  }
  const socialConn: Record<string, string> = {};
  for (const a of SOCIAL_ACCOUNTS) {
    socialConn[a.id] = await conn(a.platform, `${a.platform === 'linkedin' ? 'LinkedIn' : a.platform === 'x' ? 'X' : 'YouTube'} — ${a.name}`, demoStatus, demoMode, { account: a.id }, [a.id]);
  }
  await db.insert(s.socialAccounts).values(
    SOCIAL_ACCOUNTS.map((a) => ({ orgId, key: a.id, platform: a.platform, name: a.name, handle: a.handle, language: a.language, region: a.region, businessUnit: a.businessUnit, connectionId: socialConn[a.id] })),
  );
  const adsConn = await conn('chatgpt_ads', 'ChatGPT Ads — Veolia advertiser account', demoStatus, demoMode, {
    baseUrl: 'https://api.ads.openai.com/v1',
    attributionWindow: 'read from account settings',
    timeGranularity: 'daily',
    aggregationLevel: 'ad',
  });
  const [adAccount] = await db.insert(s.adAccounts).values({ orgId, name: 'Veolia — ChatGPT Ads (demo)', currency: 'EUR', connectionId: adsConn }).returning();
  const campaignIds: Record<string, string> = {};
  for (const c of AD_CAMPAIGNS) {
    const [row] = await db
      .insert(s.adCampaigns)
      .values({ adAccountId: adAccount.id, key: c.id, name: c.name, category: c.category, objective: c.objective, status: c.status, monthlyBudget: c.monthlyBudget, startDate: c.from, utmCampaign: c.utmCampaign, businessUnit: c.businessUnit })
      .returning();
    campaignIds[c.id] = row.id;
  }
  const groupIds: Record<string, string> = {};
  for (const g of AD_GROUPS) {
    const [row] = await db
      .insert(s.adGroups)
      .values({ campaignId: campaignIds[g.campaign], key: g.id, name: g.name, status: g.status, statusSince: g.pausedFrom ?? null })
      .returning();
    groupIds[g.id] = row.id;
  }
  await db.insert(s.ads).values(
    ADS.map((a) => ({ adGroupId: groupIds[a.group], key: a.id, name: a.name, headline: a.headline, landingUrl: `https://www.veolia.com${a.landing}`, siteKey: a.site, status: AD_GROUPS.find((g) => g.id === a.group)?.status === 'paused' ? 'paused' : 'active', reviewStatus: 'approved' })),
  );

  await conn('geo_openai', 'GEO sampling — OpenAI API (web search)', demoStatus, demoMode, { model: 'configure in Administration', cadenceDays: 7 });
  await conn('geo_perplexity', 'GEO sampling — Perplexity API', demoStatus, demoMode, { model: 'configure in Administration', cadenceDays: 7 });
  await conn('geo_manual', 'GEO — manual observations (Google AI features)', demoStatus, env.DEMO_MODE ? 'demo' : 'csv', { cadenceDays: 28 });
  await conn('ai_provider', 'AI explanations provider', 'not_configured', 'api', { provider: 'none' });
  await conn('smtp', 'E-mail delivery (SMTP)', env.smtpConfigured ? 'connected' : 'not_configured', 'api', { host: env.SMTP_HOST || null });
  await conn('oidc', 'Single sign-on (OpenID Connect)', 'not_configured', 'api', {});

  /* taxonomy & campaigns */
  const terms = [
    ...TOPICS.map((t) => ({ kind: 'topic', key: t.id, labelEn: t.name.en, labelFr: t.name.fr })),
    ...PILLARS.map((t) => ({ kind: 'pillar', key: t.id, labelEn: t.name.en, labelFr: t.name.fr })),
    ...OBJECTIVES.map((t) => ({ kind: 'objective', key: t.id, labelEn: t.name.en, labelFr: t.name.fr })),
    ...AUDIENCES.map((t) => ({ kind: 'audience', key: t.id, labelEn: t.name.en, labelFr: t.name.fr })),
    ...BUSINESS_UNITS.map((t) => ({ kind: 'business_unit', key: t.id, labelEn: t.name.en, labelFr: t.name.fr })),
    { kind: 'tag', key: 'evergreen', labelEn: 'Evergreen', labelFr: 'Intemporel' },
    { kind: 'tag', key: 'needs_update', labelEn: 'Needs update', labelFr: 'À mettre à jour' },
    { kind: 'tag', key: 'executive_voice', labelEn: 'Executive voice', labelFr: 'Prise de parole dirigeant' },
    { kind: 'tag', key: 'customer_story', labelEn: 'Customer story', labelFr: 'Témoignage client' },
  ];
  await db.insert(s.taxonomyTerms).values(terms.map((t) => ({ orgId, ...t })));
  await db.insert(s.campaigns).values(
    CAMPAIGNS.map((c) => ({ orgId, key: c.id, utm: c.utm, nameEn: c.name.en, nameFr: c.name.fr, startDate: c.from, endDate: c.to, topic: c.topic, businessUnit: c.bu, objective: c.objective })),
  );

  /* content catalogue (web pages) */
  await db.insert(s.contentItems).values(
    PAGES.map((p) => ({
      orgId,
      kind: 'web_page',
      sourceKey: p.id,
      channel: p.site,
      title: p.title,
      url: `https://www.veolia.com${p.path}`,
      language: p.site === 'veolia-fr' ? 'fr' : 'en',
      publishedAt: p.published,
      updatedAt: p.updated,
      topic: p.topic,
      businessUnit: p.bu,
      pillar: p.pillar,
      objective: p.objective,
      audience: p.audience,
      campaign: p.campaign ?? null,
      format: p.type,
      owner: p.owner,
    })),
  );

  /* SEO: keyword groups, keywords, competitors, crawl scopes, demo crawl snapshot */
  const groups: Record<string, string> = {};
  for (const t of TOPICS) {
    const [g] = await db.insert(s.keywordGroups).values({ orgId, name: t.name.en, description: t.name.fr }).returning();
    groups[t.id] = g.id;
  }
  const [brandGroup] = await db.insert(s.keywordGroups).values({ orgId, name: 'Brand', description: 'Marque' }).returning();
  await db.insert(s.keywords).values(
    QUERIES.map((q) => ({
      orgId,
      groupId: q.brand ? brandGroup.id : groups[q.topic],
      keyword: q.query,
      siteKey: q.site,
      country: q.site === 'veolia-fr' ? 'FR' : null,
      language: q.site === 'veolia-fr' ? 'fr' : 'en',
      targetUrl: `https://www.veolia.com${q.page}`,
      brand: q.brand,
      trackingSource: 'gsc',
      createdBy: admin.id,
    })),
  );
  await db.insert(s.competitors).values(COMPETITORS.map((c) => ({ orgId, key: c.id, name: c.name, domain: c.domain, topics: Object.keys(c.strength), isDemo: true, notes: 'Fictional competitor for demonstration only.' })));
  for (const w of SITES) {
    const [scope] = await db
      .insert(s.seoCrawlScopes)
      .values({
        orgId,
        websiteKey: w.id,
        name: `${w.name} — technical audit`,
        allowedHosts: [w.domain],
        startUrls: [`https://${w.domain}${w.basePath}`],
        includePatterns: [`${w.basePath}/`],
        excludePatterns: ['/search', '?'],
        maxPages: 300,
        maxDepth: 4,
        delayMs: 2000,
        authorized: false,
        enabled: false,
      })
      .returning();
    if (env.DEMO_MODE) await buildDemoCrawlSnapshot(db, orgId, scope.id, w.id);
  }

  /* GEO prompt library with versions */
  for (const p of GEO_PROMPTS) {
    const [row] = await db
      .insert(s.geoPrompts)
      .values({ orgId, key: p.id, currentVersion: p.id === 'p02' ? 2 : 1, language: p.lang, topic: p.topic, intent: p.intent, market: p.market, priority: p.priority, expectedPages: p.expectedPages, createdBy: admin.id })
      .returning();
    if (p.id === 'p02') {
      await db.insert(s.geoPromptVersions).values({ promptId: row.id, version: 1, text: 'Best technologies to remove PFAS from water?', changeNote: 'Initial wording', createdBy: admin.id, createdAt: new Date('2026-04-15T09:00:00Z') });
      await db.insert(s.geoPromptVersions).values({ promptId: row.id, version: 2, text: p.text, changeNote: 'Clarified drinking-water context (comparisons before 1 Jul 2026 use v1)', createdBy: admin.id, createdAt: new Date('2026-07-01T09:00:00Z') });
    } else {
      await db.insert(s.geoPromptVersions).values({ promptId: row.id, version: 1, text: p.text, changeNote: 'Initial wording', createdBy: admin.id, createdAt: new Date('2026-04-15T09:00:00Z') });
    }
  }

  /* KPI registry rows */
  await db.insert(s.metricDefinitions).values(METRICS.filter((m) => !m.internal).map((m) => ({ metricId: m.id, orgId, enabled: true, owner: m.module === 'ads' ? 'Paid media lead' : m.module === 'social' ? 'Social media lead' : m.module === 'geo' || m.module === 'search' ? 'SEO & GEO lead' : 'Digital analytics lead' })));

  /* targets (demo) */
  await db.insert(s.metricTargets).values([
    { orgId, metricId: 'sessions', periodStart: '2026-10-01', periodEnd: '2026-10-31', value: 900_000, owner: 'Digital analytics lead', createdBy: admin.id, note: 'Demo target' },
    { orgId, metricId: 'form_submissions', periodStart: '2026-10-01', periodEnd: '2026-10-31', value: 9_000, owner: 'Digital analytics lead', createdBy: admin.id, note: 'Demo target' },
    { orgId, metricId: 'organic_clicks', periodStart: '2026-10-01', periodEnd: '2026-10-31', value: 520_000, owner: 'SEO & GEO lead', createdBy: admin.id, note: 'Demo target' },
    { orgId, metricId: 'social_engagement_rate', periodStart: '2026-07-01', periodEnd: '2026-12-31', value: 0.045, owner: 'Social media lead', createdBy: admin.id, note: 'Demo target' },
    { orgId, metricId: 'ads_spend', periodStart: '2026-10-01', periodEnd: '2026-10-31', value: 30_000, owner: 'Paid media lead', createdBy: admin.id, note: 'Monthly budget (demo)' },
    { orgId, metricId: 'geo_mention_rate', periodStart: '2026-07-01', periodEnd: '2026-12-31', value: 0.5, owner: 'SEO & GEO lead', createdBy: admin.id, note: 'Demo target' },
  ]);

  /* dashboards & saved views */
  await db.insert(s.dashboards).values({ orgId, key: 'executive', name: 'Executive overview', layout: DEFAULT_EXECUTIVE_LAYOUT, updatedBy: admin.id });
  const presets = [
    { name: 'FR website — last 30 days', route: '/web', state: { preset: 'last30', filters: { site: ['veolia-fr'] } } },
    { name: 'EN website — quarter to date', route: '/web', state: { preset: 'qtd', filters: { site: ['veolia-en'] } } },
    { name: 'ChatGPT Ads — Collectivities, month to date', route: '/ads', state: { preset: 'mtd', filters: { campaign: ['chatgpt-collectivities'] } } },
    { name: 'Water Technologies — last 90 days', route: '/', state: { preset: 'last90', filters: { bu: ['water_tech'] } } },
  ];
  await db.insert(s.savedViews).values(presets.map((p) => ({ orgId, userId: admin.id, ...p, shared: true, isPreset: true })));

  /* alert rules */
  await db.insert(s.alertRules).values([
    { orgId, name: 'Organic clicks down more than 15% week on week', metricId: 'organic_clicks', condition: 'change_down_pct', threshold: 15, windowDays: 7, severity: 'high', cooldownHours: 72, createdBy: admin.id },
    { orgId, name: 'EN average position worsened by more than 1 place (water technologies)', metricId: 'avg_position', filters: { site: ['veolia-en'], bu: ['water_tech'] }, condition: 'change_up_abs', threshold: 1, windowDays: 7, severity: 'high', cooldownHours: 72, createdBy: admin.id },
    { orgId, name: 'GA4 form tracking coverage below 60%', metricId: 'form_tracking_coverage', condition: 'below', threshold: 0.6, windowDays: 1, severity: 'critical', cooldownHours: 24, createdBy: admin.id },
    { orgId, name: 'Missing social data', metricId: 'social_impressions', condition: 'missing_data', windowDays: 7, severity: 'medium', cooldownHours: 72, createdBy: admin.id },
    { orgId, name: 'ChatGPT Ads spend pacing above 110% of budget', metricId: 'ads_spend', condition: 'pacing_above', threshold: 1.1, windowDays: 1, severity: 'high', cooldownHours: 48, createdBy: admin.id },
    { orgId, name: 'AI answer mention rate down more than 10 points', metricId: 'geo_mention_rate', condition: 'change_down_abs', threshold: 0.1, windowDays: 28, severity: 'medium', cooldownHours: 168, createdBy: admin.id },
    { orgId, name: 'AI referral sessions up more than 25%', metricId: 'ai_referral_sessions', condition: 'change_up_pct', threshold: 25, windowDays: 28, severity: 'info', cooldownHours: 168, createdBy: admin.id },
  ]);

  /* recurring jobs */
  const now = new Date();
  const sched = (name: string, jobType: string, frequency: Frequency, payload: Record<string, unknown> = {}) => ({ orgId, name, jobType, frequency, payload, enabled: true, nextRunAt: nextRun(frequency, now) });
  await db.insert(s.schedules).values([
    sched('Evaluate alert rules', 'alerts.evaluate', { kind: 'daily', time: '07:00' }),
    sched('Refresh recommendations', 'recommendations.generate', { kind: 'daily', time: '07:15' }),
    sched('Synchronise connected sources', 'connectors.sync_all', { kind: 'daily', time: '05:30' }),
    sched('Purge expired sessions and old files', 'maintenance.cleanup', { kind: 'daily', time: '03:00' }),
  ]);

  /* report templates & schedules */
  const [execTpl] = await db
    .insert(s.reportTemplates)
    .values({ orgId, type: 'executive', name: 'Monthly executive report', config: { preset: 'prevMonth', compare: 'previous', sections: ['summary', 'kpis', 'channels', 'search', 'social', 'ads', 'geo', 'recommendations'], language: 'fr' }, createdBy: admin.id })
    .returning();
  await db.insert(s.reportTemplates).values([
    { orgId, type: 'website', name: 'Website performance — weekly', config: { preset: 'last7', compare: 'previous', sections: ['kpis', 'channels', 'pages', 'conversions', 'quality'], language: 'fr' }, createdBy: admin.id },
    { orgId, type: 'social', name: 'Social media — monthly', config: { preset: 'prevMonth', compare: 'previous', sections: ['kpis', 'platforms', 'top_posts'], language: 'fr' }, createdBy: admin.id },
    { orgId, type: 'seo', name: 'SEO & GEO — monthly', config: { preset: 'prevMonth', compare: 'previous', sections: ['kpis', 'keywords', 'issues', 'geo'], language: 'en' }, createdBy: admin.id },
    { orgId, type: 'ads', name: 'ChatGPT Ads — weekly', config: { preset: 'last7', compare: 'previous', sections: ['kpis', 'campaigns', 'pacing'], language: 'fr' }, createdBy: admin.id },
  ]);
  const monthly: Frequency = { kind: 'monthly', day: 2, time: '08:00' };
  await db.insert(s.reportSchedules).values({ orgId, templateId: execTpl.id, name: 'Executive report — 2nd of each month', frequency: monthly, format: 'pdf', recipients: ['comex-digital@veolia.example'], enabled: true, nextRunAt: nextRun(monthly, now), createdBy: admin.id });

  /* AI settings: disabled until an administrator configures and approves a provider */
  await db.insert(s.aiSettings).values({ orgId, enabled: false, provider: 'none' });
  await db.insert(s.aiPromptTemplates).values({
    orgId,
    key: 'executive_summary',
    version: 1,
    body: [
      'You explain digital performance figures to executives in {{language}}.',
      'Use ONLY the facts provided. Do not invent numbers, causes or sources.',
      'Never claim causation; describe co-occurring changes as associations.',
      'Mention any data limitations listed. Keep to 120 words.',
      'Facts (JSON): {{facts}}',
    ].join('\n'),
    createdBy: admin.id,
  });

  await db.update(s.organizations).set({ updatedAt: new Date() }).where(eq(s.organizations.id, orgId));
  log('seed complete');
  return { orgId, created: true };
}
