/** Accessible UI primitives built on the design tokens (src/styles/app.css). */
import clsx from 'clsx';
import { AlertTriangle, Check, ChevronDown, Info, Loader2, Search, X } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/i18n';

/* ---------------- buttons ---------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
type Size = 'sm' | 'md';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-ctl)] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-acc text-accink hover:bg-accs',
        variant === 'secondary' && 'border border-brd bg-card text-t1 hover:border-brds hover:bg-hov',
        variant === 'ghost' && 'text-t2 hover:bg-hov hover:text-t1',
        variant === 'danger' && 'border border-neg/40 bg-card text-neg hover:bg-negsoft',
        variant === 'link' && 'h-auto px-0 text-acctext underline-offset-2 hover:underline',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={clsx('inline-flex size-9 items-center justify-center rounded-[var(--radius-ctl)] text-t2 transition-colors hover:bg-hov hover:text-t1 disabled:opacity-50', className)} {...rest}>
      {children}
    </button>
  );
}

/* ---------------- surfaces ---------------- */

export function Card({ className, children, as: As = 'section', ...rest }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article'; 'aria-labelledby'?: string; id?: string }) {
  return (
    <As className={clsx('min-w-0 rounded-[var(--radius-card)] border border-brd bg-card shadow-[var(--shadow-card)]', className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, subtitle, actions, id, badges }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; id?: string; badges?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-[var(--pad-card)] pt-[var(--pad-card)] pb-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={id} className="text-[15px] font-semibold text-t1">
            {title}
          </h2>
          {badges}
        </div>
        {subtitle && <p className="mt-0.5 text-[13px] text-t2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('px-[var(--pad-card)] pb-[var(--pad-card)]', className)}>{children}</div>;
}

export type Tone = 'neutral' | 'pos' | 'neg' | 'warn' | 'info' | 'accent';
export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap',
        tone === 'neutral' && 'bg-inset text-t2',
        tone === 'pos' && 'bg-possoft text-pos',
        tone === 'neg' && 'bg-negsoft text-neg',
        tone === 'warn' && 'bg-warnsoft text-warn',
        tone === 'info' && 'bg-infosoft text-info',
        tone === 'accent' && 'bg-accsoft text-acctext',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function severityTone(s: string): Tone {
  return s === 'critical' || s === 'high' ? 'neg' : s === 'medium' ? 'warn' : s === 'low' ? 'info' : 'neutral';
}

/* ---------------- states ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-t2">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function EmptyState({ title, hint, icon, action }: { title?: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      {icon && <div className="mb-1 text-t3">{icon}</div>}
      <p className="text-sm font-medium text-t1">{title ?? t('common.noData')}</p>
      <p className="max-w-sm text-[13px] text-t2">{hint ?? t('common.noDataHint')}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <AlertTriangle className="size-5 text-neg" aria-hidden />
      <p className="text-sm font-medium text-t1">{t('common.error')}</p>
      <p className="max-w-md text-[13px] break-words text-t2">{msg}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/* ---------------- popover / tooltip ---------------- */

export function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOut();
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [ref, onOut, active]);
}

export function Popover({ trigger, children, align = 'left', width = 280, label }: { trigger: (p: { open: boolean; toggle: () => void; id: string }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: number; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, close, open);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div id={id} role="dialog" aria-label={label} className={clsx('pop-in absolute z-50 mt-1.5 max-h-[70vh] overflow-auto rounded-xl border border-brd bg-card p-2 shadow-[var(--shadow-pop)]', align === 'right' ? 'right-0' : 'left-0')} style={{ width: `min(${width}px, calc(100vw - 32px))` }}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** Info icon with an accessible tooltip (hover or keyboard focus). */
export function InfoTip({ content, label, className, icon }: { content: ReactNode; label: string; className?: string; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={clsx('relative inline-flex', className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen((o) => !o)} className="inline-flex size-5 items-center justify-center rounded text-t3 hover:text-t1">
        {icon ?? <Info className="size-3.5" aria-hidden />}
      </button>
      {open && (
        <span role="tooltip" id={id} className="pop-in absolute top-6 left-1/2 z-50 w-72 max-w-[80vw] -translate-x-1/2 rounded-lg border border-brd bg-card p-3 text-left text-[12.5px] leading-relaxed font-normal text-t1 shadow-[var(--shadow-pop)]">
          {content}
        </span>
      )}
    </span>
  );
}

/* ---------------- dialogs ---------------- */

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[rgba(8,15,28,0.45)] p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={clsx('pop-in w-full rounded-[var(--radius-card)] border border-brd bg-card shadow-[var(--shadow-pop)]', size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-4xl' : 'max-w-2xl')}>
        <div className="flex items-center justify-between gap-3 border-b border-brd px-5 py-3.5">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} data-close>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-brd px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-[rgba(8,15,28,0.35)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="drawer-in absolute top-0 right-0 flex h-full w-full max-w-[640px] flex-col border-l border-brd bg-card shadow-[var(--shadow-pop)] outline-none">
        <div className="flex items-center justify-between gap-3 border-b border-brd px-5 py-3.5">
          <h2 id={titleId} className="min-w-0 truncate text-base font-semibold">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-brd px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- form controls ---------------- */

const ctl = 'w-full rounded-[var(--radius-ctl)] border border-brd bg-card px-3 text-sm text-t1 placeholder:text-t3 hover:border-brds focus:border-acc disabled:opacity-60';

export function Field({ label, hint, error, children, required, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-t1">
        {label}
        {required && <span className="ml-0.5 text-neg" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[12px] text-t2">{hint}</p>}
      {error && (
        <p role="alert" className="text-[12px] text-neg">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(ctl, 'h-9', className)} {...rest} />;
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(ctl, 'min-h-[84px] py-2', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={clsx(ctl, 'h-9 appearance-none pr-8', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-t3" aria-hidden />
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, description, hideLabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; description?: string; hideLabel?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx('relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-acc' : 'bg-brds')}
      >
        <span className={clsx('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
      </button>
      <label htmlFor={id} className={clsx('text-sm', hideLabel && 'sr-only')}>
        <span className="font-medium text-t1">{label}</span>
        {description && <span className="block text-[12.5px] text-t2">{description}</span>}
      </label>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label: string; size?: Size }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[var(--radius-ctl)] border border-brd bg-inset p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx('rounded-[7px] font-medium transition-colors', size === 'sm' ? 'px-2 py-0.5 text-[12px]' : 'px-2.5 py-1 text-[13px]', value === o.value ? 'bg-card text-t1 shadow-sm' : 'text-t2 hover:text-t1')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, id, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id?: string; disabled?: boolean }) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <label htmlFor={cid} className={clsx('flex items-center gap-2 rounded-md px-1.5 py-1 text-sm', disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-hov')}>
      <span className={clsx('flex size-4 shrink-0 items-center justify-center rounded border', checked ? 'border-acc bg-acc text-white' : 'border-brds bg-card')}>{checked && <Check className="size-3" aria-hidden />}</span>
      <input id={cid} type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

/** Multi-select with search, used by the filter toolbar. */
export function MultiSelect({ label, options, value, onChange, placeholderAll, searchable = true }: { label: string; options: Array<{ value: string; label: string; group?: string }>; value: string[]; onChange: (v: string[]) => void; placeholderAll: string; searchable?: boolean }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase())), [options, q]);
  const summary = value.length === 0 ? placeholderAll : value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? value[0] : t('common.selected', { n: value.length });
  return (
    <Popover
      label={label}
      width={290}
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
          className={clsx('inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-[var(--radius-ctl)] border px-2.5 text-[13px] transition-colors', value.length ? 'border-accbrd bg-accsoft text-t1' : 'border-brd bg-card text-t2 hover:border-brds')}
        >
          <span className="whitespace-nowrap text-t3">
            {label}
            {t('common.colon')}
          </span>
          <span className="truncate font-medium text-t1">{summary}</span>
          <ChevronDown className="size-3.5 shrink-0 text-t3" aria-hidden />
        </button>
      )}
    >
      {() => (
        <div className="flex flex-col gap-1">
          {searchable && options.length > 8 && (
            <div className="relative mb-1">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-t3" aria-hidden />
              <Input aria-label={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} className="h-8 pl-8 text-[13px]" />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto" role="group" aria-label={label}>
            {filtered.map((o, i) => (
              <div key={o.value}>
                {o.group && o.group !== filtered[i - 1]?.group && <p className="eyebrow px-1.5 pt-2 pb-1">{o.group}</p>}
                <Checkbox checked={value.includes(o.value)} onChange={(c) => onChange(c ? [...value, o.value] : value.filter((v) => v !== o.value))} label={o.label} />
              </div>
            ))}
          </div>
          {value.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              {t('common.clear')}
            </Button>
          )}
        </div>
      )}
    </Popover>
  );
}

/* ---------------- tabs ---------------- */

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Array<{ id: T; label: string; badge?: ReactNode }>; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = tabs.length;
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j >= 0) {
      e.preventDefault();
      onChange(tabs[j].id);
      refs.current[tabs[j].id]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto border-b border-brd px-1">
      {tabs.map((tb, i) => (
        <button
          key={tb.id}
          ref={(el) => {
            refs.current[tb.id] = el;
          }}
          role="tab"
          type="button"
          id={`tab-${tb.id}`}
          aria-selected={value === tb.id}
          aria-controls={`panel-${tb.id}`}
          tabIndex={value === tb.id ? 0 : -1}
          onKeyDown={(e) => onKey(e, i)}
          onClick={() => onChange(tb.id)}
          className={clsx('-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors', value === tb.id ? 'border-acc text-t1' : 'border-transparent text-t2 hover:text-t1')}
        >
          {tb.label}
          {tb.badge}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="fade-up pt-5">
      {children}
    </div>
  );
}

/* ---------------- pagination ---------------- */

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 px-1 py-2 text-[13px] text-t2">
      <span>
        {t('common.page')} {page} {t('common.of')} {pages} · {t('common.rows', { n: total })}
      </span>
      <span className="flex gap-1">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t('common.previous')}
        </Button>
        <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t('common.next')}
        </Button>
      </span>
    </nav>
  );
}

/* ---------------- toasts ---------------- */

interface ToastItem {
  id: number;
  text: string;
  tone: 'pos' | 'neg' | 'info';
}
const ToastCtx = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: ToastItem['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[200] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
        {items.map((i) => (
          <div key={i.id} role="status" className={clsx('pop-in pointer-events-auto rounded-lg border bg-card px-4 py-3 text-sm shadow-[var(--shadow-pop)]', i.tone === 'pos' ? 'border-pos/40' : i.tone === 'neg' ? 'border-neg/40' : 'border-brd')}>
            {i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[15px] font-semibold text-t1">{children}</h2>
      {hint && <p className="text-[13px] text-t2">{hint}</p>}
    </div>
  );
}
