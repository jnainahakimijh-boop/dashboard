/** ------------------------------------------------------------------
 *  Semantic metric registry — the single definition of every number
 *  the platform shows. Computation lives on the server
 *  (server/analytics/engine.ts); the web app uses the same registry
 *  for labels, units, definitions and direction.
 *
 *  Integrity rules encoded here:
 *  - ratios are recomputed from their components (never averaged);
 *  - average position is impression-weighted;
 *  - GA4 users are non-additive across days;
 *  - follower counts are end-of-period values, not sums;
 *  - platform-attributed ad conversions are a separate metric from
 *    GA4 key events and Drupal submissions and are never summed with them;
 *  - the cross-platform social engagement rate covers LinkedIn and X
 *    only (YouTube has no comparable impression definition).
 *  ------------------------------------------------------------------ */
import { EVENTS, type L10n } from './catalog';
import type { DimensionId } from './filters';

export type TableId = 'web' | 'webacq' | 'webpage' | 'webbrowser' | 'search' | 'searchquery' | 'searchpage' | 'social' | 'ads' | 'forms';
export type Unit = 'count' | 'percent' | 'currency' | 'seconds' | 'minutes' | 'position' | 'decimal';
export type ModuleId = 'web' | 'search' | 'social' | 'ads' | 'geo' | 'forms';
export type SourceKey = 'ga4' | 'gsc' | 'linkedin' | 'x' | 'youtube' | 'chatgpt_ads' | 'drupal' | 'geo';

export type FixedFilter = Partial<Record<DimensionId, string[]>>;

export type MetricAgg =
  | { kind: 'sum'; tables: TableId[]; measures: string[]; fixed?: FixedFilter }
  /** GA4 users: summed per day then de-duplicated across days (approximation, flagged) */
  | { kind: 'users'; tables: TableId[]; measures: string[]; fixed?: FixedFilter }
  /** end-of-period value per entity (e.g. followers), summed across entities */
  | { kind: 'last'; tables: TableId[]; measures: string[]; entity: DimensionId; fixed?: FixedFilter }
  | { kind: 'ratio'; num: string; den: string; scale?: number }
  | { kind: 'diff'; a: string; b: string }
  | { kind: 'custom'; fn: 'keyword_visibility' | 'geo_mention_rate' | 'geo_citation_rate' | 'geo_measurements' };

export interface MetricDef {
  id: string;
  label: L10n;
  description: L10n;
  unit: Unit;
  agg: MetricAgg;
  /** whether an increase is good */
  direction: 'up' | 'down' | 'neutral';
  module: ModuleId;
  sources: SourceKey[];
  /** whether a relative (%) change is meaningful (false for rates & positions → show absolute difference) */
  deltaPct: boolean;
  /** eligible for configurable executive KPI cards */
  executive?: boolean;
  /** helper component, not user-selectable */
  internal?: boolean;
}

const KEY_EVENT_MEASURES = EVENTS.filter((e) => e.keyEvent).map((e) => `ev_${e.id}`);
const FORM_EVENT_MEASURES = EVENTS.filter((e) => e.drupalForm).map((e) => `ev_${e.id}`);
/** sentinel expanded at query time to the events configured as conversions (KPI registry) */
export const CONVERSION_MEASURES = '@conversions';

const WEB_TABLES: TableId[] = ['web', 'webacq', 'webpage'];
const LI_X = { platform: ['linkedin', 'x'] };

const m = (d: MetricDef) => d;

export const METRICS: MetricDef[] = [
  /* ---------- Website (GA4) ---------- */
  m({
    id: 'sessions',
    label: { en: 'Sessions', fr: 'Sessions' },
    description: {
      en: 'GA4 sessions (session_start). Includes all channels.',
      fr: 'Sessions GA4 (session_start), tous canaux confondus.',
    },
    unit: 'count',
    agg: { kind: 'sum', tables: WEB_TABLES, measures: ['sessions'] },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'users',
    label: { en: 'Users', fr: 'Utilisateurs' },
    description: {
      en: 'GA4 active users. Users are not additive across days: totals over a period are de-duplicated by GA4 itself. Totals computed from daily rows are approximations and are flagged.',
      fr: "Utilisateurs actifs GA4. Les utilisateurs ne s'additionnent pas d'un jour à l'autre : les totaux calculés à partir de lignes quotidiennes sont des approximations signalées.",
    },
    unit: 'count',
    agg: { kind: 'users', tables: ['web'], measures: ['users'] },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'new_users',
    label: { en: 'New users', fr: 'Nouveaux utilisateurs' },
    description: { en: 'GA4 first_visit users (non-additive across days, see Users).', fr: 'Utilisateurs first_visit GA4 (non additifs, voir Utilisateurs).' },
    unit: 'count',
    agg: { kind: 'users', tables: ['web'], measures: ['newUsers'] },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
  }),
  m({
    id: 'engaged_sessions',
    label: { en: 'Engaged sessions', fr: 'Sessions avec engagement' },
    description: {
      en: 'GA4 sessions lasting 10 s or more, with a key event, or with 2+ page views.',
      fr: "Sessions GA4 de 10 s ou plus, avec un événement clé ou au moins 2 pages vues.",
    },
    unit: 'count',
    agg: { kind: 'sum', tables: WEB_TABLES, measures: ['engaged'] },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
  }),
  m({
    id: 'engagement_rate',
    label: { en: 'Engagement rate', fr: "Taux d'engagement" },
    description: { en: 'Engaged sessions ÷ sessions (recomputed from totals, never averaged).', fr: 'Sessions avec engagement ÷ sessions (recalculé à partir des totaux).' },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'engaged_sessions', den: 'sessions' },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: false,
    executive: true,
  }),
  m({
    id: 'views',
    label: { en: 'Views', fr: 'Vues' },
    description: { en: 'GA4 page_view and screen_view events.', fr: 'Événements page_view et screen_view GA4.' },
    unit: 'count',
    agg: { kind: 'sum', tables: WEB_TABLES, measures: ['views'] },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
  }),
  m({
    id: 'views_per_session',
    label: { en: 'Views per session', fr: 'Vues par session' },
    description: { en: 'Views ÷ sessions.', fr: 'Vues ÷ sessions.' },
    unit: 'decimal',
    agg: { kind: 'ratio', num: 'views', den: 'sessions' },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
  }),
  m({
    id: 'engagement_time',
    label: { en: 'Engagement time (total)', fr: "Temps d'engagement (total)" },
    description: { en: 'Sum of GA4 user_engagement time, in seconds.', fr: "Somme du temps d'engagement GA4, en secondes." },
    unit: 'seconds',
    agg: { kind: 'sum', tables: WEB_TABLES, measures: ['engTime'] },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
    internal: true,
  }),
  m({
    id: 'avg_engagement_time',
    label: { en: 'Avg. engagement time per session', fr: "Temps d'engagement moyen par session" },
    description: {
      en: 'Total engagement time ÷ sessions. GA4 also reports a per-active-user average, which is a different metric.',
      fr: "Temps d'engagement total ÷ sessions. GA4 propose aussi une moyenne par utilisateur actif, qui est une autre métrique.",
    },
    unit: 'seconds',
    agg: { kind: 'ratio', num: 'engagement_time', den: 'sessions' },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
  }),
  m({
    id: 'key_events',
    label: { en: 'Key events', fr: 'Événements clés' },
    description: {
      en: `GA4 key events: ${EVENTS.filter((e) => e.keyEvent).map((e) => e.id).join(', ')}. Counted as events, not sessions.`,
      fr: `Événements clés GA4 : ${EVENTS.filter((e) => e.keyEvent).map((e) => e.id).join(', ')}. Comptés en événements, pas en sessions.`,
    },
    unit: 'count',
    agg: { kind: 'sum', tables: WEB_TABLES, measures: KEY_EVENT_MEASURES },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'conversions',
    label: { en: 'Website conversions (GA4)', fr: 'Conversions site (GA4)' },
    description: {
      en: 'GA4 events configured as conversions in Administration → KPI registry. Not de-duplicated with Drupal submissions or ad-platform conversions.',
      fr: "Événements GA4 définis comme conversions dans Administration → Référentiel KPI. Non dédupliqués avec les soumissions Drupal ni les conversions publicitaires.",
    },
    unit: 'count',
    agg: { kind: 'sum', tables: WEB_TABLES, measures: [CONVERSION_MEASURES] },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'key_event_rate',
    label: { en: 'Key events per session', fr: 'Événements clés par session' },
    description: {
      en: "Key events ÷ sessions. This is events per session, not GA4's 'session key event rate' (share of sessions with a key event).",
      fr: "Événements clés ÷ sessions. Il s'agit d'événements par session, et non du « taux de sessions avec événement clé » de GA4.",
    },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'key_events', den: 'sessions' },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: false,
  }),
  m({
    id: 'conversion_rate',
    label: { en: 'Conversion rate (GA4)', fr: 'Taux de conversion (GA4)' },
    description: { en: 'Website conversions ÷ sessions.', fr: 'Conversions site ÷ sessions.' },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'conversions', den: 'sessions' },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: false,
    executive: true,
  }),
  ...EVENTS.map((e) =>
    m({
      id: `ev_${e.id}`,
      label: e.name,
      description: { en: `GA4 event "${e.id}".`, fr: `Événement GA4 « ${e.id} ».` },
      unit: 'count',
      agg: { kind: 'sum', tables: WEB_TABLES, measures: [`ev_${e.id}`] },
      direction: 'up',
      module: 'web',
      sources: ['ga4'],
      deltaPct: true,
    }),
  ),
  m({
    id: 'organic_sessions',
    label: { en: 'Organic search sessions', fr: 'Sessions recherche organique' },
    description: { en: 'GA4 sessions with default channel group "Organic Search".', fr: 'Sessions GA4 du groupe de canaux « Recherche organique ».' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['web', 'webacq'], measures: ['sessions'], fixed: { channel: ['organic_search'] } },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
  }),
  m({
    id: 'ai_referral_sessions',
    label: { en: 'AI referral sessions', fr: 'Sessions issues des IA' },
    description: {
      en: 'GA4 sessions referred by AI assistants (chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, claude.ai) via a custom channel group. Excludes ChatGPT Ads clicks.',
      fr: 'Sessions GA4 provenant d’assistants IA (chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, claude.ai) via un groupe de canaux personnalisé. Hors clics ChatGPT Ads.',
    },
    unit: 'count',
    agg: { kind: 'sum', tables: ['web', 'webacq'], measures: ['sessions'], fixed: { channel: ['ai_referral'] } },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'ai_referral_share',
    label: { en: 'AI referral share of sessions', fr: 'Part des sessions issues des IA' },
    description: { en: 'AI referral sessions ÷ all sessions.', fr: 'Sessions issues des IA ÷ toutes les sessions.' },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'ai_referral_sessions', den: 'sessions' },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: false,
  }),
  m({
    id: 'social_sessions',
    label: { en: 'Organic social sessions', fr: 'Sessions social organique' },
    description: { en: 'GA4 sessions with channel group "Organic Social".', fr: 'Sessions GA4 du groupe « Social organique ».' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['web', 'webacq'], measures: ['sessions'], fixed: { channel: ['organic_social'] } },
    direction: 'up',
    module: 'web',
    sources: ['ga4'],
    deltaPct: true,
  }),
  m({
    id: 'ads_ga_sessions',
    label: { en: 'ChatGPT Ads sessions (GA4)', fr: 'Sessions ChatGPT Ads (GA4)' },
    description: {
      en: 'Sessions GA4 attributes to ChatGPT Ads clicks (utm_source=chatgpt, utm_medium=cpc). Measured by GA4, not by the ad platform.',
      fr: 'Sessions que GA4 attribue aux clics ChatGPT Ads (utm_source=chatgpt, utm_medium=cpc). Mesure GA4, pas la plateforme publicitaire.',
    },
    unit: 'count',
    agg: { kind: 'sum', tables: ['webacq', 'web'], measures: ['sessions'], fixed: { channel: ['paid'] } },
    direction: 'up',
    module: 'ads',
    sources: ['ga4'],
    deltaPct: true,
  }),
  m({
    id: 'ads_ga_key_events',
    label: { en: 'ChatGPT Ads key events (GA4)', fr: 'Événements clés ChatGPT Ads (GA4)' },
    description: {
      en: 'GA4 key events in sessions attributed to ChatGPT Ads (GA4 last-click). Not comparable to platform-attributed conversions.',
      fr: 'Événements clés GA4 des sessions attribuées à ChatGPT Ads (dernier clic GA4). Non comparable aux conversions attribuées par la plateforme.',
    },
    unit: 'count',
    agg: { kind: 'sum', tables: ['webacq', 'web'], measures: KEY_EVENT_MEASURES, fixed: { channel: ['paid'] } },
    direction: 'up',
    module: 'ads',
    sources: ['ga4'],
    deltaPct: true,
  }),

  /* ---------- Drupal webforms ---------- */
  m({
    id: 'form_submissions',
    label: { en: 'Form submissions (Drupal)', fr: 'Soumissions de formulaires (Drupal)' },
    description: {
      en: 'Webform submissions recorded server-side by Drupal (contact, project request, newsletter). Counts only — no personal data is ingested.',
      fr: 'Soumissions enregistrées côté serveur par Drupal (contact, demande de projet, newsletter). Comptages uniquement — aucune donnée personnelle.',
    },
    unit: 'count',
    agg: { kind: 'sum', tables: ['forms'], measures: ['submissions'] },
    direction: 'up',
    module: 'forms',
    sources: ['drupal'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'ga4_form_events',
    label: { en: 'Form events seen by GA4', fr: 'Événements formulaire vus par GA4' },
    description: { en: 'GA4 events mapped to Drupal forms.', fr: 'Événements GA4 associés aux formulaires Drupal.' },
    unit: 'count',
    agg: { kind: 'sum', tables: WEB_TABLES, measures: FORM_EVENT_MEASURES },
    direction: 'up',
    module: 'forms',
    sources: ['ga4'],
    deltaPct: true,
    internal: true,
  }),
  m({
    id: 'form_tracking_coverage',
    label: { en: 'GA4 form tracking coverage', fr: 'Couverture du suivi GA4 des formulaires' },
    description: {
      en: 'GA4 form events ÷ Drupal submissions. Below 100% is expected (consent refusal, blockers); sudden drops indicate tagging issues. GA4 visibility of forms is measured, never assumed.',
      fr: 'Événements formulaire GA4 ÷ soumissions Drupal. Inférieur à 100 % est normal (refus de consentement, bloqueurs) ; une chute brutale signale un problème de marquage.',
    },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'ga4_form_events', den: 'form_submissions' },
    direction: 'up',
    module: 'forms',
    sources: ['ga4', 'drupal'],
    deltaPct: false,
  }),

  /* ---------- Search Console ---------- */
  m({
    id: 'organic_clicks',
    label: { en: 'Organic clicks (Search Console)', fr: 'Clics organiques (Search Console)' },
    description: {
      en: 'Google Search clicks to the property. Search Console data is final after ~2 days; the latest days are excluded rather than shown as a drop.',
      fr: 'Clics Google Search vers la propriété. Les données Search Console sont définitives après ~2 jours ; les derniers jours sont exclus plutôt qu’affichés comme une baisse.',
    },
    unit: 'count',
    agg: { kind: 'sum', tables: ['search', 'searchpage', 'searchquery'], measures: ['clicks'] },
    direction: 'up',
    module: 'search',
    sources: ['gsc'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'organic_impressions',
    label: { en: 'Search impressions', fr: 'Impressions dans la recherche' },
    description: { en: 'Google Search impressions (Search Console).', fr: 'Impressions Google Search (Search Console).' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['search', 'searchpage', 'searchquery'], measures: ['impressions'] },
    direction: 'up',
    module: 'search',
    sources: ['gsc'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'gsc_posw',
    label: { en: 'Impression-weighted position (sum)', fr: 'Position pondérée (somme)' },
    description: { en: 'Internal helper.', fr: 'Composant interne.' },
    unit: 'decimal',
    agg: { kind: 'sum', tables: ['search', 'searchpage', 'searchquery'], measures: ['posW'] },
    direction: 'neutral',
    module: 'search',
    sources: ['gsc'],
    deltaPct: false,
    internal: true,
  }),
  m({
    id: 'organic_ctr',
    label: { en: 'Search CTR', fr: 'CTR recherche' },
    description: { en: 'Clicks ÷ impressions (Search Console).', fr: 'Clics ÷ impressions (Search Console).' },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'organic_clicks', den: 'organic_impressions' },
    direction: 'up',
    module: 'search',
    sources: ['gsc'],
    deltaPct: false,
  }),
  m({
    id: 'avg_position',
    label: { en: 'Average position (Search Console)', fr: 'Position moyenne (Search Console)' },
    description: {
      en: 'Impression-weighted average of the topmost position in Google results. This is Search Console data, not a daily rank-tracker reading; lower is better.',
      fr: 'Moyenne pondérée par les impressions de la position la plus haute dans Google. Donnée Search Console, pas un relevé de suivi de positionnement ; plus bas = mieux.',
    },
    unit: 'position',
    agg: { kind: 'ratio', num: 'gsc_posw', den: 'organic_impressions' },
    direction: 'down',
    module: 'search',
    sources: ['gsc'],
    deltaPct: false,
  }),
  m({
    id: 'branded_clicks',
    label: { en: 'Branded clicks', fr: 'Clics sur requêtes de marque' },
    description: { en: 'Clicks on queries containing the brand (query-level data excludes anonymised queries).', fr: 'Clics sur les requêtes de marque (hors requêtes anonymisées).' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['searchquery'], measures: ['clicks'], fixed: { brand: ['brand'] } },
    direction: 'up',
    module: 'search',
    sources: ['gsc'],
    deltaPct: true,
  }),
  m({
    id: 'non_branded_clicks',
    label: { en: 'Non-branded clicks', fr: 'Clics hors marque' },
    description: { en: 'Clicks on non-brand queries (query-level data excludes anonymised queries).', fr: 'Clics sur les requêtes hors marque (hors requêtes anonymisées).' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['searchquery'], measures: ['clicks'], fixed: { brand: ['non_brand'] } },
    direction: 'up',
    module: 'search',
    sources: ['gsc'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'keyword_visibility',
    label: { en: 'Keyword visibility (top 10)', fr: 'Visibilité mots-clés (top 10)' },
    description: {
      en: 'Share of tracked keywords whose Search Console average position over the period is 10 or better. Keywords with no impressions count as not visible.',
      fr: 'Part des mots-clés suivis dont la position moyenne Search Console sur la période est inférieure ou égale à 10. Sans impression = non visible.',
    },
    unit: 'percent',
    agg: { kind: 'custom', fn: 'keyword_visibility' },
    direction: 'up',
    module: 'search',
    sources: ['gsc'],
    deltaPct: false,
    executive: true,
  }),

  /* ---------- Social ---------- */
  m({
    id: 'social_impressions',
    label: { en: 'Social impressions (LinkedIn + X)', fr: 'Impressions sociales (LinkedIn + X)' },
    description: {
      en: 'Post impressions reported by LinkedIn and X. YouTube thumbnail impressions are a different measure and are reported separately.',
      fr: 'Impressions de publications LinkedIn et X. Les impressions de miniatures YouTube sont une autre mesure, présentée à part.',
    },
    unit: 'count',
    agg: { kind: 'sum', tables: ['social'], measures: ['impressions'], fixed: LI_X },
    direction: 'up',
    module: 'social',
    sources: ['linkedin', 'x'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'social_engagements',
    label: { en: 'Social engagements (LinkedIn + X)', fr: 'Engagements sociaux (LinkedIn + X)' },
    description: {
      en: 'Reactions/likes + comments/replies + shares/reposts + clicks, as reported by each platform. Platform definitions differ slightly.',
      fr: 'Réactions + commentaires + partages + clics, selon chaque plateforme. Les définitions diffèrent légèrement.',
    },
    unit: 'count',
    agg: { kind: 'sum', tables: ['social'], measures: ['engagements'], fixed: LI_X },
    direction: 'up',
    module: 'social',
    sources: ['linkedin', 'x'],
    deltaPct: true,
  }),
  m({
    id: 'social_engagement_rate',
    label: { en: 'Social engagement rate (by impressions)', fr: "Taux d'engagement social (par impression)" },
    description: {
      en: 'LinkedIn + X engagements ÷ LinkedIn + X impressions, computed from totals. YouTube is excluded: it has no comparable impression base.',
      fr: 'Engagements LinkedIn + X ÷ impressions LinkedIn + X, calculé sur les totaux. YouTube est exclu faute de base d’impressions comparable.',
    },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'social_engagements', den: 'social_impressions' },
    direction: 'up',
    module: 'social',
    sources: ['linkedin', 'x'],
    deltaPct: false,
    executive: true,
  }),
  m({
    id: 'social_link_clicks',
    label: { en: 'Link clicks to websites', fr: 'Clics vers les sites' },
    description: { en: 'Clicks on links in LinkedIn and X posts.', fr: 'Clics sur les liens des publications LinkedIn et X.' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['social'], measures: ['linkClicks'], fixed: LI_X },
    direction: 'up',
    module: 'social',
    sources: ['linkedin', 'x'],
    deltaPct: true,
  }),
  m({
    id: 'social_posts',
    label: { en: 'Posts published', fr: 'Publications' },
    description: { en: 'Posts and videos published on monitored accounts.', fr: 'Publications et vidéos des comptes suivis.' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['social'], measures: ['posts'] },
    direction: 'neutral',
    module: 'social',
    sources: ['linkedin', 'x', 'youtube'],
    deltaPct: true,
  }),
  m({
    id: 'followers',
    label: { en: 'Audience (followers & subscribers)', fr: 'Audience (abonnés)' },
    description: {
      en: 'End-of-period followers (LinkedIn, X) and subscribers (YouTube), summed across accounts. People following several accounts are counted once per account.',
      fr: 'Abonnés en fin de période (LinkedIn, X, YouTube), additionnés par compte. Une personne abonnée à plusieurs comptes est comptée pour chacun.',
    },
    unit: 'count',
    agg: { kind: 'last', tables: ['social'], measures: ['followers'], entity: 'account' },
    direction: 'up',
    module: 'social',
    sources: ['linkedin', 'x', 'youtube'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'followers_gained',
    label: { en: 'New followers', fr: 'Nouveaux abonnés' },
    description: { en: 'Followers / subscribers gained during the period.', fr: 'Abonnés gagnés sur la période.' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['social'], measures: ['followersGained'] },
    direction: 'up',
    module: 'social',
    sources: ['linkedin', 'x', 'youtube'],
    deltaPct: true,
  }),
  m({
    id: 'followers_lost',
    label: { en: 'Lost followers', fr: 'Abonnés perdus' },
    description: { en: 'Unfollows / unsubscribes during the period.', fr: 'Désabonnements sur la période.' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['social'], measures: ['followersLost'] },
    direction: 'down',
    module: 'social',
    sources: ['linkedin', 'x', 'youtube'],
    deltaPct: true,
  }),
  m({
    id: 'followers_net',
    label: { en: 'Net follower change', fr: 'Évolution nette des abonnés' },
    description: { en: 'Followers gained − followers lost.', fr: 'Abonnés gagnés − abonnés perdus.' },
    unit: 'count',
    agg: { kind: 'diff', a: 'followers_gained', b: 'followers_lost' },
    direction: 'up',
    module: 'social',
    sources: ['linkedin', 'x', 'youtube'],
    deltaPct: true,
  }),
  m({
    id: 'yt_views',
    label: { en: 'YouTube views', fr: 'Vues YouTube' },
    description: { en: 'Video views reported by YouTube Analytics.', fr: 'Vues de vidéos selon YouTube Analytics.' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['social'], measures: ['videoViews'], fixed: { platform: ['youtube'] } },
    direction: 'up',
    module: 'social',
    sources: ['youtube'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'yt_watch_minutes',
    label: { en: 'YouTube watch time (min)', fr: 'Durée de visionnage YouTube (min)' },
    description: { en: 'Estimated minutes watched (YouTube Analytics).', fr: 'Minutes visionnées estimées (YouTube Analytics).' },
    unit: 'minutes',
    agg: { kind: 'sum', tables: ['social'], measures: ['watchMinutes'], fixed: { platform: ['youtube'] } },
    direction: 'up',
    module: 'social',
    sources: ['youtube'],
    deltaPct: true,
  }),
  m({
    id: 'yt_impressions',
    label: { en: 'YouTube thumbnail impressions', fr: 'Impressions de miniatures YouTube' },
    description: { en: 'Times video thumbnails were shown on YouTube.', fr: 'Affichages des miniatures de vidéos sur YouTube.' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['social'], measures: ['impressions'], fixed: { platform: ['youtube'] } },
    direction: 'up',
    module: 'social',
    sources: ['youtube'],
    deltaPct: true,
  }),
  m({
    id: 'yt_view_rate',
    label: { en: 'YouTube impressions click-through', fr: 'Taux de clic des miniatures YouTube' },
    description: { en: 'Views ÷ thumbnail impressions (approximation of YouTube impressions CTR).', fr: 'Vues ÷ impressions de miniatures (approximation du CTR YouTube).' },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'yt_views', den: 'yt_impressions' },
    direction: 'up',
    module: 'social',
    sources: ['youtube'],
    deltaPct: false,
  }),
  m({
    id: 'yt_avg_view_minutes',
    label: { en: 'Avg. view duration (min)', fr: 'Durée moyenne de visionnage (min)' },
    description: { en: 'Watch time ÷ views.', fr: 'Durée de visionnage ÷ vues.' },
    unit: 'minutes',
    agg: { kind: 'ratio', num: 'yt_watch_minutes', den: 'yt_views' },
    direction: 'up',
    module: 'social',
    sources: ['youtube'],
    deltaPct: true,
  }),

  /* ---------- ChatGPT Ads (platform-reported) ---------- */
  m({
    id: 'ads_spend',
    label: { en: 'Ad spend (ChatGPT Ads)', fr: 'Dépenses (ChatGPT Ads)' },
    description: {
      en: 'Spend reported by ChatGPT Ads, in account currency. Spend can take several hours to finalise.',
      fr: 'Dépenses déclarées par ChatGPT Ads, dans la devise du compte. Elles peuvent mettre plusieurs heures à être finalisées.',
    },
    unit: 'currency',
    agg: { kind: 'sum', tables: ['ads'], measures: ['spend'] },
    direction: 'neutral',
    module: 'ads',
    sources: ['chatgpt_ads'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'ads_impressions',
    label: { en: 'Ad impressions', fr: 'Impressions publicitaires' },
    description: { en: 'Impressions reported by ChatGPT Ads.', fr: 'Impressions déclarées par ChatGPT Ads.' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['ads'], measures: ['impressions'] },
    direction: 'up',
    module: 'ads',
    sources: ['chatgpt_ads'],
    deltaPct: true,
  }),
  m({
    id: 'ads_clicks',
    label: { en: 'Ad clicks', fr: 'Clics publicitaires' },
    description: { en: 'Clicks reported by ChatGPT Ads.', fr: 'Clics déclarés par ChatGPT Ads.' },
    unit: 'count',
    agg: { kind: 'sum', tables: ['ads'], measures: ['clicks'] },
    direction: 'up',
    module: 'ads',
    sources: ['chatgpt_ads'],
    deltaPct: true,
  }),
  m({
    id: 'ads_ctr',
    label: { en: 'Ad CTR', fr: 'CTR publicitaire' },
    description: { en: 'Clicks ÷ impressions.', fr: 'Clics ÷ impressions.' },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'ads_clicks', den: 'ads_impressions' },
    direction: 'up',
    module: 'ads',
    sources: ['chatgpt_ads'],
    deltaPct: false,
  }),
  m({
    id: 'ads_cpc',
    label: { en: 'Cost per click', fr: 'Coût par clic' },
    description: { en: 'Spend ÷ clicks.', fr: 'Dépenses ÷ clics.' },
    unit: 'currency',
    agg: { kind: 'ratio', num: 'ads_spend', den: 'ads_clicks' },
    direction: 'down',
    module: 'ads',
    sources: ['chatgpt_ads'],
    deltaPct: true,
  }),
  m({
    id: 'ads_cpm',
    label: { en: 'CPM', fr: 'CPM' },
    description: { en: 'Spend ÷ impressions × 1,000.', fr: 'Dépenses ÷ impressions × 1 000.' },
    unit: 'currency',
    agg: { kind: 'ratio', num: 'ads_spend', den: 'ads_impressions', scale: 1000 },
    direction: 'down',
    module: 'ads',
    sources: ['chatgpt_ads'],
    deltaPct: true,
  }),
  m({
    id: 'ads_conversions',
    label: { en: 'Platform-attributed conversions', fr: 'Conversions attribuées par la plateforme' },
    description: {
      en: 'Conversions ChatGPT Ads attributes to ad clicks/views under its own attribution window (from the OpenAI pixel / Conversions API). Can appear 24–48 h late. Never added to GA4 conversions or Drupal submissions.',
      fr: 'Conversions que ChatGPT Ads attribue à ses publicités selon sa propre fenêtre d’attribution (pixel / API Conversions OpenAI). Délai possible de 24–48 h. Jamais additionnées aux conversions GA4 ni aux soumissions Drupal.',
    },
    unit: 'count',
    agg: { kind: 'sum', tables: ['ads'], measures: ['conversions'] },
    direction: 'up',
    module: 'ads',
    sources: ['chatgpt_ads'],
    deltaPct: true,
    executive: true,
  }),
  m({
    id: 'ads_cpa',
    label: { en: 'Cost per conversion (platform)', fr: 'Coût par conversion (plateforme)' },
    description: { en: 'Spend ÷ platform-attributed conversions.', fr: 'Dépenses ÷ conversions attribuées par la plateforme.' },
    unit: 'currency',
    agg: { kind: 'ratio', num: 'ads_spend', den: 'ads_conversions' },
    direction: 'down',
    module: 'ads',
    sources: ['chatgpt_ads'],
    deltaPct: true,
  }),
  m({
    id: 'ads_cvr',
    label: { en: 'Conversion rate (platform)', fr: 'Taux de conversion (plateforme)' },
    description: { en: 'Platform-attributed conversions ÷ clicks.', fr: 'Conversions attribuées ÷ clics.' },
    unit: 'percent',
    agg: { kind: 'ratio', num: 'ads_conversions', den: 'ads_clicks' },
    direction: 'up',
    module: 'ads',
    sources: ['chatgpt_ads'],
    deltaPct: false,
  }),

  /* ---------- GEO / AI visibility ---------- */
  m({
    id: 'geo_mention_rate',
    label: { en: 'AI answer mention rate', fr: 'Taux de mention dans les réponses IA' },
    description: {
      en: 'Share of completed GEO measurements in which Veolia is mentioned. Applies only to the monitored prompt sample and providers — not to all AI usage.',
      fr: 'Part des mesures GEO abouties où Veolia est mentionné. Valable uniquement pour l’échantillon de prompts et de fournisseurs suivis — pas pour tout l’usage des IA.',
    },
    unit: 'percent',
    agg: { kind: 'custom', fn: 'geo_mention_rate' },
    direction: 'up',
    module: 'geo',
    sources: ['geo'],
    deltaPct: false,
    executive: true,
  }),
  m({
    id: 'geo_citation_rate',
    label: { en: 'AI answer citation rate', fr: 'Taux de citation dans les réponses IA' },
    description: {
      en: 'Share of completed GEO measurements citing a veolia.com URL as a source. Monitored prompt sample only.',
      fr: 'Part des mesures GEO abouties citant une URL veolia.com comme source. Échantillon de prompts suivi uniquement.',
    },
    unit: 'percent',
    agg: { kind: 'custom', fn: 'geo_citation_rate' },
    direction: 'up',
    module: 'geo',
    sources: ['geo'],
    deltaPct: false,
    executive: true,
  }),
  m({
    id: 'geo_measurements',
    label: { en: 'GEO measurements completed', fr: 'Mesures GEO abouties' },
    description: { en: 'Completed prompt × provider measurements in the period (failed runs excluded).', fr: 'Mesures prompt × fournisseur abouties sur la période (échecs exclus).' },
    unit: 'count',
    agg: { kind: 'custom', fn: 'geo_measurements' },
    direction: 'neutral',
    module: 'geo',
    sources: ['geo'],
    deltaPct: true,
  }),
];

export const METRIC_BY_ID: ReadonlyMap<string, MetricDef> = new Map(METRICS.map((x) => [x.id, x]));

export function getMetric(id: string): MetricDef | undefined {
  return METRIC_BY_ID.get(id);
}

/** Default executive KPI cards (administrators can change the selection). */
export const DEFAULT_EXECUTIVE_KPIS = [
  'sessions',
  'conversions',
  'form_submissions',
  'organic_clicks',
  'keyword_visibility',
  'social_engagement_rate',
  'followers',
  'ai_referral_sessions',
  'geo_mention_rate',
  'ads_spend',
  'ads_conversions',
  'engagement_rate',
];

/** Default events counted as GA4 conversions (KPI registry). */
export const DEFAULT_CONVERSION_EVENTS = EVENTS.filter((e) => e.conversion).map((e) => e.id);

export const SOURCE_LABELS: Record<SourceKey, string> = {
  ga4: 'Google Analytics 4',
  gsc: 'Google Search Console',
  linkedin: 'LinkedIn',
  x: 'X',
  youtube: 'YouTube',
  chatgpt_ads: 'ChatGPT Ads',
  drupal: 'Drupal Webform',
  geo: 'GEO monitoring',
};

/** Which source keys feed each physical table (used for data-mode resolution). */
export const TABLE_SOURCES: Record<TableId, SourceKey[]> = {
  web: ['ga4'],
  webacq: ['ga4'],
  webpage: ['ga4'],
  webbrowser: ['ga4'],
  search: ['gsc'],
  searchquery: ['gsc'],
  searchpage: ['gsc'],
  social: ['linkedin', 'x', 'youtube'],
  ads: ['chatgpt_ads'],
  forms: ['drupal'],
};
