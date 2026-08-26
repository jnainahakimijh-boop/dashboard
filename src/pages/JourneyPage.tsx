import { useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { CHANNELS } from '@/data/dimensions';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { acquisitionFunnel, prevQ, socialTotals, toQ, webBy, type WebTotals } from '@/lib/aggregate';
import { ratio, relChange } from '@/lib/metrics';
import { fmtCompact, fmtInt, fmtPct, fmtRelDelta } from '@/lib/format';
import { RankedList } from '@/components/charts/RankedList';
import { Badge, Card, EmptyState, InfoTip } from '@/components/ui/primitives';
import type { MsgKey } from '@/i18n/messages';

const STAGE_KEYS: Array<{ id: string; label: MsgKey; desc: MsgKey; attribution: 'deterministic' | 'modelled' }> = [
  { id: 'impressions', label: 'jny.awareness', desc: 'jny.awarenessDesc', attribution: 'deterministic' },
  { id: 'interaction', label: 'jny.interaction', desc: 'jny.interactionDesc', attribution: 'deterministic' },
  { id: 'sessions', label: 'jny.website', desc: 'jny.websiteDesc', attribution: 'modelled' },
  { id: 'engaged', label: 'jny.engagement', desc: 'jny.engagementDesc', attribution: 'deterministic' },
  { id: 'conversions', label: 'jny.conversion', desc: 'jny.conversionDesc', attribution: 'deterministic' },
];

export default function JourneyPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => prevQ(q), [q]);
  const showCompare = filters.compare === 'previous';

  /* journey stages: awareness → interaction (engagements + clicks) → website → engaged → conversion.
     interaction = social engagements + all clicks; each stage <= the previous by construction. */
  const buildStages = (query: typeof q) => {
    const f = acquisitionFunnel(query);
    const by = new Map(f.map((s) => [s.id, s.value]));
    const impressions = by.get('impressions') ?? 0;
    const clicks = by.get('clicks') ?? 0;
    const engagements = socialTotals(query).engagements;
    return [
      { id: 'impressions', value: impressions },
      { id: 'interaction', value: Math.min(impressions, engagements + clicks) },
      { id: 'sessions', value: by.get('sessions') ?? 0 },
      { id: 'engaged', value: by.get('engaged') ?? 0 },
      { id: 'conversions', value: by.get('conversions') ?? 0 },
    ];
  };

  const stages = buildStages(q);
  const prevStages = buildStages(p);

  const first = stages[0].value;
  const empty = first === 0;

  /* source contribution — sessions entering the journey by channel (social + paid) */
  const byChannel = webBy({ ...q, channels: q.channels.length ? q.channels.filter((c) => c === 'social' || c === 'paid') : (['social', 'paid'] as typeof q.channels) }, 'channel') as Map<string, WebTotals>;
  const total = [...byChannel.values()].reduce((s, v) => s + v.sessions, 0);
  const sourceRows = CHANNELS.filter((c) => byChannel.has(c.id))
    .map((c) => {
      const v = byChannel.get(c.id)!;
      const share = ratio(v.sessions, total);
      return {
        id: c.id,
        label: lang === 'fr' ? c.nameFr : c.name,
        value: v.sessions,
        valueLabel: fmtCompact(v.sessions, lang),
        share: share === null ? null : share * 100,
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-5 md:p-8">
      <Card
        title={t('jny.stages')}
        subtitle={t('ov.funnelSub')}
        right={<InfoTip text={t('jny.attributionNote')} />}
      >
        {empty ? (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        ) : (
          <div className="flex flex-col">
            {stages.map((s, i) => {
              const def = STAGE_KEYS[i];
              const stageRate = i > 0 ? ratio(s.value, stages[i - 1].value) : null;
              const dropOff = stageRate === null ? null : (1 - stageRate) * 100;
              const prevVal = prevStages[i]?.value ?? null;
              const change = prevVal !== null && prevVal > 0 ? relChange(s.value, prevVal) : null;
              const widthPct = first > 0 ? Math.max((s.value / first) * 100, 0.75) : 0;
              return (
                <div key={s.id}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 py-1 pl-2">
                      <ArrowDown size={12} className="text-t3" aria-hidden />
                      <span className="mono text-[11.5px] text-t2 tnum">{stageRate === null ? '—' : fmtPct(stageRate * 100, lang)}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-t3">{t('jny.stageRate')}</span>
                      {dropOff !== null && (
                        <span className="mono ml-2 text-[11px] text-t3 tnum">
                          {t('jny.dropOff')}: {fmtPct(dropOff, lang)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-[minmax(120px,190px)_1fr_auto] items-center gap-3 rounded-[10px] border border-brd bg-card2 px-3.5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-t1">{t(def.label)}</span>
                        <Badge tone={def.attribution === 'modelled' ? 'warn' : 'neutral'} title={t('jny.attributionNote')}>
                          {t(def.attribution === 'modelled' ? 'jny.modelled' : 'jny.deterministic').toUpperCase()}
                        </Badge>
                      </div>
                      <div className="truncate text-[11.5px] text-t3">{t(def.desc)}</div>
                    </div>
                    <div className="hidden h-[16px] overflow-hidden rounded-[4px] bg-hov sm:block">
                      <div className="h-full rounded-[4px]" style={{ width: `${widthPct}%`, background: 'var(--ch-1)', opacity: 0.3 + 0.7 * (i / (stages.length - 1)) }} />
                    </div>
                    <div className="text-right">
                      <div className="mono text-[15px] font-semibold text-t1 tnum">{fmtInt(s.value, lang)}</div>
                      {showCompare && change !== null && (
                        <div className={`mono text-[11px] tnum ${change >= 0 ? 'text-pos' : 'text-neg'}`}>{fmtRelDelta(change, lang)} {t('misc.vs')} {t('compare.prevShort').toLowerCase()}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2">
        <Card title={t('jny.sources')} subtitle={t('jny.sourcesSub')}>
          {sourceRows.length > 0 ? <RankedList rows={sourceRows} lang={lang} ariaLabel={t('jny.sources')} /> : <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />}
        </Card>

        <Card title={t('jny.attribution')}>
          <p className="m-0 text-[13px] leading-relaxed text-t2">{t('jny.attributionNote')}</p>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <Badge tone="neutral">{t('jny.deterministic').toUpperCase()}</Badge>
              <span className="text-[12px] leading-snug text-t3">{lang === 'fr' ? 'Comptages directs depuis la source (impressions, clics, sessions engagées, conversions).' : 'Direct counts from the source system (impressions, clicks, engaged sessions, conversions).'}</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge tone="warn">{t('jny.modelled').toUpperCase()}</Badge>
              <span className="text-[12px] leading-snug text-t3">{lang === 'fr' ? 'Rapprochement agrégé clics → sessions (pas de suivi individuel inter-plateformes).' : 'Aggregate click → session matching (no cross-platform individual tracking).'}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
