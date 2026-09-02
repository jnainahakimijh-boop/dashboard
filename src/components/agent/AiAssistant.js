import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { askPerformanceAgent } from '/src/lib/agent.js';
import { hasLiveAgent } from '/src/config/runtime.js';
export function AiAssistant() {
    const { filters } = useFilters();
    const { lang } = useI18n();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [messages, setMessages] = useState(() => [{
            id: 'welcome',
            role: 'assistant',
            text: lang === 'fr'
                ? "Bonjour. Je peux expliquer les KPIs, résumer les changements, comparer les canaux et proposer les priorités selon les filtres actifs."
                : 'Hi. I can explain KPIs, summarise changes, compare channels and suggest priorities using the filters currently applied.',
        }]);
    const triggerRef = useRef(null);
    const inputRef = useRef(null);
    const endRef = useRef(null);
    const dialogTitleId = useId();
    useEffect(() => {
        setMessages((current) => current.length === 1 && current[0]?.id === 'welcome'
            ? [{
                    id: 'welcome',
                    role: 'assistant',
                    text: lang === 'fr'
                        ? "Bonjour. Je peux expliquer les KPIs, résumer les changements, comparer les canaux et proposer les priorités selon les filtres actifs."
                        : 'Hi. I can explain KPIs, summarise changes, compare channels and suggest priorities using the filters currently applied.',
                }]
            : current);
    }, [lang]);
    const suggestions = lang === 'fr'
        ? ["Qu'est-ce qui a changé ?", 'Quel est le meilleur canal ?', 'Que faut-il prioriser ?', 'Quelle est la qualité des données ?']
        : ['What changed?', 'Which channel performs best?', 'What should we prioritise?', 'How is data quality?'];
    useEffect(() => {
        if (!open)
            return;
        const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                window.setTimeout(() => triggerRef.current?.focus(), 0);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => { window.clearTimeout(timer); document.removeEventListener('keydown', onKey); };
    }, [open]);
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'nearest' });
    }, [messages, busy]);
    const submit = async (raw) => {
        const question = raw.trim();
        if (!question || busy)
            return;
        const userMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
        setMessages((m) => [...m, userMessage]);
        setInput('');
        setBusy(true);
        try {
            const answer = await askPerformanceAgent(question, filters, lang, pathname);
            setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: answer.text }]);
        }
        finally {
            setBusy(false);
            window.setTimeout(() => inputRef.current?.focus(), 0);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("button", { ref: triggerRef, type: "button", onClick: () => setOpen((v) => !v), "aria-expanded": open, "aria-controls": "dp-ai-agent", "aria-label": lang === 'fr' ? "Ouvrir l'agent Digital Performance" : 'Open Veolia Digital Performance agent', className: "no-print fixed bottom-5 right-5 z-40 inline-flex h-14 min-w-14 items-center justify-center gap-2 rounded-full border border-acc bg-acc px-4 text-[12.5px] font-bold text-white shadow-[0_8px_24px_rgba(9,8,22,.15)] transition-colors hover:bg-card hover:text-acc", children: [open ? _jsx(X, { size: 20, "aria-hidden": true }) : _jsx(MessageCircle, { size: 20, "aria-hidden": true }), _jsx("span", { className: "hidden sm:inline", children: lang === 'fr' ? 'Demander à l’agent' : 'Ask the agent' })] }), open && (_jsxs("section", { id: "dp-ai-agent", role: "dialog", "aria-labelledby": dialogTitleId, className: "no-print fixed bottom-[88px] right-3 z-40 flex max-h-[min(650px,calc(100vh-112px))] w-[min(410px,calc(100vw-24px))] flex-col overflow-hidden rounded-[12px] border border-brds bg-card shadow-[var(--shadow-pop)] sm:right-5", children: [_jsxs("header", { className: "flex items-center gap-3 border-b border-brd bg-card px-4 py-3.5", children: [_jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] bg-acc text-white", "aria-hidden": true, children: _jsx(Sparkles, { size: 18 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h2", { id: dialogTitleId, className: "m-0 text-[14px] font-semibold text-t1", children: "Veolia Digital Performance Agent" }), _jsxs("p", { className: "m-0 mt-0.5 flex items-center gap-1.5 text-[11px] text-t3", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-pos", "aria-hidden": true }), hasLiveAgent
                                                ? (lang === 'fr' ? 'IA connectée · utilise les filtres actifs' : 'Connected AI · uses active filters')
                                                : (lang === 'fr' ? 'Mode analytique local · prêt pour connexion IA' : 'Local analytics mode · AI endpoint ready')] })] }), _jsx("button", { type: "button", onClick: () => { setOpen(false); window.setTimeout(() => triggerRef.current?.focus(), 0); }, "aria-label": lang === 'fr' ? 'Fermer' : 'Close', className: "inline-flex h-10 w-10 items-center justify-center rounded-[6px] text-t3 hover:bg-hov hover:text-t1", children: _jsx(X, { size: 18, "aria-hidden": true }) })] }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto bg-card2/55 px-3 py-4", "aria-live": "polite", "aria-relevant": "additions", children: _jsxs("div", { className: "space-y-3", children: [messages.map((m) => (_jsx("div", { className: m.role === 'user' ? 'flex justify-end' : 'flex justify-start', children: _jsxs("div", { className: m.role === 'user'
                                            ? 'max-w-[86%] rounded-[12px_12px_4px_12px] bg-[#002d62] px-3.5 py-2.5 text-[12.5px] leading-5 text-white'
                                            : 'max-w-[92%] rounded-[12px_12px_12px_4px] border border-brd bg-card px-3.5 py-2.5 text-[12.5px] leading-5 text-t1', children: [m.role === 'assistant' && _jsxs("span", { className: "mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-acctext", children: [_jsx(Bot, { size: 12, "aria-hidden": true }), "Agent"] }), _jsx("span", { className: "whitespace-pre-wrap", children: m.text })] }) }, m.id))), busy && (_jsx("div", { className: "flex justify-start", role: "status", children: _jsx("div", { className: "rounded-[12px_12px_12px_4px] border border-brd bg-card px-3.5 py-2.5 text-[12px] text-t3", children: lang === 'fr' ? 'Analyse des données filtrées…' : 'Analysing the filtered data…' }) })), _jsx("div", { ref: endRef })] }) }), messages.length <= 1 && (_jsxs("div", { className: "border-t border-brd bg-card px-3 py-2.5", children: [_jsx("div", { className: "mb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-t3", children: lang === 'fr' ? 'Questions rapides' : 'Quick questions' }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: suggestions.map((q) => _jsx("button", { type: "button", onClick: () => void submit(q), className: "min-h-9 rounded-full border border-brd bg-card2 px-2.5 py-1.5 text-left text-[11px] font-medium text-t2 hover:border-accbrd hover:bg-accsoft hover:text-acctext", children: q }, q)) })] })), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); void submit(input); }, className: "border-t border-brd bg-card p-3", children: [_jsx("label", { htmlFor: "dp-agent-question", className: "sr-only", children: lang === 'fr' ? 'Posez une question sur les données' : 'Ask a question about the data' }), _jsxs("div", { className: "flex items-end gap-2", children: [_jsx("input", { ref: inputRef, id: "dp-agent-question", value: input, onChange: (e) => setInput(e.target.value), disabled: busy, autoComplete: "off", placeholder: lang === 'fr' ? 'Ex. Pourquoi les conversions ont baissé ?' : 'e.g. Why did conversions fall?', className: "h-11 min-w-0 flex-1 rounded-[6px] border border-brd bg-inset px-3 text-[16px] text-t1 placeholder:text-t3 sm:text-[13px]" }), _jsx("button", { type: "submit", disabled: busy || !input.trim(), "aria-label": lang === 'fr' ? 'Envoyer' : 'Send', className: "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-acc text-accink disabled:cursor-not-allowed disabled:opacity-40", children: _jsx(Send, { size: 17, "aria-hidden": true }) })] }), _jsx("p", { className: "m-0 mt-2 text-[10.5px] leading-4 text-t3", children: lang === 'fr' ? "Les réponses utilisent la période et les filtres actuellement sélectionnés." : 'Answers use the currently selected date range and filters.' })] })] }))] }));
}
