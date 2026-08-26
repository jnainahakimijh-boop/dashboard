import { useId, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Info, Minus, SearchX } from 'lucide-react';
import { fmtPpDelta, fmtRelDelta, type Locale } from '@/lib/format';
import type { Delta } from '@/lib/metrics';

/* ---------------- Card ---------------- */

export function Card({ className, children, title, subtitle, right, role }: { className?: string; children: ReactNode; title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; role?: string }) {
  return (
    <section role={role} className={clsx('min-w-0 rounded-[14px] border border-brd bg-card p-[var(--pad-card)] shadow-[var(--shadow-card)]', className)}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="m-0 text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-t1">{title}</h2>}
            {subtitle && <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-t3">{subtitle}</p>}
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
        size === 'sm' ? 'h-8 px-3 text-[12.5px]' : 'h-9 px-3.5 text-[13px]',
        variant === 'primary' && 'bg-acc font-semibold text-accink shadow-[0_1px_2px_rgba(225,29,46,0.3)] hover:bg-accs',
        variant === 'default' && 'border border-brd bg-card text-t1 shadow-[0_1px_2px_rgba(15,31,56,0.05)] hover:border-brds hover:bg-card2',
        variant === 'ghost' && 'text-t2 hover:bg-hov hover:text-t1',
        className,
      )}
    />
  );
}

/* ---------------- Badge ---------------- */

export type BadgeTone = 'pos' | 'neg' | 'warn' | 'info' | 'neutral' | 'accent';

const badgeTones: Record<BadgeTone, string> = {
  pos: 'bg-possoft text-pos border-pos/20',
  neg: 'bg-negsoft text-neg border-neg/20',
  warn: 'bg-warnsoft text-warn border-warn/20',
  info: 'bg-infosoft text-info border-info/20',
  neutral: 'bg-hov text-t2 border-brd',
  accent: 'bg-accsoft text-acctext border-accbrd',
};

export function Badge({ tone = 'neutral', children, className, title }: { tone?: BadgeTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-[7px] border px-2 py-[3px] text-[10.5px] font-semibold tracking-[0.03em]', badgeTones[tone], className)}>
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
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-[7px] px-1.5 py-0.5 text-[12px] font-semibold tnum',
        sentiment === 1 ? 'bg-possoft text-pos' : sentiment === -1 ? 'bg-negsoft text-neg' : 'bg-hov text-t3',
        className,
      )}
      aria-label={label ? `${label}: ${text}` : undefined}
    >
      <Icon size={13} aria-hidden />
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
        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full text-t3 hover:text-t1"
      >
        <Info size={13} aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="pop-in absolute left-1/2 top-full z-50 mt-1.5 w-60 -translate-x-1/2 rounded-[10px] border border-brd bg-card p-3 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-t2 shadow-[var(--shadow-pop)]"
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
            'whitespace-nowrap rounded-[7px] font-medium transition-colors duration-150',
            size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[12.5px]',
            value === o.id ? 'bg-card text-t1 shadow-[0_1px_2px_rgba(15,31,56,0.1),inset_0_0_0_1px_var(--border)]' : 'text-t3 hover:text-t1',
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
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-inset text-t3">{icon ?? <SearchX size={20} aria-hidden />}</div>
      <p className="m-0 text-[14px] font-semibold text-t1">{title}</p>
      <p className="m-0 max-w-80 text-[12.5px] leading-relaxed text-t3">{body}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

/* ---------------- Thin progress bar ---------------- */

export function MiniBar({ pct, color, className, track = true, height = 6 }: { pct: number; color?: string; className?: string; track?: boolean; height?: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={clsx('min-w-10 flex-1 overflow-hidden rounded-full', track && 'bg-inset', className)} style={{ height }} aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: color ?? 'var(--ch-1)' }} />
    </div>
  );
}

/* ---------------- Demo data marker ---------------- */

export function DemoTag({ label, tip, onDark = false }: { label: string; tip: string; onDark?: boolean }) {
  return (
    <span
      title={tip}
      className={clsx(
        'mono inline-flex cursor-help items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-[10px] tracking-[0.1em]',
        onDark ? 'border-sbrd text-st3' : 'border-brd text-t3',
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-acc" aria-hidden />
      {label}
    </span>
  );
}
