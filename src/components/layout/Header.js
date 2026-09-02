import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Activity, AlertTriangle, ArrowLeft, ArrowUpRight, Bell, Bookmark, ChevronDown, Clock3, Download, LogOut, Menu, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, UserRound, } from 'lucide-react';
import { FILTERED_PAGES, PAGE_META } from '/src/lib/nav.js';
import { useI18n } from '/src/i18n/index.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useSettings } from '/src/state/SettingsContext.js';
import { useToast } from '/src/state/ToastContext.js';
import { topSignals } from '/src/lib/insights.js';
import { toQ } from '/src/lib/aggregate.js';
import { Btn } from '/src/components/ui/primitives.js';
import { useAuth } from '/src/state/AuthContext.js';
import { fmtRange } from '/src/lib/format.js';
function useDismissable(open, close) {
    const ref = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const onDown = (e) => { if (ref.current && !ref.current.contains(e.target))
            close(); };
        const onKey = (e) => { if (e.key === 'Escape')
            close(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open, close]);
    return ref;
}
function Popover({ trigger, label, children, width = 'w-80' }) {
    const [open, setOpen] = useState(false);
    const ref = useDismissable(open, () => setOpen(false));
    return (_jsxs("div", { className: "relative", ref: ref, children: [_jsx("button", { type: "button", "aria-label": label, "aria-expanded": open, onClick: () => setOpen((o) => !o), className: clsx('inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border px-3 text-[12px] font-medium transition-colors', open ? 'border-brds bg-inset text-t1' : 'border-brd bg-card text-t2 hover:border-brds hover:text-t1'), children: trigger }), open && (_jsx("div", { role: "dialog", "aria-label": label, className: clsx('pop-in absolute right-0 top-full z-[120] mt-2 max-w-[calc(100vw-24px)] overflow-hidden rounded-[8px] border border-brds bg-card shadow-[var(--shadow-pop)]', width), children: children(() => setOpen(false)) }))] }));
}
function countFilterSelections(filters) {
    return filters.markets.length + filters.regions.length + filters.languages.length + filters.channels.length + filters.platforms.length + filters.devices.length + filters.campaigns.length + filters.themes.length + filters.formats.length + filters.advocacyPrograms.length + filters.advocateGroups.length;
}
function categoryIcon(category) {
    if (category === 'risk' || category === 'anomaly' || category === 'dataQuality')
        return AlertTriangle;
    if (category === 'growth' || category === 'opportunity')
        return ArrowUpRight;
    if (category === 'conversion')
        return Activity;
    return Sparkles;
}
function categoryTone(category) {
    if (category === 'risk' || category === 'anomaly' || category === 'dataQuality')
        return 'bg-negsoft text-neg';
    if (category === 'growth' || category === 'opportunity')
        return 'bg-possoft text-pos';
    return 'bg-infosoft text-info';
}
function categoryLabel(category, lang) {
    const labels = {
        growth: { en: 'Growth', fr: 'Croissance' },
        risk: { en: 'Risk', fr: 'Risque' },
        opportunity: { en: 'Opportunity', fr: 'Opportunité' },
        anomaly: { en: 'Anomaly', fr: 'Anomalie' },
        dataQuality: { en: 'Data quality', fr: 'Qualité des données' },
        content: { en: 'Content', fr: 'Contenu' },
        conversion: { en: 'Workflow', fr: 'Workflow' },
    };
    return labels[category][lang];
}
const READ_KEY = 'dp.notifications.read';
function loadReadIds() {
    try {
        const parsed = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
export function Header({ onOpenPalette, onOpenMobileNav }) {
    const location = useLocation();
    const { pathname } = location;
    const navigate = useNavigate();
    const drillState = location.state;
    const { t, lang } = useI18n();
    const { filters, activeCount, savedViews, saveView, applyView, deleteView } = useFilters();
    const { settings } = useSettings();
    const { toast } = useToast();
    const { user, signOut } = useAuth();
    const [readIds, setReadIds] = useState(loadReadIds);
    const meta = PAGE_META[pathname] ?? PAGE_META['/'];
    const computedSignals = topSignals(toQ(filters), lang, 10, { advocacyPrograms: filters.advocacyPrograms, advocateGroups: filters.advocateGroups })
        .filter((signal) => settings.notifAnomalies || (signal.category !== 'risk' && signal.category !== 'anomaly'))
        .filter((signal) => settings.notifSources || signal.category !== 'dataQuality')
        .map((signal) => ({ ...signal, href: `/insights${location.search}` }));
    const workflowSignals = [
        ...(settings.notifDigest ? [{ id: 'workflow-digest', direction: 0, category: 'content', text: lang === 'fr' ? 'Le digest de performance digitale est prêt à être consulté.' : 'Your digital performance digest is ready to review.', href: `/insights${location.search}` }] : []),
        ...(settings.notifReports ? [{ id: 'workflow-reports', direction: 0, category: 'conversion', text: lang === 'fr' ? 'Les rapports programmés et les modèles d’export sont disponibles dans Rapports.' : 'Scheduled reports and export templates are available in Reports.', href: '/reports' }] : []),
    ];
    const signals = [...computedSignals, ...workflowSignals].slice(0, 8);
    const hasGlobalFilters = FILTERED_PAGES.has(pathname);
    const unreadCount = signals.filter((s) => !readIds.includes(s.id)).length;
    const markRead = (ids) => {
        const next = Array.from(new Set([...readIds, ...ids])).slice(-100);
        setReadIds(next);
        try {
            localStorage.setItem(READ_KEY, JSON.stringify(next));
        }
        catch { /* ignore */ }
    };
    const oidcIdentity = user?.provider === 'oidc';
    const profileName = oidcIdentity ? (user?.name || settings.profileName) : settings.profileName;
    const profileRole = oidcIdentity ? (user?.role || settings.profileRole) : settings.profileRole;
    const profileEmail = user?.email || settings.profileEmail;
    const initials = profileName.split(' ').map((x) => x[0]).slice(0, 2).join('');
    const providerLabel = user?.provider === 'oidc' ? 'Veolia SSO' : user?.provider === 'secure-demo' ? (lang === 'fr' ? 'Accès sécurisé' : 'Secure access') : user?.provider === 'prototype-login' ? (lang === 'fr' ? 'Connexion prototype' : 'Prototype login') : user?.provider === 'local' ? 'Local' : (lang === 'fr' ? 'Profil' : 'Profile');
    return (_jsx("header", { className: "no-print sticky top-0 z-[80] border-b border-brd bg-card shadow-[0_1px_0_rgba(9,8,22,.04)]", children: _jsxs("div", { className: "flex min-h-[64px] items-center gap-3 px-4 py-2 md:px-6", children: [_jsx("button", { type: "button", onClick: onOpenMobileNav, "aria-label": t('nav.main'), className: "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-brd bg-card text-t2 lg:hidden", children: _jsx(Menu, { size: 18, "aria-hidden": true }) }), drillState?.from && (_jsxs("button", { type: "button", onClick: () => navigate(drillState.from), "aria-label": lang === 'fr' ? 'Retour à la page précédente' : 'Back to previous page', title: lang === 'fr' ? 'Retour' : 'Back', className: "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[6px] border border-brd bg-card px-2.5 text-[12px] font-semibold text-t2 hover:border-brds hover:text-t1", children: [_jsx(ArrowLeft, { size: 15, "aria-hidden": true }), _jsx("span", { className: "hidden xl:inline", children: lang === 'fr' ? 'Retour' : 'Back' })] })), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "text-[12px] font-bold text-acctext", children: t(meta.eyebrowKey) }), _jsxs("div", { className: "mt-0.5 flex min-w-0 items-baseline gap-3", children: [_jsx("h1", { className: "m-0 shrink-0 truncate text-[21px] font-bold tracking-[-.01em] text-t1 md:text-[24px]", children: t(meta.titleKey) }), _jsx("p", { className: "hidden min-w-0 flex-1 truncate text-[12.5px] text-t3 2xl:block", children: t(meta.subtitleKey) })] })] }), _jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [hasGlobalFilters && (_jsxs("button", { id: "global-filter-trigger", type: "button", onClick: () => window.dispatchEvent(new Event('dp:open-filters')), "aria-label": lang === 'fr' ? `Ouvrir les filtres${activeCount ? `, ${activeCount} actif(s)` : ''}` : `Open filters${activeCount ? `, ${activeCount} active` : ''}`, className: "inline-flex h-10 items-center gap-2 rounded-[6px] border border-brd bg-card px-2.5 text-[12px] font-semibold text-t2 hover:border-acc hover:text-acctext", children: [_jsx(SlidersHorizontal, { size: 15, "aria-hidden": true }), _jsx("span", { className: "hidden lg:inline", children: t('filters.title') }), activeCount > 0 && _jsx("span", { className: "rounded-full bg-acc px-1.5 text-[10px] font-bold leading-[18px] text-white", children: activeCount })] })), _jsxs("button", { type: "button", onClick: onOpenPalette, "aria-label": t('header.searchHint'), className: "hidden h-10 w-10 items-center justify-center gap-2 rounded-[6px] border border-brd bg-card px-2 text-left text-[12px] text-t3 hover:border-brds hover:text-t2 md:flex 2xl:w-auto 2xl:min-w-[200px] 2xl:justify-start 2xl:px-3", children: [_jsx(Search, { size: 15, "aria-hidden": true }), _jsx("span", { className: "hidden flex-1 2xl:inline", children: t('header.searchHint') }), _jsx("kbd", { className: "hidden rounded border border-brd bg-inset px-1.5 py-0.5 text-[10.5px] 2xl:inline", children: "\u2318K" })] }), _jsx(Popover, { label: lang === 'fr' ? 'Analyses enregistrées' : 'Saved analyses', width: "w-[390px]", trigger: _jsxs(_Fragment, { children: [_jsx(Bookmark, { size: 15 }), _jsx("span", { className: "hidden 2xl:inline", children: lang === 'fr' ? 'Analyses enregistrées' : 'Saved analyses' }), _jsx(ChevronDown, { size: 12 })] }), children: (close) => (_jsxs("div", { children: [_jsxs("div", { className: "border-b border-brd px-4 py-3", children: [_jsx("div", { className: "text-[13px] font-bold text-t1", children: lang === 'fr' ? 'Analyses enregistrées' : 'Saved analyses' }), _jsx("p", { className: "m-0 mt-1 text-[11.5px] leading-5 text-t3", children: lang === 'fr' ? 'Enregistrez la page, la période, la comparaison et tous les filtres pour retrouver exactement la même analyse.' : 'Save the page, date range, comparison and all filters so you can reopen the exact same analysis.' })] }), _jsx("div", { className: "max-h-[330px] overflow-y-auto p-2", children: savedViews.length ? savedViews.map((v) => {
                                            const pageMeta = PAGE_META[v.path || '/'] ?? PAGE_META['/'];
                                            return (_jsxs("div", { className: "group mb-1 flex items-stretch overflow-hidden rounded-[6px] border border-transparent hover:border-brd hover:bg-card2 last:mb-0", children: [_jsxs("button", { type: "button", onClick: () => { applyView(v.id); close(); }, className: "min-w-0 flex-1 px-3 py-2.5 text-left", children: [_jsx("span", { className: "block truncate text-[12.5px] font-semibold text-t1", children: v.name }), _jsxs("span", { className: "mt-1 block text-[11px] text-t3", children: [t(pageMeta.titleKey), " \u00B7 ", fmtRange(v.filters.from, v.filters.to, lang)] }), _jsxs("span", { className: "mt-1 inline-flex items-center gap-1 text-[10.5px] text-t3", children: [_jsx(SlidersHorizontal, { size: 11, "aria-hidden": true }), countFilterSelections(v.filters), " ", lang === 'fr' ? 'filtres de dimension' : 'dimension filters'] })] }), _jsx("button", { type: "button", "aria-label": t('header.deleteView'), onClick: () => deleteView(v.id), className: "m-1 self-center rounded-[5px] p-2 text-t3 opacity-70 hover:bg-negsoft hover:text-neg group-hover:opacity-100", children: _jsx(Trash2, { size: 14 }) })] }, v.id));
                                        }) : _jsx("div", { className: "rounded-[6px] bg-card2 px-3 py-4 text-[11.5px] leading-5 text-t3", children: lang === 'fr' ? 'Aucune analyse enregistrée. Créez-en une lorsque vous avez une combinaison de filtres que vous consultez régulièrement.' : 'No saved analyses yet. Save one when you have a page and filter combination you revisit regularly.' }) }), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const name = String(fd.get('name') ?? '').trim(); if (name) {
                                            saveView(name);
                                            toast(lang === 'fr' ? 'Analyse enregistrée' : 'Analysis saved');
                                            e.currentTarget.elements.namedItem('name').value = '';
                                        } }, className: "flex gap-2 border-t border-brd p-3", children: [_jsx("input", { name: "name", "aria-label": lang === 'fr' ? 'Nom de l’analyse' : 'Analysis name', placeholder: lang === 'fr' ? 'Ex. France · Social · 30 jours' : 'e.g. France · Social · 30 days', className: "h-10 min-w-0 flex-1 rounded-[6px] border border-brds bg-inset px-2.5 text-[12px] text-t1" }), _jsx(Btn, { size: "sm", variant: "primary", type: "submit", children: lang === 'fr' ? 'Enregistrer' : 'Save' })] })] })) }), _jsx(Popover, { label: t('header.notifications'), width: "w-[390px]", trigger: _jsxs("span", { className: "relative inline-flex", children: [_jsx(Bell, { size: 16 }), unreadCount > 0 && _jsxs("span", { "aria-label": `${unreadCount} unread`, className: "absolute -right-2 -top-2 min-w-[16px] rounded-full bg-acc px-1 text-center text-[9px] font-bold leading-4 text-white", children: [Math.min(9, unreadCount), unreadCount > 9 ? '+' : ''] })] }), children: (close) => (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between gap-3 border-b border-brd px-4 py-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[13px] font-bold text-t1", children: t('header.notifications') }), _jsx("div", { className: "mt-0.5 text-[10.5px] text-t3", children: lang === 'fr' ? 'Signaux calculés sur la sélection actuelle' : 'Signals calculated from the current selection' })] }), unreadCount > 0 && _jsx("button", { type: "button", onClick: () => markRead(signals.map((s) => s.id)), className: "text-[11px] font-semibold text-acctext hover:underline", children: lang === 'fr' ? 'Tout marquer lu' : 'Mark all read' })] }), _jsx("div", { className: "max-h-[410px] overflow-y-auto bg-card p-2", children: signals.length === 0 ? (_jsx("div", { className: "rounded-[7px] border border-brd bg-card2 px-4 py-5 text-center text-[11.5px] leading-5 text-t3", children: lang === 'fr' ? 'Aucune nouvelle notification pour la sélection actuelle.' : 'No new notifications for the current selection.' })) : signals.map((signal) => {
                                            const Icon = categoryIcon(signal.category);
                                            const unread = !readIds.includes(signal.id);
                                            return (_jsxs("button", { type: "button", onClick: () => { markRead([signal.id]); navigate(signal.href); close(); }, className: "mb-1.5 flex w-full items-start gap-3 rounded-[7px] border border-brd bg-card px-3 py-3 text-left transition hover:border-brds hover:bg-card2 last:mb-0", children: [_jsx("span", { className: `mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${categoryTone(signal.category)}`, children: _jsx(Icon, { size: 15, "aria-hidden": true }) }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block text-[12px] font-semibold leading-5 text-t1", children: signal.text }), _jsxs("span", { className: "mt-1 flex items-center gap-1.5 text-[10.5px] text-t3", children: [_jsx(Clock3, { size: 11, "aria-hidden": true }), lang === 'fr' ? 'Analyse actuelle' : 'Current analysis', " \u00B7 ", categoryLabel(signal.category, lang)] })] }), unread && _jsx("span", { className: "mt-2 h-2 w-2 shrink-0 rounded-full bg-acc", "aria-label": lang === 'fr' ? 'Non lu' : 'Unread' })] }, signal.id));
                                        }) }), _jsxs("button", { type: "button", onClick: () => { markRead(signals.map((s) => s.id)); navigate(`/insights${location.search}`); close(); }, className: "flex w-full items-center justify-center gap-2 border-t border-brd px-4 py-3 text-[11.5px] font-semibold text-acctext hover:bg-card2", children: [lang === 'fr' ? 'Voir tous les insights' : 'View all insights', _jsx(ArrowUpRight, { size: 13 })] })] })) }), _jsxs(Btn, { onClick: () => navigate('/reports'), className: "h-10", children: [_jsx(Download, { size: 14, "aria-hidden": true }), _jsx("span", { className: "hidden sm:inline", children: t('header.export') })] }), _jsx(Popover, { label: lang === 'fr' ? 'Compte utilisateur' : 'User account', width: "w-[300px]", trigger: _jsxs(_Fragment, { children: [_jsx("span", { className: "flex h-7 w-7 items-center justify-center rounded-full bg-[#002d62] text-[10.5px] font-bold text-white", "aria-hidden": true, children: initials }), _jsx("span", { className: "hidden max-w-[120px] truncate text-[11.5px] font-semibold text-t1 2xl:inline", children: profileName }), _jsx(ChevronDown, { size: 12, className: "hidden xl:block" })] }), children: (close) => (_jsxs("div", { children: [_jsxs("div", { className: "border-b border-brd p-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "flex h-10 w-10 items-center justify-center rounded-full bg-[#002d62] text-[12px] font-bold text-white", children: initials }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate text-[13px] font-bold text-t1", children: profileName }), _jsx("div", { className: "truncate text-[11px] text-t3", children: profileEmail })] })] }), _jsxs("div", { className: "mt-3 inline-flex items-center gap-1.5 rounded-full bg-inset px-2.5 py-1 text-[10.5px] font-semibold text-t2", children: [_jsx(ShieldCheck, { size: 12, className: "text-pos" }), profileRole, " \u00B7 ", providerLabel] })] }), _jsxs("div", { className: "p-2", children: [_jsxs("button", { type: "button", onClick: () => { navigate('/settings?section=account'); close(); }, className: "flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2.5 text-left text-[12px] font-medium text-t2 hover:bg-card2 hover:text-t1", children: [_jsx(UserRound, { size: 15 }), lang === 'fr' ? 'Profil et compte' : 'Profile & account'] }), _jsxs("button", { type: "button", onClick: () => { navigate('/settings?section=security'); close(); }, className: "flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2.5 text-left text-[12px] font-medium text-t2 hover:bg-card2 hover:text-t1", children: [_jsx(ShieldCheck, { size: 15 }), lang === 'fr' ? 'Sécurité' : 'Security'] }), _jsxs("button", { type: "button", onClick: () => { navigate('/settings?section=dashboard'); close(); }, className: "flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2.5 text-left text-[12px] font-medium text-t2 hover:bg-card2 hover:text-t1", children: [_jsx(Settings, { size: 15 }), lang === 'fr' ? 'Préférences' : 'Preferences'] })] }), _jsx("div", { className: "border-t border-brd p-2", children: _jsxs("button", { type: "button", onClick: () => { close(); signOut(); }, className: "flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2.5 text-left text-[12px] font-semibold text-neg hover:bg-negsoft", children: [_jsx(LogOut, { size: 15 }), t('nav.logout')] }) })] })) })] })] }) }));
}
