import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'info';
}

const Ctx = createContext<{ toast: (message: string, kind?: Toast['kind']) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pop-in flex items-center gap-2.5 rounded-[10px] border border-brds bg-card2 py-2.5 pl-3 pr-2 text-[12.5px] text-t1 shadow-[var(--shadow-pop)]">
            {t.kind === 'success' ? <CheckCircle2 size={15} className="shrink-0 text-pos" /> : <Info size={15} className="shrink-0 text-info" />}
            <span>{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-1 rounded p-1 text-t3 hover:bg-hov hover:text-t1"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
