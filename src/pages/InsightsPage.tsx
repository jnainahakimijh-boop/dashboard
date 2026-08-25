import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Flag, Info } from 'lucide-react';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { toQ } from '@/lib/aggregate';
import { computeInsights, type InsightCategory } from '@/lib/insights';
import { Badge, Card, EmptyState, type BadgeTone } from '@/components/ui/primitives';
import type { MsgKey } from '@/i18n/messages';

const CAT_TONE: Record<InsightCategory, BadgeTone> = {
  growth: 'pos',
  risk: 'neg',
  opportunity: 'accent',
  anomaly: 'warn',
  dataQuality: 'info',
  content: 'accent',
  conversion: 'neg',
};

const CAT_KEY: Record<InsightCategory, MsgKey> = {
  growth: 'ins.cat.growth',
  risk: 'ins.cat.risk',
  opportunity: 'ins.cat.opportunity',
  anomaly: 'ins.cat.anomaly',
  dataQuality: 'ins.cat.dataQuality',
  content: 'ins.cat.content',
  conversion: 'ins.cat.conversion',
};

const LEVEL_KEY = { low: 'rec.low', medium: 'rec.medium', high: 'rec.high' } as const;

export default function InsightsPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const q = useMemo(() => toQ(filters), [filters]);
  const insights = useMemo(() => computeInsights(q), [q]);
  const [cat, setCat] = useState<InsightCategory | 'all'>('all');

  const cats = useMemo(() => {
    const present = new Set(insights.map((i) => i.category));
    return ['all', ...([...present] as InsightCategory[])] as Array<InsightCategory | 'all'>;
  }, [insights]);

  const visible = cat === 'all' ? insights : insights.filter((i) => i.category === cat);

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t('ins.title')}>
        {cats.map((c) => (
          <button
            key={c}
            role="tab"
            type="button"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={`mono h-7 rounded-full border px-3 text-[10.5px] transition-colors ${
              cat === c ? 'border-accbrd bg-accsoft text-acctext' : 'border-brd text-t3 hover:border-brds hover:text-t1'
            }`}
          >
            {c === 'all' ? t('ins.all') : t(CAT_KEY[c])}
            <span className="ml-1.5 opacity-60">{c === 'all' ? insights.length : insights.filter((i) => i.category === c).length}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState title={t('state.empty.title')} body={t('ins.empty')} />
        </Card>
      ) : (
        <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2">
          {visible.map((ins) => (
            <article key={ins.id} className="fade-up flex min-w-0 flex-col gap-3 rounded-[14px] border border-brd bg-card p-[var(--pad-card)]">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={CAT_TONE[ins.category]}>{t(CAT_KEY[ins.category]).toUpperCase()}</Badge>
                <span className="flex items-center gap-2">
                  <span className="mono text-[9px] uppercase tracking-[0.08em] text-t3">
                    {t('ins.confidence')}: <span className="text-t2">{t(LEVEL_KEY[ins.confidence])}</span>
                  </span>
                  <span className="mono text-[9px] uppercase tracking-[0.08em] text-t3">
                    {t('ins.impact')}: <span className="text-t2">{t(LEVEL_KEY[ins.impact])}</span>
                  </span>
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                {ins.direction === 1 ? (
                  <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-pos" aria-label="up" />
                ) : ins.direction === -1 ? (
                  <ArrowDownRight size={16} className="mt-0.5 shrink-0 text-neg" aria-label="down" />
                ) : (
                  <Flag size={14} className="mt-0.5 shrink-0 text-warn" aria-label="flag" />
                )}
                <h2 className="m-0 text-[13.5px] font-semibold leading-snug text-t1">{ins.signal[lang]}</h2>
              </div>

              <dl className="m-0 flex flex-col gap-2 border-t border-brd pt-3">
                <div>
                  <dt className="eyebrow text-[8.5px]">{t('ins.evidence')}</dt>
                  <dd className="mono m-0 mt-0.5 text-[11px] leading-relaxed text-t2 tnum">{ins.evidence[lang]}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-[8.5px]">{t('ins.interpretation')}</dt>
                  <dd className="m-0 mt-0.5 text-[11.5px] leading-relaxed text-t2">{ins.interpretation[lang]}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-[8.5px]">{t('ins.action')}</dt>
                  <dd className="m-0 mt-0.5 text-[11.5px] leading-relaxed text-t1">{ins.action[lang]}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <p className="m-0 flex items-center justify-center gap-1.5 text-center text-[10.5px] text-t3">
        <Info size={11} aria-hidden />
        {t('ins.disclaimer')}
      </p>
    </div>
  );
}
