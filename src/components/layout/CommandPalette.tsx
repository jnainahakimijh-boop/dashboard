import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/nav';
import { CAMPAIGN_DEFS, LANDING_PAGES, MARKETS, PLATFORMS, dataset } from '@/data';
import { WEB_KPIS, SOCIAL_KPIS } from '@/lib/kpis';
import { useI18n } from '@/i18n';
import { useSettings } from '@/state/SettingsContext';
import { useFilters } from '@/state/FiltersContext';
import { useToast } from '@/state/ToastContext';
import { buildOverviewCsv, downloadCsv } from '@/lib/export';

interface Item {
  id: string;
  category: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const { filters } = useFilters();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = NAV_SECTIONS.flatMap((s) =>
      s.items.map((i) => ({
        id: `nav-${i.path}`,
        category: t('cmd.pages'),
        label: t(i.labelKey),
        hint: t('cmd.hint.nav'),
        run: () => navigate(i.path),
      })),
    );
    const actions: Item[] = [
      {
        id: 'act-export',
        category: t('cmd.actions'),
        label: t('cmd.exportReport'),
        run: () => {
          downloadCsv(buildOverviewCsv(filters, { methodology: settings.exportMethodology, comparison: settings.exportComparison }), `digital-performance_${new Date().toISOString().slice(0, 10)}.csv`);
          toast(t('rep.exportCsv') + ' ✓');
        },
      },
      {
        id: 'act-theme',
        category: t('cmd.actions'),
        label: t('cmd.toggleTheme'),
        run: () => update({ theme: settings.theme === 'light' ? 'dark' : 'light' }),
      },
    ];
    const campaigns: Item[] = CAMPAIGN_DEFS.map((c) => ({
      id: `cmp-${c.id}`,
      category: t('cmd.campaigns'),
      label: c.name,
      run: () => navigate(`/campaigns?cp=${c.id}`),
    }));
    const pages: Item[] = LANDING_PAGES.map((p) => ({
      id: `lp-${p.path}`,
      category: t('cmd.landingPages'),
      label: p.path,
      run: () => navigate('/web'),
    }));
    const kpis: Item[] = [...WEB_KPIS, ...SOCIAL_KPIS.filter((k) => !WEB_KPIS.some((w) => w.id === k.id))].map((k) => ({
      id: `kpi-${k.id}`,
      category: t('cmd.kpis'),
      label: t(k.labelKey),
      run: () => navigate('/kpi-catalogue'),
    }));
    const markets: Item[] = MARKETS.map((m) => ({
      id: `mk-${m.id}`,
      category: t('cmd.markets'),
      label: lang === 'fr' ? m.nameFr : m.name,
      run: () => navigate(`/audience?mk=${m.id}`),
    }));
    const content: Item[] = dataset.content.slice(0, 60).map((c) => ({
      id: `ct-${c.id}`,
      category: t('cmd.contentItems'),
      label: lang === 'fr' ? c.titleFr : c.title,
      hint: PLATFORMS.find((p) => p.id === c.platform)?.name,
      run: () => navigate('/content'),
    }));
    return [...nav, ...actions, ...campaigns, ...pages, ...kpis, ...markets, ...content];
  }, [t, lang, navigate, filters, settings, update, toast]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 14);
    return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 14);
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const runItem = (item: Item) => {
    onClose();
    item.run();
  };

  let lastCategory = '';

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={t('header.search')} className="pop-in w-full max-w-xl overflow-hidden rounded-[14px] border border-brds bg-card shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-2.5 border-b border-brd px-4">
          <Search size={15} className="shrink-0 text-t3" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && results[active]) {
                runItem(results[active]);
              }
            }}
            placeholder={t('cmd.placeholder')}
            aria-label={t('cmd.placeholder')}
            className="h-12 w-full bg-transparent text-[14px] text-t1 outline-none placeholder:text-t3"
          />
          <kbd className="mono shrink-0 rounded-[5px] border border-brd bg-inset px-1.5 py-0.5 text-[9px] text-t3">ESC</kbd>
        </div>
        <ul ref={listRef} className="m-0 max-h-[46vh] list-none overflow-y-auto p-1.5" role="listbox">
          {results.map((item, i) => {
            const showCat = item.category !== lastCategory;
            lastCategory = item.category;
            return (
              <li key={item.id} role="option" aria-selected={i === active}>
                {showCat && <div className="eyebrow px-2.5 pb-1 pt-2 text-[8.5px]">{item.category}</div>}
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => runItem(item)}
                  className={clsx('flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13px]', i === active ? 'bg-act text-t1' : 'text-t2')}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {item.hint && <span className="mono shrink-0 text-[9px] uppercase tracking-[0.08em] text-t3">{item.hint}</span>}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {i === active && <CornerDownLeft size={12} className="shrink-0 text-t3" aria-hidden />}
                </button>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-4 text-[12.5px] text-t3">
              <ArrowRight size={13} aria-hidden />
              {t('cmd.noResults', { q: query })}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
