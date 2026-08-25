import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Bell, Bookmark, ChevronDown, Download, Flag, Menu, Search, Trash2 } from 'lucide-react';
import { PAGE_META } from '@/lib/nav';
import { useI18n } from '@/i18n';
import { useFilters } from '@/state/FiltersContext';
import { useSettings } from '@/state/SettingsContext';
import { useToast } from '@/state/ToastContext';
import { fmtRange } from '@/lib/format';
import { topSignals } from '@/lib/insights';
import { toQ } from '@/lib/aggregate';
import { buildOverviewCsv, downloadCsv } from '@/lib/export';
import { Btn, Segmented } from '@/components/ui/primitives';

function useDismissable(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

function Popover({ trigger, label, children, align = 'right', badge }: { trigger: ReactNode; label: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; badge?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={clsx('relative inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] border px-2 text-[12px] transition-colors', open ? 'border-brds bg-act text-t1' : 'border-brd bg-card2 text-t2 hover:border-brds hover:text-t1')}
      >
        {trigger}
        {badge !== undefined && badge > 0 && (
          <span className="mono absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-acc px-0.5 text-[8.5px] font-semibold text-accink" aria-hidden>
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label={label} className={clsx('pop-in absolute top-full z-50 mt-1.5 w-80 max-w-[calc(100vw-24px)] rounded-[12px] border border-brds bg-card p-2 shadow-[var(--shadow-pop)]', align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function Header({ onOpenPalette, onOpenMobileNav }: { onOpenPalette: () => void; onOpenMobileNav: () => void }) {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { filters, setRangePreset, set, savedViews, saveView, applyView, deleteView } = useFilters();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [viewName, setViewName] = useState('');

  const meta = PAGE_META[pathname] ?? PAGE_META['/'];
  const signals = topSignals(toQ(filters), lang, 4);

  const doExport = () => {
    const csv = buildOverviewCsv(filters, { methodology: settings.exportMethodology, comparison: settings.exportComparison });
    downloadCsv(csv, `digital-performance_${new Date().toISOString().slice(0, 10)}.csv`);
    toast(t('rep.exportCsv') + ' ✓');
  };

  return (
    <header className="no-print sticky top-0 z-20 border-b border-brd bg-app/90 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
        <button type="button" aria-label={t('nav.main')} onClick={onOpenMobileNav} className="rounded-[9px] border border-brd bg-card2 p-2 text-t1 lg:hidden">
          <Menu size={15} aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <div className="eyebrow text-[9px]">{t(meta.eyebrowKey)}</div>
          <h1 className="m-0 truncate text-[17px] font-semibold leading-tight tracking-[-0.015em] text-t1">{t(meta.titleKey)}</h1>
          <p className="m-0 hidden truncate text-[11px] text-t3 md:block">{t(meta.subtitleKey)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label={t('header.search')}
            className="inline-flex h-8 items-center gap-2 rounded-[9px] border border-brd bg-card2 px-2.5 text-[12px] text-t3 transition-colors hover:border-brds hover:text-t1"
          >
            <Search size={13} aria-hidden />
            <span className="hidden xl:inline">{t('header.searchHint')}</span>
            <kbd className="mono hidden rounded-[5px] border border-brd bg-inset px-1 py-px text-[9px] text-t3 md:inline">⌘K</kbd>
          </button>

          <Segmented
            ariaLabel={t('range.dateRange')}
            size="sm"
            options={[
              { id: '7d', label: t('range.7d').replace(/last |derniers /i, '').trim() },
              { id: '28d', label: t('range.28d').replace(/last |derniers /i, '').trim() },
              { id: '90d', label: t('range.90d').replace(/last |derniers /i, '').trim() },
            ]}
            value={filters.rangePreset === 'custom' ? '28d' : filters.rangePreset}
            onChange={(v) => setRangePreset(v as '7d' | '28d' | '90d')}
          />
          <span className="mono hidden text-[10px] tracking-[0.04em] text-t3 2xl:inline" title={t('range.dateRange')}>
            {fmtRange(filters.from, filters.to, lang)}
          </span>

          <label className="hidden items-center gap-1.5 md:inline-flex">
            <span className="sr-only">{t('header.compare')}</span>
            <select
              value={filters.compare}
              onChange={(e) => set({ compare: e.target.value as 'previous' | 'none' })}
              className="h-8 rounded-[9px] border border-brd bg-card2 px-2 text-[11.5px] text-t2 hover:border-brds"
              aria-label={t('header.compare')}
            >
              <option value="previous">{t('compare.previous')}</option>
              <option value="none">{t('compare.none')}</option>
            </select>
          </label>

          <Popover label={t('header.savedViews')} trigger={<Bookmark size={13} aria-hidden />}>
            {(close) => (
              <div className="p-1">
                <div className="eyebrow mb-2 px-1 text-[9px]">{t('header.savedViews')}</div>
                {savedViews.length === 0 && <p className="m-0 px-1 pb-2 text-[11.5px] leading-snug text-t3">{t('header.noViews')}</p>}
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {savedViews.map((v) => (
                    <li key={v.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          applyView(v.id);
                          close();
                          toast(`${v.name} ✓`, 'info');
                        }}
                        className="flex-1 truncate rounded-[7px] px-2 py-1.5 text-left text-[12px] text-t1 hover:bg-hov"
                      >
                        {v.name}
                      </button>
                      <button type="button" aria-label={`${t('header.deleteView')}: ${v.name}`} onClick={() => deleteView(v.id)} className="rounded-[7px] p-1.5 text-t3 hover:bg-hov hover:text-neg">
                        <Trash2 size={12} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-2 flex gap-1.5 border-t border-brd pt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (viewName.trim()) {
                      saveView(viewName.trim());
                      setViewName('');
                      toast(t('header.saveView') + ' ✓');
                    }
                  }}
                >
                  <input
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    placeholder={t('header.viewName')}
                    aria-label={t('header.viewName')}
                    className="h-7.5 min-w-0 flex-1 rounded-[8px] border border-brd bg-inset px-2 text-[12px] text-t1 placeholder:text-t3"
                  />
                  <Btn size="sm" variant="primary" type="submit" disabled={!viewName.trim()}>
                    {t('misc.save')}
                  </Btn>
                </form>
              </div>
            )}
          </Popover>

          <Popover label={t('header.notifications')} trigger={<Bell size={13} aria-hidden />} badge={signals.length}>
            {(close) => (
              <div className="p-1">
                <div className="eyebrow mb-2 px-1 text-[9px]">{t('header.notifications')}</div>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {signals.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded-[7px] px-2 py-1.5 text-left hover:bg-hov"
                        onClick={() => {
                          navigate('/insights');
                          close();
                        }}
                      >
                        {s.direction === 1 ? <ArrowUpRight size={13} className="mt-0.5 shrink-0 text-pos" aria-hidden /> : s.direction === -1 ? <ArrowDownRight size={13} className="mt-0.5 shrink-0 text-neg" aria-hidden /> : <Flag size={12} className="mt-0.5 shrink-0 text-warn" aria-hidden />}
                        <span className="text-[11.5px] leading-snug text-t2">{s.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Popover>

          <Btn onClick={doExport} aria-label={t('header.export')} title={t('header.export')} className="hidden sm:inline-flex">
            <Download size={13} aria-hidden />
            <span className="hidden md:inline">{t('header.export')}</span>
          </Btn>

          <Popover
            label={t('header.profile')}
            trigger={
              <span className="flex items-center gap-1">
                <span aria-hidden className="flex h-5.5 w-5.5 items-center justify-center rounded-full border border-brds bg-inset text-[9px] font-semibold text-t1">
                  {settings.profileName.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                </span>
                <ChevronDown size={11} aria-hidden />
              </span>
            }
          >
            {(close) => (
              <div className="p-1">
                <div className="border-b border-brd px-2 pb-2">
                  <div className="text-[12.5px] font-medium text-t1">{settings.profileName}</div>
                  <div className="mono text-[10px] text-t3">
                    {settings.profileRole} · {settings.profileEmail}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/settings');
                    close();
                  }}
                  className="mt-1 w-full rounded-[7px] px-2 py-1.5 text-left text-[12px] text-t1 hover:bg-hov"
                >
                  {t('nav.settings')}
                </button>
                <button type="button" onClick={() => toast(`${t('nav.logout')} — demo`, 'info')} className="w-full rounded-[7px] px-2 py-1.5 text-left text-[12px] text-t2 hover:bg-hov">
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
