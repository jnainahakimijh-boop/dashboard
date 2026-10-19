/** KPI card: value, comparison value, absolute and relative change, direction, sparkline, source, freshness, definition, caveats. */
import clsx from 'clsx';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { CompareMode } from '@shared/calendar';
import type { MetricResult } from '@shared/filters';
import { getMetric, SOURCE_LABELS, type SourceKey } from '@shared/metrics';
import { useI18n } from '@/i18n';
import { formatDelta, formatPct, formatValue, relativeTime } from '@/lib/format';
import { Sparkline } from '@/components/charts';
import { DataModeBadge, MetricInfo, ResultNotes, useMetricLabel } from '@/components/data';
import { Skeleton } from '@/components/ui';

export function changeTone(metric: string, delta: number | null): 'pos' | 'neg' | 'neutral' {
  const def = getMetric(metric);
  if (!def || delta === null || delta === 0 || def.direction === 'neutral') return 'neutral';
  return (def.direction === 'up') === delta > 0 ? 'pos' : 'neg';
}

export function ChangeLabel({ metric, result, compact }: { metric: string; result: Pick<MetricResult, 'delta' | 'deltaPct' | 'compare'>; compact?: boolean }) {
  const { t, lang } = useI18n();
  const def = getMetric(metric);
  if (!def || result.delta === null) return <span className="text-[12.5px] text-t3">—</span>;
  const main = def.deltaPct && result.deltaPct !== null ? formatPct(result.deltaPct, lang) : formatDelta(result.delta, def.unit, lang);
  // a change that rounds to zero at display precision is shown as flat, not as good or bad
  const flat = /^[+−±-]?0([.,]0+)?\s*(%|pts?|pt)?$/.test(main.replace(/\u202f|\u00a0/g, ' ').trim());
  const tone = flat ? 'neutral' : changeTone(metric, result.delta);
  const Icon = flat ? ArrowRight : result.delta > 0 ? ArrowUpRight : result.delta < 0 ? ArrowDownRight : ArrowRight;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-[12.5px] font-semibold tnum', tone === 'pos' && 'text-pos', tone === 'neg' && 'text-neg', tone === 'neutral' && 'text-t2')}>
      <Icon className="size-3.5" aria-hidden />
      {main}
      <span className="sr-only"> ({t(tone === 'pos' ? 'common.goodChange' : tone === 'neg' ? 'common.badChange' : 'common.neutralChange')})</span>
      {!compact && def.deltaPct && <span className="ml-1 font-normal text-t3">({formatDelta(result.delta, def.unit, lang)})</span>}
    </span>
  );
}

export function KpiCard({ result, compare, loading, target, onClick }: { result?: MetricResult; compare: CompareMode; loading?: boolean; target?: { value: number; periodLabel: string } | null; onClick?: () => void }) {
  const { t, lang } = useI18n();
  const labelOf = useMetricLabel();
  if (loading || !result)
    return (
      <div className="rounded-[var(--radius-card)] border border-brd bg-card p-4 shadow-[var(--shadow-card)]">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-8 w-24" />
        <Skeleton className="mt-3 h-8 w-full" />
      </div>
    );
  const def = getMetric(result.metric)!;
  const label = labelOf(result.metric);
  const unavailable = result.meta.mode === 'unavailable' || result.value === null;
  const progress = target && result.value !== null && target.value ? result.value / target.value : null;
  return (
    <article className={clsx('flex min-w-0 flex-col rounded-[var(--radius-card)] border border-brd bg-card p-4 shadow-[var(--shadow-card)]', onClick && 'cursor-pointer transition-colors hover:border-brds')} aria-label={label} onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-0.5 text-[13px] leading-snug font-medium text-t2">
          <span className="line-clamp-2">{label}</span>
          <MetricInfo metric={result.metric} meta={result.meta} />
        </h3>
        <span className="flex shrink-0 items-center gap-1">
          <ResultNotes meta={result.meta} compact />
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="tnum text-[26px] leading-tight font-semibold tracking-tight text-t1">{unavailable ? '—' : formatValue(result.value, def.unit, lang, { compact: true })}</p>
        {!unavailable && compare !== 'none' && <ChangeLabel metric={result.metric} result={result} compact />}
      </div>
      <p className="mt-0.5 min-h-[18px] text-[12px] text-t3 tnum">
        {unavailable
          ? t('common.unavailable')
          : compare === 'none'
            ? t('common.noComparison')
            : result.compare === null
              ? t('common.compareIncomplete')
              : `${formatValue(result.compare, def.unit, lang, { compact: true })} ${t(compare === 'yoy' ? 'common.vsYoy' : 'common.vsPrevious')} · ${formatDelta(result.delta, def.unit, lang)}`}
      </p>
      {result.series && result.series.length > 1 && (
        <div className="mt-2">
          <Sparkline values={result.series.map((p) => p.value)} slot={0} height={30} />
        </div>
      )}
      {progress !== null && (
        <div className="mt-2">
          <div className="flex justify-between text-[11.5px] text-t3">
            <span>
              {t('common.target')} {formatValue(target!.value, def.unit, lang, { compact: true })} · {target!.periodLabel}
            </span>
            <span className="tnum">{t('common.targetProgress', { pct: formatPct(progress, lang, false) })}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-inset" aria-hidden>
            <div className="h-full rounded-full bg-[var(--ch-1)]" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <p className="min-w-0 truncate text-[11px] text-t3">
          {def.sources.map((s) => SOURCE_LABELS[s as SourceKey]).join(' · ')}
          {result.meta.freshness && result.meta.mode !== 'demo' ? ` · ${relativeTime(result.meta.freshness, lang)}` : ''}
        </p>
        {result.meta.mode !== 'connected' && <DataModeBadge mode={result.meta.mode} className="shrink-0 !text-[10.5px]" />}
      </div>
    </article>
  );
}
