import { useId, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Info, Minus, SearchX } from 'lucide-react';
import { fmtPpDelta, fmtRelDelta, type Locale } from '@/lib/format';
import type { Delta } from '@/lib/metrics';

/* ---------------- Card ---------------- */

export function Card({ className, children, title, subtitle, right, role }: { className?: string; children: ReactNode; title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; role?: string }) {
  return (
    <section role={role} className={clsx('min-w-0 rounded-[14px] border border-brd bg-card p-[var(--pad-card)]', className)}>
      {(title || right) && (
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="m-0 text-[13.5px] font-semibold leading-tight text-t1">{title}</h2>}
            {subtitle && <p className="m-0 mt-0.5 text-[11.5px] leading-snug text-t3">{subtitle}</p>}
          </div>
          {right && <div className="flex min-w-0 max-w-full items-center gap-2">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------------- Buttons ---------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost'; size?: 'sm' | 'md' };

export function Btn({ variant = 'default', size = 'md', className, ...props }: BtnProps) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'h-7 px-2.5 text-[11.5px]' : 'h-8.5 px-3 text-[12.5px]',
        variant === 'primary' && 'bg-acc text-accink hover:brightness-95 font-semibold',
        variant === 'default' && 'border border-brd bg-card2 text-t1 hover:border-brds hover:bg-act',
        variant === 'ghost' && 'text-t2 hover:bg-hov hover:text-t1',
        className,
      )}
    />
  );
}

/* ---------------- Badge ---------------- */

export type BadgeTone = 'pos' | 'neg' | 'warn' | 'info' | 'neutral' | 'accent';

const badgeTones: Record<BadgeTone, string> = {
  pos: 'bg-possoft text-pos border-pos/25',
  neg: 'bg-negsoft text-neg border-neg/25',
  warn: 'bg-warnsoft text-warn border-warn/25',
  info: 'bg-infosoft text-info border-info/25',
  neutral: 'bg-hov text-t2 border-brd',
  accent: 'bg-accsoft text-acctext border-accbrd',
};

export function Badge({ tone = 'neutral', children, className, title }: { tone?: BadgeTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx('mono inline-flex items-center gap-1 whitespace-nowrap rounded-[6px] border px-1.5 py-0.5 text-[9.5px] tracking-[0.05em]', badgeTones[tone], className)}>
      {children}
    </span>
  );
}

/* ---------------- Delta indicator (never colour-only: arrow + sign) ---------------- */

export function DeltaTag({ delta, lang, label, className }: { delta: Delta; lang: Locale; label?: string; className?: string }) {
  const { value, kind, sentiment } = delta;
  const text = value === null ? '—' : kind === 'pp' ? fmtPpDelta(value, lang) : fmtRelDelta(value, lang);
  const Icon = value === null || value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={clsx('mono inline-flex items-center gap-0.5 text-[11px] tnum', sentiment === 1 ? 'text-pos' : sentiment === -1 ? 'text-neg' : 'text-t3', className)}
      aria-label={label ? `${label}: ${text}` : undefined}
    >
      <Icon size={12} aria-hidden />
      {text}
    </span>
  );
}

/* ---------------- Info tooltip ---------------- */

export function InfoTip({ text, className }: { text: string; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className={clsx('relative inline-flex', className)}>
      <button
        type="button"
        aria-label="Definition"
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-t3 hover:text-t1"
      >
        <Info size={12} aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="pop-in absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded-[9px] border border-brds bg-card2 p-2.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-t2 shadow-[var(--shadow-pop)]"
        >
          {text}
        </span>
      )}
    </span>
  );
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string>({ options, value, onChange, ariaLabel, size = 'md' }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex max-w-full overflow-x-auto rounded-[9px] border border-brd bg-inset p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          type="button"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={clsx(
            'mono whitespace-nowrap rounded-[7px] transition-colors duration-150',
            size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10.5px]',
            value === o.id ? 'bg-card2 text-t1 shadow-[inset_0_0_0_1px_var(--border-strong)]' : 'text-t3 hover:text-t2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- States ---------------- */

export function EmptyState({ title, body, icon }: { title: string; body: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="text-t3">{icon ?? <SearchX size={22} aria-hidden />}</div>
      <p className="m-0 text-[13px] font-medium text-t1">{title}</p>
      <p className="m-0 max-w-72 text-[11.5px] text-t3">{body}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

/* ---------------- Thin progress bar ---------------- */

export function MiniBar({ pct, color, className, track = true }: { pct: number; color?: string; className?: string; track?: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={clsx('h-[5px] min-w-10 flex-1 overflow-hidden rounded-full', track && 'bg-hov', className)} aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: color ?? 'var(--accent)' }} />
    </div>
  );
}

/* ---------------- Demo data marker ---------------- */

export function DemoTag({ label, tip }: { label: string; tip: string }) {
  return (
    <span title={tip} className="mono inline-flex cursor-help items-center gap-1.5 rounded-[6px] border border-brd px-1.5 py-0.5 text-[9px] tracking-[0.12em] text-t3">
      <span className="h-1.5 w-1.5 rounded-full bg-acc" aria-hidden />
      {label}
    </span>
  );
}
