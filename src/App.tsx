import { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { I18nProvider, useI18n } from '@/i18n';
import { usePrefs } from '@/state/prefs';
import { SessionProvider, useSession } from '@/state/session';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Spinner, ToastProvider } from '@/components/ui';
import { LoginPage } from '@/pages/LoginPage';

const OverviewPage = lazy(() => import('@/pages/overview/OverviewPage'));
const WebPage = lazy(() => import('@/pages/web/WebPage'));
const SocialPage = lazy(() => import('@/pages/social/SocialPage'));
const SeoPage = lazy(() => import('@/pages/seo/SeoPage'));
const GeoPage = lazy(() => import('@/pages/geo/GeoPage'));
const AdsPage = lazy(() => import('@/pages/ads/AdsPage'));
const ContentPage = lazy(() => import('@/pages/content/ContentPage'));
const InsightsPage = lazy(() => import('@/pages/insights/InsightsPage'));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">{t('shell.notFound')}</h1>
      <p className="text-t2">{t('shell.notFoundHint')}</p>
      <Link to="/">
        <Button variant="primary">{t('shell.backHome')}</Button>
      </Link>
    </div>
  );
}

function Guarded() {
  const { me, loading, can } = useSession();
  const { setPrefs, prefs } = usePrefs();
  const loc = useLocation();
  useEffect(() => {
    // the profile language wins the first time a user signs in on a browser
    if (me && !localStorage.getItem('vdi.langInit')) {
      localStorage.setItem('vdi.langInit', '1');
      if (me.user.language !== prefs.language) setPrefs({ language: me.user.language });
    }
  }, [me, prefs.language, setPrefs]);
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          path="*"
          element={
            <Suspense
              fallback={
                <div className="p-8">
                  <Spinner />
                </div>
              }
            >
              <Routes>
                <Route index element={<OverviewPage />} />
                <Route path="web" element={<WebPage />} />
                <Route path="social" element={<SocialPage />} />
                <Route path="seo" element={<SeoPage />} />
                <Route path="geo" element={<GeoPage />} />
                <Route path="ads" element={<AdsPage />} />
                <Route path="content" element={<ContentPage />} />
                <Route path="insights" element={<InsightsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="admin" element={can('admin.view') ? <AdminPage /> : <NotFound />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

function Root() {
  const { me } = useSession();
  return (
    <Routes>
      <Route path="/login" element={me ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<Guarded />} />
    </Routes>
  );
}

export function App() {
  const { prefs } = usePrefs();
  return (
    <I18nProvider lang={prefs.language}>
      <ToastProvider>
        <SessionProvider>
          <Root />
        </SessionProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
