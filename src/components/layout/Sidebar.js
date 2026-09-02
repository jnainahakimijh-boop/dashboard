import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronsLeft, ChevronsRight, HelpCircle, X } from 'lucide-react';
import { NAV_SECTIONS } from '/src/lib/nav.js';
import { useI18n } from '/src/i18n/index.js';
import { useSettings } from '/src/state/SettingsContext.js';
import { useToast } from '/src/state/ToastContext.js';
import { useAuth } from '/src/state/AuthContext.js';
import { usePlatformConfig } from '/src/lib/platformConfig.js';
function Brand({ collapsed }) {
    const { config } = usePlatformConfig();
    const productName = String(config.workspace.name || 'Veolia Digital Performance').replace(/^Veolia\s+/i, '');
    if (collapsed) {
        return _jsx("img", { src: "/veolia-mark.png", alt: "Veolia", className: "h-8 w-8 object-contain" });
    }
    return (_jsxs("span", { className: "min-w-0 leading-tight", children: [_jsx("img", { src: "/veolia-logo.webp", alt: "Veolia", className: "h-6 w-auto" }), _jsx("span", { className: "mt-2 block truncate text-[14px] font-bold tracking-[-.01em] text-t1", children: productName }), _jsx("span", { className: "mt-0.5 block text-[10.5px] font-medium text-t3", children: "Communication & Marketing Intelligence" })] }));
}
export function SidebarContent({ collapsed, onNavigate, onToggleCollapse, mobile = false, onClose }) {
    const { t } = useI18n();
    const { settings } = useSettings();
    const { toast } = useToast();
    const { user } = useAuth();
    const oidcIdentity = user?.provider === 'oidc';
    const displayName = oidcIdentity ? (user?.name || settings.profileName) : settings.profileName;
    const displayRole = oidcIdentity ? (user?.role || settings.profileRole) : settings.profileRole;
    return (_jsxs("div", { className: "flex h-full min-h-0 flex-col text-t1", children: [_jsxs("div", { className: clsx('flex min-h-[58px] items-start justify-between gap-2 border-b border-brd px-2 pb-4 pt-1', collapsed && 'items-center justify-center px-0'), children: [_jsx(Brand, { collapsed: collapsed }), mobile && (_jsx("button", { type: "button", "aria-label": t('misc.close'), onClick: onClose, className: "inline-flex h-10 w-10 items-center justify-center rounded-[6px] text-t3 hover:bg-hov hover:text-t1", children: _jsx(X, { size: 18, "aria-hidden": true }) }))] }), _jsx("nav", { "aria-label": t('nav.main'), className: "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0.5 pt-4", children: NAV_SECTIONS.map((section) => (_jsxs("div", { className: "mb-5", children: [!collapsed && _jsx("div", { className: "mb-2 px-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-t3", children: t(section.labelKey) }), _jsx("ul", { className: "m-0 flex list-none flex-col gap-1 p-0", children: section.items.map((item) => (_jsxs("li", { className: "group relative", children: [_jsx(NavLink, { to: item.path, end: item.path === '/', onClick: onNavigate, title: collapsed ? t(item.labelKey) : undefined, className: ({ isActive }) => clsx('relative flex min-h-[44px] items-center gap-3 rounded-[6px] text-[13px] font-medium transition-colors duration-150', collapsed ? 'justify-center px-0' : 'px-3', isActive ? 'bg-inset text-t1' : 'text-t2 hover:bg-hov hover:text-t1'), children: ({ isActive }) => (_jsxs(_Fragment, { children: [_jsx("span", { "aria-hidden": true, className: clsx('absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-acc transition-opacity', isActive ? 'opacity-100' : 'opacity-0') }), _jsx(item.icon, { size: 18, "aria-hidden": true, className: clsx('shrink-0', isActive ? 'text-acc' : 'text-t3 group-hover:text-t2') }), !collapsed && _jsx("span", { className: "truncate", children: t(item.labelKey) })] })) }), collapsed && (_jsx("span", { role: "tooltip", className: "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[6px] border border-brds bg-card px-2.5 py-1.5 text-[12px] text-t1 opacity-0 shadow-[var(--shadow-pop)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100", children: t(item.labelKey) }))] }, item.path))) })] }, section.labelKey))) }), _jsxs("div", { className: "mt-3 border-t border-brd pt-3", children: [_jsxs(Link, { to: "/settings?section=account", title: collapsed ? displayName : undefined, className: clsx('group flex items-center gap-2.5 rounded-[6px] border border-transparent px-2 py-2 no-underline transition hover:border-brd hover:bg-card2', collapsed && 'justify-center px-0'), children: [_jsx("span", { "aria-hidden": true, className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#002d62] text-[11px] font-bold text-white", children: displayName.split(' ').map((s) => s[0]).slice(0, 2).join('') }), !collapsed && (_jsxs("span", { className: "min-w-0 flex-1 leading-tight", children: [_jsx("span", { className: "block truncate text-[12.5px] font-semibold text-t1", children: displayName }), _jsx("span", { className: "mt-1 block truncate text-[11px] text-t3", children: displayRole }), _jsx("span", { className: "mt-1 block text-[10px] font-semibold text-acctext opacity-0 transition-opacity group-hover:opacity-100", children: t('nav.settings') })] }))] }), _jsxs("div", { className: clsx('mt-1 flex gap-1', collapsed ? 'flex-col items-center' : 'items-center justify-between px-1'), children: [_jsxs("button", { type: "button", onClick: () => toast('Use Ctrl/Cmd + K to search pages and entities.', 'info'), className: "flex min-h-10 items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[11.5px] text-t3 hover:bg-hov hover:text-t1", "aria-label": t('nav.help'), title: t('nav.help'), children: [_jsx(HelpCircle, { size: 15, "aria-hidden": true }), !collapsed && t('nav.help')] }), !mobile && onToggleCollapse && (_jsx("button", { type: "button", onClick: onToggleCollapse, "aria-label": collapsed ? t('nav.expand') : t('nav.collapse'), title: collapsed ? t('nav.expand') : t('nav.collapse'), className: "inline-flex h-10 w-10 items-center justify-center rounded-[6px] text-t3 hover:bg-hov hover:text-t1", children: collapsed ? _jsx(ChevronsRight, { size: 16, "aria-hidden": true }) : _jsx(ChevronsLeft, { size: 16, "aria-hidden": true }) }))] })] })] }));
}
export function Sidebar() {
    const [collapsed, setCollapsed] = useState(() => {
        try {
            const saved = localStorage.getItem('dp.sidebar');
            return saved !== 'expanded'; // maximise analytical canvas by default
        }
        catch {
            return true;
        }
    });
    const toggle = () => setCollapsed((c) => {
        try {
            localStorage.setItem('dp.sidebar', c ? 'expanded' : 'collapsed');
        }
        catch { /* ignore */ }
        return !c;
    });
    return (_jsxs("aside", { className: clsx('relative sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-brd bg-side px-3 py-4 transition-[width] duration-200 lg:flex', collapsed ? 'w-[72px]' : 'w-[260px]'), children: [_jsx("button", { type: "button", onClick: toggle, "aria-label": collapsed ? 'Expand navigation' : 'Collapse navigation', title: collapsed ? 'Expand navigation' : 'Collapse navigation', className: "absolute -right-3 top-6 z-40 inline-flex h-7 w-7 items-center justify-center rounded-full border border-brds bg-card text-t3 shadow-[var(--shadow-raised)] hover:border-acc hover:text-acctext", children: collapsed ? _jsx(ChevronsRight, { size: 14, "aria-hidden": true }) : _jsx(ChevronsLeft, { size: 14, "aria-hidden": true }) }), _jsx(SidebarContent, { collapsed: collapsed })] }));
}
