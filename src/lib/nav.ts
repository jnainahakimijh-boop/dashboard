import { BarChart3, FileText, Gauge, Globe2, Lightbulb, Megaphone, Search, Settings2, Share2, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import type { Permission } from '@shared/rbac';

export interface NavItem {
  path: string;
  key: string;
  icon: LucideIcon;
  group: 'performance' | 'intelligence' | 'governance';
  permission?: Permission;
}

export const NAV: NavItem[] = [
  { path: '/', key: 'overview', icon: Gauge, group: 'performance' },
  { path: '/web', key: 'web', icon: Globe2, group: 'performance' },
  { path: '/social', key: 'social', icon: Share2, group: 'performance' },
  { path: '/ads', key: 'ads', icon: Megaphone, group: 'performance' },
  { path: '/seo', key: 'seo', icon: Search, group: 'intelligence' },
  { path: '/geo', key: 'geo', icon: Sparkles, group: 'intelligence' },
  { path: '/content', key: 'content', icon: FileText, group: 'intelligence' },
  { path: '/insights', key: 'insights', icon: Lightbulb, group: 'intelligence' },
  { path: '/reports', key: 'reports', icon: BarChart3, group: 'governance' },
  { path: '/admin', key: 'admin', icon: ShieldCheck, group: 'governance', permission: 'admin.view' },
];

export const SETTINGS_ITEM = { path: '/settings', key: 'settings', icon: Settings2 };
