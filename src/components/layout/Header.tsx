import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Bell, Download, Flag, Menu, Search } from 'lucide-react';
import { PAGE_META } from '@/lib/nav';
import { useI18n } from '@/i18n';
import { useFilters } from '@/state/FiltersContext';
import { useSettings } from '@/state/SettingsContext';
import { useAuth } from '@/state/AuthContext';
import { useToast } from '@/state/ToastContext';
import { topSignals } from '@/lib/insights';
import { toQ } from '@/lib/aggregate';
import { buildOverviewCsv, downloadCsv } from '@/lib/export';
import { Btn } from '@/components/ui/primitives';
import { Popover } from '@/components/ui/Popover';

/** Identity row: page context on the left, four global controls on the right.
 *  The analytical toolbar (period, comparison, filters) lives below it. */
export function Header({ onOpenPalette, onOpenMobileNav }: { onOpenPalette: () => void; onOpenMobileNav: () => void }) {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { filters } = useFilters();
  const { settings } = useSettings();
  const { logout } = useAuth();
  const { toast } = useToast();

  const meta = PAGE_META[pathname] ?? PAGE_META['/'];
  const signals = topSignals(toQ(filters), lang, 4);

  const doExport = () => {
    const csv = buildOverviewCsv(filters, { methodology: settings.exportMethodology, comparison: settings.exportComparison });
    downloadCsv(csv, `digital-performance_${new Date().toISOString().slice(0, 10)}.csv`);
    toast(t('rep.exportCsv') + ' ✓');
  };

  return (
    <header className="no-print border-b border-brd bg-card">
      <div className="flex items-center gap-4 px-5 py-4 md:px-8">
        <button type="button" aria-label={t('nav.main')} onClick={onOpenMobileNav} className="rounded-[9px] border border-brd bg-card p-2 text-t1 lg:hidden">
          <Menu size={16} aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <div className="eyebrow text-[10px]">{t(meta.eyebrowKey)}</div>
          <h1 className="m-0 mt-0.5 truncate text-[18px] font-bold leading-tight tracking-[-0.02em] text-t1 md:text-[22px]">{t(meta.titleKey)}</h1>
          <p className="m-0 mt-0.5 hidden truncate text-[13px] text-t2 md:block">{t(meta.subtitleKey)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label={t('header.search')}
            className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-brd bg-card px-3 text-[12.5px] text-t3 shadow-[0_1px_2px_rgba(15,31,56,0.05)] transition-colors hover:border-brds hover:text-t1"
          >
            <Search size={14} aria-hidden />
            <span className="hidden xl:inline">{t('header.searchHint')}</span>
            <kbd className="mono hidden rounded-[5px] border border-brd bg-inset px-1.5 py-px text-[10px] text-t3 md:inline">⌘K</kbd>
          </button>

          <Popover label={t('header.notifications')} trigger={<Bell size={15} aria-hidden />} badge={signals.length}>
            {(close) => (
              <div className="p-1.5">
                <div className="eyebrow mb-2 px-1.5 text-[10px]">{t('header.notifications')}</div>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {signals.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2.5 rounded-[8px] px-2 py-2 text-left hover:bg-hov"
                        onClick={() => {
                          navigate('/insights');
                          close();
                        }}
                      >
                        {s.direction === 1 ? (
                          <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-pos" aria-hidden />
                        ) : s.direction === -1 ? (
                          <ArrowDownRight size={14} className="mt-0.5 shrink-0 text-neg" aria-hidden />
                        ) : (
                          <Flag size={13} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                        )}
                        <span className="text-[12.5px] leading-snug text-t2">{s.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Popover>

          <Btn onClick={doExport} aria-label={t('header.export')} title={t('header.export')} className="hidden sm:inline-flex">
            <Download size={14} aria-hidden />
            <span className="hidden md:inline">{t('header.export')}</span>
          </Btn>

          <Popover
            label={t('header.profile')}
            trigger={
              <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-side text-[10.5px] font-bold text-st1">
                {settings.profileName.split(' ').map((s) => s[0]).slice(0, 2).join('')}
              </span>
            }
            triggerClassName="rounded-full p-0.5 hover:ring-2 hover:ring-brd"
            width="w-64"
          >
            {(close) => (
              <div className="p-1.5">
                <div className="border-b border-brd px-2 pb-2.5">
                  <div className="text-[13.5px] font-semibold text-t1">{settings.profileName}</div>
                  <div className="mono mt-0.5 text-[11px] text-t3">
                    {settings.profileRole} · {settings.profileEmail}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/settings');
                    close();
                  }}
                  className="mt-1.5 w-full rounded-[8px] px-2 py-2 text-left text-[13px] text-t1 hover:bg-hov"
                >
                  {t('nav.settings')}
                </button>
                <button type="button" onClick={logout} className="w-full rounded-[8px] px-2 py-2 text-left text-[13px] text-t2 hover:bg-hov">
                  {t('nav.logout')}
                </button>
              </div>
            )}
          </Popover>
        </div>
      </div>
    </header>
  );
}
