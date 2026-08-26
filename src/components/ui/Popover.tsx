import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

export function useDismissable(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function Popover({
  trigger,
  label,
  children,
  align = 'right',
  badge,
  triggerClassName,
  width = 'w-80',
}: {
  trigger: ReactNode;
  label: string;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  badge?: number;
  triggerClassName?: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          triggerClassName ??
            'relative inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border px-2.5 text-[12.5px] transition-colors ' +
              (open ? 'border-brds bg-act text-t1' : 'border-brd bg-card text-t2 shadow-[0_1px_2px_rgba(15,31,56,0.05)] hover:border-brds hover:text-t1'),
        )}
      >
        {trigger}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-acc px-1 text-[9px] font-bold text-accink" aria-hidden>
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={clsx('pop-in absolute top-full z-50 mt-1.5 max-w-[calc(100vw-24px)] rounded-[12px] border border-brd bg-card p-2 shadow-[var(--shadow-pop)]', width, align === 'right' ? 'right-0' : 'left-0')}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
