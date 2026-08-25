import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronsLeft, ChevronsRight, HelpCircle, LogOut, X } from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/nav';
import { useI18n } from '@/i18n';
import { useSettings } from '@/state/SettingsContext';
import { useToast } from '@/state/ToastContext';
import { DemoTag } from '@/components/ui/primitives';

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect width="32" height="32" rx="7" fill="var(--bg-card2)" stroke="var(--border-strong)" />
        <path d="M8 22V14M14 22V8M20 22v-6M26 22V11" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-t1">Digital Performance</span>
          <span className="mono block text-[8.5px] uppercase tracking-[0.16em] text-t3">Intelligence Platform</span>
        </span>
      )}
    </span>
  );
}

export function SidebarContent({ collapsed, onNavigate, onToggleCollapse, mobile = false, onClose }: { collapsed: boolean; onNavigate?: () => void; onToggleCollapse?: () => void; mobile?: boolean; onClose?: () => void }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const { toast } = useToast();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={clsx('flex items-center justify-between gap-2 px-1.5 pb-5', collapsed && 'justify-center px-0')}>
        <Logo collapsed={collapsed} />
        {mobile && (
          <button type="button" aria-label={t('misc.close')} onClick={onClose} className="rounded-[7px] p-1.5 text-t2 hover:bg-hov">
            <X size={16} aria-hidden />
          </button>
        )}
      </div>

      <nav aria-label={t('nav.main')} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.labelKey} className="mb-4">
            {!collapsed && <div className="eyebrow mb-1.5 px-2.5 text-[9px]">{t(section.labelKey)}</div>}
            <ul className="m-0 flex list-none flex-col gap-px p-0">
              {section.items.map((item) => (
                <li key={item.path} className="group relative">
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onNavigate}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={({ isActive }) =>
                      clsx(
                        'relative flex items-center gap-2.5 rounded-[9px] py-[7px] text-[12.5px] transition-colors duration-150',
                        collapsed ? 'justify-center px-0' : 'px-2.5',
                        isActive ? 'bg-act font-medium text-t1' : 'text-t2 hover:bg-hov hover:text-t1',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          aria-hidden
                          className={clsx('absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-acc transition-opacity', isActive ? 'opacity-100' : 'opacity-0')}
                        />
                        <item.icon size={15} aria-hidden className={clsx('shrink-0', isActive ? 'text-acctext' : 'text-t3 group-hover:text-t2')} />
                        {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                      </>
                    )}
                  </NavLink>
                  {collapsed && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[7px] border border-brds bg-card2 px-2 py-1 text-[11px] text-t1 opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {t(item.labelKey)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-2 border-t border-brd pt-3">
        {!collapsed && (
          <div className="mb-2.5 px-1">
            <DemoTag label={t('app.demo')} tip={t('app.demoTip')} />
          </div>
        )}
        <div className={clsx('flex items-center gap-2 rounded-[9px] px-1.5 py-1.5', collapsed && 'justify-center px-0')}>
          <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brds bg-card2 text-[10px] font-semibold text-t1">
            {settings.profileName.split(' ').map((s) => s[0]).slice(0, 2).join('')}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12px] font-medium text-t1">{settings.profileName}</span>
              <span className="block truncate text-[10px] text-t3">{settings.profileRole}</span>
            </span>
          )}
          {!collapsed && (
            <button
              type="button"
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
              onClick={() => toast(`${t('nav.logout')} — demo`, 'info')}
              className="rounded-[7px] p-1.5 text-t3 hover:bg-hov hover:text-t1"
            >
              <LogOut size={13} aria-hidden />
            </button>
          )}
        </div>
        <div className={clsx('mt-1 flex gap-1', collapsed ? 'flex-col items-center' : 'items-center justify-between px-1')}>
          <button
            type="button"
            onClick={() => toast('Docs & keyboard shortcuts: press ⌘K / Ctrl+K to search and navigate.', 'info')}
            className="flex items-center gap-1.5 rounded-[7px] px-1.5 py-1 text-[11px] text-t3 hover:bg-hov hover:text-t1"
            aria-label={t('nav.help')}
            title={t('nav.help')}
          >
            <HelpCircle size={13} aria-hidden />
            {!collapsed && t('nav.help')}
          </button>
          {!mobile && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
              title={collapsed ? t('nav.expand') : t('nav.collapse')}
              className="rounded-[7px] p-1.5 text-t3 hover:bg-hov hover:text-t1"
            >
              {collapsed ? <ChevronsRight size={14} aria-hidden /> : <ChevronsLeft size={14} aria-hidden />}
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
        'sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-brd bg-side px-3 py-4 transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[64px]' : 'w-[248px]',
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={toggle} />
    </aside>
  );
}
