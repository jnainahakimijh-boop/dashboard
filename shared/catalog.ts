/** ------------------------------------------------------------------
 *  Reference catalogues shared by the demo data engine, the database
 *  seed and the web app. Everything here describes the DEMO estate:
 *  values are synthetic and must never be read as real performance.
 *  Competitor brands are fictional (.example domains, RFC 2606).
 *  ------------------------------------------------------------------ */

export type Lang = 'en' | 'fr';
export interface L10n {
  en: string;
  fr: string;
}

/* ---------------- Websites ---------------- */

export type SiteId = 'veolia-fr' | 'veolia-en';
export interface SiteDef {
  id: SiteId;
  name: string;
  domain: string;
  basePath: string;
  language: Lang;
  businessUnit: string;
  ga4Property: string;
  gscProperty: string;
}

export const SITES: SiteDef[] = [
  { id: 'veolia-fr', name: 'veolia.com — FR', domain: 'www.veolia.com', basePath: '/fr', language: 'fr', businessUnit: 'group', ga4Property: 'properties/DEMO-FR', gscProperty: 'https://www.veolia.com/fr/' },
  { id: 'veolia-en', name: 'veolia.com — EN', domain: 'www.veolia.com', basePath: '/en', language: 'en', businessUnit: 'group', ga4Property: 'properties/DEMO-EN', gscProperty: 'https://www.veolia.com/en/' },
];

/* ---------------- Geography ---------------- */

export type RegionId = 'europe' | 'north_america' | 'latin_america' | 'africa_middle_east' | 'asia_pacific';
export const REGIONS: Array<{ id: RegionId; name: L10n }> = [
  { id: 'europe', name: { en: 'Europe', fr: 'Europe' } },
  { id: 'north_america', name: { en: 'North America', fr: 'Amérique du Nord' } },
  { id: 'latin_america', name: { en: 'Latin America', fr: 'Amérique latine' } },
  { id: 'africa_middle_east', name: { en: 'Africa & Middle East', fr: 'Afrique & Moyen-Orient' } },
  { id: 'asia_pacific', name: { en: 'Asia-Pacific', fr: 'Asie-Pacifique' } },
];

export interface CountryDef {
  id: string; // ISO 3166-1 alpha-2
  isoNum: string; // ISO 3166-1 numeric (world-atlas ids)
  name: L10n;
  region: RegionId;
  /** share of sessions per website (demo traffic model) */
  share: Record<SiteId, number>;
  /** dominant browser languages of users from this country */
  languages: Array<[string, number]>;
}

export const COUNTRIES: CountryDef[] = [
  { id: 'FR', isoNum: '250', name: { en: 'France', fr: 'France' }, region: 'europe', share: { 'veolia-fr': 0.7, 'veolia-en': 0.07 }, languages: [['fr', 0.93], ['en', 0.07]] },
  { id: 'GB', isoNum: '826', name: { en: 'United Kingdom', fr: 'Royaume-Uni' }, region: 'europe', share: { 'veolia-fr': 0.008, 'veolia-en': 0.13 }, languages: [['en', 0.97], ['fr', 0.03]] },
  { id: 'DE', isoNum: '276', name: { en: 'Germany', fr: 'Allemagne' }, region: 'europe', share: { 'veolia-fr': 0.006, 'veolia-en': 0.06 }, languages: [['de', 0.78], ['en', 0.22]] },
  { id: 'ES', isoNum: '724', name: { en: 'Spain', fr: 'Espagne' }, region: 'europe', share: { 'veolia-fr': 0.006, 'veolia-en': 0.035 }, languages: [['es', 0.8], ['en', 0.2]] },
  { id: 'BE', isoNum: '056', name: { en: 'Belgium', fr: 'Belgique' }, region: 'europe', share: { 'veolia-fr': 0.06, 'veolia-en': 0.02 }, languages: [['fr', 0.55], ['nl', 0.3], ['en', 0.15]] },
  { id: 'IT', isoNum: '380', name: { en: 'Italy', fr: 'Italie' }, region: 'europe', share: { 'veolia-fr': 0.005, 'veolia-en': 0.03 }, languages: [['it', 0.82], ['en', 0.18]] },
  { id: 'NL', isoNum: '528', name: { en: 'Netherlands', fr: 'Pays-Bas' }, region: 'europe', share: { 'veolia-fr': 0.003, 'veolia-en': 0.03 }, languages: [['nl', 0.6], ['en', 0.4]] },
  { id: 'CH', isoNum: '756', name: { en: 'Switzerland', fr: 'Suisse' }, region: 'europe', share: { 'veolia-fr': 0.035, 'veolia-en': 0.015 }, languages: [['fr', 0.45], ['de', 0.4], ['en', 0.15]] },
  { id: 'US', isoNum: '840', name: { en: 'United States', fr: 'États-Unis' }, region: 'north_america', share: { 'veolia-fr': 0.02, 'veolia-en': 0.25 }, languages: [['en', 0.95], ['es', 0.05]] },
  { id: 'CA', isoNum: '124', name: { en: 'Canada', fr: 'Canada' }, region: 'north_america', share: { 'veolia-fr': 0.04, 'veolia-en': 0.045 }, languages: [['en', 0.62], ['fr', 0.38]] },
  { id: 'BR', isoNum: '076', name: { en: 'Brazil', fr: 'Brésil' }, region: 'latin_america', share: { 'veolia-fr': 0.004, 'veolia-en': 0.03 }, languages: [['pt', 0.85], ['en', 0.15]] },
  { id: 'MA', isoNum: '504', name: { en: 'Morocco', fr: 'Maroc' }, region: 'africa_middle_east', share: { 'veolia-fr': 0.045, 'veolia-en': 0.008 }, languages: [['fr', 0.75], ['ar', 0.2], ['en', 0.05]] },
  { id: 'AE', isoNum: '784', name: { en: 'United Arab Emirates', fr: 'Émirats arabes unis' }, region: 'africa_middle_east', share: { 'veolia-fr': 0.004, 'veolia-en': 0.022 }, languages: [['en', 0.8], ['ar', 0.2]] },
  { id: 'IN', isoNum: '356', name: { en: 'India', fr: 'Inde' }, region: 'asia_pacific', share: { 'veolia-fr': 0.003, 'veolia-en': 0.1 }, languages: [['en', 0.92], ['hi', 0.08]] },
  { id: 'CN', isoNum: '156', name: { en: 'China', fr: 'Chine' }, region: 'asia_pacific', share: { 'veolia-fr': 0.002, 'veolia-en': 0.035 }, languages: [['zh', 0.85], ['en', 0.15]] },
  { id: 'AU', isoNum: '036', name: { en: 'Australia', fr: 'Australie' }, region: 'asia_pacific', share: { 'veolia-fr': 0.002, 'veolia-en': 0.05 }, languages: [['en', 0.98], ['zh', 0.02]] },
];

export const LANGUAGE_NAMES: Record<string, L10n> = {
  fr: { en: 'French', fr: 'Français' },
  en: { en: 'English', fr: 'Anglais' },
  de: { en: 'German', fr: 'Allemand' },
  es: { en: 'Spanish', fr: 'Espagnol' },
  it: { en: 'Italian', fr: 'Italien' },
  nl: { en: 'Dutch', fr: 'Néerlandais' },
  pt: { en: 'Portuguese', fr: 'Portugais' },
  ar: { en: 'Arabic', fr: 'Arabe' },
  zh: { en: 'Chinese', fr: 'Chinois' },
  hi: { en: 'Hindi', fr: 'Hindi' },
};

/* ---------------- Web channels (GA4 session default channel group + AI referral) ---------------- */

export type ChannelId = 'organic_search' | 'direct' | 'referral' | 'organic_social' | 'email' | 'ai_referral' | 'paid';
export interface ChannelDef {
  id: ChannelId;
  name: L10n;
  /** share of non-paid sessions at the start of the dataset and at the end (mix shift) */
  shareStart: number;
  shareEnd: number;
  engaged: number;
  viewsPerSession: number;
  engSecPerSession: number;
  newUserShare: number;
  /** relative propensity for key events (1 = average) */
  intent: number;
  desktop: number;
  mobile: number;
}

export const CHANNELS: ChannelDef[] = [
  { id: 'organic_search', name: { en: 'Organic Search', fr: 'Recherche organique' }, shareStart: 0.5, shareEnd: 0.445, engaged: 0.63, viewsPerSession: 2.4, engSecPerSession: 96, newUserShare: 0.72, intent: 1.05, desktop: 0.56, mobile: 0.4 },
  { id: 'direct', name: { en: 'Direct', fr: 'Accès direct' }, shareStart: 0.22, shareEnd: 0.205, engaged: 0.56, viewsPerSession: 2.1, engSecPerSession: 82, newUserShare: 0.48, intent: 1.0, desktop: 0.62, mobile: 0.34 },
  { id: 'referral', name: { en: 'Referral', fr: 'Sites référents' }, shareStart: 0.09, shareEnd: 0.085, engaged: 0.6, viewsPerSession: 2.2, engSecPerSession: 88, newUserShare: 0.7, intent: 0.9, desktop: 0.58, mobile: 0.38 },
  { id: 'organic_social', name: { en: 'Organic Social', fr: 'Social organique' }, shareStart: 0.12, shareEnd: 0.13, engaged: 0.47, viewsPerSession: 1.6, engSecPerSession: 54, newUserShare: 0.78, intent: 0.55, desktop: 0.32, mobile: 0.64 },
  { id: 'email', name: { en: 'Email', fr: 'E-mail' }, shareStart: 0.065, shareEnd: 0.06, engaged: 0.7, viewsPerSession: 2.6, engSecPerSession: 110, newUserShare: 0.22, intent: 1.25, desktop: 0.6, mobile: 0.36 },
  { id: 'ai_referral', name: { en: 'AI Referral', fr: 'Référents IA' }, shareStart: 0.004, shareEnd: 0.042, engaged: 0.72, viewsPerSession: 2.9, engSecPerSession: 128, newUserShare: 0.83, intent: 1.55, desktop: 0.78, mobile: 0.2 },
  { id: 'paid', name: { en: 'Paid (ChatGPT Ads)', fr: 'Payant (ChatGPT Ads)' }, shareStart: 0, shareEnd: 0, engaged: 0.5, viewsPerSession: 1.8, engSecPerSession: 61, newUserShare: 0.86, intent: 1.1, desktop: 0.55, mobile: 0.42 },
];

export const AI_REFERRAL_SOURCES = ['chatgpt.com', 'perplexity.ai', 'gemini.google.com', 'copilot.microsoft.com', 'claude.ai'];

/** GA4 sessionSourceMedium split per channel (demo) */
export const SOURCE_MEDIUMS: Array<{ id: string; channel: ChannelId; share: number }> = [
  { id: 'google / organic', channel: 'organic_search', share: 0.9 },
  { id: 'bing / organic', channel: 'organic_search', share: 0.065 },
  { id: 'ecosia.org / organic', channel: 'organic_search', share: 0.02 },
  { id: 'duckduckgo / organic', channel: 'organic_search', share: 0.015 },
  { id: '(direct) / (none)', channel: 'direct', share: 1 },
  { id: 'wikipedia.org / referral', channel: 'referral', share: 0.34 },
  { id: 'news.google.com / referral', channel: 'referral', share: 0.22 },
  { id: 'europa.eu / referral', channel: 'referral', share: 0.12 },
  { id: 'other / referral', channel: 'referral', share: 0.32 },
  { id: 'linkedin.com / social', channel: 'organic_social', share: 0.64 },
  { id: 'youtube.com / social', channel: 'organic_social', share: 0.19 },
  { id: 't.co / social', channel: 'organic_social', share: 0.17 },
  { id: 'newsletter / email', channel: 'email', share: 0.76 },
  { id: 'crm / email', channel: 'email', share: 0.24 },
  { id: 'chatgpt.com / referral', channel: 'ai_referral', share: 0.63 },
  { id: 'perplexity.ai / referral', channel: 'ai_referral', share: 0.16 },
  { id: 'gemini.google.com / referral', channel: 'ai_referral', share: 0.1 },
  { id: 'copilot.microsoft.com / referral', channel: 'ai_referral', share: 0.08 },
  { id: 'claude.ai / referral', channel: 'ai_referral', share: 0.03 },
  { id: 'chatgpt / cpc', channel: 'paid', share: 1 },
];

export type DeviceId = 'desktop' | 'mobile' | 'tablet';
export const DEVICES: Array<{ id: DeviceId; name: L10n }> = [
  { id: 'desktop', name: { en: 'Desktop', fr: 'Ordinateur' } },
  { id: 'mobile', name: { en: 'Mobile', fr: 'Mobile' } },
  { id: 'tablet', name: { en: 'Tablet', fr: 'Tablette' } },
];

export const BROWSERS: Array<{ id: string; desktop: number; mobile: number; tablet: number }> = [
  { id: 'Chrome', desktop: 0.6, mobile: 0.5, tablet: 0.35 },
  { id: 'Safari', desktop: 0.08, mobile: 0.38, tablet: 0.55 },
  { id: 'Edge', desktop: 0.24, mobile: 0.01, tablet: 0.03 },
  { id: 'Firefox', desktop: 0.06, mobile: 0.02, tablet: 0.02 },
  { id: 'Samsung Internet', desktop: 0, mobile: 0.07, tablet: 0.04 },
  { id: 'Other', desktop: 0.02, mobile: 0.02, tablet: 0.01 },
];

/* ---------------- Organisation taxonomy ---------------- */

export const BUSINESS_UNITS: Array<{ id: string; name: L10n }> = [
  { id: 'group', name: { en: 'Group & Corporate', fr: 'Groupe & Corporate' } },
  { id: 'water_tech', name: { en: 'Water Technologies', fr: "Technologies de l'eau" } },
  { id: 'municipal_water', name: { en: 'Municipal Water', fr: 'Eau des collectivités' } },
  { id: 'waste', name: { en: 'Waste Solutions', fr: 'Solutions déchets' } },
  { id: 'energy', name: { en: 'Energy Services', fr: 'Services énergétiques' } },
];

export const TOPICS: Array<{ id: string; name: L10n; bu: string }> = [
  { id: 'water_treatment', name: { en: 'Water treatment & reuse', fr: "Traitement & réutilisation de l'eau" }, bu: 'water_tech' },
  { id: 'decarbonisation', name: { en: 'Industrial decarbonisation', fr: 'Décarbonation industrielle' }, bu: 'energy' },
  { id: 'pfas', name: { en: 'PFAS & micropollutants', fr: 'PFAS & micropolluants' }, bu: 'water_tech' },
  { id: 'waste_circular', name: { en: 'Waste & circular economy', fr: 'Déchets & économie circulaire' }, bu: 'waste' },
  { id: 'energy_efficiency', name: { en: 'Energy efficiency', fr: 'Efficacité énergétique' }, bu: 'energy' },
  { id: 'datacentre_water', name: { en: 'Data-centre water & cooling', fr: 'Eau & refroidissement des data centers' }, bu: 'water_tech' },
  { id: 'municipal_services', name: { en: 'Municipal water services', fr: "Services d'eau aux collectivités" }, bu: 'municipal_water' },
  { id: 'corporate', name: { en: 'Corporate & results', fr: 'Corporate & résultats' }, bu: 'group' },
  { id: 'careers', name: { en: 'Careers & people', fr: 'Carrières & talents' }, bu: 'group' },
];

export const PILLARS: Array<{ id: string; name: L10n }> = [
  { id: 'expertise', name: { en: 'Expertise & solutions', fr: 'Expertise & solutions' } },
  { id: 'impact', name: { en: 'Environmental impact', fr: 'Impact environnemental' } },
  { id: 'proof', name: { en: 'Customer proof', fr: 'Preuves clients' } },
  { id: 'people', name: { en: 'People & culture', fr: 'Talents & culture' } },
  { id: 'corporate', name: { en: 'Corporate news', fr: 'Actualité corporate' } },
];

export const OBJECTIVES: Array<{ id: string; name: L10n }> = [
  { id: 'awareness', name: { en: 'Awareness', fr: 'Notoriété' } },
  { id: 'consideration', name: { en: 'Consideration', fr: 'Considération' } },
  { id: 'lead_generation', name: { en: 'Lead generation', fr: 'Génération de leads' } },
  { id: 'recruitment', name: { en: 'Recruitment', fr: 'Recrutement' } },
  { id: 'reputation', name: { en: 'Reputation', fr: 'Réputation' } },
];

export const AUDIENCES: Array<{ id: string; name: L10n }> = [
  { id: 'industry', name: { en: 'Industrial clients', fr: 'Clients industriels' } },
  { id: 'public_sector', name: { en: 'Local authorities', fr: 'Collectivités' } },
  { id: 'talent', name: { en: 'Talent', fr: 'Talents' } },
  { id: 'investors', name: { en: 'Investors & media', fr: 'Investisseurs & médias' } },
  { id: 'general', name: { en: 'General public', fr: 'Grand public' } },
];

/* ---------------- Cross-channel campaigns ---------------- */

export interface CampaignDef {
  id: string;
  utm: string;
  name: L10n;
  from: string;
  to: string | null;
  topic: string;
  bu: string;
  objective: string;
}

export const CAMPAIGNS: CampaignDef[] = [
  { id: 'decarb-week-2025', utm: 'decarb_week_2025', name: { en: 'Industrial Decarbonisation Week 2025', fr: 'Semaine de la décarbonation industrielle 2025' }, from: '2025-11-17', to: '2025-11-30', topic: 'decarbonisation', bu: 'energy', objective: 'consideration' },
  { id: 'graduates-2026', utm: 'graduates_2026', name: { en: 'Graduate programme 2026', fr: 'Programme jeunes diplômés 2026' }, from: '2026-01-12', to: '2026-02-27', topic: 'careers', bu: 'group', objective: 'recruitment' },
  { id: 'results-2025', utm: 'annual_results_2025', name: { en: 'Annual results 2025', fr: 'Résultats annuels 2025' }, from: '2026-02-23', to: '2026-03-08', topic: 'corporate', bu: 'group', objective: 'reputation' },
  { id: 'water-day-2026', utm: 'world_water_day_2026', name: { en: 'World Water Day 2026', fr: "Journée mondiale de l'eau 2026" }, from: '2026-03-16', to: '2026-03-29', topic: 'water_treatment', bu: 'water_tech', objective: 'awareness' },
  { id: 'pfas-2026', utm: 'pfas_solutions_2026', name: { en: 'PFAS solutions 2026', fr: 'Solutions PFAS 2026' }, from: '2026-05-11', to: '2026-06-28', topic: 'pfas', bu: 'water_tech', objective: 'lead_generation' },
  { id: 'chatgpt-industries', utm: 'chatgpt_industries', name: { en: 'ChatGPT Ads — Industries', fr: 'ChatGPT Ads — Industries' }, from: '2026-05-04', to: null, topic: 'water_treatment', bu: 'water_tech', objective: 'lead_generation' },
  { id: 'chatgpt-collectivities', utm: 'chatgpt_collectivities', name: { en: 'ChatGPT Ads — Collectivities', fr: 'ChatGPT Ads — Collectivités' }, from: '2026-05-18', to: null, topic: 'municipal_services', bu: 'municipal_water', objective: 'consideration' },
  { id: 'datacentres-2026', utm: 'datacentre_water_2026', name: { en: 'Data-centre water efficiency', fr: 'Efficacité hydrique des data centers' }, from: '2026-09-08', to: '2026-10-18', topic: 'datacentre_water', bu: 'water_tech', objective: 'consideration' },
];

/* ---------------- Conversion events ---------------- */

export interface EventDef {
  id: string;
  name: L10n;
  /** propensity per session (demo) */
  rate: number;
  keyEvent: boolean;
  conversion: boolean;
  drupalForm?: string;
}

export const EVENTS: EventDef[] = [
  { id: 'contact_form_submit', name: { en: 'Contact request', fr: 'Demande de contact' }, rate: 0.0042, keyEvent: true, conversion: true, drupalForm: 'contact' },
  { id: 'generate_lead', name: { en: 'Qualified lead form', fr: 'Formulaire de lead qualifié' }, rate: 0.0019, keyEvent: true, conversion: true, drupalForm: 'lead_request' },
  { id: 'newsletter_signup', name: { en: 'Newsletter sign-up', fr: 'Inscription newsletter' }, rate: 0.0033, keyEvent: true, conversion: true, drupalForm: 'newsletter' },
  { id: 'brochure_download', name: { en: 'Brochure download', fr: 'Téléchargement de brochure' }, rate: 0.011, keyEvent: true, conversion: false },
  { id: 'career_apply_click', name: { en: 'Job application click', fr: 'Clic candidature' }, rate: 0.008, keyEvent: true, conversion: false },
  { id: 'file_download', name: { en: 'File download', fr: 'Téléchargement de fichier' }, rate: 0.016, keyEvent: false, conversion: false },
];

export const DRUPAL_FORMS: Array<{ id: string; name: L10n; event: string }> = [
  { id: 'contact', name: { en: 'Contact form', fr: 'Formulaire de contact' }, event: 'contact_form_submit' },
  { id: 'lead_request', name: { en: 'Project request form', fr: 'Formulaire de demande de projet' }, event: 'generate_lead' },
  { id: 'newsletter', name: { en: 'Newsletter form', fr: 'Formulaire newsletter' }, event: 'newsletter_signup' },
];

/* ---------------- Social accounts ---------------- */

export type PlatformId = 'linkedin' | 'x' | 'youtube';
export const PLATFORMS: Array<{ id: PlatformId; name: string }> = [
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'x', name: 'X' },
  { id: 'youtube', name: 'YouTube' },
];

export interface SocialAccountDef {
  id: string;
  platform: PlatformId;
  name: string;
  handle: string;
  language: Lang;
  region: RegionId | 'global';
  businessUnit: string;
  audienceStart: number;
  /** daily net audience growth rate */
  growth: number;
  postsPerWeek: number;
}

export const SOCIAL_ACCOUNTS: SocialAccountDef[] = [
  { id: 'li-group', platform: 'linkedin', name: 'Veolia (Group)', handle: 'linkedin.com/company/veolia (demo)', language: 'en', region: 'global', businessUnit: 'group', audienceStart: 1_420_000, growth: 0.00034, postsPerWeek: 5 },
  { id: 'li-fr', platform: 'linkedin', name: 'Veolia France', handle: 'linkedin.com/company/veolia-france (demo)', language: 'fr', region: 'europe', businessUnit: 'group', audienceStart: 214_000, growth: 0.00041, postsPerWeek: 4 },
  { id: 'x-group', platform: 'x', name: '@Veolia', handle: 'x.com/veolia (demo)', language: 'en', region: 'global', businessUnit: 'group', audienceStart: 188_000, growth: -0.00006, postsPerWeek: 7 },
  { id: 'x-fr', platform: 'x', name: '@Veolia_FR', handle: 'x.com/veolia_fr (demo)', language: 'fr', region: 'europe', businessUnit: 'group', audienceStart: 61_000, growth: -0.00003, postsPerWeek: 5 },
  { id: 'yt-group', platform: 'youtube', name: 'Veolia — YouTube', handle: 'youtube.com/@veolia (demo)', language: 'en', region: 'global', businessUnit: 'group', audienceStart: 52_000, growth: 0.00052, postsPerWeek: 1.5 },
];

export const FORMATS: Array<{ id: string; name: L10n; platforms: PlatformId[] }> = [
  { id: 'image', name: { en: 'Image', fr: 'Image' }, platforms: ['linkedin', 'x'] },
  { id: 'video', name: { en: 'Video', fr: 'Vidéo' }, platforms: ['linkedin', 'x', 'youtube'] },
  { id: 'carousel', name: { en: 'Carousel / document', fr: 'Carrousel / document' }, platforms: ['linkedin'] },
  { id: 'article', name: { en: 'Article', fr: 'Article' }, platforms: ['linkedin'] },
  { id: 'text', name: { en: 'Text', fr: 'Texte' }, platforms: ['linkedin', 'x'] },
  { id: 'poll', name: { en: 'Poll', fr: 'Sondage' }, platforms: ['linkedin'] },
  { id: 'link', name: { en: 'Link', fr: 'Lien' }, platforms: ['x'] },
  { id: 'short', name: { en: 'Short', fr: 'Short' }, platforms: ['youtube'] },
  { id: 'live', name: { en: 'Live stream', fr: 'Direct' }, platforms: ['youtube'] },
];

/* ---------------- Web pages (content catalogue, demo) ---------------- */

export type PageType = 'home' | 'solution' | 'industry' | 'municipal' | 'press' | 'case_study' | 'article' | 'careers' | 'conversion' | 'resource' | 'corporate';

export interface PageDef {
  id: string;
  site: SiteId;
  path: string;
  title: string;
  type: PageType;
  topic: string;
  bu: string;
  pillar: string;
  objective: string;
  audience: string;
  published: string;
  updated: string;
  owner: string;
  campaign?: string;
  /** relative traffic weight within the site */
  w: number;
  /** engagement multiplier */
  eng: number;
  /** key-event multiplier */
  conv: number;
  /** traffic trend per year (e.g. 0.3 = +30%/yr, -0.4 declining) */
  trend: number;
}

const P = (
  site: SiteId,
  path: string,
  title: string,
  type: PageType,
  topic: string,
  bu: string,
  pillar: string,
  objective: string,
  audience: string,
  published: string,
  updated: string,
  owner: string,
  w: number,
  eng: number,
  conv: number,
  trend: number,
  campaign?: string,
): PageDef => ({ id: `${site}:${path}`, site, path, title, type, topic, bu, pillar, objective, audience, published, updated, owner, w, eng, conv, trend, campaign });

export const PAGES: PageDef[] = [
  // English site
  P('veolia-en', '/en', 'Veolia — Ecological transformation', 'home', 'corporate', 'group', 'corporate', 'awareness', 'general', '2019-01-15', '2026-09-02', 'Digital team', 0.2, 0.9, 0.6, 0.02),
  P('veolia-en', '/en/our-solutions/water-treatment', 'Industrial water treatment solutions', 'solution', 'water_treatment', 'water_tech', 'expertise', 'lead_generation', 'industry', '2021-04-12', '2026-06-18', 'Water Technologies marketing', 0.07, 1.15, 1.9, 0.08),
  P('veolia-en', '/en/our-solutions/wastewater-reuse', 'Wastewater reuse for industry', 'solution', 'water_treatment', 'water_tech', 'expertise', 'lead_generation', 'industry', '2022-03-01', '2025-11-20', 'Water Technologies marketing', 0.035, 1.2, 1.7, 0.12),
  P('veolia-en', '/en/our-solutions/pfas-treatment', 'PFAS treatment and destruction', 'solution', 'pfas', 'water_tech', 'expertise', 'lead_generation', 'industry', '2023-05-22', '2026-05-11', 'Water Technologies marketing', 0.045, 1.25, 2.1, 0.45, 'pfas-2026'),
  P('veolia-en', '/en/our-solutions/industrial-decarbonisation', 'Industrial decarbonisation services', 'solution', 'decarbonisation', 'energy', 'expertise', 'lead_generation', 'industry', '2022-09-05', '2025-11-17', 'Energy marketing', 0.03, 1.1, 1.6, 0.1, 'decarb-week-2025'),
  P('veolia-en', '/en/our-solutions/waste-management', 'Waste management and recycling', 'solution', 'waste_circular', 'waste', 'expertise', 'consideration', 'industry', '2020-06-10', '2024-03-14', 'Waste marketing', 0.035, 1.0, 1.2, -0.18),
  P('veolia-en', '/en/our-solutions/energy-efficiency', 'Energy efficiency for industrial sites', 'solution', 'energy_efficiency', 'energy', 'expertise', 'lead_generation', 'industry', '2021-02-08', '2025-01-30', 'Energy marketing', 0.025, 1.05, 1.4, -0.05),
  P('veolia-en', '/en/our-solutions/data-centre-water', 'Water solutions for data centres', 'solution', 'datacentre_water', 'water_tech', 'expertise', 'lead_generation', 'industry', '2025-02-17', '2026-09-08', 'Water Technologies marketing', 0.022, 1.2, 1.8, 0.85, 'datacentres-2026'),
  P('veolia-en', '/en/industries/manufacturing', 'Manufacturing industry solutions', 'industry', 'water_treatment', 'water_tech', 'proof', 'consideration', 'industry', '2021-04-12', '2025-08-22', 'Water Technologies marketing', 0.02, 1.0, 1.3, 0.0),
  P('veolia-en', '/en/municipalities/water-services', 'Water services for municipalities', 'municipal', 'municipal_services', 'municipal_water', 'expertise', 'consideration', 'public_sector', '2020-10-01', '2026-05-18', 'Municipal marketing', 0.025, 1.05, 1.3, 0.05, 'chatgpt-collectivities'),
  P('veolia-en', '/en/media/press-releases', 'Press releases', 'press', 'corporate', 'group', 'corporate', 'reputation', 'investors', '2019-01-15', '2026-10-14', 'Press office', 0.045, 0.75, 0.2, 0.0),
  P('veolia-en', '/en/media/annual-results-2025', 'Annual results 2025', 'press', 'corporate', 'group', 'corporate', 'reputation', 'investors', '2026-02-26', '2026-02-26', 'Press office', 0.015, 0.95, 0.2, -0.6, 'results-2025'),
  P('veolia-en', '/en/case-studies/brewery-water-reuse', 'Case study — brewery water reuse', 'case_study', 'water_treatment', 'water_tech', 'proof', 'consideration', 'industry', '2024-09-03', '2024-09-03', 'Water Technologies marketing', 0.012, 1.3, 1.5, -0.1),
  P('veolia-en', '/en/case-studies/steel-plant-decarbonisation', 'Case study — steel plant decarbonisation', 'case_study', 'decarbonisation', 'energy', 'proof', 'consideration', 'industry', '2025-03-11', '2025-03-11', 'Energy marketing', 0.01, 1.3, 1.4, 0.05),
  P('veolia-en', '/en/insights/pfas-explained', 'PFAS explained: what industry needs to know', 'article', 'pfas', 'water_tech', 'expertise', 'awareness', 'industry', '2024-04-22', '2026-05-12', 'Content team', 0.03, 1.35, 0.9, 0.35, 'pfas-2026'),
  P('veolia-en', '/en/insights/water-scarcity-2030', 'Water scarcity: the 2030 outlook', 'article', 'water_treatment', 'water_tech', 'impact', 'awareness', 'general', '2023-03-20', '2023-03-20', 'Content team', 0.022, 1.25, 0.5, -0.32),
  P('veolia-en', '/en/insights/circular-economy-guide', 'A practical guide to the circular economy', 'article', 'waste_circular', 'waste', 'impact', 'awareness', 'general', '2022-11-07', '2022-11-07', 'Content team', 0.03, 1.3, 0.4, 0.0),
  P('veolia-en', '/en/insights/data-centre-cooling', 'How data centres can cut cooling water use', 'article', 'datacentre_water', 'water_tech', 'expertise', 'awareness', 'industry', '2025-06-02', '2026-09-10', 'Content team', 0.016, 1.3, 0.8, 0.9, 'datacentres-2026'),
  P('veolia-en', '/en/careers', 'Careers at Veolia', 'careers', 'careers', 'group', 'people', 'recruitment', 'talent', '2019-01-15', '2026-01-12', 'HR digital', 0.08, 0.95, 1.6, 0.04, 'graduates-2026'),
  P('veolia-en', '/en/careers/graduate-programme', 'Graduate programme', 'careers', 'careers', 'group', 'people', 'recruitment', 'talent', '2022-01-10', '2026-01-12', 'HR digital', 0.025, 1.05, 2.0, 0.06, 'graduates-2026'),
  P('veolia-en', '/en/contact', 'Contact us', 'conversion', 'corporate', 'group', 'corporate', 'lead_generation', 'industry', '2019-01-15', '2025-10-01', 'Digital team', 0.03, 1.1, 4.2, 0.03),
  P('veolia-en', '/en/resources/brochures', 'Brochures and technical documents', 'resource', 'water_treatment', 'water_tech', 'expertise', 'consideration', 'industry', '2021-01-11', '2026-04-02', 'Water Technologies marketing', 0.02, 1.15, 2.6, 0.04),
  P('veolia-en', '/en/about-us', 'About Veolia', 'corporate', 'corporate', 'group', 'corporate', 'reputation', 'general', '2019-01-15', '2025-06-30', 'Digital team', 0.04, 0.85, 0.3, -0.02),
  P('veolia-en', '/en/sustainability-report-2025', 'Sustainability report 2025', 'corporate', 'corporate', 'group', 'impact', 'reputation', 'investors', '2026-04-15', '2026-04-15', 'CSR team', 0.012, 1.2, 0.8, 0.2),
  // French site
  P('veolia-fr', '/fr', 'Veolia — Transformation écologique', 'home', 'corporate', 'group', 'corporate', 'awareness', 'general', '2019-01-15', '2026-09-02', 'Équipe digitale', 0.21, 0.9, 0.6, 0.01),
  P('veolia-fr', '/fr/nos-solutions/traitement-de-l-eau', "Solutions de traitement de l'eau industrielle", 'solution', 'water_treatment', 'water_tech', 'expertise', 'lead_generation', 'industry', '2021-04-12', '2026-03-16', 'Marketing Technologies eau', 0.06, 1.15, 1.8, 0.05, 'water-day-2026'),
  P('veolia-fr', '/fr/nos-solutions/reutilisation-des-eaux-usees', 'Réutilisation des eaux usées traitées (REUT)', 'solution', 'water_treatment', 'water_tech', 'expertise', 'lead_generation', 'public_sector', '2022-03-01', '2026-03-16', 'Marketing Technologies eau', 0.04, 1.2, 1.7, 0.22, 'water-day-2026'),
  P('veolia-fr', '/fr/nos-solutions/traitement-des-pfas', 'Traitement et destruction des PFAS', 'solution', 'pfas', 'water_tech', 'expertise', 'lead_generation', 'public_sector', '2023-05-22', '2026-05-11', 'Marketing Technologies eau', 0.045, 1.25, 2.0, 0.55, 'pfas-2026'),
  P('veolia-fr', '/fr/nos-solutions/decarbonation-industrielle', 'Décarbonation des sites industriels', 'solution', 'decarbonisation', 'energy', 'expertise', 'lead_generation', 'industry', '2022-09-05', '2025-11-17', 'Marketing énergie', 0.028, 1.1, 1.5, 0.08, 'decarb-week-2025'),
  P('veolia-fr', '/fr/nos-solutions/gestion-des-dechets', 'Gestion et valorisation des déchets', 'solution', 'waste_circular', 'waste', 'expertise', 'consideration', 'industry', '2020-06-10', '2024-02-08', 'Marketing déchets', 0.04, 1.0, 1.2, -0.2),
  P('veolia-fr', '/fr/nos-solutions/efficacite-energetique', 'Efficacité énergétique des bâtiments et sites', 'solution', 'energy_efficiency', 'energy', 'expertise', 'lead_generation', 'industry', '2021-02-08', '2025-02-20', 'Marketing énergie', 0.025, 1.05, 1.4, -0.04),
  P('veolia-fr', '/fr/collectivites/services-de-l-eau', "Services de l'eau pour les collectivités", 'municipal', 'municipal_services', 'municipal_water', 'expertise', 'consideration', 'public_sector', '2020-10-01', '2026-05-18', 'Marketing collectivités', 0.045, 1.1, 1.5, 0.12, 'chatgpt-collectivities'),
  P('veolia-fr', '/fr/collectivites/dechets-et-economie-circulaire', 'Déchets et économie circulaire pour les collectivités', 'municipal', 'waste_circular', 'waste', 'expertise', 'consideration', 'public_sector', '2021-05-17', '2025-09-08', 'Marketing collectivités', 0.025, 1.05, 1.2, 0.0),
  P('veolia-fr', '/fr/industries/agroalimentaire', 'Solutions pour l’industrie agroalimentaire', 'industry', 'water_treatment', 'water_tech', 'proof', 'consideration', 'industry', '2021-04-12', '2025-05-12', 'Marketing Technologies eau', 0.018, 1.0, 1.3, 0.0),
  P('veolia-fr', '/fr/medias/communiques', 'Communiqués de presse', 'press', 'corporate', 'group', 'corporate', 'reputation', 'investors', '2019-01-15', '2026-10-14', 'Service de presse', 0.05, 0.75, 0.2, 0.0),
  P('veolia-fr', '/fr/medias/resultats-annuels-2025', 'Résultats annuels 2025', 'press', 'corporate', 'group', 'corporate', 'reputation', 'investors', '2026-02-26', '2026-02-26', 'Service de presse', 0.016, 0.95, 0.2, -0.6, 'results-2025'),
  P('veolia-fr', '/fr/etudes-de-cas/station-reutilisation-vendee', 'Étude de cas — réutilisation des eaux en Vendée', 'case_study', 'water_treatment', 'municipal_water', 'proof', 'consideration', 'public_sector', '2024-06-03', '2024-06-03', 'Marketing collectivités', 0.012, 1.3, 1.4, 0.05),
  P('veolia-fr', '/fr/decryptages/pfas-ce-qu-il-faut-savoir', 'PFAS : ce qu’il faut savoir', 'article', 'pfas', 'water_tech', 'expertise', 'awareness', 'general', '2024-04-22', '2026-05-12', 'Équipe contenus', 0.035, 1.35, 0.8, 0.4, 'pfas-2026'),
  P('veolia-fr', '/fr/decryptages/secheresse-et-reutilisation', "Sécheresse : la réutilisation de l'eau, une réponse", 'article', 'water_treatment', 'municipal_water', 'impact', 'awareness', 'general', '2023-06-19', '2023-06-19', 'Équipe contenus', 0.025, 1.25, 0.5, -0.28),
  P('veolia-fr', '/fr/decryptages/economie-circulaire', "L'économie circulaire en pratique", 'article', 'waste_circular', 'waste', 'impact', 'awareness', 'general', '2022-11-07', '2022-11-07', 'Équipe contenus', 0.022, 1.3, 0.4, 0.0),
  P('veolia-fr', '/fr/carrieres', 'Carrières chez Veolia', 'careers', 'careers', 'group', 'people', 'recruitment', 'talent', '2019-01-15', '2026-01-12', 'RH digital', 0.09, 0.95, 1.6, 0.05, 'graduates-2026'),
  P('veolia-fr', '/fr/carrieres/alternance', 'Alternance et stages', 'careers', 'careers', 'group', 'people', 'recruitment', 'talent', '2022-01-10', '2026-01-12', 'RH digital', 0.035, 1.05, 2.1, 0.1, 'graduates-2026'),
  P('veolia-fr', '/fr/contact', 'Nous contacter', 'conversion', 'corporate', 'group', 'corporate', 'lead_generation', 'industry', '2019-01-15', '2025-10-01', 'Équipe digitale', 0.03, 1.1, 4.0, 0.03),
  P('veolia-fr', '/fr/ressources/brochures', 'Brochures et documentations', 'resource', 'water_treatment', 'water_tech', 'expertise', 'consideration', 'industry', '2021-01-11', '2026-04-02', 'Marketing Technologies eau', 0.018, 1.15, 2.5, 0.03),
  P('veolia-fr', '/fr/qui-sommes-nous', 'Qui sommes-nous', 'corporate', 'corporate', 'group', 'corporate', 'reputation', 'general', '2019-01-15', '2025-06-30', 'Équipe digitale', 0.04, 0.85, 0.3, -0.02),
  P('veolia-fr', '/fr/rapport-developpement-durable-2025', 'Rapport développement durable 2025', 'corporate', 'corporate', 'group', 'impact', 'reputation', 'investors', '2026-04-15', '2026-04-15', 'Équipe RSE', 0.012, 1.2, 0.8, 0.2),
];

/* ---------------- Search queries (Search Console, demo) ---------------- */

export interface QueryDef {
  id: string;
  site: SiteId;
  query: string;
  topic: string;
  brand: boolean;
  /** baseline daily impressions */
  imp: number;
  /** baseline average position */
  pos: number;
  /** position change per year (negative = improving) */
  drift: number;
  page: string;
  /** cliff: position jump from this date (anomaly) */
  cliff?: { from: string; delta: number };
}

const Q = (site: SiteId, query: string, topic: string, brand: boolean, imp: number, pos: number, drift: number, page: string, cliff?: QueryDef['cliff']): QueryDef => ({
  id: `${site}:${query}`,
  site,
  query,
  topic,
  brand,
  imp,
  pos,
  drift,
  page,
  cliff,
});

const CLIFF_EN = { from: '2026-10-06', delta: 6.2 };

export const QUERIES: QueryDef[] = [
  Q('veolia-en', 'veolia', 'corporate', true, 5200, 1.1, 0, '/en'),
  Q('veolia-en', 'veolia careers', 'careers', true, 820, 1.3, 0, '/en/careers'),
  Q('veolia-en', 'veolia water technologies', 'water_treatment', true, 640, 1.4, 0, '/en/our-solutions/water-treatment'),
  Q('veolia-en', 'veolia annual results', 'corporate', true, 260, 1.6, 0, '/en/media/annual-results-2025'),
  Q('veolia-en', 'veolia contact', 'corporate', true, 210, 1.2, 0, '/en/contact'),
  Q('veolia-en', 'veolia graduate programme', 'careers', true, 140, 1.5, 0, '/en/careers/graduate-programme'),
  Q('veolia-en', 'industrial water treatment', 'water_treatment', false, 2400, 3.1, -0.4, '/en/our-solutions/water-treatment', CLIFF_EN),
  Q('veolia-en', 'industrial water treatment companies', 'water_treatment', false, 820, 2.7, -0.3, '/en/our-solutions/water-treatment', CLIFF_EN),
  Q('veolia-en', 'wastewater treatment solutions', 'water_treatment', false, 1500, 4.2, -0.5, '/en/our-solutions/water-treatment', CLIFF_EN),
  Q('veolia-en', 'industrial wastewater recycling', 'water_treatment', false, 640, 5.1, -0.6, '/en/our-solutions/wastewater-reuse'),
  Q('veolia-en', 'water reuse for industry', 'water_treatment', false, 520, 4.4, -0.8, '/en/our-solutions/wastewater-reuse'),
  Q('veolia-en', 'zero liquid discharge', 'water_treatment', false, 760, 7.2, -0.2, '/en/our-solutions/wastewater-reuse'),
  Q('veolia-en', 'pfas water treatment', 'pfas', false, 1650, 5.4, -1.8, '/en/our-solutions/pfas-treatment'),
  Q('veolia-en', 'pfas removal technology', 'pfas', false, 980, 6.3, -1.6, '/en/our-solutions/pfas-treatment'),
  Q('veolia-en', 'what are pfas', 'pfas', false, 4800, 11.4, -2.1, '/en/insights/pfas-explained'),
  Q('veolia-en', 'pfas destruction', 'pfas', false, 420, 4.1, -1.2, '/en/our-solutions/pfas-treatment'),
  Q('veolia-en', 'industrial decarbonization solutions', 'decarbonisation', false, 690, 6.8, -0.4, '/en/our-solutions/industrial-decarbonisation'),
  Q('veolia-en', 'how to decarbonise a factory', 'decarbonisation', false, 380, 9.7, -0.6, '/en/our-solutions/industrial-decarbonisation'),
  Q('veolia-en', 'steel decarbonisation case study', 'decarbonisation', false, 160, 6.1, -0.3, '/en/case-studies/steel-plant-decarbonisation'),
  Q('veolia-en', 'waste management company', 'waste_circular', false, 2100, 8.3, 1.6, '/en/our-solutions/waste-management'),
  Q('veolia-en', 'industrial waste recycling', 'waste_circular', false, 740, 7.4, 1.1, '/en/our-solutions/waste-management'),
  Q('veolia-en', 'circular economy examples', 'waste_circular', false, 3100, 12.6, 0.5, '/en/insights/circular-economy-guide'),
  Q('veolia-en', 'energy efficiency industry', 'energy_efficiency', false, 880, 10.2, 0.6, '/en/our-solutions/energy-efficiency'),
  Q('veolia-en', 'industrial heat recovery', 'energy_efficiency', false, 410, 8.8, 0.3, '/en/our-solutions/energy-efficiency'),
  Q('veolia-en', 'data center water usage', 'datacentre_water', false, 2300, 14.2, -4.2, '/en/insights/data-centre-cooling'),
  Q('veolia-en', 'data center cooling water', 'datacentre_water', false, 1200, 9.8, -3.6, '/en/our-solutions/data-centre-water'),
  Q('veolia-en', 'water scarcity solutions', 'water_treatment', false, 950, 9.4, 1.4, '/en/insights/water-scarcity-2030'),
  Q('veolia-en', 'municipal water services', 'municipal_services', false, 360, 6.6, -0.2, '/en/municipalities/water-services'),
  Q('veolia-en', 'smart water network', 'municipal_services', false, 290, 8.1, -0.1, '/en/municipalities/water-services'),
  Q('veolia-en', 'manufacturing water efficiency', 'water_treatment', false, 270, 7.9, -0.3, '/en/industries/manufacturing'),
  Q('veolia-en', 'brewery water reuse', 'water_treatment', false, 120, 4.8, 0.2, '/en/case-studies/brewery-water-reuse'),
  Q('veolia-en', 'sustainability report water company', 'corporate', false, 180, 7.3, -0.5, '/en/sustainability-report-2025'),
  Q('veolia-fr', 'veolia', 'corporate', true, 6100, 1.1, 0, '/fr'),
  Q('veolia-fr', 'veolia recrutement', 'careers', true, 1350, 1.2, 0, '/fr/carrieres'),
  Q('veolia-fr', 'veolia alternance', 'careers', true, 690, 1.4, 0, '/fr/carrieres/alternance'),
  Q('veolia-fr', 'veolia eau', 'water_treatment', true, 980, 1.6, 0, '/fr/nos-solutions/traitement-de-l-eau'),
  Q('veolia-fr', 'veolia contact', 'corporate', true, 330, 1.3, 0, '/fr/contact'),
  Q('veolia-fr', 'veolia résultats annuels', 'corporate', true, 190, 1.5, 0, '/fr/medias/resultats-annuels-2025'),
  Q('veolia-fr', 'traitement des eaux usées', 'water_treatment', false, 2700, 6.4, -0.3, '/fr/nos-solutions/traitement-de-l-eau'),
  Q('veolia-fr', "traitement de l'eau industrielle", 'water_treatment', false, 720, 3.8, -0.2, '/fr/nos-solutions/traitement-de-l-eau'),
  Q('veolia-fr', 'réutilisation des eaux usées', 'water_treatment', false, 1450, 3.2, -0.9, '/fr/nos-solutions/reutilisation-des-eaux-usees'),
  Q('veolia-fr', 'reut eau', 'water_treatment', false, 520, 2.9, -0.7, '/fr/nos-solutions/reutilisation-des-eaux-usees'),
  Q('veolia-fr', 'sécheresse solutions eau', 'water_treatment', false, 610, 8.9, 1.2, '/fr/decryptages/secheresse-et-reutilisation'),
  Q('veolia-fr', 'pfas eau potable', 'pfas', false, 3900, 7.6, -2.4, '/fr/decryptages/pfas-ce-qu-il-faut-savoir'),
  Q('veolia-fr', 'traitement pfas', 'pfas', false, 1100, 3.9, -1.5, '/fr/nos-solutions/traitement-des-pfas'),
  Q('veolia-fr', 'pfas définition', 'pfas', false, 2600, 13.8, -2.2, '/fr/decryptages/pfas-ce-qu-il-faut-savoir'),
  Q('veolia-fr', 'décarbonation industrielle', 'decarbonisation', false, 830, 5.6, -0.5, '/fr/nos-solutions/decarbonation-industrielle'),
  Q('veolia-fr', 'gestion des déchets entreprise', 'waste_circular', false, 1250, 6.9, 1.4, '/fr/nos-solutions/gestion-des-dechets'),
  Q('veolia-fr', 'valorisation des déchets', 'waste_circular', false, 980, 7.7, 1.0, '/fr/nos-solutions/gestion-des-dechets'),
  Q('veolia-fr', 'économie circulaire exemple', 'waste_circular', false, 2300, 11.2, 0.4, '/fr/decryptages/economie-circulaire'),
  Q('veolia-fr', 'déchets collectivités', 'waste_circular', false, 430, 5.3, 0.1, '/fr/collectivites/dechets-et-economie-circulaire'),
  Q('veolia-fr', 'efficacité énergétique industrie', 'energy_efficiency', false, 640, 9.1, 0.5, '/fr/nos-solutions/efficacite-energetique'),
  Q('veolia-fr', "délégation de service public eau", 'municipal_services', false, 520, 4.6, -0.4, '/fr/collectivites/services-de-l-eau'),
  Q('veolia-fr', "services de l'eau collectivités", 'municipal_services', false, 340, 3.7, -0.3, '/fr/collectivites/services-de-l-eau'),
  Q('veolia-fr', 'eau agroalimentaire', 'water_treatment', false, 210, 6.2, 0.1, '/fr/industries/agroalimentaire'),
  Q('veolia-fr', 'rapport rse eau', 'corporate', false, 150, 8.4, -0.4, '/fr/rapport-developpement-durable-2025'),
];

/** share of Search Console totals hidden from query-level rows (anonymised queries) */
export const GSC_ANONYMISED_IMPRESSION_SHARE = 0.24;

/* ---------------- GEO (Generative Engine Optimisation) ---------------- */

export interface CompetitorDef {
  id: string;
  name: string;
  domain: string;
  /** relative mention propensity per topic (demo) */
  strength: Partial<Record<string, number>>;
}

export const COMPETITORS: CompetitorDef[] = [
  { id: 'aquenta', name: 'Aquenta (fictional)', domain: 'aquenta.example', strength: { water_treatment: 0.55, pfas: 0.4, datacentre_water: 0.5, municipal_services: 0.35 } },
  { id: 'circulor', name: 'Circulor Group (fictional)', domain: 'circulor.example', strength: { waste_circular: 0.6, energy_efficiency: 0.3, decarbonisation: 0.25 } },
  { id: 'nordwater', name: 'Nordwater (fictional)', domain: 'nordwater.example', strength: { water_treatment: 0.35, municipal_services: 0.5, pfas: 0.3 } },
  { id: 'envirocore', name: 'EnviroCore (fictional)', domain: 'envirocore.example', strength: { decarbonisation: 0.5, energy_efficiency: 0.55, datacentre_water: 0.35 } },
];

export const NEUTRAL_CITATION_DOMAINS = ['wikipedia.org', 'epa.gov', 'iea.org', 'unep.org', 'who.int', 'ec.europa.eu', 'ademe.fr', 'eea.europa.eu', 'oecd.org', 'reuters.com'];

export type GeoProviderId = 'openai_api_search' | 'perplexity_api' | 'google_aio_manual';
export interface GeoProviderDef {
  id: GeoProviderId;
  name: string;
  method: 'api_sampling' | 'manual_observation';
  /** measurement cadence in days */
  cadence: number;
  limitation: L10n;
}

export const GEO_PROVIDERS: GeoProviderDef[] = [
  {
    id: 'openai_api_search',
    name: 'OpenAI API — web search sampling',
    method: 'api_sampling',
    cadence: 7,
    limitation: {
      en: 'Answers sampled through the OpenAI API with web search. API answers can differ from what ChatGPT users see.',
      fr: "Réponses échantillonnées via l'API OpenAI avec recherche web. Elles peuvent différer de ce que voient les utilisateurs de ChatGPT.",
    },
  },
  {
    id: 'perplexity_api',
    name: 'Perplexity API — sampling',
    method: 'api_sampling',
    cadence: 7,
    limitation: {
      en: 'Answers sampled through the Perplexity API. Results vary with model version and retrieval.',
      fr: "Réponses échantillonnées via l'API Perplexity. Les résultats varient selon le modèle et la recherche.",
    },
  },
  {
    id: 'google_aio_manual',
    name: 'Google AI search — manual observation',
    method: 'manual_observation',
    cadence: 28,
    limitation: {
      en: 'No official API: observations are captured manually and imported. Small sample, low frequency.',
      fr: "Pas d'API officielle : observations relevées manuellement puis importées. Échantillon réduit, fréquence faible.",
    },
  },
];

export interface GeoPromptDef {
  id: string;
  text: string;
  lang: Lang;
  topic: string;
  intent: 'informational' | 'commercial' | 'comparison' | 'navigational';
  market: string;
  priority: 'high' | 'medium' | 'low';
  expectedPages: string[];
  /** baseline probability that Veolia is mentioned / cited (demo) */
  mention: number;
  cite: number;
  /** probability change per year */
  trend: number;
}

const G = (id: string, text: string, lang: Lang, topic: string, intent: GeoPromptDef['intent'], market: string, priority: GeoPromptDef['priority'], expectedPages: string[], mention: number, cite: number, trend: number): GeoPromptDef => ({
  id,
  text,
  lang,
  topic,
  intent,
  market,
  priority,
  expectedPages,
  mention,
  cite,
  trend,
});

export const GEO_PROMPTS: GeoPromptDef[] = [
  G('p01', 'Which companies provide industrial wastewater treatment services?', 'en', 'water_treatment', 'commercial', 'Global', 'high', ['/en/our-solutions/water-treatment'], 0.78, 0.46, 0.08),
  G('p02', 'What are the best technologies to remove PFAS from drinking water?', 'en', 'pfas', 'informational', 'Global', 'high', ['/en/our-solutions/pfas-treatment', '/en/insights/pfas-explained'], 0.42, 0.3, 0.2),
  G('p03', 'How can manufacturers reduce their water consumption?', 'en', 'water_treatment', 'informational', 'Global', 'medium', ['/en/our-solutions/wastewater-reuse'], 0.38, 0.22, 0.05),
  G('p04', 'What is the most effective way to decarbonise an industrial site?', 'en', 'decarbonisation', 'informational', 'Global', 'high', ['/en/our-solutions/industrial-decarbonisation'], 0.3, 0.18, 0.06),
  G('p05', 'Who are the leading waste management companies in Europe?', 'en', 'waste_circular', 'comparison', 'Europe', 'high', ['/en/our-solutions/waste-management'], 0.81, 0.35, 0.0),
  G('p06', 'How do data centres reduce water use for cooling?', 'en', 'datacentre_water', 'informational', 'Global', 'high', ['/en/insights/data-centre-cooling', '/en/our-solutions/data-centre-water'], 0.12, 0.07, 0.18),
  G('p07', 'Which suppliers offer water solutions for data centres?', 'en', 'datacentre_water', 'commercial', 'US', 'high', ['/en/our-solutions/data-centre-water'], 0.2, 0.09, 0.2),
  G('p08', 'What are examples of the circular economy in industry?', 'en', 'waste_circular', 'informational', 'Global', 'medium', ['/en/insights/circular-economy-guide'], 0.33, 0.21, 0.0),
  G('p09', 'How can cities make their water networks more efficient?', 'en', 'municipal_services', 'informational', 'Global', 'medium', ['/en/municipalities/water-services'], 0.36, 0.2, 0.04),
  G('p10', 'What is zero liquid discharge and who provides it?', 'en', 'water_treatment', 'comparison', 'Global', 'medium', ['/en/our-solutions/wastewater-reuse'], 0.47, 0.25, 0.02),
  G('p11', 'Best practices for industrial energy efficiency', 'en', 'energy_efficiency', 'informational', 'Global', 'low', ['/en/our-solutions/energy-efficiency'], 0.15, 0.08, -0.02),
  G('p12', 'How is PFAS destroyed rather than just filtered?', 'en', 'pfas', 'informational', 'US', 'medium', ['/en/our-solutions/pfas-treatment'], 0.35, 0.24, 0.16),
  G('p13', 'Which companies help municipalities with water reuse projects?', 'en', 'municipal_services', 'commercial', 'Global', 'medium', ['/en/municipalities/water-services'], 0.52, 0.27, 0.05),
  G('p14', 'What is industrial heat recovery and how does it cut emissions?', 'en', 'energy_efficiency', 'informational', 'Global', 'low', ['/en/our-solutions/energy-efficiency'], 0.18, 0.1, 0.0),
  G('p15', 'Compare industrial water treatment providers', 'en', 'water_treatment', 'comparison', 'Global', 'high', ['/en/our-solutions/water-treatment', '/en/industries/manufacturing'], 0.71, 0.29, 0.03),
  G('p16', 'What does the water sector need to do to reach net zero?', 'en', 'decarbonisation', 'informational', 'Global', 'low', ['/en/sustainability-report-2025'], 0.26, 0.14, 0.02),
  G('p17', 'Quelles solutions pour traiter les PFAS dans l’eau potable ?', 'fr', 'pfas', 'informational', 'France', 'high', ['/fr/nos-solutions/traitement-des-pfas', '/fr/decryptages/pfas-ce-qu-il-faut-savoir'], 0.55, 0.38, 0.18),
  G('p18', 'Quelles entreprises proposent la réutilisation des eaux usées traitées ?', 'fr', 'water_treatment', 'commercial', 'France', 'high', ['/fr/nos-solutions/reutilisation-des-eaux-usees'], 0.74, 0.44, 0.06),
  G('p19', 'Comment décarboner un site industriel ?', 'fr', 'decarbonisation', 'informational', 'France', 'high', ['/fr/nos-solutions/decarbonation-industrielle'], 0.34, 0.2, 0.05),
  G('p20', 'Quels acteurs de la gestion des déchets pour les collectivités ?', 'fr', 'waste_circular', 'comparison', 'France', 'high', ['/fr/collectivites/dechets-et-economie-circulaire'], 0.83, 0.41, 0.0),
  G('p21', 'Comment une collectivité peut-elle déléguer son service de l’eau ?', 'fr', 'municipal_services', 'informational', 'France', 'medium', ['/fr/collectivites/services-de-l-eau'], 0.66, 0.39, 0.03),
  G('p22', 'Quelles solutions face à la sécheresse pour les collectivités ?', 'fr', 'water_treatment', 'informational', 'France', 'medium', ['/fr/decryptages/secheresse-et-reutilisation'], 0.44, 0.24, 0.04),
  G('p23', 'Exemples d’économie circulaire dans l’industrie', 'fr', 'waste_circular', 'informational', 'France', 'medium', ['/fr/decryptages/economie-circulaire'], 0.29, 0.17, 0.0),
  G('p24', 'Comment réduire la consommation d’eau d’un data center ?', 'fr', 'datacentre_water', 'informational', 'France', 'high', [], 0.09, 0.03, 0.12),
  G('p25', 'Qu’est-ce que la valorisation énergétique des déchets ?', 'fr', 'waste_circular', 'informational', 'France', 'low', ['/fr/nos-solutions/gestion-des-dechets'], 0.4, 0.2, 0.0),
  G('p26', 'Quels prestataires pour l’efficacité énergétique des bâtiments publics ?', 'fr', 'energy_efficiency', 'commercial', 'France', 'medium', ['/fr/nos-solutions/efficacite-energetique'], 0.27, 0.12, -0.03),
  G('p27', 'Traitement de l’eau dans l’agroalimentaire : quelles solutions ?', 'fr', 'water_treatment', 'commercial', 'France', 'low', ['/fr/industries/agroalimentaire'], 0.39, 0.19, 0.02),
  G('p28', 'PFAS : quelles obligations pour les industriels en 2026 ?', 'fr', 'pfas', 'informational', 'France', 'high', ['/fr/decryptages/pfas-ce-qu-il-faut-savoir'], 0.31, 0.21, 0.14),
];

/* ---------------- ChatGPT Ads (demo account structure) ---------------- */

export type AdCategory = 'industries' | 'collectivities';
export interface AdDef {
  id: string;
  group: string;
  name: string;
  headline: string;
  landing: string;
  site: SiteId;
  ctr: number;
  cvr: number;
}
export interface AdGroupDef {
  id: string;
  campaign: string;
  name: string;
  status: 'active' | 'paused';
  /** day from which the ad group stops delivering (paused) */
  pausedFrom?: string;
}
export interface AdCampaignDef {
  id: string;
  name: string;
  category: AdCategory;
  objective: string;
  status: 'active' | 'paused';
  from: string;
  monthlyBudget: number;
  utmCampaign: string;
  businessUnit: string;
  cpm: number;
}

export const AD_CAMPAIGNS: AdCampaignDef[] = [
  { id: 'cg-ind', name: 'Industries — Industrial water efficiency', category: 'industries', objective: 'lead_generation', status: 'active', from: '2026-05-04', monthlyBudget: 18000, utmCampaign: 'chatgpt_industries', businessUnit: 'water_tech', cpm: 21 },
  { id: 'cg-col', name: 'Collectivities — Municipal water & waste', category: 'collectivities', objective: 'consideration', status: 'active', from: '2026-05-18', monthlyBudget: 12000, utmCampaign: 'chatgpt_collectivities', businessUnit: 'municipal_water', cpm: 17 },
];

export const AD_GROUPS: AdGroupDef[] = [
  { id: 'ag-ind-reuse', campaign: 'cg-ind', name: 'Water reuse for manufacturing', status: 'active' },
  { id: 'ag-ind-pfas', campaign: 'cg-ind', name: 'PFAS treatment for industry', status: 'active' },
  { id: 'ag-ind-decarb', campaign: 'cg-ind', name: 'Industrial decarbonisation', status: 'active' },
  { id: 'ag-col-water', campaign: 'cg-col', name: 'Municipal water services', status: 'active' },
  { id: 'ag-col-waste', campaign: 'cg-col', name: 'Waste & circular economy for cities', status: 'active' },
  { id: 'ag-col-quality', campaign: 'cg-col', name: 'Drinking water quality', status: 'paused', pausedFrom: '2026-09-01' },
];

export const ADS: AdDef[] = [
  { id: 'ad-ind-reuse-a', group: 'ag-ind-reuse', name: 'Reuse — ROI angle', headline: 'Cut process water costs with on-site reuse', landing: '/en/our-solutions/wastewater-reuse', site: 'veolia-en', ctr: 0.028, cvr: 0.046 },
  { id: 'ad-ind-reuse-b', group: 'ag-ind-reuse', name: 'Reuse — compliance angle', headline: 'Meet discharge limits and reuse more water', landing: '/en/our-solutions/water-treatment', site: 'veolia-en', ctr: 0.021, cvr: 0.038 },
  { id: 'ad-ind-pfas-a', group: 'ag-ind-pfas', name: 'PFAS — destruction', headline: 'Destroy PFAS, not just capture them', landing: '/en/our-solutions/pfas-treatment', site: 'veolia-en', ctr: 0.034, cvr: 0.052 },
  { id: 'ad-ind-pfas-b', group: 'ag-ind-pfas', name: 'PFAS — FR industriels', headline: 'PFAS : des solutions de traitement éprouvées', landing: '/fr/nos-solutions/traitement-des-pfas', site: 'veolia-fr', ctr: 0.03, cvr: 0.044 },
  { id: 'ad-ind-decarb-a', group: 'ag-ind-decarb', name: 'Decarbonisation — audit', headline: 'Map your site’s fastest decarbonisation wins', landing: '/en/our-solutions/industrial-decarbonisation', site: 'veolia-en', ctr: 0.017, cvr: 0.031 },
  { id: 'ad-ind-decarb-b', group: 'ag-ind-decarb', name: 'Decarbonisation — heat', headline: 'Recover industrial heat, reduce emissions', landing: '/en/our-solutions/energy-efficiency', site: 'veolia-en', ctr: 0.014, cvr: 0 },
  { id: 'ad-col-water-a', group: 'ag-col-water', name: 'Collectivités — service eau', headline: "Un service de l'eau performant pour votre territoire", landing: '/fr/collectivites/services-de-l-eau', site: 'veolia-fr', ctr: 0.041, cvr: 0.011 },
  { id: 'ad-col-water-b', group: 'ag-col-water', name: 'Collectivités — REUT', headline: 'Réutilisez vos eaux usées traitées', landing: '/fr/nos-solutions/reutilisation-des-eaux-usees', site: 'veolia-fr', ctr: 0.036, cvr: 0.015 },
  { id: 'ad-col-waste-a', group: 'ag-col-waste', name: 'Collectivités — déchets', headline: 'Valorisez les déchets de votre collectivité', landing: '/fr/collectivites/dechets-et-economie-circulaire', site: 'veolia-fr', ctr: 0.031, cvr: 0.013 },
  { id: 'ad-col-waste-b', group: 'ag-col-waste', name: 'Cities — circular economy', headline: 'Circular economy programmes for cities', landing: '/en/municipalities/water-services', site: 'veolia-en', ctr: 0.024, cvr: 0.012 },
  { id: 'ad-col-quality-a', group: 'ag-col-quality', name: 'Eau potable — qualité', headline: 'Garantir la qualité de votre eau potable', landing: '/fr/collectivites/services-de-l-eau', site: 'veolia-fr', ctr: 0.026, cvr: 0.01 },
];

/** Attribution window assumed for platform-attributed conversions in demo mode.
 *  The real window must be read from the advertiser account / OpenAI measurement settings. */
export const DEMO_AD_ATTRIBUTION_WINDOW = { en: '7-day click (demo assumption)', fr: '7 jours après clic (hypothèse démo)' };

export function label(l10n: L10n, lang: Lang): string {
  return l10n[lang] ?? l10n.en;
}
