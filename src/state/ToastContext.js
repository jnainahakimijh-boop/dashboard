import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
const Ctx = createContext(null);
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const nextId = useRef(1);
    const toast = useCallback((message, kind = 'success') => {
        const id = nextId.current++;
        setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
        window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
    }, []);
    const value = useMemo(() => ({ toast }), [toast]);
    return (_jsxs(Ctx.Provider, { value: value, children: [children, _jsx("div", { "aria-live": "polite", className: "fixed bottom-5 right-5 z-[100] flex flex-col gap-2", children: toasts.map((t) => (_jsxs("div", { className: "pop-in flex items-center gap-2.5 rounded-[6px] border border-brds bg-card2 py-2.5 pl-3 pr-2 text-[12.5px] text-t1 shadow-[var(--shadow-pop)]", children: [t.kind === 'success' ? _jsx(CheckCircle2, { size: 15, className: "shrink-0 text-pos" }) : t.kind === 'error' ? _jsx(AlertCircle, { size: 15, className: "shrink-0 text-neg" }) : _jsx(Info, { size: 15, className: "shrink-0 text-info" }), _jsx("span", { children: t.message }), _jsx("button", { type: "button", "aria-label": "Dismiss", onClick: () => setToasts((prev) => prev.filter((x) => x.id !== t.id)), className: "ml-1 rounded p-1 text-t3 hover:bg-hov hover:text-t1", children: _jsx(X, { size: 13 }) })] }, t.id))) })] }));
}
export function useToast() {
    const ctx = useContext(Ctx);
    if (!ctx)
        throw new Error('useToast outside ToastProvider');
    return ctx;
}
