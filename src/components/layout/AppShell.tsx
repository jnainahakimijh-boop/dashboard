import clsx from 'clsx';
import { ChevronRight, Star } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useApi, useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { configureFormatting } from '@/lib/format';
import { explicitPrefs, usePrefs, type Density, type Theme } from '@/state/prefs';
import { useSession } from '@/state/session';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function DemoBanner() {
  const { t } = useI18n();
  const meta = useMeta();
  const demo = meta.data && Object.values(meta.data.sources).some((s) => s.mode === 'demo');
  if (!demo) return null;
  return (
    <div role="note" className="no-print border-b border-warn/25 bg-warnsoft px-3 py-1.5 text-center text-[12.5px] font-medium text-warn sm:px-5">
      {t('common.demoBanner')}
    </div>
  );
}

/** Applies organisation-wide display defaults (formatting, theme) once metadata is loaded. */
function OrgDefaults() {
  const meta = useMeta();
  const { applyOrgTheme } = usePrefs();
  const st = meta.data?.org.settings;
  useEffect(() => {
    if (!st) return;
    configureFormatting({ numberLocale: st.numberLocale, dateFormat: st.dateFormat });
    applyOrgTheme(st.defaultTheme);
  }, [st, applyOrgTheme]);
  return null;
}

/** Keeps theme and density in the user profile so they follow the user across devices. */
function ProfilePrefsSync() {
  const { me } = useSession();
  const { prefs, setPrefs } = usePrefs();
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!me || loadedFor.current === me.user.id) return;
    loadedFor.current = me.user.id;
    const p = me.user.preferences as { theme?: Theme; density?: Density };
    setPrefs({ ...(p.theme ? { theme: p.theme } : {}), ...(p.density ? { density: p.density } : {}) });
  }, [me, setPrefs]);
  useEffect(() => {
    if (!me || loadedFor.current !== me.user.id) return;
    const ex = explicitPrefs();
    const server = me.user.preferences as { theme?: string; density?: string };
    if ((ex.theme ?? server.theme) === server.theme && (ex.density ?? server.density) === server.density) return;
    const id = setTimeout(() => void api.send('PATCH', '/api/auth/me', { preferences: { ...me.user.preferences, ...(ex.theme ? { theme: ex.theme } : {}), ...(ex.density ? { density: ex.density } : {}) } }).catch(() => {}), 600);
    return () => clearTimeout(id);
  }, [prefs.theme, prefs.density, me]);
  return null;
}

export function AppShell() {
  const { t } = useI18n();
  const [mobile, setMobile] = useState(false);
  return (
    <div className="flex min-h-screen bg-app">
      <a href="#main" className="sr-only z-[300] rounded bg-card px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {t('common.skipToContent')}
      </a>
      <OrgDefaults />
      <ProfilePrefsSync />
      <Sidebar mobileOpen={mobile} onClose={() => setMobile(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobile(true)} />
        <DemoBanner />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, crumbs = [], actions, favoriteLabel }: { title: string; subtitle?: string; crumbs?: Array<{ label: string; to?: string }>; actions?: ReactNode; favoriteLabel?: string }) {
  const { t } = useI18n();
  const { pathname, search } = useLocation();
  const qc = useQueryClient();
  const favs = useApi<Array<{ id: string; kind: string; ref: string }>>('/api/me/favorites');
  const ref = `${pathname}${search}`;
  const fav = favs.data?.find((f) => f.kind === 'page' && f.ref === ref);
  const toggleFav = async () => {
    if (fav) await api.send('DELETE', `/api/me/favorites/${fav.id}`);
    else await api.send('POST', '/api/me/favorites', { kind: 'page', ref, label: favoriteLabel ?? title });
    await qc.invalidateQueries({ queryKey: ['/api/me/favorites'] });
  };
  return (
    <div className="px-3 pt-5 pb-1 sm:px-5 lg:px-7">
      <nav aria-label="Breadcrumb" className="mb-1.5">
        <ol className="flex flex-wrap items-center gap-1 text-[12.5px] text-t3">
          <li>
            <Link to="/" className="hover:text-t1">
              {t('nav.home')}
            </Link>
          </li>
          {crumbs.map((c, i) => (
            <li key={i} className="flex items-center gap-1">
              <ChevronRight className="size-3" aria-hidden />
              {c.to ? (
                <Link to={c.to} className="hover:text-t1">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-t1 sm:text-[24px]">{title}</h1>
            <button type="button" onClick={toggleFav} aria-pressed={!!fav} aria-label={fav ? t('common.unfavorite') : t('common.favorite')} title={fav ? t('common.unfavorite') : t('common.favorite')} className="rounded-md p-1 text-t3 hover:text-t1">
              <Star className={clsx('size-[18px]', fav && 'fill-[var(--ch-4)] text-[var(--ch-4)]')} />
            </button>
          </div>
          {subtitle && <p className="mt-1 max-w-3xl text-[14px] text-t2">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('flex flex-col gap-[var(--gap-grid)] px-3 py-4 sm:px-5 lg:px-7', className)}>{children}</div>;
}
