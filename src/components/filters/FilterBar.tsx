import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Bookmark, CalendarRange, Check, ChevronDown, GitCompareArrows, Trash2, X } from 'lucide-react';
import { CHANNELS, DEVICES, FORMATS, MARKETS, PLATFORMS, THEMES } from '@/data/dimensions';
import { CAMPAIGN_DEFS } from '@/data/campaigns';
import { FILTERED_PAGES, PAGE_META } from '@/lib/nav';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { useToast } from '@/state/ToastContext';
import { fmtDayFull } from '@/lib/format';
import { Btn, Segmented } from '@/components/ui/primitives';
import { Popover } from '@/components/ui/Popover';
import type { MsgKey } from '@/i18n/messages';

type DimKey = 'markets' | 'channels' | 'platforms' | 'devices' | 'campaigns' | 'themes' | 'formats';

interface DimDef {
  key: DimKey;
  labelKey: MsgKey;
  options: { id: string; label: (lang: string) => string }[];
  primary: boolean;
}

const DIMS: DimDef[] = [
  { key: 'markets', labelKey: 'filters.market', primary: true, options: MARKETS.map((m) => ({ id: m.id, label: (l) => (l === 'fr' ? m.nameFr : m.name) })) },
  { key: 'channels', labelKey: 'filters.channel', primary: true, options: CHANNELS.map((c) => ({ id: c.id, label: (l) => (l === 'fr' ? c.nameFr : c.name) })) },
  { key: 'platforms', labelKey: 'filters.platform', primary: true, options: PLATFORMS.map((p) => ({ id: p.id, label: () => p.name })) },
  { key: 'campaigns', labelKey: 'filters.campaign', primary: true, options: CAMPAIGN_DEFS.map((c) => ({ id: c.id, label: () => c.name })) },
  { key: 'themes', labelKey: 'filters.theme', primary: true, options: THEMES.map((t) => ({ id: t.id, label: (l) => (l === 'fr' ? t.nameFr : t.name) })) },
  { key: 'devices', labelKey: 'filters.device', primary: false, options: DEVICES.map((d) => ({ id: d.id, label: (l) => (l === 'fr' ? d.nameFr : d.name) })) },
  { key: 'formats', labelKey: 'filters.format', primary: false, options: FORMATS.map((f) => ({ id: f.id, label: (l) => (l === 'fr' ? f.nameFr : f.name) })) },
];

function MultiSelect({ dim, dimmed }: { dim: DimDef; dimmed: boolean }) {
  const { filters, toggle } = useFilters();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = filters[dim.key] as string[];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? dim.options.filter((o) => o.label(lang).toLowerCase().includes(q)) : dim.options;
  }, [dim.options, query, lang]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        title={dimmed ? t('filters.notApplicable') : undefined}
        className={clsx(
          'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[9px] border px-2.5 text-[12.5px] font-medium transition-colors',
          selected.length > 0 ? 'border-accbrd bg-accsoft text-acctext' : 'border-brd bg-card text-t2 hover:border-brds hover:text-t1',
          dimmed && 'opacity-45',
        )}
      >
        {t(dim.labelKey)}
        {selected.length > 0 && <span className="rounded-full bg-acc px-1.5 text-[10px] font-bold leading-[15px] text-accink">{selected.length}</span>}
        <ChevronDown size={12} aria-hidden />
      </button>
      {open && (
        <div className="pop-in absolute left-0 top-full z-40 mt-1.5 w-60 rounded-[11px] border border-brd bg-card p-1.5 shadow-[var(--shadow-pop)]">
          {dim.options.length > 6 && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('filters.search')}
              aria-label={t('filters.search')}
              className="mb-1.5 h-8 w-full rounded-[8px] border border-brd bg-inset px-2.5 text-[12.5px] text-t1 placeholder:text-t3"
            />
          )}
          <ul role="listbox" aria-multiselectable="true" aria-label={t(dim.labelKey)} className="m-0 max-h-60 list-none overflow-y-auto p-0">
            {visible.map((o) => {
              const active = selected.includes(o.id);
              return (
                <li key={o.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => toggle(dim.key, o.id)}
                    className={clsx('flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-hov', active ? 'font-medium text-t1' : 'text-t2')}
                  >
                    <span className="truncate">{o.label(lang)}</span>
                    {active && <Check size={13} className="shrink-0 text-acctext" aria-hidden />}
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-2.5 py-2 text-[12.5px] text-t3">{t('tbl.noResults')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Analytical control bar: period + comparison on the first row, dimension
 *  filters on the second, removable chips underneath. */
export function FilterBar() {
  const { filters, toggle, reset, activeCount, setRangePreset, set, savedViews, saveView, applyView, deleteView } = useFilters();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [viewName, setViewName] = useState('');

  if (!FILTERED_PAGES.has(pathname)) return null;

  const meta = PAGE_META[pathname];
  const applicable = new Set(meta?.filterDims ?? []);

  const chips: Array<{ dim: DimKey; id: string; label: string }> = [];
  for (const dim of DIMS) {
    for (const id of filters[dim.key] as string[]) {
      const opt = dim.options.find((o) => o.id === id);
      if (opt) chips.push({ dim: dim.key, id, label: opt.label(lang) });
    }
  }

  const secondaryActive = DIMS.filter((d) => !d.primary).some((d) => (filters[d.key] as string[]).length > 0);

  return (
    <div className="no-print sticky top-0 z-20 border-b border-brd bg-card/95 backdrop-blur-md">
      {/* Row 1 — period & comparison */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-5 pb-2.5 pt-3 md:px-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1.5">
            <CalendarRange size={14} className="text-t3" aria-hidden />
            <span className="eyebrow">{t('toolbar.period')}</span>
          </span>
          <Segmented
            ariaLabel={t('toolbar.period')}
            size="sm"
            options={[
              { id: '7d', label: t('range.7d').replace(/last |derniers /i, '').trim() },
              { id: '28d', label: t('range.28d').replace(/last |derniers /i, '').trim() },
              { id: '90d', label: t('range.90d').replace(/last |derniers /i, '').trim() },
            ]}
            value={filters.rangePreset === 'custom' ? '28d' : filters.rangePreset}
            onChange={(v) => setRangePreset(v as '7d' | '28d' | '90d')}
          />
          <span className="mono hidden text-[12px] text-t2 tnum sm:inline" title={t('range.dateRange')}>
            {fmtDayFull(filters.from, lang)} → {fmtDayFull(filters.to, lang)}
          </span>
        </div>

        <span className="hidden h-5 w-px bg-brd md:inline-block" aria-hidden />

        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5">
            <GitCompareArrows size={14} className="text-t3" aria-hidden />
            <span className="eyebrow">{t('toolbar.compare')}</span>
          </span>
          <select
            value={filters.compare}
            onChange={(e) => set({ compare: e.target.value as 'previous' | 'none' })}
            className="h-8 rounded-[9px] border border-brd bg-card px-2 text-[12.5px] font-medium text-t1 hover:border-brds"
            aria-label={t('toolbar.compare')}
          >
            <option value="previous">{t('compare.previous').replace(/^vs /i, '')}</option>
            <option value="none">{t('compare.none')}</option>
          </select>
        </div>

        <div className="ml-auto">
          <Popover label={t('header.savedViews')} trigger={<span className="flex items-center gap-1.5"><Bookmark size={14} aria-hidden /><span className="hidden lg:inline">{t('header.savedViews')}</span></span>}>
            {(close) => (
              <div className="p-1.5">
                <div className="eyebrow mb-2 px-1.5 text-[10px]">{t('header.savedViews')}</div>
                {savedViews.length === 0 && <p className="m-0 px-1.5 pb-2 text-[12.5px] leading-snug text-t3">{t('header.noViews')}</p>}
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
                        className="flex-1 truncate rounded-[8px] px-2.5 py-2 text-left text-[13px] text-t1 hover:bg-hov"
                      >
                        {v.name}
                      </button>
                      <button type="button" aria-label={`${t('header.deleteView')}: ${v.name}`} onClick={() => deleteView(v.id)} className="rounded-[8px] p-1.5 text-t3 hover:bg-hov hover:text-neg">
                        <Trash2 size={13} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-2 flex gap-1.5 border-t border-brd pt-2.5"
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
                    className="h-8 min-w-0 flex-1 rounded-[8px] border border-brd bg-inset px-2.5 text-[12.5px] text-t1 placeholder:text-t3"
                  />
                  <Btn size="sm" variant="primary" type="submit" disabled={!viewName.trim()}>
                    {t('misc.save')}
                  </Btn>
                </form>
              </div>
            )}
          </Popover>
        </div>
      </div>

      {/* Row 2 — dimension filters */}
      <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3 md:px-8">
        {DIMS.filter((d) => d.primary).map((dim) => (
          <MultiSelect key={dim.key} dim={dim} dimmed={!applicable.has(dim.key)} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen || secondaryActive}
          className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-medium text-t3 transition-colors hover:bg-hov hover:text-t1"
        >
          {t('filters.more')}
          <ChevronDown size={12} aria-hidden className={clsx('transition-transform', (moreOpen || secondaryActive) && 'rotate-180')} />
        </button>
        {(moreOpen || secondaryActive) && DIMS.filter((d) => !d.primary).map((dim) => <MultiSelect key={dim.key} dim={dim} dimmed={!applicable.has(dim.key)} />)}
      </div>

      {/* Row 3 — active chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-brd bg-card2 px-5 py-2 md:px-8">
          <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0" aria-label={t('filters.active', { n: activeCount })}>
            {chips.map((c) => (
              <li key={`${c.dim}:${c.id}`}>
                <button
                  type="button"
                  onClick={() => toggle(c.dim, c.id)}
                  aria-label={`${c.label} ×`}
                  className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-accbrd bg-accsoft px-2.5 text-[12px] font-medium text-t1 hover:border-brds"
                >
                  {c.label}
                  <X size={11} className="text-t3 group-hover:text-t1" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={reset} className="ml-1 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-t3 underline-offset-2 hover:text-acctext hover:underline">
            {t('filters.clearAll')}
          </button>
        </div>
      )}
    </div>
  );
}
