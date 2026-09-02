import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SettingsProvider, useSettings } from '/src/state/SettingsContext.js';
import { FiltersProvider } from '/src/state/FiltersContext.js';
import { ToastProvider } from '/src/state/ToastContext.js';
import { AuthProvider, useAuth } from '/src/state/AuthContext.js';
import { AppShell } from '/src/components/layout/AppShell.js';
import LoginPage from '/src/pages/LoginPage.js';
const OverviewPage = lazy(() => import('/src/pages/OverviewPage.js'));
const GlobalPerformancePage = lazy(() => import('/src/pages/GlobalPerformancePage.js'));
const AdvocacyPage = lazy(() => import('/src/pages/AdvocacyPage.js'));
const SeoPage = lazy(() => import('/src/pages/SeoPage.js'));
const AiSearchPage = lazy(() => import('/src/pages/AiSearchPage.js'));
const WebPage = lazy(() => import('/src/pages/WebPage.js'));
const SocialPage = lazy(() => import('/src/pages/SocialPage.js'));
const ContentPage = lazy(() => import('/src/pages/ContentPage.js'));
const CampaignsPage = lazy(() => import('/src/pages/CampaignsPage.js'));
const JourneyPage = lazy(() => import('/src/pages/JourneyPage.js'));
const AudiencePage = lazy(() => import('/src/pages/AudiencePage.js'));
const InsightsPage = lazy(() => import('/src/pages/InsightsPage.js'));
const ReportsPage = lazy(() => import('/src/pages/ReportsPage.js'));
const DataQualityPage = lazy(() => import('/src/pages/DataQualityPage.js'));
const KpiCataloguePage = lazy(() => import('/src/pages/KpiCataloguePage.js'));
const SettingsPage = lazy(() => import('/src/pages/SettingsPage.js'));
class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error('Veolia Digital Performance render error', error, info);
    }
    render() {
        if (!this.state.error)
            return this.props.children;
        const message = this.state.error instanceof Error ? this.state.error.message : String(this.state.error || 'Unknown application error');
        return _jsx("main", { className: "min-h-screen bg-[#fcfcfc] px-5 py-10 text-[#1c1c1f]", children: _jsxs("div", { className: "mx-auto max-w-2xl rounded-[10px] border border-[#e0ddee] bg-white p-7 shadow-[0_12px_34px_rgba(9,8,22,.08)]", children: [_jsx("img", { src: "/veolia-logo.webp", alt: "Veolia", className: "h-7 w-auto" }), _jsx("h1", { className: "mt-6 text-[22px] font-bold", children: "The dashboard could not finish loading" }), _jsx("p", { className: "mt-3 text-[13px] leading-6 text-[#55555a]", children: "The deployment is online, but a browser module encountered an error. Reload once. If the message remains, redeploy this fixed package." }), _jsx("pre", { className: "mt-4 overflow-auto rounded-[6px] bg-[#f2f1f9] p-3 text-[11px] leading-5 text-[#55555a]", children: message }), _jsx("button", { type: "button", onClick: () => window.location.reload(), className: "mt-5 h-10 rounded-[6px] bg-[#002d62] px-4 text-[12px] font-bold text-white", children: "Reload dashboard" })] }) });
    }
}
function ProductRoutes() {
    const { authenticated } = useAuth();
    const { settings } = useSettings();
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (!authenticated || settings.defaultPage === '/' || location.pathname !== '/')
            return;
        try {
            if (sessionStorage.getItem('dp.defaultPage.applied') === '1')
                return;
            sessionStorage.setItem('dp.defaultPage.applied', '1');
        }
        catch { /* storage unavailable */ }
        navigate(settings.defaultPage, { replace: true });
    }, [authenticated, location.pathname, navigate, settings.defaultPage]);
    return (_jsx(ToastProvider, { children: _jsx(FiltersProvider, { children: _jsx(AppShell, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(OverviewPage, {}) }), _jsx(Route, { path: "/global", element: _jsx(GlobalPerformancePage, {}) }), _jsx(Route, { path: "/advocacy", element: _jsx(AdvocacyPage, {}) }), _jsx(Route, { path: "/seo", element: _jsx(SeoPage, {}) }), _jsx(Route, { path: "/ai-search", element: _jsx(AiSearchPage, {}) }), _jsx(Route, { path: "/web", element: _jsx(WebPage, {}) }), _jsx(Route, { path: "/social", element: _jsx(SocialPage, {}) }), _jsx(Route, { path: "/content", element: _jsx(ContentPage, {}) }), _jsx(Route, { path: "/campaigns", element: _jsx(CampaignsPage, {}) }), _jsx(Route, { path: "/journey", element: _jsx(JourneyPage, {}) }), _jsx(Route, { path: "/audience", element: _jsx(AudiencePage, {}) }), _jsx(Route, { path: "/insights", element: _jsx(InsightsPage, {}) }), _jsx(Route, { path: "/recommendations", element: _jsx(Navigate, { to: "/insights?view=actions", replace: true }) }), _jsx(Route, { path: "/reports", element: _jsx(ReportsPage, {}) }), _jsx(Route, { path: "/data-quality", element: _jsx(DataQualityPage, {}) }), _jsx(Route, { path: "/kpi-catalogue", element: _jsx(KpiCataloguePage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) }), _jsx(Route, { path: "/admin", element: _jsx(Navigate, { to: "/settings?section=backoffice", replace: true }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) }) }));
}
function AuthenticatedApp() {
    const { authenticated, authReady } = useAuth();
    if (!authReady) return _jsx("div", { className: "min-h-screen bg-app" });
    if (!authenticated) return _jsx(LoginPage, {});
    return _jsx(ProductRoutes, {});
}
export default function App() {
    return (_jsx(AppErrorBoundary, { children: _jsx(SettingsProvider, { children: _jsx(AuthProvider, { children: _jsx(AuthenticatedApp, {}) }) }) }));
}
