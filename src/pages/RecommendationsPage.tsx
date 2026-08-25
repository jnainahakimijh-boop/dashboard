import { Fragment, useMemo, useState } from 'react';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { toQ } from '@/lib/aggregate';
import { buildRecommendations, saveStatus, type RecStatus, type Recommendation } from '@/lib/recommendations';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { useToast } from '@/state/ToastContext';
import type { MsgKey } from '@/i18n/messages';

const STATUS_KEYS: Record<RecStatus, MsgKey> = {
  new: 'rec.st.new',
  accepted: 'rec.st.accepted',
  inprogress: 'rec.st.inprogress',
  completed: 'rec.st.completed',
  dismissed: 'rec.st.dismissed',
};

const LEVEL_KEY = { low: 'rec.low', medium: 'rec.medium', high: 'rec.high' } as const;

export default function RecommendationsPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const q = useMemo(() => toQ(filters), [filters]);
  const [version, setVersion] = useState(0);
  const recs = useMemo(() => buildRecommendations(q), [q, version]);
  const [statusFilter, setStatusFilter] = useState<RecStatus | 'all'>('all');

  const visible = statusFilter === 'all' ? recs : recs.filter((r) => r.status === statusFilter);

  const changeStatus = (r: Recommendation, status: RecStatus) => {
    saveStatus(r.id, status);
    setVersion((v) => v + 1);
    toast(`${t(STATUS_KEYS[status])} ✓`);
  };

  /* impact × effort matrix — 3×3 grid, items positioned by their levels */
  const cellItems = (impact: string, effort: string) => visible.filter((r) => r.impact === impact && r.effort === effort);
  const IMPACTS = ['high', 'medium', 'low'] as const;
  const EFFORTS = ['low', 'medium', 'high'] as const;

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t('rec.status')}>
        {(['all', 'new', 'accepted', 'inprogress', 'completed', 'dismissed'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            className={`mono h-7 rounded-full border px-3 text-[10.5px] transition-colors ${
              statusFilter === s ? 'border-accbrd bg-accsoft text-acctext' : 'border-brd text-t3 hover:border-brds hover:text-t1'
            }`}
          >
            {s === 'all' ? t('ins.all') : t(STATUS_KEYS[s])}
            <span className="ml-1.5 opacity-60">{s === 'all' ? recs.length : recs.filter((r) => r.status === s).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-[var(--gap-grid)] xl:grid-cols-[1.6fr_1fr]">
        <div className="flex min-w-0 flex-col gap-[var(--gap-grid)]">
          {visible.length === 0 && (
            <Card>
              <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
            </Card>
          )}
          {visible.map((r) => (
            <article key={r.id} className="fade-up flex flex-col gap-2.5 rounded-[14px] border border-brd bg-card p-[var(--pad-card)]">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={r.priority === 'high' ? 'neg' : r.priority === 'medium' ? 'warn' : 'neutral'}>
                  {t(LEVEL_KEY[r.priority]).toUpperCase()} · {t('rec.priority').toUpperCase()}
                </Badge>
                <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-t3">
                  {r.owner} · {r.timeline}
                </span>
                <label className="ml-auto flex items-center gap-1.5">
                  <span className="sr-only">{t('rec.status')}</span>
                  <select
                    value={r.status}
                    onChange={(e) => changeStatus(r, e.target.value as RecStatus)}
                    className="h-7 rounded-[8px] border border-brd bg-card2 px-1.5 text-[11px] text-t2 hover:border-brds"
                    aria-label={`${t('rec.status')}: ${r.signal[lang]}`}
                  >
                    {(Object.keys(STATUS_KEYS) as RecStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {t(STATUS_KEYS[s])}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <h2 className="m-0 text-[13.5px] font-semibold leading-snug text-t1">{r.signal[lang]}</h2>
              <p className="m-0 text-[12px] leading-relaxed text-t2">{r.action[lang]}</p>
              <div className="rounded-[9px] border border-brd bg-card2 px-3 py-2">
                <span className="eyebrow text-[8.5px]">{t('rec.evidence')}</span>
                <p className="mono m-0 mt-0.5 text-[10.5px] leading-relaxed text-t2 tnum">{r.evidence[lang]}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="mono text-[9.5px] uppercase tracking-[0.06em] text-t3">
                  {t('rec.impact')}: <span className="text-t2">{t(LEVEL_KEY[r.impact])}</span>
                </span>
                <span className="mono text-[9.5px] uppercase tracking-[0.06em] text-t3">
                  {t('rec.effort')}: <span className="text-t2">{t(LEVEL_KEY[r.effort])}</span>
                </span>
              </div>
            </article>
          ))}
        </div>

        <Card title={t('rec.matrix')} subtitle={t('rec.matrixSub')} className="h-fit xl:sticky xl:top-[120px]">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1">
            <div />
            {EFFORTS.map((e) => (
              <div key={e} className="eyebrow pb-1 text-center text-[8px]">
                {t(LEVEL_KEY[e])} {t('rec.effort').toLowerCase()}
              </div>
            ))}
            {IMPACTS.map((imp) => (
              <Fragment key={imp}>
                <div className="eyebrow flex items-center pr-1 text-[8px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  {t(LEVEL_KEY[imp])} {t('rec.impact').toLowerCase()}
                </div>
                {EFFORTS.map((eff) => {
                  const items = cellItems(imp, eff);
                  const prime = imp === 'high' && eff === 'low';
                  return (
                    <div
                      key={`${imp}-${eff}`}
                      className={`min-h-16 min-w-0 overflow-hidden rounded-[8px] border p-1.5 ${prime ? 'border-accbrd bg-accsoft' : 'border-brd bg-card2'}`}
                    >
                      {items.map((r) => (
                        <div key={r.id} className="mb-1 truncate rounded-[5px] bg-hov px-1.5 py-1 text-[9.5px] leading-tight text-t2" title={r.signal[lang]}>
                          {r.signal[lang]}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
