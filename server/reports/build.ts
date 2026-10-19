/** Builds report content (format-independent) from the semantic engine. */
import { desc, inArray } from 'drizzle-orm';
import { addDays, comparisonRange, defaultGranularity, resolvePreset, type CompareMode, type RangePreset } from '@shared/calendar';
import { CHANNELS, SOCIAL_ACCOUNTS, label, type L10n } from '@shared/catalog';
import { analyticsQuerySchema, type DimensionId, type Filters, type MetricResult } from '@shared/filters';
import { getMetric, type Unit } from '@shared/metrics';
import { z } from 'zod';
import type { AppContext, SessionUser } from '../context';
import { recommendations, seoIssues } from '../db/schema';
import { runQuery } from '../analytics/engine';
import { buildExecutiveSummary, type ExecutiveSummary } from '../insights/summary';
import { campaignPacing } from '../insights/ads';
import { fmtRange, type Lang } from '../insights/format';

export const REPORT_TYPES = ['executive', 'website', 'social', 'seo', 'ads', 'content', 'custom'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const reportConfigSchema = z.object({
  preset: z.enum(['last7', 'last30', 'last90', 'mtd', 'qtd', 'ytd', 'prevMonth', 'prevQuarter', 'prevYear', 'custom']).default('last30'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compare: z.enum(['previous', 'yoy', 'none']).default('previous'),
  filters: z.record(z.array(z.string())).default({}),
  sections: z.array(z.string()).default([]),
  metrics: z.array(z.string()).max(30).optional(),
  groupBy: z.string().optional(),
  language: z.enum(['en', 'fr']).default('fr'),
  title: z.string().max(200).optional(),
});
export type ReportConfig = z.infer<typeof reportConfigSchema>;

export interface KpiRow {
  metric: string;
  label: string;
  unit: Unit;
  value: number | null;
  compare: number | null;
  delta: number | null;
  deltaPct: number | null;
  showPct: boolean;
  mode: string;
  sources: string[];
  notes: string[];
}

export interface TableBlock {
  title: string;
  columns: Array<{ key: string; label: string; unit?: Unit | 'text' }>;
  rows: Array<Record<string, string | number | null>>;
  note?: string;
}

export interface ChartBlock {
  title: string;
  unit: Unit;
  points: Array<{ label: string; value: number | null; compare: number | null }>;
}

export interface ReportSection {
  id: string;
  title: string;
  kpis?: KpiRow[];
  tables?: TableBlock[];
  charts?: ChartBlock[];
  text?: string[];
}

export interface ReportContent {
  title: string;
  type: ReportType;
  language: Lang;
  period: { from: string; to: string };
  comparePeriod: { from: string; to: string } | null;
  compare: CompareMode;
  filters: Filters;
  generatedAt: string;
  generatedBy: string;
  organisation: string;
  dataModes: string[];
  sources: string[];
  sections: ReportSection[];
  summary: ExecutiveSummary | null;
  notes: string[];
}

const DEFAULT_SECTIONS: Record<ReportType, string[]> = {
  executive: ['summary', 'kpis', 'channels', 'search', 'social', 'ads', 'geo', 'recommendations'],
  website: ['kpis', 'trend', 'channels', 'pages', 'conversions', 'quality'],
  social: ['kpis', 'platforms', 'top_posts'],
  seo: ['kpis', 'trend', 'keywords', 'issues', 'geo'],
  ads: ['kpis', 'campaigns', 'pacing', 'conversions_compare'],
  content: ['kpis', 'pages', 'top_posts'],
  custom: ['kpis', 'trend', 'breakdown'],
};

const TYPE_KPIS: Record<ReportType, string[]> = {
  executive: ['sessions', 'conversions', 'form_submissions', 'organic_clicks', 'keyword_visibility', 'social_engagement_rate', 'followers', 'ai_referral_sessions', 'geo_mention_rate', 'ads_spend', 'ads_conversions'],
  website: ['sessions', 'users', 'engaged_sessions', 'engagement_rate', 'views', 'key_events', 'conversions', 'conversion_rate', 'form_submissions', 'ai_referral_sessions'],
  social: ['social_impressions', 'social_engagements', 'social_engagement_rate', 'social_link_clicks', 'social_posts', 'followers', 'followers_net', 'yt_views', 'yt_watch_minutes'],
  seo: ['organic_clicks', 'organic_impressions', 'organic_ctr', 'avg_position', 'keyword_visibility', 'non_branded_clicks', 'geo_mention_rate', 'geo_citation_rate'],
  ads: ['ads_spend', 'ads_impressions', 'ads_clicks', 'ads_ctr', 'ads_cpc', 'ads_conversions', 'ads_cpa', 'ads_ga_sessions', 'ads_ga_key_events'],
  content: ['sessions', 'engagement_rate', 'social_engagement_rate', 'yt_views'],
  custom: ['sessions'],
};

const NOTE_TEXT = (code: string, params: Record<string, unknown> | undefined, lang: Lang): string => {
  const p = params ?? {};
  const en: Record<string, string> = {
    coverage_clipped: `data available ${p.from} → ${p.to}`,
    missing_days: `missing data: ${p.entities} (${p.days} day(s))`,
    users_approx: 'users de-duplicated approximately (demo)',
    compare_incomplete: 'comparison period not covered by data',
    sample_only: 'monitored sample only',
    unavailable: 'not available',
    no_data: 'no data',
  };
  const fr: Record<string, string> = {
    coverage_clipped: `données disponibles ${p.from} → ${p.to}`,
    missing_days: `données manquantes : ${p.entities} (${p.days} jour(s))`,
    users_approx: 'utilisateurs dédupliqués de façon approximative (démo)',
    compare_incomplete: 'période de comparaison non couverte',
    sample_only: 'échantillon suivi uniquement',
    unavailable: 'non disponible',
    no_data: 'aucune donnée',
  };
  return (lang === 'fr' ? fr : en)[code] ?? code;
};

export function resolveReportPeriod(cfg: ReportConfig, asOf: string): { from: string; to: string } {
  if (cfg.preset === 'custom' && cfg.from && cfg.to) return { from: cfg.from, to: cfg.to };
  return resolvePreset((cfg.preset === 'custom' ? 'last30' : cfg.preset) as Exclude<RangePreset, 'custom'>, asOf);
}

export async function buildReport(app: AppContext, user: SessionUser | null, type: ReportType, cfgIn: Partial<ReportConfig>, generatedBy: string): Promise<ReportContent> {
  const cfg = reportConfigSchema.parse(cfgIn);
  const lang = cfg.language;
  const ctx = await app.analytics.engineContext(user);
  const asOf = ctx.dataset.asOf;
  const period = resolveReportPeriod(cfg, asOf);
  const filters = cfg.filters as Filters;
  const Q = (x: { metrics: string[]; groupBy?: DimensionId; granularity?: 'day' | 'week' | 'month'; compare?: CompareMode; limit?: number; filters?: Filters; from?: string; to?: string }) =>
    runQuery(ctx, analyticsQuerySchema.parse({ from: x.from ?? period.from, to: x.to ?? period.to, compare: x.compare ?? cfg.compare, filters: x.filters ?? filters, metrics: x.metrics, groupBy: x.groupBy, granularity: x.granularity, limit: x.limit })).results;
  const L = (l: L10n) => label(l, lang);
  const modes = new Set<string>();
  const sources = new Set<string>();
  const kpiRows = (results: MetricResult[]): KpiRow[] =>
    results.map((r) => {
      const def = getMetric(r.metric)!;
      modes.add(r.meta.mode);
      def.sources.forEach((s) => sources.add(s));
      return {
        metric: r.metric,
        label: L(def.label),
        unit: def.unit,
        value: r.value,
        compare: r.compare,
        delta: r.delta,
        deltaPct: r.deltaPct,
        showPct: def.deltaPct,
        mode: r.meta.mode,
        sources: def.sources,
        notes: [...r.meta.notes.map((n) => NOTE_TEXT(n.code, n.params, lang)), ...(r.meta.ignoredFilters.length ? [`${lang === 'fr' ? 'filtres non applicables' : 'filters not applicable'}: ${r.meta.ignoredFilters.join(', ')}`] : [])],
      };
    });
  const T = (en: string, fr: string) => (lang === 'fr' ? fr : en);
  const sectionsWanted = cfg.sections.length ? cfg.sections : DEFAULT_SECTIONS[type];
  const kpiList = cfg.metrics?.length ? cfg.metrics.filter((m) => getMetric(m)) : TYPE_KPIS[type];
  const sections: ReportSection[] = [];
  let summary: ExecutiveSummary | null = null;

  for (const s of sectionsWanted) {
    switch (s) {
      case 'summary':
        summary = await buildExecutiveSummary(app, user, { from: period.from, to: period.to, compare: cfg.compare, filters, metrics: kpiList });
        sections.push({ id: 'summary', title: T('Executive summary', 'Synthèse') });
        break;
      case 'kpis':
        sections.push({ id: 'kpis', title: T('Key indicators', 'Indicateurs clés'), kpis: kpiRows(Q({ metrics: kpiList })) });
        break;
      case 'trend': {
        const g = defaultGranularity(period);
        const main = kpiList[0];
        const r = Q({ metrics: [main], granularity: g })[0];
        sections.push({ id: 'trend', title: T('Trend', 'Évolution'), charts: [{ title: L(getMetric(main)!.label), unit: getMetric(main)!.unit, points: (r.series ?? []).map((p) => ({ label: p.key, value: p.value, compare: p.compare })) }] });
        break;
      }
      case 'channels': {
        const r = Q({ metrics: ['sessions', 'engagement_rate', 'key_events'], groupBy: 'channel' });
        const keys = r[0].rows?.map((x) => x.key) ?? [];
        sections.push({
          id: 'channels',
          title: T('Website traffic by channel', 'Trafic du site par canal'),
          tables: [
            {
              title: T('Sessions by channel (GA4)', 'Sessions par canal (GA4)'),
              columns: [
                { key: 'channel', label: T('Channel', 'Canal'), unit: 'text' },
                { key: 'sessions', label: 'Sessions', unit: 'count' },
                { key: 'sessionsCompare', label: T('Comparison', 'Comparaison'), unit: 'count' },
                { key: 'engagementRate', label: T('Engagement rate', "Taux d'engagement"), unit: 'percent' },
                { key: 'keyEvents', label: T('Key events', 'Événements clés'), unit: 'count' },
              ],
              rows: keys.map((k) => ({ channel: L(CHANNELS.find((c) => c.id === k)?.name ?? { en: k, fr: k }), sessions: r[0].rows!.find((x) => x.key === k)?.value ?? null, sessionsCompare: r[0].rows!.find((x) => x.key === k)?.compare ?? null, engagementRate: r[1].rows?.find((x) => x.key === k)?.value ?? null, keyEvents: r[2].rows?.find((x) => x.key === k)?.value ?? null })),
            },
          ],
        });
        break;
      }
      case 'search':
        sections.push({ id: 'search', title: T('Organic search', 'Recherche organique'), kpis: kpiRows(Q({ metrics: ['organic_clicks', 'organic_impressions', 'organic_ctr', 'avg_position', 'keyword_visibility'] })) });
        break;
      case 'social':
        sections.push({ id: 'social', title: T('Social media', 'Réseaux sociaux'), kpis: kpiRows(Q({ metrics: ['social_impressions', 'social_engagement_rate', 'followers', 'yt_views'] })) });
        break;
      case 'ads':
        sections.push({ id: 'ads', title: 'ChatGPT Ads', kpis: kpiRows(Q({ metrics: ['ads_spend', 'ads_clicks', 'ads_conversions', 'ads_cpa', 'ads_ga_sessions'] })), text: [T('Platform-attributed conversions are reported separately from GA4 conversions and are never added to them.', 'Les conversions attribuées par la plateforme sont présentées à part des conversions GA4 et ne leur sont jamais additionnées.')] });
        break;
      case 'geo':
        sections.push({ id: 'geo', title: T('AI answer visibility (GEO)', 'Visibilité dans les réponses IA (GEO)'), kpis: kpiRows(Q({ metrics: ['geo_mention_rate', 'geo_citation_rate', 'geo_measurements', 'ai_referral_sessions'] })), text: [T('Rates describe the monitored prompt sample only.', 'Les taux ne concernent que l’échantillon de prompts suivi.')] });
        break;
      case 'pages': {
        const r = Q({ metrics: ['sessions', 'engagement_rate', 'key_events', 'organic_clicks'], groupBy: 'page', limit: 15 });
        sections.push({
          id: 'pages',
          title: T('Top landing pages', 'Principales pages de destination'),
          tables: [
            {
              title: T('Landing pages by sessions', 'Pages de destination par sessions'),
              columns: [
                { key: 'page', label: 'Page', unit: 'text' },
                { key: 'sessions', label: 'Sessions', unit: 'count' },
                { key: 'engagementRate', label: T('Engagement rate', "Taux d'engagement"), unit: 'percent' },
                { key: 'keyEvents', label: T('Key events', 'Événements clés'), unit: 'count' },
                { key: 'organicClicks', label: T('Organic clicks', 'Clics organiques'), unit: 'count' },
              ],
              rows: (r[0].rows ?? []).map((x) => ({ page: x.key.split(':').slice(1).join(':'), sessions: x.value, engagementRate: r[1].rows?.find((y) => y.key === x.key)?.value ?? null, keyEvents: r[2].rows?.find((y) => y.key === x.key)?.value ?? null, organicClicks: r[3].rows?.find((y) => y.key === x.key)?.value ?? null })),
            },
          ],
        });
        break;
      }
      case 'conversions':
        sections.push({ id: 'conversions', title: T('Conversions', 'Conversions'), kpis: kpiRows(Q({ metrics: ['conversions', 'ev_contact_form_submit', 'ev_generate_lead', 'ev_newsletter_signup', 'form_submissions', 'form_tracking_coverage'] })) });
        break;
      case 'quality':
        sections.push({ id: 'quality', title: T('Measurement quality', 'Qualité de la mesure'), kpis: kpiRows(Q({ metrics: ['form_tracking_coverage'], groupBy: 'site' })) });
        break;
      case 'platforms': {
        const r = Q({ metrics: ['social_posts', 'followers', 'followers_net'], groupBy: 'account' });
        sections.push({
          id: 'platforms',
          title: T('Accounts', 'Comptes'),
          tables: [
            {
              title: T('Monitored accounts', 'Comptes suivis'),
              columns: [
                { key: 'account', label: T('Account', 'Compte'), unit: 'text' },
                { key: 'posts', label: T('Posts', 'Publications'), unit: 'count' },
                { key: 'followers', label: T('Followers (end)', 'Abonnés (fin)'), unit: 'count' },
                { key: 'net', label: T('Net change', 'Évolution nette'), unit: 'count' },
              ],
              rows: (r[1].rows ?? []).map((x) => ({ account: SOCIAL_ACCOUNTS.find((a) => a.id === x.key)?.name ?? x.key, posts: r[0].rows?.find((y) => y.key === x.key)?.value ?? null, followers: x.value, net: r[2].rows?.find((y) => y.key === x.key)?.value ?? null })),
            },
          ],
        });
        break;
      }
      case 'top_posts': {
        const posts = (ctx.dataset.posts?.rows ?? []).filter((p) => p.date >= period.from && p.date <= period.to && p.platform !== 'youtube').sort((a, b) => b.engagements - a.engagements).slice(0, 10);
        sections.push({
          id: 'top_posts',
          title: T('Top posts by engagements', 'Meilleures publications (engagements)'),
          tables: [
            {
              title: T('LinkedIn and X', 'LinkedIn et X'),
              columns: [
                { key: 'date', label: 'Date', unit: 'text' },
                { key: 'account', label: T('Account', 'Compte'), unit: 'text' },
                { key: 'text', label: T('Post', 'Publication'), unit: 'text' },
                { key: 'impressions', label: 'Impressions', unit: 'count' },
                { key: 'engagements', label: 'Engagements', unit: 'count' },
              ],
              rows: posts.map((p) => ({ date: p.date, account: SOCIAL_ACCOUNTS.find((a) => a.id === p.account)?.name ?? p.account, text: p.text.slice(0, 80), impressions: p.impressions, engagements: p.engagements })),
            },
          ],
        });
        break;
      }
      case 'keywords': {
        const r = Q({ metrics: ['organic_clicks', 'avg_position'], groupBy: 'query', limit: 20 });
        sections.push({
          id: 'keywords',
          title: T('Top queries (Search Console)', 'Principales requêtes (Search Console)'),
          tables: [
            {
              title: T('Positions are Search Console averages, not rank-tracker readings', 'Positions moyennes Search Console, pas des relevés de suivi de positionnement'),
              columns: [
                { key: 'query', label: T('Query', 'Requête'), unit: 'text' },
                { key: 'clicks', label: T('Clicks', 'Clics'), unit: 'count' },
                { key: 'position', label: 'Position', unit: 'position' },
                { key: 'positionCompare', label: T('Previous', 'Précédente'), unit: 'position' },
              ],
              rows: (r[0].rows ?? []).map((x) => ({ query: x.key.split(':').slice(1).join(':'), clicks: x.value, position: r[1].rows?.find((y) => y.key === x.key)?.value ?? null, positionCompare: r[1].rows?.find((y) => y.key === x.key)?.compare ?? null })),
            },
          ],
        });
        break;
      }
      case 'issues': {
        const rows = await app.db.select().from(seoIssues).where(inArray(seoIssues.status, ['open', 'in_progress']));
        const by = new Map<string, number>();
        for (const i of rows) by.set(`${i.severity}|${i.rule}`, (by.get(`${i.severity}|${i.rule}`) ?? 0) + 1);
        sections.push({
          id: 'issues',
          title: T('Open technical SEO issues', 'Anomalies SEO techniques ouvertes'),
          tables: [{ title: T('By severity and rule', 'Par gravité et règle'), columns: [{ key: 'severity', label: T('Severity', 'Gravité'), unit: 'text' }, { key: 'rule', label: T('Rule', 'Règle'), unit: 'text' }, { key: 'count', label: T('Issues', 'Anomalies'), unit: 'count' }], rows: [...by.entries()].map(([k, n]) => ({ severity: k.split('|')[0], rule: k.split('|')[1].replace(/_/g, ' '), count: n })) }],
        });
        break;
      }
      case 'campaigns': {
        const r = Q({ metrics: ['ads_spend', 'ads_clicks', 'ads_ctr', 'ads_conversions', 'ads_cpa'], groupBy: 'adCampaign' });
        sections.push({
          id: 'campaigns',
          title: T('Campaigns', 'Campagnes'),
          tables: [
            {
              title: T('ChatGPT Ads — platform-reported', 'ChatGPT Ads — données de la plateforme'),
              columns: [
                { key: 'campaign', label: T('Campaign', 'Campagne'), unit: 'text' },
                { key: 'spend', label: T('Spend', 'Dépenses'), unit: 'currency' },
                { key: 'clicks', label: T('Clicks', 'Clics'), unit: 'count' },
                { key: 'ctr', label: 'CTR', unit: 'percent' },
                { key: 'conversions', label: T('Conversions (platform)', 'Conversions (plateforme)'), unit: 'count' },
                { key: 'cpa', label: T('Cost / conversion', 'Coût / conversion'), unit: 'currency' },
              ],
              rows: (r[0].rows ?? []).map((x) => ({ campaign: x.key, spend: x.value, clicks: r[1].rows?.find((y) => y.key === x.key)?.value ?? null, ctr: r[2].rows?.find((y) => y.key === x.key)?.value ?? null, conversions: r[3].rows?.find((y) => y.key === x.key)?.value ?? null, cpa: r[4].rows?.find((y) => y.key === x.key)?.value ?? null })),
            },
          ],
        });
        break;
      }
      case 'pacing': {
        const pc = campaignPacing(ctx, period.to < asOf ? period.to : asOf);
        sections.push({
          id: 'pacing',
          title: T('Budget pacing (month to date)', 'Rythme de dépense (mois en cours)'),
          tables: [{ title: T('Spend vs straight-line budget', 'Dépenses vs budget linéaire'), columns: [{ key: 'name', label: T('Campaign', 'Campagne'), unit: 'text' }, { key: 'spend', label: T('Spend MTD', 'Dépenses MTD'), unit: 'currency' }, { key: 'expected', label: T('Expected MTD', 'Attendu MTD'), unit: 'currency' }, { key: 'pacing', label: T('Pacing', 'Rythme'), unit: 'percent' }], rows: pc.map((x) => ({ name: x.name, spend: x.spendMtd, expected: x.expectedMtd, pacing: x.pacing })) }],
        });
        break;
      }
      case 'conversions_compare':
        sections.push({ id: 'conversions_compare', title: T('Conversions — two systems', 'Conversions — deux systèmes'), kpis: kpiRows(Q({ metrics: ['ads_conversions', 'ads_ga_key_events'] })), text: [T('Shown side by side; never summed.', 'Présentées côte à côte ; jamais additionnées.')] });
        break;
      case 'recommendations': {
        const recs = await app.db.select().from(recommendations).where(inArray(recommendations.status, ['new', 'under_review', 'approved', 'in_progress'])).orderBy(desc(recommendations.updatedAt));
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        sections.push({
          id: 'recommendations',
          title: T('Recommended actions', 'Actions recommandées'),
          tables: [{ title: T('Open recommendations', 'Recommandations ouvertes'), columns: [{ key: 'priority', label: T('Priority', 'Priorité'), unit: 'text' }, { key: 'title', label: T('Recommendation', 'Recommandation'), unit: 'text' }, { key: 'status', label: T('Status', 'Statut'), unit: 'text' }], rows: recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 10).map((r) => ({ priority: r.priority, title: lang === 'fr' ? r.titleFr ?? r.title : r.title, status: r.status })) }],
        });
        break;
      }
      case 'breakdown': {
        if (!cfg.groupBy) break;
        const r = Q({ metrics: kpiList.slice(0, 5), groupBy: cfg.groupBy as DimensionId, limit: 30 });
        const keys = r[0].rows?.map((x) => x.key) ?? [];
        sections.push({
          id: 'breakdown',
          title: `${T('Breakdown by', 'Répartition par')} ${cfg.groupBy}`,
          tables: [{ title: '', columns: [{ key: 'key', label: cfg.groupBy, unit: 'text' }, ...r.map((m) => ({ key: m.metric, label: L(getMetric(m.metric)!.label), unit: getMetric(m.metric)!.unit }))], rows: keys.map((k) => ({ key: k, ...Object.fromEntries(r.map((m) => [m.metric, m.rows?.find((x) => x.key === k)?.value ?? null])) })) }],
        });
        break;
      }
    }
  }

  const titles: Record<ReportType, L10n> = {
    executive: { en: 'Executive digital performance report', fr: 'Rapport exécutif de performance digitale' },
    website: { en: 'Website performance report', fr: 'Rapport de performance des sites' },
    social: { en: 'Social media report', fr: 'Rapport réseaux sociaux' },
    seo: { en: 'SEO & GEO report', fr: 'Rapport SEO & GEO' },
    ads: { en: 'ChatGPT Ads report', fr: 'Rapport ChatGPT Ads' },
    content: { en: 'Content performance report', fr: 'Rapport de performance des contenus' },
    custom: { en: 'Custom report', fr: 'Rapport personnalisé' },
  };
  const notes: string[] = [];
  if (modes.has('demo')) notes.push(T('DEMO DATA — figures are synthetic and must not be used for decisions.', 'DONNÉES DE DÉMONSTRATION — chiffres synthétiques, à ne pas utiliser pour décider.'));
  if (modes.has('partial')) notes.push(T('Some sources are only partially connected.', 'Certaines sources ne sont que partiellement connectées.'));
  return {
    title: cfg.title || L(titles[type]),
    type,
    language: lang,
    period,
    comparePeriod: comparisonRange(period, cfg.compare),
    compare: cfg.compare,
    filters,
    generatedAt: new Date().toISOString(),
    generatedBy,
    organisation: 'Veolia',
    dataModes: [...modes],
    sources: [...sources],
    sections,
    summary,
    notes,
  };
}

export function periodLabel(c: ReportContent): string {
  return fmtRange(c.period, c.language);
}

export { addDays };
