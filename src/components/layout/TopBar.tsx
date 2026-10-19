import clsx from 'clsx';
import { Bell, Database, Menu, Moon, Search, Star, Sun } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SOURCE_LABELS, type SourceKey } from '@shared/metrics';
import { api } from '@/api/client';
import { useApi, useMeta } from '@/api/hooks';
import type { Notification } from '@/api/types';
import { useI18n } from '@/i18n';
import { formatDate, relativeTime } from '@/lib/format';
import { NAV } from '@/lib/nav';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';
import { DataModeBadge } from '@/components/data';
import { Button, IconButton, Input, Modal, Popover, Segmented } from '@/components/ui';

function DataStatus() {
  const { t, lang } = useI18n();
  const meta = useMeta();
  const { can } = useSession();
  const sources = meta.data?.sources ?? {};
  const anyDemo = Object.values(sources).some((s) => s.mode === 'demo');
  return (
    <Popover
      align="right"
      width={420}
      label={t('shell.dataStatus')}
      trigger={({ toggle, open, id }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={id} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-ctl)] px-2.5 text-[13px] text-t2 hover:bg-hov hover:text-t1">
          <Database className="size-4" aria-hidden />
          <span className="hidden md:inline">{meta.data ? t('common.asOf', { date: formatDate(meta.data.asOf, lang) }) : t('shell.dataStatus')}</span>
          {anyDemo && <span className="size-2 rounded-full bg-warn" aria-hidden />}
        </button>
      )}
    >
      {() => (
        <div className="p-1">
          <p className="text-sm font-semibold">{t('shell.dataStatus')}</p>
          <p className="mt-0.5 mb-2 text-[12px] text-t2">{t('shell.dataStatusHint')}</p>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-t3">
                <th className="py-1 font-medium">{t('shell.source')}</th>
                <th className="py-1 font-medium">{t('shell.mode')}</th>
                <th className="py-1 font-medium">{t('shell.coverage')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(sources).map(([k, s]) => (
                <tr key={k} className="border-t border-brd">
                  <td className="py-1.5 pr-2">{SOURCE_LABELS[k as SourceKey] ?? k}</td>
                  <td className="py-1.5 pr-2">
                    <DataModeBadge mode={s.mode} />
                  </td>
                  <td className="py-1.5 tnum text-t2">
                    {s.coverageTo ? formatDate(s.coverageTo, lang, 'short') : '—'}
                    {s.mode !== 'demo' && s.freshness ? <span className="block text-[11px] text-t3">{relativeTime(s.freshness, lang)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {can('admin.view') && (
            <Link to="/admin?section=integrations" className="mt-2 inline-block text-[13px] font-medium text-acctext hover:underline">
              {t('shell.manageIntegrations')}
            </Link>
          )}
        </div>
      )}
    </Popover>
  );
}

function Notifications() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useApi<{ items: Notification[]; unread: number }>('/api/notifications', undefined, { refetchInterval: 60_000 });
  const unread = q.data?.unread ?? 0;
  const markAll = async () => {
    await api.send('POST', '/api/notifications/read', { all: true });
    await qc.invalidateQueries({ queryKey: ['/api/notifications'] });
  };
  return (
    <Popover
      align="right"
      width={380}
      label={t('common.notifications')}
      trigger={({ toggle, open, id }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={id} className="relative inline-flex size-9 items-center justify-center rounded-[var(--radius-ctl)] text-t2 hover:bg-hov hover:text-t1" aria-label={`${t('common.notifications')}${unread ? ` (${unread})` : ''}`}>
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-acc px-1 text-[10px] leading-4 font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-1 pb-1">
            <p className="text-sm font-semibold">{t('common.notifications')}</p>
            {unread > 0 && (
              <Button size="sm" variant="ghost" onClick={markAll}>
                {t('common.markAllRead')}
              </Button>
            )}
          </div>
          {!q.data?.items.length && <p className="px-1 py-4 text-[13px] text-t2">{t('common.noNotifications')}</p>}
          <ul className="flex flex-col">
            {q.data?.items.slice(0, 20).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={clsx('w-full rounded-md px-2 py-2 text-left hover:bg-hov', !n.readAt && 'bg-accsoft')}
                  onClick={async () => {
                    close();
                    await api.send('POST', '/api/notifications/read', { ids: [n.id] });
                    void qc.invalidateQueries({ queryKey: ['/api/notifications'] });
                    if (n.link) nav(n.link);
                  }}
                >
                  <p className="line-clamp-2 text-[13px] text-t1">{n.title}</p>
                  <p className="text-[11.5px] text-t3">{relativeTime(n.createdAt, lang)}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  );
}

function Favorites() {
  const { t } = useI18n();
  const q = useApi<Array<{ id: string; kind: string; ref: string; label: string }>>('/api/me/favorites');
  if (!q.data?.length) return null;
  return (
    <Popover
      align="right"
      width={300}
      label={t('common.favorites')}
      trigger={({ toggle, open, id }) => <IconButton label={t('common.favorites')} onClick={toggle} aria-expanded={open} aria-controls={id}>
          <Star className="size-[18px]" />
        </IconButton>}
    >
      {(close) => (
        <ul>
          {q.data!.map((f) => (
            <li key={f.id}>
              <Link to={f.ref} onClick={close} className="block truncate rounded-md px-2 py-1.5 text-[13px] hover:bg-hov">
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  link: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const { can } = useSession();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(h);
  }, [q]);
  useEffect(() => {
    if (!open) {
      setQ('');
      setActive(0);
    }
  }, [open]);
  const res = useApi<{ results: SearchResult[] }>(open && debounced.length >= 2 ? '/api/me/search' : null, { q: debounced });
  const pages: SearchResult[] = useMemo(
    () =>
      NAV.filter((n) => (!n.permission || can(n.permission)) && (!q || t(`nav.${n.key}`).toLowerCase().includes(q.toLowerCase()))).map((n) => ({ type: 'page', id: n.path, title: t(`nav.${n.key}`), link: n.path })),
    [q, t, can],
  );
  const items = [...pages, ...(debounced.length >= 2 ? res.data?.results ?? [] : [])];
  const go = (r: SearchResult) => {
    onClose();
    nav(r.link);
  };
  return (
    <Modal open={open} onClose={onClose} title={t('common.search')} size="md">
      <div
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && items[active]) go(items[active]);
        }}
      >
        <Input autoFocus value={q} onChange={(e) => (setQ(e.target.value), setActive(0))} placeholder={t('common.searchPlaceholder')} aria-label={t('common.search')} role="combobox" aria-expanded aria-controls="cmd-results" aria-activedescendant={items[active] ? `cmd-${active}` : undefined} />
        <ul id="cmd-results" role="listbox" className="mt-3 flex max-h-[50vh] flex-col overflow-y-auto">
          {items.map((r, i) => (
            <li key={`${r.type}-${r.id}`} id={`cmd-${i}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(r)} className={clsx('flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left', i === active ? 'bg-accsoft' : 'hover:bg-hov')}>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] text-t1">{r.title}</span>
                  {r.subtitle && <span className="block truncate text-[12px] text-t3">{r.subtitle}</span>}
                </span>
                <span className="shrink-0 text-[11.5px] text-t3">{t(`shell.result_${r.type}`)}</span>
              </button>
            </li>
          ))}
          {debounced.length >= 2 && !res.isFetching && items.length === 0 && <li className="px-3 py-4 text-[13px] text-t2">{t('shell.noResults')}</li>}
        </ul>
      </div>
    </Modal>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { t, lang } = useI18n();
  const { prefs, setPrefs } = usePrefs();
  const { me } = useSession();
  const meta = useMeta();
  const [cmd, setCmd] = useState(false);
  const saved = useRef(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmd(true);
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);
  const setLang = (l: 'en' | 'fr') => {
    setPrefs({ language: l });
    if (me && !saved.current) void api.send('PATCH', '/api/auth/me', { language: l }).catch(() => {});
  };
  const dark = prefs.theme === 'dark';
  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-brd bg-card/95 px-3 backdrop-blur sm:px-5">
      <IconButton label={t('common.openMenu')} onClick={onMenu} className="lg:hidden">
        <Menu className="size-5" />
      </IconButton>
      <button type="button" onClick={() => setCmd(true)} className="flex h-9 max-w-[420px] min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-ctl)] border border-brd bg-app px-3 text-left text-[13px] text-t3 hover:border-brds" aria-label={t('common.search')}>
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{t('shell.commandHint')}</span>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <DataStatus />
        <Favorites />
        <Notifications />
        {(meta.data?.org.settings.supportedLanguages ?? ['fr', 'en']).length > 1 && (
          <Segmented size="sm" label={t('common.language')} value={lang} onChange={setLang} options={(['fr', 'en'] as const).filter((l) => (meta.data?.org.settings.supportedLanguages ?? ['fr', 'en']).includes(l)).map((l) => ({ value: l, label: l.toUpperCase() }))} />
        )}
        <IconButton label={`${t('shell.theme')}: ${dark ? t('shell.themeLight') : t('shell.themeDark')}`} onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })}>
          {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </IconButton>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
    </header>
  );
}
