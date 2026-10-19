import clsx from 'clsx';
import { ChevronsLeft, ChevronsRight, LogOut, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { APP_MODULES, ROLE_LABELS, canAccessModule, type AppModule } from '@shared/rbac';
import { useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { NAV, SETTINGS_ITEM } from '@/lib/nav';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { t, L } = useI18n();
  const { me, can, logout } = useSession();
  const { prefs, setPrefs } = usePrefs();
  const meta = useMeta();
  const collapsed = prefs.sidebarCollapsed && !mobileOpen;
  const groups = (['performance', 'intelligence', 'governance'] as const).map((g) => ({ g, items: NAV.filter((n) => n.group === g && (!n.permission || can(n.permission)) && (!(APP_MODULES as readonly string[]).includes(n.key) || canAccessModule(me?.user.scopes, n.key as AppModule))) }));
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    clsx('group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors', collapsed && 'justify-center px-2', isActive ? 'bg-sact text-st1 shadow-[inset_3px_0_0_var(--accent)]' : 'text-st2 hover:bg-shov hover:text-st1');
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-[rgba(8,15,28,0.5)] lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-side text-st1 transition-[width] duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen',
          collapsed ? 'w-[72px]' : 'w-[264px]',
          mobileOpen ? 'drawer-in-left flex' : 'hidden lg:flex',
        )}
        aria-label="Main navigation"
      >
        <div className={clsx('flex h-16 items-center gap-3 border-b border-sbrd px-4', collapsed && 'justify-center px-2')}>
          {meta.data?.org.logoDataUrl ? <img src={meta.data.org.logoDataUrl} alt="" className="h-8 w-auto max-w-[40px] rounded" /> : null}
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight text-st1">{meta.data?.org.settings.appName ?? t('common.appName')}</p>
              <p className="truncate text-[11.5px] text-st3">{t('common.appTagline')}</p>
            </div>
          )}
          {mobileOpen && (
            <button type="button" className="ml-auto rounded-md p-1.5 text-st2 hover:bg-shov lg:hidden" onClick={onClose} aria-label={t('common.closeMenu')}>
              <X className="size-5" />
            </button>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map(({ g, items }) =>
            items.length ? (
              <div key={g} className="mb-5">
                {!collapsed && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-st3 uppercase">{t(`nav.group${g[0].toUpperCase()}${g.slice(1)}`)}</p>}
                <ul className="flex flex-col gap-0.5">
                  {items.map((n) => (
                    <li key={n.path}>
                      <NavLink to={n.path} end={n.path === '/'} className={linkCls} onClick={onClose} title={collapsed ? t(`nav.${n.key}`) : undefined}>
                        <n.icon className="size-[18px] shrink-0" aria-hidden />
                        {!collapsed && <span className="truncate">{t(`nav.${n.key}`)}</span>}
                        {collapsed && <span className="sr-only">{t(`nav.${n.key}`)}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </nav>
        <div className="border-t border-sbrd px-3 py-3">
          <NavLink to={SETTINGS_ITEM.path} className={linkCls} onClick={onClose}>
            <SETTINGS_ITEM.icon className="size-[18px] shrink-0" aria-hidden />
            {!collapsed ? <span>{t('nav.settings')}</span> : <span className="sr-only">{t('nav.settings')}</span>}
          </NavLink>
          {me && (
            <div className={clsx('mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2', collapsed && 'justify-center')}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-side2 text-[12px] font-semibold text-st1 ring-1 ring-sbrd" aria-hidden>
                {me.user.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-st1">{me.user.name}</p>
                  <p className="truncate text-[11.5px] text-st3">{L(ROLE_LABELS[me.user.role])}</p>
                </div>
              )}
              {!collapsed && (
                <button type="button" onClick={() => void logout()} className="rounded-md p-1.5 text-st2 hover:bg-shov hover:text-st1" aria-label={t('common.signOut')} title={t('common.signOut')}>
                  <LogOut className="size-4" />
                </button>
              )}
            </div>
          )}
          <button type="button" onClick={() => setPrefs({ sidebarCollapsed: !prefs.sidebarCollapsed })} className="mt-1 hidden w-full items-center justify-center gap-2 rounded-md py-1.5 text-[12px] text-st3 hover:bg-shov hover:text-st1 lg:flex" aria-label={prefs.sidebarCollapsed ? t('nav.expand') : t('nav.collapse')}>
            {prefs.sidebarCollapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
