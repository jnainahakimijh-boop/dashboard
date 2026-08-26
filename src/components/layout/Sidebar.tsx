import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronsLeft, ChevronsRight, HelpCircle, LogOut, X } from 'lucide-react';
import { NAV_BOTTOM, NAV_SECTIONS, type NavItem } from '@/lib/nav';
import { useI18n } from '@/i18n';
import { useSettings } from '@/state/SettingsContext';
import { useAuth } from '@/state/AuthContext';
import { DemoTag } from '@/components/ui/primitives';

function Brand({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <span className="flex flex-col items-center leading-none" aria-label="Digital Performance">
        <span className="text-[15px] font-bold tracking-tight text-st1">D</span>
        <span className="mt-0.5 h-[2px] w-4 rounded-full bg-acc" aria-hidden />
      </span>
    );
  }
  return (
    <span className="block min-w-0 leading-tight">
      <span className="block truncate text-[16px] font-bold tracking-[-0.01em] text-st1">Digital Performance</span>
      <span className="mono mt-0.5 block text-[9.5px] uppercase tracking-[0.22em] text-st3">Intelligence Platform</span>
    </span>
  );
}

function NavEntry({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <li className="group relative">
      <NavLink
        to={item.path}
        end={item.path === '/'}
        onClick={onNavigate}
        title={collapsed ? t(item.labelKey) : undefined}
        className={({ isActive }) =>
          clsx(
            'relative flex items-center gap-3 rounded-[9px] py-2 text-[13px] transition-colors duration-150',
            collapsed ? 'justify-center px-0' : 'px-3',
            isActive ? 'bg-sact font-medium text-st1' : 'text-st2 hover:bg-shov hover:text-st1',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span
              aria-hidden
              className={clsx('absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-acc transition-opacity', isActive ? 'opacity-100' : 'opacity-0')}
            />
            <item.icon size={16} aria-hidden className={clsx('shrink-0', isActive ? 'text-st1' : 'text-st3 group-hover:text-st2')} />
            {!collapsed && <span className="min-w-0 leading-snug">{t(item.labelKey)}</span>}
          </>
        )}
      </NavLink>
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[8px] border border-brd bg-card px-2.5 py-1.5 text-[12px] text-t1 opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-100 group-focus-within:opacity-100 group-hover:opacity-100"
        >
          {t(item.labelKey)}
        </span>
      )}
    </li>
  );
}

export function SidebarContent({ collapsed, onNavigate, onToggleCollapse, mobile = false, onClose }: { collapsed: boolean; onNavigate?: () => void; onToggleCollapse?: () => void; mobile?: boolean; onClose?: () => void }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const { logout } = useAuth();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={clsx('flex items-center justify-between gap-2 px-2 pb-6 pt-1', collapsed && 'justify-center px-0')}>
        <Brand collapsed={collapsed} />
        {mobile && (
          <button type="button" aria-label={t('misc.close')} onClick={onClose} className="rounded-[8px] p-1.5 text-st2 hover:bg-shov">
            <X size={17} aria-hidden />
          </button>
        )}
      </div>

      <nav aria-label={t('nav.main')} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.labelKey} className="mb-5">
            {!collapsed && <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-st3">{t(section.labelKey)}</div>}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {section.items.map((item) => (
                <NavEntry key={item.path} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-2 border-t border-sbrd pt-3">
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pb-2">
          {NAV_BOTTOM.map((item) => (
            <NavEntry key={item.path} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </ul>

        {!collapsed && (
          <div className="px-2 pb-3">
            <DemoTag label={t('app.demo')} tip={t('app.demoTip')} onDark />
          </div>
        )}

        <div className={clsx('flex items-center gap-2.5 rounded-[10px] bg-side2 px-2.5 py-2.5', collapsed && 'justify-center bg-transparent px-0')}>
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acc text-[11px] font-bold text-accink">
            {settings.profileName.split(' ').map((s) => s[0]).slice(0, 2).join('')}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12.5px] font-medium text-st1">{settings.profileName}</span>
              <span className="block truncate text-[11px] text-st3">{settings.profileRole}</span>
            </span>
          )}
          {!collapsed && (
            <button type="button" aria-label={t('nav.logout')} title={t('nav.logout')} onClick={logout} className="rounded-[8px] p-1.5 text-st3 hover:bg-shov hover:text-st1">
              <LogOut size={14} aria-hidden />
            </button>
          )}
        </div>

        <div className={clsx('mt-1.5 flex gap-1', collapsed ? 'flex-col items-center' : 'items-center justify-between px-1')}>
          <a
            href="#main"
            onClick={(e) => e.preventDefault()}
            title={`${t('nav.help')} — ⌘K`}
            aria-label={t('nav.help')}
            className="flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[12px] text-st3 hover:bg-shov hover:text-st1"
          >
            <HelpCircle size={14} aria-hidden />
            {!collapsed && t('nav.help')}
          </a>
          {!mobile && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
              title={collapsed ? t('nav.expand') : t('nav.collapse')}
              className="rounded-[8px] p-1.5 text-st3 hover:bg-shov hover:text-st1"
            >
              {collapsed ? <ChevronsRight size={15} aria-hidden /> : <ChevronsLeft size={15} aria-hidden />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('dp.sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('dp.sidebar', c ? 'expanded' : 'collapsed');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  return (
    <aside
      className={clsx(
        'sticky top-0 z-30 hidden h-dvh shrink-0 flex-col bg-side px-3.5 py-5 transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[68px]' : 'w-[258px]',
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={toggle} />
    </aside>
  );
}
