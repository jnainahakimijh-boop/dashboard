import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent } from '/src/components/layout/Sidebar.js';
import { Header } from '/src/components/layout/Header.js';
import { FilterBar } from '/src/components/filters/FilterBar.js';
import { CommandPalette } from '/src/components/layout/CommandPalette.js';
import { Skeleton } from '/src/components/ui/primitives.js';
import { useI18n } from '/src/i18n/index.js';
import { AiAssistant } from '/src/components/agent/AiAssistant.js';
function PageSkeleton() {
    return (_jsxs("div", { className: "page-shell flex flex-col gap-[var(--gap-grid)]", "aria-busy": "true", "aria-live": "polite", children: [_jsx("div", { className: "grid grid-cols-2 gap-[var(--gap-grid)] sm:grid-cols-3 lg:grid-cols-6", children: Array.from({ length: 6 }).map((_, i) => (_jsx(Skeleton, { className: "h-[104px]" }, i))) }), _jsx(Skeleton, { className: "h-[340px]" }), _jsxs("div", { className: "grid gap-[var(--gap-grid)] lg:grid-cols-2", children: [_jsx(Skeleton, { className: "h-[280px]" }), _jsx(Skeleton, { className: "h-[280px]" })] })] }));
}
export function AppShell({ children }) {
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const mobileDialogRef = useRef(null);
    const lastFocusRef = useRef(null);
    const location = useLocation();
    const { pathname, hash } = location;
    const { t } = useI18n();
    useEffect(() => {
        const onKey = (e) => {
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
        const main = document.getElementById('main');
        requestAnimationFrame(() => {
            if (hash) {
                const target = document.getElementById(hash.slice(1));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    if (!target.hasAttribute('tabindex'))
                        target.setAttribute('tabindex', '-1');
                    target.focus({ preventScroll: true });
                    return;
                }
            }
            main?.scrollTo?.({ top: 0 });
            window.scrollTo({ top: 0 });
            main?.focus({ preventScroll: true });
        });
    }, [pathname, hash]);
    const closeMobile = useCallback(() => {
        setMobileNavOpen(false);
        window.setTimeout(() => {
            const target = lastFocusRef.current;
            if (target?.isConnected)
                target.focus();
        }, 0);
    }, []);
    const openMobile = useCallback(() => {
        lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setMobileNavOpen(true);
    }, []);
    useEffect(() => {
        if (!mobileNavOpen)
            return;
        const root = mobileDialogRef.current;
        const focusables = () => root ? Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')) : [];
        requestAnimationFrame(() => focusables()[0]?.focus());
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeMobile();
                return;
            }
            if (e.key !== 'Tab')
                return;
            const nodes = focusables();
            if (!nodes.length)
                return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [mobileNavOpen, closeMobile]);
    return (_jsxs("div", { className: "flex min-h-dvh bg-app text-t1", children: [_jsx("a", { href: "#main", className: "sr-only z-[100] rounded-[6px] bg-acc px-3 py-2 text-[12px] font-semibold text-accink focus:not-sr-only focus:fixed focus:left-3 focus:top-3", children: "Skip to content" }), _jsx(Sidebar, {}), mobileNavOpen && (_jsxs("div", { className: "fixed inset-0 z-40 lg:hidden", children: [_jsx("div", { className: "absolute inset-0 bg-black/55", onMouseDown: closeMobile, "aria-hidden": true }), _jsx("div", { ref: mobileDialogRef, role: "dialog", "aria-modal": "true", "aria-label": t('nav.main'), className: "drawer-in-left absolute inset-y-0 left-0 flex w-[286px] flex-col border-r border-brd bg-side px-3 py-4 shadow-[var(--shadow-pop)]", children: _jsx(SidebarContent, { collapsed: false, mobile: true, onClose: closeMobile, onNavigate: closeMobile }) })] })), _jsxs("div", { className: "flex min-h-dvh min-w-0 flex-1 flex-col", children: [_jsx(Header, { onOpenPalette: () => setPaletteOpen(true), onOpenMobileNav: openMobile }), _jsx(FilterBar, {}), _jsx("main", { id: "main", tabIndex: -1, className: "min-w-0 flex-1 focus:outline-none", children: _jsx(Suspense, { fallback: _jsx(PageSkeleton, {}), children: children }) })] }), _jsx(CommandPalette, { open: paletteOpen, onClose: () => setPaletteOpen(false) }), _jsx(AiAssistant, {})] }));
}
