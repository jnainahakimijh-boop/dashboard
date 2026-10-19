import type { L10n } from '@shared/catalog';
import type { AnalyticsResponse, DataMode, MetricResult } from '@shared/filters';
import type { Permission, Role } from '@shared/rbac';

export type { AnalyticsResponse, DataMode, MetricResult };

export interface Me {
  user: { id: string; email: string; name: string; role: Role; language: 'en' | 'fr'; scopes: { websites?: string[]; modules?: string[] }; isDemo: boolean; hasPassword: boolean; preferences: Record<string, unknown> };
  permissions: Permission[];
}

export interface SourceStatus {
  mode: DataMode;
  coverageFrom: string | null;
  coverageTo: string | null;
  freshness: string | null;
  missingEntities: string[];
}

export interface WidgetConfig {
  id: string;
  type: 'kpi_grid' | 'evolution' | 'channels' | 'geography' | 'content_snapshot' | 'alerts' | 'ai_summary' | 'targets';
  visible: boolean;
  metrics?: string[];
  title?: string;
}

export interface OrgUiSettings {
  conversionEvents: string[];
  appName?: string;
  supportedLanguages?: Array<'en' | 'fr'>;
  dateFormat?: 'locale' | 'iso';
  numberLocale?: 'fr-FR' | 'en-GB' | 'en-US';
  defaultPeriod?: string;
  defaultCompare?: 'previous' | 'yoy' | 'none';
  defaultTheme?: 'light' | 'dark' | 'system';
}

export interface Meta {
  org: { name: string; timezone: string; currency: string; defaultLanguage: string; logoDataUrl: string | null; demoMode: boolean; settings: OrgUiSettings };
  asOf: string;
  dataStart: string | null;
  sources: Record<string, SourceStatus>;
  connections: Array<{ provider: string; status: string; name: string; mode: string; lastSuccessAt: string | null }>;
  sites: Array<{ key: string; name: string; domain: string; basePath: string; language: string; businessUnit: string | null; status: string }>;
  accounts: Array<{ key: string; platform: string; name: string; handle: string | null; language: string; status: string }>;
  campaigns: Array<{ key: string; utm: string; name: L10n; from: string; to: string | null; topic: string | null; businessUnit: string | null; objective: string | null }>;
  taxonomy: Array<{ kind: string; key: string; label: L10n }>;
  competitors: Array<{ key: string; name: string; domain: string; isDemo: boolean }>;
  metricOverrides: Record<string, { enabled: boolean; label: L10n | null; definition: L10n | null; owner: string | null }>;
  executiveLayout: WidgetConfig[];
  catalog: {
    countries: Array<{ id: string; isoNum: string; name: L10n; region: string }>;
    regions: Array<{ id: string; name: L10n }>;
    channels: Array<{ id: string; name: L10n }>;
    devices: Array<{ id: string; name: L10n }>;
    events: Array<{ id: string; name: L10n; keyEvent: boolean; conversion: boolean; drupalForm: string | null }>;
    forms: Array<{ id: string; name: L10n; event: string }>;
    platforms: Array<{ id: string; name: string }>;
    formats: Array<{ id: string; name: L10n; platforms: string[] }>;
    businessUnits: Array<{ id: string; name: L10n }>;
    languages: Record<string, L10n>;
    geoProviders: Array<{ id: string; name: string; method: string; cadence: number; limitation: L10n }>;
    aiReferralSources: string[];
    adCampaigns: Array<{ id: string; name: string; category: string }>;
    adGroups: Array<{ id: string; campaign: string; name: string }>;
    ads: Array<{ id: string; group: string; name: string; headline: string }>;
  };
}

export interface SummaryItem {
  text: L10n;
  tone: 'positive' | 'negative' | 'neutral' | 'warning';
  metric?: string;
  link?: string;
}

export interface ExecutiveSummary {
  period: { from: string; to: string };
  comparePeriod: { from: string; to: string } | null;
  modes: string[];
  changed: SummaryItem[];
  drivers: SummaryItem[];
  attention: SummaryItem[];
  actions: SummaryItem[];
  limitations: SummaryItem[];
  generatedAt: string;
  narrative: { text: string | null; reason: string } | null;
  ai: { available: boolean; reason: string; provider: string; model: string | null };
}

export interface AlertEvent {
  id: string;
  ruleId: string | null;
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  titleFr: string | null;
  evidence: Record<string, unknown>;
  occurrences: number;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface EvidenceItem {
  label: L10n;
  value?: number | null;
  compare?: number | null;
  unit: string;
  period?: { from: string; to: string } | null;
  comparePeriod?: { from: string; to: string } | null;
  source: string;
  metric?: string;
  mode?: string;
  text?: string;
}

export interface Recommendation {
  id: string;
  ruleKey: string | null;
  origin: 'rule' | 'ai' | 'manual';
  title: string;
  titleFr: string | null;
  summary: string;
  summaryFr: string | null;
  action: string;
  actionFr: string | null;
  evidence: EvidenceItem[];
  kpis: string[];
  channels: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  effort: string | null;
  ownerId: string | null;
  ownerName?: string | null;
  status: 'new' | 'under_review' | 'approved' | 'in_progress' | 'completed' | 'dismissed';
  dueDate: string | null;
  sources: string[];
  confidence: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  comments?: Array<{ id: string; body: string; userName: string | null; createdAt: string }>;
  history?: Array<{ id: string; field: string; fromValue: string | null; toValue: string | null; userName: string | null; createdAt: string }>;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
