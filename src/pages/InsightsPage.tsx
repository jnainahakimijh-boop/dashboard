import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Flag, Info } from 'lucide-react';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { toQ } from '@/lib/aggregate';
import { computeInsights, type InsightCategory } from '@/lib/insights';
import { buildRecommendations, saveStatus, type RecStatus, type Recommendation } from '@/lib/recommendations';
import { Badge, Card, EmptyState, Segmented, type BadgeTone } from '@/components/ui/primitives';
import { useToast } from '@/state/ToastContext';
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

const STATUS_KEYS: Record<RecStatus, MsgKey> = {
  new: 'rec.st.new',
  accepted: 'rec.st.accepted',
  inprogress: 'rec.st.inprogress',
  completed: 'rec.st.completed',
  dismissed: 'rec.st.dismissed',
};

const LEVEL_KEY = { low: 'rec.low', medium: 'rec.medium', high: 'rec.high' } as const;

export default function InsightsPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'recommendations' ? 'recommendations' : 'insights';

  const setTab = (v: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (v === 'recommendations') p.set('tab', 'recommendations');
        else p.delete('tab');
        return p;
      },
      { replace: true },
    );

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-5 md:p-8">
      <Segmented
        ariaLabel={t('nav.insightsRecs')}
        options={[
          { id: 'insights', label: t('ins.tab.insights') },
          { id: 'recommendations', label: t('ins.tab.recs') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'insights' ? <InsightsView /> : <RecommendationsView />}
    </div>
  );
}

/* ================= Insights ================= */

function InsightsView() {
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
    <>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={t('ins.title')}>
        {cats.map((c) => (
          <button
            key={c}
            role="tab"
            type="button"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={`h-8 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors ${
              cat === c ? 'border-accbrd bg-accsoft text-acctext' : 'border-brd bg-card text-t3 hover:border-brds hover:text-t1'
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
            <article key={ins.id} className="fade-up flex min-w-0 flex-col gap-3.5 rounded-[14px] border border-brd bg-card p-[var(--pad-card)] shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={CAT_TONE[ins.category]}>{t(CAT_KEY[ins.category]).toUpperCase()}</Badge>
                <span className="flex items-center gap-3 text-[11.5px] text-t3">
                  <span>
                    {t('ins.confidence')}: <span className="font-medium text-t2">{t(LEVEL_KEY[ins.confidence])}</span>
                  </span>
                  <span>
                    {t('ins.impact')}: <span className="font-medium text-t2">{t(LEVEL_KEY[ins.impact])}</span>
                  </span>
                </span>
              </div>

              <div className="flex items-start gap-3">
                {ins.direction === 1 ? (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-possoft"><ArrowUpRight size={15} className="text-pos" aria-label="up" /></span>
                ) : ins.direction === -1 ? (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-negsoft"><ArrowDownRight size={15} className="text-neg" aria-label="down" /></span>
                ) : (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warnsoft"><Flag size={13} className="text-warn" aria-label="flag" /></span>
                )}
                <h2 className="m-0 text-[15px] font-semibold leading-snug text-t1">{ins.signal[lang]}</h2>
              </div>

              <dl className="m-0 flex flex-col gap-2.5 border-t border-brd pt-3.5">
                <div>
                  <dt className="eyebrow text-[11px]">{t('ins.evidence')}</dt>
                  <dd className="mono m-0 mt-1 text-[13px] leading-relaxed text-t2 tnum">{ins.evidence[lang]}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-[11px]">{t('ins.interpretation')}</dt>
                  <dd className="m-0 mt-1 text-[12.5px] leading-relaxed text-t2">{ins.interpretation[lang]}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-[11px]">{t('ins.action')}</dt>
                  <dd className="m-0 mt-1 text-[13px] font-medium leading-relaxed text-t1">{ins.action[lang]}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <p className="m-0 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-t3">
        <Info size={12} aria-hidden />
        {t('ins.disclaimer')}
      </p>
    </>
  );
}

/* ================= Recommendations ================= */

function RecommendationsView() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const q = useMemo(() => toQ(filters), [filters]);
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recs = useMemo(() => buildRecommendations(q), [q, version]);
  const [statusFilter, setStatusFilter] = useState<RecStatus | 'all'>('all');

  const visible = statusFilter === 'all' ? recs : recs.filter((r) => r.status === statusFilter);

  const changeStatus = (r: Recommendation, status: RecStatus) => {
    saveStatus(r.id, status);
    setVersion((v) => v + 1);
    toast(`${t(STATUS_KEYS[status])} ✓`);
  };

  const cellItems = (impact: string, effort: string) => visible.filter((r) => r.impact === impact && r.effort === effort);
  const IMPACTS = ['high', 'medium', 'low'] as const;
  const EFFORTS = ['low', 'medium', 'high'] as const;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={t('rec.status')}>
        {(['all', 'new', 'accepted', 'inprogress', 'completed', 'dismissed'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            className={`h-8 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors ${
              statusFilter === s ? 'border-accbrd bg-accsoft text-acctext' : 'border-brd bg-card text-t3 hover:border-brds hover:text-t1'
            }`}
          >
            {s === 'all' ? t('ins.all') : t(STATUS_KEYS[s])}
            <span className="ml-1.5 opacity-60">{s === 'all' ? recs.length : recs.filter((r) => r.status === s).length}</span>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-[var(--gap-grid)] xl:grid-cols-[1.6fr_1fr]">
        <div className="flex min-w-0 flex-col gap-[var(--gap-grid)]">
          {visible.length === 0 && (
            <Card>
              <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
            </Card>
          )}
          {visible.map((r, i) => (
            <article key={r.id} className="fade-up flex flex-col gap-3 rounded-[14px] border border-brd bg-card p-[var(--pad-card)] shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={r.priority === 'high' ? 'neg' : r.priority === 'medium' ? 'warn' : 'neutral'}>
                  P{i + 1} · {t(LEVEL_KEY[r.priority]).toUpperCase()} {t('rec.impact').toUpperCase()}
                </Badge>
                <span className="text-[11.5px] text-t3">
                  {r.owner} · {r.timeline}
                </span>
                <label className="ml-auto flex items-center gap-1.5">
                  <span className="sr-only">{t('rec.status')}</span>
                  <select
                    value={r.status}
                    onChange={(e) => changeStatus(r, e.target.value as RecStatus)}
                    className="h-8 rounded-[8px] border border-brd bg-card px-2 text-[12px] font-medium text-t2 hover:border-brds"
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
              <h2 className="m-0 text-[15px] font-semibold leading-snug text-t1">{r.signal[lang]}</h2>
              <p className="m-0 text-[13px] leading-relaxed text-t2">{r.action[lang]}</p>
              <div className="rounded-[10px] border border-brd bg-card2 px-3.5 py-2.5">
                <span className="eyebrow text-[11px]">{t('rec.evidence')}</span>
                <p className="mono m-0 mt-1 text-[11.5px] leading-relaxed text-t2 tnum">{r.evidence[lang]}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-t3">
                <span>
                  {t('rec.impact')}: <span className="font-medium text-t1">{t(LEVEL_KEY[r.impact])}</span>
                </span>
                <span>
                  {t('rec.effort')}: <span className="font-medium text-t1">{t(LEVEL_KEY[r.effort])}</span>
                </span>
              </div>
            </article>
          ))}
        </div>

        <Card title={t('rec.matrix')} subtitle={t('rec.matrixSub')} className="xl:sticky xl:top-[132px]">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1.5">
            <div />
            {EFFORTS.map((e) => (
              <div key={e} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-t3">
                {t(LEVEL_KEY[e])} {t('rec.effort').toLowerCase()}
              </div>
            ))}
            {IMPACTS.map((imp) => (
              <Fragment key={imp}>
                <div className="flex items-center pr-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-t3" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  {t(LEVEL_KEY[imp])} {t('rec.impact').toLowerCase()}
                </div>
                {EFFORTS.map((eff) => {
                  const items = cellItems(imp, eff);
                  const prime = imp === 'high' && eff === 'low';
                  return (
                    <div key={`${imp}-${eff}`} className={`min-h-18 min-w-0 overflow-hidden rounded-[9px] border p-1.5 ${prime ? 'border-accbrd bg-accsoft' : 'border-brd bg-card2'}`}>
                      {items.map((r) => (
                        <div key={r.id} className="mb-1 truncate rounded-[6px] bg-hov px-2 py-1.5 text-[11.5px] leading-tight text-t2" title={r.signal[lang]}>
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
    </>
  );
}
