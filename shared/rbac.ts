/** ------------------------------------------------------------------
 *  Role-based access control matrix. The server enforces it on every
 *  route (server/auth/middleware.ts); the web app only uses it to
 *  decide what to display.
 *  ------------------------------------------------------------------ */
import type { L10n } from './catalog';

export const ROLES = ['super_admin', 'admin', 'analyst', 'editor', 'executive_viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, L10n> = {
  super_admin: { en: 'Super Admin', fr: 'Super administrateur' },
  admin: { en: 'Admin', fr: 'Administrateur' },
  analyst: { en: 'Analyst', fr: 'Analyste' },
  editor: { en: 'Editor', fr: 'Éditeur' },
  executive_viewer: { en: 'Executive Viewer', fr: 'Lecteur direction' },
};

export const ROLE_DESCRIPTIONS: Record<Role, L10n> = {
  super_admin: { en: 'Full control, including other administrators, AI and security settings.', fr: 'Contrôle total, y compris les administrateurs, l’IA et la sécurité.' },
  admin: { en: 'Manages users, integrations, KPIs, dashboards, alerts and data.', fr: 'Gère utilisateurs, intégrations, KPI, tableaux de bord, alertes et données.' },
  analyst: { en: 'Analyses all modules, manages recommendations, reports, targets, keywords and prompts.', fr: 'Analyse tous les modules, gère recommandations, rapports, objectifs, mots-clés et prompts.' },
  editor: { en: 'Views analytics, tags content, comments on recommendations and works on SEO issues.', fr: 'Consulte les analyses, qualifie les contenus, commente les recommandations et traite les anomalies SEO.' },
  executive_viewer: { en: 'Read-only access to dashboards, summaries and published reports.', fr: 'Accès en lecture aux tableaux de bord, synthèses et rapports publiés.' },
};

export const PERMISSIONS = [
  'analytics.view',
  'analytics.export',
  'content.tag',
  'recommendations.comment',
  'recommendations.manage',
  'seo.issues.manage',
  'seo.keywords.manage',
  'seo.crawl.run',
  'geo.prompts.manage',
  'geo.measure.run',
  'reports.create',
  'reports.schedule',
  'alerts.ack',
  'alerts.manage',
  'targets.manage',
  'views.share',
  'dashboards.edit',
  'data.import',
  'ai.generate',
  'admin.view',
  'users.manage',
  'org.manage',
  'integrations.manage',
  'kpi.manage',
  'ai.manage',
  'audit.view',
  'system.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = new Set<Permission>(PERMISSIONS);
const ADMIN = new Set<Permission>([...PERMISSIONS].filter((p) => p !== 'ai.manage'));
const ANALYST = new Set<Permission>([
  'analytics.view',
  'analytics.export',
  'content.tag',
  'recommendations.comment',
  'recommendations.manage',
  'seo.issues.manage',
  'seo.keywords.manage',
  'geo.prompts.manage',
  'reports.create',
  'reports.schedule',
  'alerts.ack',
  'alerts.manage',
  'targets.manage',
  'views.share',
  'data.import',
  'ai.generate',
]);
const EDITOR = new Set<Permission>(['analytics.view', 'analytics.export', 'content.tag', 'recommendations.comment', 'seo.issues.manage', 'reports.create', 'alerts.ack']);
const EXEC = new Set<Permission>(['analytics.view']);

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: ALL,
  admin: ADMIN,
  analyst: ANALYST,
  editor: EDITOR,
  executive_viewer: EXEC,
};

export function can(role: Role | null | undefined, p: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].has(p);
}

/** Roles a user with `actor` role may assign. Only super admins create super admins. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === 'super_admin') return [...ROLES];
  if (actor === 'admin') return ['admin', 'analyst', 'editor', 'executive_viewer'];
  return [];
}

export function isRole(x: unknown): x is Role {
  return typeof x === 'string' && (ROLES as readonly string[]).includes(x);
}

/** Analytics modules that can be restricted per user (in addition to the role). */
export const APP_MODULES = ['web', 'social', 'seo', 'geo', 'ads', 'content'] as const;
export type AppModule = (typeof APP_MODULES)[number];

/** Which app module governs metrics of each semantic-layer module. */
export const METRIC_MODULE_TO_APP: Record<string, AppModule> = { web: 'web', forms: 'web', search: 'seo', social: 'social', ads: 'ads', geo: 'geo' };

/** Users without a module list may access every module their role allows. */
export function canAccessModule(scopes: { modules?: string[] } | null | undefined, module: AppModule): boolean {
  return !scopes?.modules?.length || scopes.modules.includes(module);
}
