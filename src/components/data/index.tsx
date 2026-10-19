/** Data-integrity UI: mode badges, freshness, caveat notes, metric definitions. */
import clsx from 'clsx';
import { AlertCircle, Database, FilterX } from 'lucide-react';
import type { DataMode, MetricResultMeta, ResultNote } from '@shared/filters';
import { getMetric, SOURCE_LABELS, type SourceKey } from '@shared/metrics';
import { useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatDate, formatDateTime } from '@/lib/format';
import { Badge, InfoTip } from '@/components/ui';

export function DataModeBadge({ mode, className }: { mode: DataMode | string | null | undefined; className?: string }) {
  const { t } = useI18n();
  if (!mode) return null;
  if (mode === 'demo')
    return (
      <Badge tone="warn" className={clsx('tracking-wide', className)} title={t('common.demoBanner')}>
        {t('common.demoData')}
      </Badge>
    );
  if (mode === 'partial')
    return (
      <Badge tone="info" className={className}>
        {t('common.modePartial')}
      </Badge>
    );
  if (mode === 'unavailable')
    return (
      <Badge tone="neutral" className={className}>
        {t('common.modeUnavailable')}
      </Badge>
    );
  return (
    <Badge tone="pos" className={className}>
      {t('common.modeConnected')}
    </Badge>
  );
}

export function useMetricLabel() {
  const meta = useMeta();
  const { L } = useI18n();
  return (id: string) => {
    const o = meta.data?.metricOverrides[id]?.label;
    if (o && (o.en || o.fr)) return L({ en: o.en || o.fr, fr: o.fr || o.en });
    const def = getMetric(id);
    return def ? L(def.label) : id;
  };
}

export function useMetricDefinition() {
  const meta = useMeta();
  const { L } = useI18n();
  return (id: string) => {
    const o = meta.data?.metricOverrides[id]?.definition;
    if (o && (o.en || o.fr)) return L({ en: o.en || o.fr, fr: o.fr || o.en });
    const def = getMetric(id);
    return def ? L(def.description) : '';
  };
}

export function noteText(n: ResultNote, t: (k: string, p?: Record<string, string | number>) => string, lang: 'en' | 'fr'): string {
  const p = n.params ?? {};
  const d = (x: unknown) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? formatDate(x, lang) : String(x ?? ''));
  switch (n.code) {
    case 'coverage_clipped':
      return t('common.coverageClipped', { from: d(p.from), to: d(p.to) });
    case 'missing_days':
      return t('common.missingDays', { entities: String(p.entities), days: Number(p.days), from: d(p.from), to: d(p.to) });
    case 'users_approx':
      return t('common.usersApprox');
    case 'compare_incomplete':
      return t('common.compareIncomplete');
    case 'sample_only':
      return `${t('common.sampleOnly')}${p.measurements ? ` (n = ${p.measurements})` : p.keywords ? ` (${p.keywords})` : ''}`;
    case 'definition_differs':
      return t('common.definitionDiffers');
    case 'groupby_unsupported':
      return t('common.groupbyUnsupported');
    case 'no_data':
      return t('common.noData');
    case 'unavailable':
      return `${t('common.unavailable')}${p.reason ? ` (${String(p.reason).replace(/_/g, ' ')})` : ''}`;
    default:
      return n.code;
  }
}

/** Compact caveat indicators for a metric result: ignored filters and notes. */
export function ResultNotes({ meta, compact }: { meta: MetricResultMeta | undefined; compact?: boolean }) {
  const { t, lang } = useI18n();
  if (!meta) return null;
  const filterLabel = (k: string) => t(`filters.dim_${k}`);
  const notes = meta.notes.filter((n) => n.code !== 'users_approx' || !compact);
  return (
    <span className="inline-flex items-center gap-1">
      {meta.ignoredFilters.length > 0 && (
        <InfoTip
          label={t('common.filtersNotAppliedTitle')}
          icon={<FilterX className="size-3.5 text-warn" aria-hidden />}
          content={
            <span>
              <strong className="block">{t('common.filtersNotAppliedTitle')}</strong>
              {t('common.filtersNotApplied', { filters: meta.ignoredFilters.map(filterLabel).join(', ') })}
            </span>
          }
        />
      )}
      {notes.length > 0 && (
        <InfoTip
          label={notes.map((n) => noteText(n, t, lang)).join('. ')}
          icon={<AlertCircle className="size-3.5 text-info" aria-hidden />}
          content={
            <ul className="list-disc space-y-1 pl-4">
              {notes.map((n, i) => (
                <li key={i}>{noteText(n, t, lang)}</li>
              ))}
            </ul>
          }
        />
      )}
    </span>
  );
}

/** Definition tooltip: definition, sources, data mode, freshness, coverage. */
export function MetricInfo({ metric, meta }: { metric: string; meta?: MetricResultMeta }) {
  const { t, lang } = useI18n();
  const label = useMetricLabel()(metric);
  const definition = useMetricDefinition()(metric);
  const def = getMetric(metric);
  return (
    <InfoTip
      label={`${t('common.definition')}: ${label}`}
      content={
        <span className="flex flex-col gap-1.5">
          <strong>{label}</strong>
          <span className="text-t2">{definition}</span>
          {def && (
            <span className="flex items-center gap-1 text-[12px] text-t2">
              <Database className="size-3" aria-hidden /> {def.sources.map((s) => SOURCE_LABELS[s as SourceKey]).join(', ')}
            </span>
          )}
          {meta && (
            <span className="text-[12px] text-t3">
              {meta.mode === 'demo' ? t('common.demoData') : meta.mode} · {meta.coverageEnd ? t('common.asOf', { date: formatDate(meta.coverageEnd, lang) }) : ''}
              {meta.freshness ? ` · ${t('common.updated', { when: formatDateTime(meta.freshness, lang) })}` : ''}
            </span>
          )}
        </span>
      }
    />
  );
}

export function SourceLine({ meta, sources }: { meta?: MetricResultMeta | null; sources?: string[] }) {
  const { t, lang } = useI18n();
  const srcs = sources ?? meta?.sources ?? [];
  return (
    <p className="text-[11.5px] text-t3">
      {srcs.map((s) => SOURCE_LABELS[s as SourceKey] ?? s).join(' · ')}
      {meta?.range ? ` · ${formatDate(meta.range.from, lang, 'short')} – ${formatDate(meta.range.to, lang)}` : ''}
      {meta?.mode === 'demo' ? ` · ${t('common.synthetic')}` : ''}
    </p>
  );
}
