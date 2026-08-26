import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from '@/state/SettingsContext';
import { FiltersProvider } from '@/state/FiltersContext';
import { ToastProvider } from '@/state/ToastContext';
import { AuthProvider, useAuth } from '@/state/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import OverviewPage from '@/pages/OverviewPage';

const WebPage = lazy(() => import('@/pages/WebPage'));
const SocialPage = lazy(() => import('@/pages/SocialPage'));
const ContentPage = lazy(() => import('@/pages/ContentPage'));
const CampaignsPage = lazy(() => import('@/pages/CampaignsPage'));
const JourneyPage = lazy(() => import('@/pages/JourneyPage'));
const AudiencePage = lazy(() => import('@/pages/AudiencePage'));
const InsightsPage = lazy(() => import('@/pages/InsightsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const DataQualityPage = lazy(() => import('@/pages/DataQualityPage'));
const KpiCataloguePage = lazy(() => import('@/pages/KpiCataloguePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));

function Gate() {
  const { authed } = useAuth();
  if (!authed) return <LoginPage />;
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/web" element={<WebPage />} />
        <Route path="/social" element={<SocialPage />} />
        <Route path="/content" element={<ContentPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/journey" element={<JourneyPage />} />
        <Route path="/audience" element={<AudiencePage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/recommendations" element={<Navigate to="/insights?tab=recommendations" replace />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/data-quality" element={<DataQualityPage />} />
        <Route path="/kpi-catalogue" element={<KpiCataloguePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AuthProvider>
          <FiltersProvider>
            <Gate />
          </FiltersProvider>
        </AuthProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
