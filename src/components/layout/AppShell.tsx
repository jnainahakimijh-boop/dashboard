import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent } from './Sidebar';
import { Header } from './Header';
import { FilterBar } from '@/components/filters/FilterBar';
import { CommandPalette } from './CommandPalette';
import { Skeleton } from '@/components/ui/primitives';
import { useI18n } from '@/i18n';

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-4 md:p-6" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 gap-[var(--gap-grid)] sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
      <Skeleton className="h-[340px]" />
      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { pathname } = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    document.getElementById('main')?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const closeMobile = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen, closeMobile]);

  return (
    <div className="flex min-h-dvh bg-app text-t1">
      <a
        href="#main"
        className="sr-only z-[100] rounded-[8px] bg-acc px-3 py-2 text-[12px] font-semibold text-accink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar />

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/55" onMouseDown={closeMobile} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label={t('nav.main')} className="drawer-in-left absolute inset-y-0 left-0 flex w-[268px] flex-col border-r border-brd bg-side px-3 py-4">
            <SidebarContent collapsed={false} mobile onClose={closeMobile} onNavigate={closeMobile} />
          </div>
        </div>
      )}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Header onOpenPalette={() => setPaletteOpen(true)} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <FilterBar />
        <main id="main" className="min-w-0 flex-1">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
