import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createElement as h, useId, useState } from 'react';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Info, Minus, SearchX } from 'lucide-react';
import { fmtPpDelta, fmtRankDelta, fmtRelDelta } from '/src/lib/format.js';
/* ---------------- Card ---------------- */
export function Card({ id, className, children, title, subtitle, right, role }) {
    return (_jsxs("section", { id: id, role: role, className: clsx('scroll-mt-28 surface-card min-w-0 rounded-[6px] border border-brds bg-card p-[var(--pad-card)]', className), children: [(title || right) && (_jsxs("div", { className: "mb-3.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2", children: [_jsxs("div", { className: "min-w-0", children: [title && _jsx("h2", { className: "m-0 text-[15px] font-semibold leading-tight text-t1", children: title }), subtitle && _jsx("p", { className: "m-0 mt-0.5 text-[12px] leading-relaxed text-t3", children: subtitle })] }), right && _jsx("div", { className: "flex min-w-0 max-w-full items-center gap-2", children: right })] })), children] }));
}
export function Btn({ variant = 'default', size = 'md', className, ...props }) {
    return (_jsx("button", { type: "button", ...props, className: clsx('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45', size === 'sm' ? 'h-8 px-3 text-[11.5px]' : 'h-10 px-3.5 text-[12.5px]', variant === 'primary' && 'rounded-full border border-acc bg-acc text-accink hover:bg-card hover:text-acc font-semibold', variant === 'default' && 'border border-brds bg-card text-t1 hover:border-t1 hover:bg-card', variant === 'ghost' && 'text-t2 hover:bg-hov hover:text-t1', className) }));
}
const badgeTones = {
    pos: 'bg-possoft text-pos border-pos/25',
    neg: 'bg-negsoft text-neg border-neg/25',
    warn: 'bg-warnsoft text-warn border-warn/25',
    info: 'bg-infosoft text-info border-info/25',
    neutral: 'bg-hov text-t2 border-brd',
    accent: 'bg-accsoft text-acctext border-accbrd',
};
export function Badge({ tone = 'neutral', children, className, title }) {
    return (_jsx("span", { title: title, className: clsx('mono inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] border px-2 py-0.5 text-[10.5px] tracking-[0.05em]', badgeTones[tone], className), children: children }));
}
/* ---------------- Delta indicator (never colour-only: arrow + sign) ---------------- */
export function DeltaTag({ delta, lang, label, className }) {
    const { value, kind, sentiment } = delta;
    const text = value === null ? '—' : kind === 'pp' ? fmtPpDelta(value, lang) : kind === 'rank' ? fmtRankDelta(value, lang) : fmtRelDelta(value, lang);
    const Icon = value === null || value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
    return (_jsxs("span", { className: clsx('mono inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] tnum', sentiment === 1 ? 'text-pos' : sentiment === -1 ? 'text-neg' : 'text-t3', className), "aria-label": label ? `${label}: ${text}` : undefined, children: [_jsx(Icon, { size: 12, "aria-hidden": true }), text] }));
}
/* ---------------- Info tooltip ---------------- */
export function InfoTip({ text, className }) {
    const id = useId();
    const [open, setOpen] = useState(false);
    return (_jsxs("span", { className: clsx('relative inline-flex', className), children: [_jsx("button", { type: "button", "aria-label": "Definition", "aria-describedby": open ? id : undefined, onFocus: () => setOpen(true), onBlur: () => setOpen(false), onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false), className: "inline-flex h-6 w-6 items-center justify-center rounded-full text-t3 hover:bg-hov hover:text-t1", children: _jsx(Info, { size: 12, "aria-hidden": true }) }), open && (_jsx("span", { id: id, role: "tooltip", className: "pop-in absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded-[6px] border border-brds bg-card p-2.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-t2 shadow-[var(--shadow-pop)]", children: text }))] }));
}
/* ---------------- Segmented control ---------------- */
export function Segmented({ options, value, onChange, ariaLabel, size = 'md' }) {
    return (_jsx("div", { role: "group", "aria-label": ariaLabel, className: "inline-flex max-w-full overflow-x-auto rounded-[6px] border border-brd bg-inset p-0.5", children: options.map((o) => (_jsx("button", { type: "button", "aria-pressed": value === o.id, onClick: () => onChange(o.id), className: clsx('mono whitespace-nowrap rounded-[4px] transition-colors duration-150', size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[10.5px]', value === o.id ? 'bg-card2 text-t1 shadow-[inset_0_0_0_1px_var(--border-strong)]' : 'text-t3 hover:text-t2'), children: o.label }, o.id))) }));
}
/* ---------------- States ---------------- */
export function EmptyState({ title, body, icon }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-2 py-10 text-center", children: [_jsx("div", { className: "text-t3", children: icon ?? _jsx(SearchX, { size: 22, "aria-hidden": true }) }), _jsx("p", { className: "m-0 text-[13px] font-medium text-t1", children: title }), _jsx("p", { className: "m-0 max-w-72 text-[11.5px] text-t3", children: body })] }));
}
export function Skeleton({ className }) {
    return _jsx("div", { className: clsx('skeleton', className), "aria-hidden": true });
}
/* ---------------- Thin progress bar ---------------- */
export function MiniBar({ pct, color, className, track = true }) {
    const clamped = Math.max(0, Math.min(100, pct));
    return (_jsx("div", { className: clsx('h-[5px] min-w-10 flex-1 overflow-hidden rounded-full', track && 'bg-hov', className), "aria-hidden": true, children: _jsx("div", { className: "h-full rounded-full", style: { width: `${clamped}%`, background: color ?? 'var(--accent)' } }) }));
}
/* ---------------- Analytical section ----------------
 * Every analytical page is built from the same five questions:
 *   1 What is happening · 2 How is it evolving · 3 Where is it happening
 *   4 Why is it happening · 5 What should we do
 * PageSection renders one of those steps with a consistent heading, so the
 * hierarchy reads the same way on every page. */
export function SectionHeading({ step, title, description, right, className }) {
    return h('div', { className: clsx('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className) },
        h('div', { className: 'min-w-0' },
            h('div', { className: 'flex items-center gap-2' }, step
                ? h('span', { 'aria-hidden': true, className: 'inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-[4px] border border-brd bg-inset px-1 text-[10px] font-bold text-t3 tnum' }, step)
                : null, h('h2', { className: 'm-0 text-[15px] font-semibold leading-tight text-t1' }, title)),
            description ? h('p', { className: 'm-0 mt-1 max-w-3xl text-[12px] leading-5 text-t3' }, description) : null),
        right ? h('div', { className: 'flex shrink-0 flex-wrap items-center gap-2' }, right) : null);
}
export function PageSection({ id, step, title, description, right, children, className }) {
    return h('section', { id, className: clsx('scroll-mt-28 flex min-w-0 flex-col gap-[var(--gap-grid)]', className) },
        h(SectionHeading, { step, title, description, right }), children);
}
/* ---------------- Progressive disclosure ----------------
 * Secondary analysis that only some roles need stays collapsed, so the page
 * above the fold answers the common question first. */
export function Disclosure({ id, title, description, children, defaultOpen = false, badge }) {
    return h('details', { id, className: 'group surface-card min-w-0 scroll-mt-28 rounded-[6px] border border-brds bg-card', open: defaultOpen },
        h('summary', { className: 'flex cursor-pointer list-none items-center justify-between gap-3 px-[var(--pad-card)] py-3.5 marker:hidden [&::-webkit-details-marker]:hidden' },
            h('span', { className: 'min-w-0' },
                h('span', { className: 'flex flex-wrap items-center gap-2' },
                    h('span', { className: 'text-[15px] font-semibold leading-tight text-t1' }, title),
                    badge ? h(Badge, { tone: 'neutral' }, badge) : null),
                description ? h('span', { className: 'mt-0.5 block text-[12px] leading-relaxed text-t3' }, description) : null),
            h(ChevronDown, { size: 17, 'aria-hidden': true, className: 'shrink-0 text-t3 transition-transform duration-150 group-open:rotate-180' })),
        h('div', { className: 'border-t border-brd px-[var(--pad-card)] pb-[var(--pad-card)] pt-4' }, children));
}
/* ---------------- Compact stat tile ----------------
 * For dense supporting numbers that do not warrant a full KPI card. */
export function StatTile({ label, value, hint, tone }) {
    return h('div', { className: 'min-w-0 rounded-[6px] border border-brd bg-card2 px-3 py-2.5' }, h('div', { className: 'truncate text-[10.5px] font-semibold text-t3', title: label }, label), h('div', { className: clsx('mt-1 text-[17px] font-bold leading-none tnum', tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : tone === 'warn' ? 'text-warn' : 'text-t1') }, value), hint ? h('div', { className: 'mt-1 truncate text-[10px] text-t3', title: hint }, hint) : null);
}
/* ---------------- Sample-data marker ---------------- */
export function DemoTag({ label, tip }) {
    return (_jsxs("span", { title: tip, className: "mono inline-flex cursor-help items-center gap-1.5 rounded-[6px] border border-brd px-1.5 py-0.5 text-[10.5px] tracking-[0.12em] text-t3", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-acc", "aria-hidden": true }), label] }));
}
