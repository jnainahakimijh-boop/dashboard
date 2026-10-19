import clsx from 'clsx';
import { Activity, Bell, Building2, Database, FileBarChart, Gauge, Globe2, KeyRound, LayoutDashboard, ListChecks, Megaphone, Plug, ScrollText, Search, Share2, Sparkles, Target, Users } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Permission } from '@shared/rbac';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { Select } from '@/components/ui';
import { OrganizationSection, OverviewSection } from './sections/general';
import { AuditSection, RolesSection, UsersSection } from './sections/access';
import { AdvertisingSection, IntegrationsSection, SeoGeoSection, SocialAccountsSection, WebsitesSection } from './sections/sources';
import { AlertRulesSection, DashboardSection, KpiSection, TargetsSection } from './sections/measure';
import { AiSection, DataSection, ReportingAdminSection, SystemSection } from './sections/operations';

interface SectionDef {
  id: string;
  icon: ComponentType<{ className?: string }>;
  group: 'platform' | 'sources' | 'measurement' | 'operations';
  permission?: Permission;
}

/** The overview plus the 17 administration areas of the brief, in order. */
const SECTIONS: SectionDef[] = [
  { id: 'overview', icon: Gauge, group: 'platform' },
  { id: 'organization', icon: Building2, group: 'platform' },
  { id: 'users', icon: Users, group: 'platform' },
  { id: 'roles', icon: KeyRound, group: 'platform' },
  { id: 'integrations', icon: Plug, group: 'sources' },
  { id: 'websites', icon: Globe2, group: 'sources' },
  { id: 'social', icon: Share2, group: 'sources' },
  { id: 'advertising', icon: Megaphone, group: 'sources' },
  { id: 'seo_geo', icon: Search, group: 'sources' },
  { id: 'kpis', icon: ListChecks, group: 'measurement' },
  { id: 'dashboard', icon: LayoutDashboard, group: 'measurement' },
  { id: 'alerts', icon: Bell, group: 'measurement' },
  { id: 'data', icon: Database, group: 'measurement' },
  { id: 'targets', icon: Target, group: 'measurement' },
  { id: 'reporting', icon: FileBarChart, group: 'operations' },
  { id: 'ai', icon: Sparkles, group: 'operations' },
  { id: 'audit', icon: ScrollText, group: 'operations', permission: 'audit.view' },
  { id: 'system', icon: Activity, group: 'operations', permission: 'system.view' },
];

export default function AdminPage() {
  const { t } = useI18n();
  const { can } = useSession();
  const [sp, setSp] = useSearchParams();
  const [auditUser, setAuditUser] = useState<string | undefined>(undefined);
  const visible = SECTIONS.filter((s) => !s.permission || can(s.permission));
  const current = visible.find((s) => s.id === sp.get('section')) ?? visible[0];
  const go = (id: string) =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('section', id);
        return n;
      },
      { replace: false },
    );
  const body = () => {
    switch (current.id) {
      case 'organization':
        return <OrganizationSection />;
      case 'users':
        return (
          <UsersSection
            onShowAudit={(email) => {
              setAuditUser(email);
              go('audit');
            }}
          />
        );
      case 'roles':
        return <RolesSection />;
      case 'integrations':
        return <IntegrationsSection />;
      case 'websites':
        return <WebsitesSection />;
      case 'social':
        return <SocialAccountsSection />;
      case 'advertising':
        return <AdvertisingSection />;
      case 'seo_geo':
        return <SeoGeoSection />;
      case 'kpis':
        return <KpiSection />;
      case 'dashboard':
        return <DashboardSection />;
      case 'alerts':
        return <AlertRulesSection />;
      case 'data':
        return <DataSection />;
      case 'targets':
        return <TargetsSection />;
      case 'reporting':
        return <ReportingAdminSection />;
      case 'ai':
        return <AiSection />;
      case 'audit':
        return <AuditSection initialUser={auditUser} />;
      case 'system':
        return <SystemSection />;
      default:
        return <OverviewSection />;
    }
  };
  const groups = (['platform', 'sources', 'measurement', 'operations'] as const).map((g) => ({ g, items: visible.filter((s) => s.group === g) }));
  return (
    <>
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} crumbs={[{ label: t('nav.admin'), to: '/admin' }, { label: t(`admin.section_${current.id}`) }]} />
      <PageBody>
        <div className="lg:hidden">
          <label htmlFor="admin-section" className="sr-only">
            {t('admin.sectionPicker')}
          </label>
          <Select id="admin-section" value={current.id} onChange={(e) => go(e.target.value)}>
            {groups.map(({ g, items }) => (
              <optgroup key={g} label={t(`admin.group_nav_${g}`)}>
                {items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t(`admin.section_${s.id}`)}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-[var(--gap-grid)] lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label={t('admin.sectionPicker')} className="hidden lg:block">
            <div className="sticky top-4 flex flex-col gap-4">
              {groups.map(({ g, items }) => (
                <div key={g}>
                  <p className="eyebrow mb-1 px-2">{t(`admin.group_nav_${g}`)}</p>
                  <ul className="flex flex-col gap-0.5">
                    {items.map((s) => {
                      const Icon = s.icon;
                      const active = s.id === current.id;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => go(s.id)}
                            aria-current={active ? 'page' : undefined}
                            className={clsx('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] transition-colors', active ? 'bg-accsoft font-medium text-t1' : 'text-t2 hover:bg-hov hover:text-t1')}
                          >
                            <Icon className="size-4 shrink-0" aria-hidden />
                            <span className="truncate">{t(`admin.section_${s.id}`)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
          <section aria-labelledby="admin-section-title" className="min-w-0">
            <h2 id="admin-section-title" className="mb-1 text-[18px] font-semibold">
              {t(`admin.section_${current.id}`)}
            </h2>
            <p className="mb-4 text-[13px] text-t2">{t(`admin.sectionHint_${current.id}`)}</p>
            {body()}
          </section>
        </div>
      </PageBody>
    </>
  );
}
