import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { CHANNELS, DEVICES, FORMATS, MARKETS, PLATFORMS, THEMES } from '@/data/dimensions';
import { CAMPAIGN_DEFS } from '@/data/campaigns';
import { FILTERED_PAGES, PAGE_META } from '@/lib/nav';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
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
  { key: 'devices', labelKey: 'filters.device', primary: true, options: DEVICES.map((d) => ({ id: d.id, label: (l) => (l === 'fr' ? d.nameFr : d.name) })) },
  { key: 'campaigns', labelKey: 'filters.campaign', primary: false, options: CAMPAIGN_DEFS.map((c) => ({ id: c.id, label: () => c.name })) },
  { key: 'themes', labelKey: 'filters.theme', primary: false, options: THEMES.map((t) => ({ id: t.id, label: (l) => (l === 'fr' ? t.nameFr : t.name) })) },
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
          'mono inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[10.5px] transition-colors',
          selected.length > 0 ? 'border-accbrd bg-accsoft text-acctext' : 'border-brd bg-transparent text-t2 hover:border-brds hover:text-t1',
          dimmed && 'opacity-45',
        )}
      >
        {t(dim.labelKey)}
        {selected.length > 0 && <span className="rounded-full bg-acc px-1 text-[9px] font-semibold leading-[13px] text-accink">{selected.length}</span>}
        <ChevronDown size={11} aria-hidden />
      </button>
      {open && (
        <div className="pop-in absolute left-0 top-full z-40 mt-1.5 w-56 rounded-[11px] border border-brds bg-card p-1.5 shadow-[var(--shadow-pop)]">
          {dim.options.length > 6 && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('filters.search')}
              aria-label={t('filters.search')}
              className="mb-1.5 h-7 w-full rounded-[7px] border border-brd bg-inset px-2 text-[11.5px] text-t1 placeholder:text-t3"
            />
          )}
          <ul role="listbox" aria-multiselectable="true" aria-label={t(dim.labelKey)} className="m-0 max-h-56 list-none overflow-y-auto p-0">
            {visible.map((o) => {
              const active = selected.includes(o.id);
              return (
                <li key={o.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => toggle(dim.key, o.id)}
                    className={clsx('flex w-full items-center justify-between gap-2 rounded-[7px] px-2 py-1.5 text-left text-[12px] hover:bg-hov', active ? 'text-t1' : 'text-t2')}
                  >
                    <span className="truncate">{o.label(lang)}</span>
                    {active && <Check size={12} className="shrink-0 text-acctext" aria-hidden />}
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-2 py-1.5 text-[11.5px] text-t3">{t('tbl.noResults')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export function FilterBar() {
  const { filters, toggle, reset, activeCount } = useFilters();
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

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
    <div className="no-print sticky top-[57px] z-10 flex flex-wrap items-center gap-1.5 border-b border-brd bg-app/90 px-4 py-2 backdrop-blur-md md:px-6">
      <SlidersHorizontal size={12} className="text-t3" aria-hidden />
      {DIMS.filter((d) => d.primary).map((dim) => (
        <MultiSelect key={dim.key} dim={dim} dimmed={!applicable.has(dim.key)} />
      ))}
      <button
        type="button"
        onClick={() => setMoreOpen((o) => !o)}
        aria-expanded={moreOpen || secondaryActive}
        className={clsx('mono inline-flex h-7 items-center gap-1 rounded-full border border-brd px-2.5 text-[10.5px] text-t3 transition-colors hover:border-brds hover:text-t1')}
      >
        {t('filters.more')}
        <ChevronDown size={11} aria-hidden className={clsx('transition-transform', (moreOpen || secondaryActive) && 'rotate-180')} />
      </button>
      {(moreOpen || secondaryActive) && DIMS.filter((d) => !d.primary).map((dim) => <MultiSelect key={dim.key} dim={dim} dimmed={!applicable.has(dim.key)} />)}

      {chips.length > 0 && (
        <>
          <span className="mx-1 h-4 w-px bg-brd" aria-hidden />
          <ul className="m-0 flex list-none flex-wrap items-center gap-1 p-0" aria-label={t('filters.active', { n: activeCount })}>
            {chips.map((c) => (
              <li key={`${c.dim}:${c.id}`}>
                <button
                  type="button"
                  onClick={() => toggle(c.dim, c.id)}
                  aria-label={`${c.label} ×`}
                  className="group inline-flex h-6 items-center gap-1 rounded-full border border-accbrd bg-accsoft px-2 text-[11px] text-t1 hover:border-brds"
                >
                  {c.label}
                  <X size={10} className="text-t3 group-hover:text-t1" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={reset} className="mono ml-1 text-[10px] uppercase tracking-[0.08em] text-t3 underline-offset-2 hover:text-t1 hover:underline">
            {t('filters.clearAll')}
          </button>
        </>
      )}
    </div>
  );
}
