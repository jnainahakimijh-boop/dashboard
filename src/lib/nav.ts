import {
  Activity,
  BarChart3,
  BookOpenCheck,
  FileText,
  Filter,
  Globe2,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Megaphone,
  Settings,
  Share2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { MsgKey } from '@/i18n/messages';

export interface NavItem {
  path: string;
  labelKey: MsgKey;
  icon: LucideIcon;
}

export interface NavSection {
  labelKey: MsgKey;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: 'nav.performance',
    items: [
      { path: '/', labelKey: 'nav.overview', icon: LayoutDashboard },
      { path: '/web', labelKey: 'nav.web', icon: Activity },
      { path: '/social', labelKey: 'nav.social', icon: Share2 },
      { path: '/content', labelKey: 'nav.content', icon: FileText },
      { path: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone },
      { path: '/journey', labelKey: 'nav.journey', icon: Filter },
      { path: '/audience', labelKey: 'nav.audience', icon: Globe2 },
    ],
  },
  {
    labelKey: 'nav.intelligence',
    items: [
      { path: '/insights', labelKey: 'nav.insightsRecs', icon: Lightbulb },
      { path: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'nav.governance',
    items: [
      { path: '/data-quality', labelKey: 'nav.dq', icon: ListChecks },
      { path: '/kpi-catalogue', labelKey: 'nav.catalogue', icon: BookOpenCheck },
    ],
  },
];

/** Pinned below the scrollable groups, above the user profile. */
export const NAV_BOTTOM: NavItem[] = [
  { path: '/settings', labelKey: 'nav.settings', icon: Settings },
  { path: '/admin', labelKey: 'nav.admin', icon: ShieldCheck },
];

export interface PageMeta {
  eyebrowKey: MsgKey;
  titleKey: MsgKey;
  subtitleKey: MsgKey;
  /** dimensions whose filters genuinely apply on this page */
  filterDims: Array<'markets' | 'channels' | 'platforms' | 'devices' | 'campaigns' | 'themes' | 'formats'>;
}

export const PAGE_META: Record<string, PageMeta> = {
  '/': { eyebrowKey: 'ov.eyebrow', titleKey: 'ov.title', subtitleKey: 'ov.subtitle', filterDims: ['markets', 'channels', 'platforms', 'devices', 'campaigns', 'themes', 'formats'] },
  '/web': { eyebrowKey: 'web.eyebrow', titleKey: 'web.title', subtitleKey: 'web.subtitle', filterDims: ['markets', 'channels', 'devices'] },
  '/social': { eyebrowKey: 'soc.eyebrow', titleKey: 'soc.title', subtitleKey: 'soc.subtitle', filterDims: ['markets', 'platforms'] },
  '/content': { eyebrowKey: 'cnt.eyebrow', titleKey: 'cnt.title', subtitleKey: 'cnt.subtitle', filterDims: ['markets', 'platforms', 'themes', 'formats'] },
  '/campaigns': { eyebrowKey: 'cmp.eyebrow', titleKey: 'cmp.title', subtitleKey: 'cmp.subtitle', filterDims: ['markets', 'campaigns', 'themes'] },
  '/journey': { eyebrowKey: 'jny.eyebrow', titleKey: 'jny.title', subtitleKey: 'jny.subtitle', filterDims: ['markets', 'platforms', 'devices'] },
  '/audience': { eyebrowKey: 'aud.eyebrow', titleKey: 'aud.title', subtitleKey: 'aud.subtitle', filterDims: ['markets', 'channels', 'devices'] },
  '/insights': { eyebrowKey: 'ins.eyebrow', titleKey: 'ins.title', subtitleKey: 'ins.subtitle', filterDims: ['markets', 'channels', 'platforms', 'devices'] },
  '/reports': { eyebrowKey: 'rep.eyebrow', titleKey: 'rep.title', subtitleKey: 'rep.subtitle', filterDims: [] },
  '/data-quality': { eyebrowKey: 'dq.eyebrow', titleKey: 'dq.title', subtitleKey: 'dq.subtitle', filterDims: [] },
  '/kpi-catalogue': { eyebrowKey: 'cat.eyebrow', titleKey: 'cat.title', subtitleKey: 'cat.subtitle', filterDims: [] },
  '/settings': { eyebrowKey: 'set.eyebrow', titleKey: 'set.title', subtitleKey: 'set.subtitle', filterDims: [] },
  '/admin': { eyebrowKey: 'adm.eyebrow', titleKey: 'adm.title', subtitleKey: 'adm.subtitle', filterDims: [] },
};

/** Pages where the analytical toolbar (period + filters) is shown */
export const FILTERED_PAGES = new Set(['/', '/web', '/social', '/content', '/campaigns', '/journey', '/audience', '/insights']);
