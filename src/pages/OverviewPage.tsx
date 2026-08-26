import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Flag } from 'lucide-react';
import { CHANNELS } from '@/data/dimensions';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { campaignBy, campaignTotals, prevQ, socialBy, socialTotals, toQ, webBy, webTotals, acquisitionFunnel, type SocialTotals, type WebTotals, type CampaignTotals } from '@/lib/aggregate';
import { cvr, deltaAbs, deltaRate, engagementRateWeb, ratio, type Delta } from '@/lib/metrics';
import { fmtCompact, fmtInt, fmtPct } from '@/lib/format';
import { topSignals } from '@/lib/insights';
import { buildRecommendations } from '@/lib/recommendations';
import { KpiCard } from '@/components/kpi/KpiCard';
import { TrendChart, type TrendPoint } from '@/components/charts/TrendChart';
import { RankedList } from '@/components/charts/RankedList';
import { FunnelSteps } from '@/components/charts/FunnelSteps';
import { Badge, Card, EmptyState, InfoTip, Segmented } from '@/components/ui/primitives';
import type { MsgKey } from '@/i18n/messages';

type OvMetric = 'sessions' | 'users' | 'engagementRate' | 'conversions';

interface DayMaps {
  web: Map<string | number, WebTotals>;
  soc: Map<string | number, SocialTotals>;
  cmp: Map<string | number, CampaignTotals>;
}

function metricDaily(maps: DayMaps, q: { from: number; to: number }, metric: OvMetric): (number | null)[] {
  const out: (number | null)[] = [];
  for (let d = q.from; d <= q.to; d++) {
    const w = maps.web.get(d);
    switch (metric) {
      case 'sessions':
        out.push(w ? w.sessions : 0);
        break;
      case 'users':
        out.push(w ? w.users : 0);
        break;
      case 'engagementRate':
        out.push(w ? engagementRateWeb(w.engaged, w.sessions) : null);
        break;
      case 'conversions':
        out.push(w ? w.conversions : 0);
        break;
    }
  }
  return out;
}

const LEVEL_KEY = { low: 'rec.low', medium: 'rec.medium', high: 'rec.high' } as const;

export default function OverviewPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => prevQ(q), [q]);
  const showCompare = filters.compare === 'previous';

  const web = webTotals(q);
  const webPrev = webTotals(p);
  const soc = socialTotals(q);
  const socPrev = socialTotals(p);
  const cmp = campaignTotals(q);
  const cmpPrev = campaignTotals(p);

  const maps: DayMaps = { web: webBy(q, 'day'), soc: socialBy(q, 'day'), cmp: campaignBy(q, 'day') };
  const prevMaps: DayMaps = { web: webBy(p, 'day'), soc: socialBy(p, 'day'), cmp: campaignBy(p, 'day') };

  const [metric, setMetric] = useState<OvMetric>('sessions');
  const [chMetric, setChMetric] = useState<'sessions' | 'conversions'>('sessions');

  const hasData = web.sessions > 0 || soc.impressions > 0 || cmp.impressions > 0;

  /* ---- Row 1: executive KPI summary (6 max) ---- */
  const impressions = soc.impressions + cmp.impressions;
  const impressionsPrev = socPrev.impressions + cmpPrev.impressions;
  const er = engagementRateWeb(web.engaged, web.sessions);
  const erPrev = engagementRateWeb(webPrev.engaged, webPrev.sessions);
  const cvrNow = cvr(web.conversions, web.sessions);
  const cvrPrev = cvr(webPrev.conversions, webPrev.sessions);

  const impressionsSpark = (() => {
    const out: (number | null)[] = [];
    for (let d = q.from; d <= q.to; d++) out.push((maps.soc.get(d)?.impressions ?? 0) + (maps.cmp.get(d)?.impressions ?? 0));
    return out;
  })();

  const kpis: Array<{ id: string; label: MsgKey; def: MsgKey; value: string; prev: string; delta: Delta; spark: (number | null)[] }> = [
    { id: 'users', label: 'kpi.users', def: 'def.users', value: fmtCompact(web.users, lang), prev: fmtCompact(webPrev.users, lang), delta: deltaAbs(web.users, webPrev.users), spark: metricDaily(maps, q, 'users') },
    { id: 'sessions', label: 'kpi.sessions', def: 'def.sessions', value: fmtCompact(web.sessions, lang), prev: fmtCompact(webPrev.sessions, lang), delta: deltaAbs(web.sessions, webPrev.sessions), spark: metricDaily(maps, q, 'sessions') },
    { id: 'impressions', label: 'kpi.impressions', def: 'def.impressions', value: fmtCompact(impressions, lang), prev: fmtCompact(impressionsPrev, lang), delta: deltaAbs(impressions, impressionsPrev), spark: impressionsSpark },
    { id: 'er', label: 'kpi.engagementRate', def: 'def.engagementRateWeb', value: fmtPct(er, lang), prev: fmtPct(erPrev, lang), delta: deltaRate(er, erPrev), spark: metricDaily(maps, q, 'engagementRate') },
    { id: 'conversions', label: 'kpi.conversions', def: 'def.conversions', value: fmtCompact(web.conversions, lang), prev: fmtCompact(webPrev.conversions, lang), delta: deltaAbs(web.conversions, webPrev.conversions), spark: metricDaily(maps, q, 'conversions') },
    { id: 'cvr', label: 'kpi.cvr', def: 'def.cvr', value: fmtPct(cvrNow, lang), prev: fmtPct(cvrPrev, lang), delta: deltaRate(cvrNow, cvrPrev), spark: [] },
  ];

  /* ---- Row 2: hero trend + signals ---- */
  const metricOptions: { id: OvMetric; label: string }[] = [
    { id: 'sessions', label: t('kpi.sessions') },
    { id: 'users', label: t('kpi.users') },
    { id: 'conversions', label: t('kpi.conversions') },
    { id: 'engagementRate', label: t('kpi.engagementRate') },
  ];
  const isRate = metric === 'engagementRate';
  const curSeries = metricDaily(maps, q, metric);
  const prevSeries = metricDaily(prevMaps, p, metric);
  const points: TrendPoint[] = curSeries.map((v, i) => ({
    d: q.from + i,
    value: v,
    prev: prevSeries[i] ?? null,
    prevD: p.from + i <= p.to ? p.from + i : null,
  }));
  const metricLabel = metricOptions.find((m) => m.id === metric)!.label;

  const signals = topSignals(q, lang, 5);

  /* ---- Row 3: channels + funnel ---- */
  const byChannel = webBy(q, 'channel') as Map<string, WebTotals>;
  const chTotal = chMetric === 'sessions' ? web.sessions : web.conversions;
  const channelRows = CHANNELS.map((ch) => {
    const tot = byChannel.get(ch.id);
    const value = tot ? (chMetric === 'sessions' ? tot.sessions : tot.conversions) : 0;
    const shareR = ratio(value, chTotal);
    return {
      id: ch.id,
      label: lang === 'fr' ? ch.nameFr : ch.name,
      value,
      valueLabel: fmtCompact(value, lang),
      share: shareR === null ? null : shareR * 100,
    };
  }).sort((a, b) => b.value - a.value);

  const funnel = acquisitionFunnel(q);
  const funnelStages = funnel.map((s) => ({
    id: s.id,
    value: s.value,
    label:
      s.id === 'impressions'
        ? t('kpi.impressions')
        : s.id === 'clicks'
          ? t('kpi.clicks')
          : s.id === 'sessions'
            ? t('kpi.sessions')
            : s.id === 'engaged'
              ? t('kpi.engagedSessions')
              : t('kpi.conversions'),
  }));

  /* ---- Row 4: priority recommendations ---- */
  const recs = buildRecommendations(q).slice(0, 3);
  const compareLabel = showCompare ? t('compare.short') : undefined;
  const compareLabelFull = showCompare ? t('compare.label') : undefined;

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-5 md:p-8">
      {/* Row 1 — KPI summary */}
      <div className="grid grid-cols-1 gap-[var(--gap-grid)] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard
            key={k.id}
            label={t(k.label)}
            definition={t(k.def)}
            value={k.value}
            prevValue={k.prev}
            delta={showCompare ? k.delta : undefined}
            compareLabel={compareLabel}
            compareLabelFull={compareLabelFull}
            spark={k.spark}
            lang={lang}
          />
        ))}
      </div>

      {/* Row 2 — hero: trend + signals */}
      <div className="grid gap-[var(--gap-grid)] xl:grid-cols-3">
        <Card
          title={t('ov.trend')}
          subtitle={t('ov.trendSub')}
          right={<Segmented ariaLabel={t('ov.trend')} options={metricOptions} value={metric} onChange={setMetric} size="sm" />}
          className="xl:col-span-2"
        >
          {hasData ? (
            <TrendChart
              points={points}
              format={(v) => (isRate ? fmtPct(v, lang) : fmtInt(v, lang))}
              metricLabel={metricLabel}
              deltaKind={isRate ? 'pp' : 'rel'}
              showCompare={showCompare}
              lang={lang}
              isRate={isRate}
              height={330}
              description={`${metricLabel} — ${t('ov.trendSub')}`}
            />
          ) : (
            <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
          )}
        </Card>

        <Card title={t('ov.signals')} subtitle={t('ov.signalsSub')}>
          {signals.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {signals.map((s) => (
                <li key={s.id}>
                  <Link to="/insights" className="flex items-start gap-3 rounded-[11px] border border-brd bg-card2 px-3.5 py-3 no-underline transition-colors hover:border-brds hover:bg-hov">
                    {s.direction === 1 ? (
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-possoft"><ArrowUpRight size={14} className="text-pos" aria-label="up" /></span>
                    ) : s.direction === -1 ? (
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-negsoft"><ArrowDownRight size={14} className="text-neg" aria-label="down" /></span>
                    ) : (
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warnsoft"><Flag size={12} className="text-warn" aria-label="flag" /></span>
                    )}
                    <span className="text-[13px] leading-snug text-t1">{s.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
          )}
        </Card>
      </div>

      {/* Row 3 — channels + funnel */}
      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2">
        <Card
          title={t('ov.channels')}
          subtitle={t('ov.channelsSub')}
          right={
            <Segmented
              ariaLabel={t('ov.channels')}
              size="sm"
              options={[
                { id: 'sessions', label: t('kpi.sessions') },
                { id: 'conversions', label: t('kpi.conversions') },
              ]}
              value={chMetric}
              onChange={setChMetric}
            />
          }
        >
          {chTotal > 0 ? <RankedList rows={channelRows} lang={lang} ariaLabel={t('ov.channels')} /> : <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />}
        </Card>

        <Card title={t('ov.funnel')} subtitle={t('ov.funnelSub')} right={<InfoTip text={t('ov.funnelNote')} />}>
          {funnel[0].value > 0 ? <FunnelSteps stages={funnelStages} lang={lang} ariaLabel={t('ov.funnel')} /> : <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />}
        </Card>
      </div>

      {/* Row 4 — decision area */}
      <Card
        title={t('ov.recs')}
        subtitle={t('ov.recsSub')}
        right={
          <Link to="/insights?tab=recommendations" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-acctext no-underline hover:underline">
            {t('ov.allRecs')}
            <ArrowRight size={13} aria-hidden />
          </Link>
        }
      >
        <div className="grid gap-[var(--gap-grid)] md:grid-cols-3">
          {recs.map((r, i) => (
            <article key={r.id} className="flex flex-col gap-3 rounded-[12px] border border-brd bg-card2 p-4.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={r.priority === 'high' ? 'neg' : r.priority === 'medium' ? 'warn' : 'neutral'}>
                  P{i + 1} · {t(LEVEL_KEY[r.priority]).toUpperCase()} {t('rec.impact').toUpperCase()}
                </Badge>
              </div>
              <h3 className="m-0 text-[14.5px] font-semibold leading-snug text-t1">{r.signal[lang]}</h3>
              <div>
                <div className="eyebrow text-[11px]">{t('ins.action')}</div>
                <p className="m-0 mt-1 text-[13px] leading-relaxed text-t2">{r.action[lang]}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 border-t border-brd pt-3 text-[11.5px]">
                <span className="text-t3">
                  {t('rec.impact')}: <span className="font-medium text-t1">{t(LEVEL_KEY[r.impact])}</span>
                </span>
                <span className="text-t3">
                  {t('rec.effort')}: <span className="font-medium text-t1">{t(LEVEL_KEY[r.effort])}</span>
                </span>
                <span className="text-t3">
                  {t('rec.owner')}: <span className="font-medium text-t1">{r.owner}</span>
                </span>
                <span className="text-t3">
                  {t('rec.status')}: <span className="font-medium text-t1">{t(`rec.st.${r.status}` as MsgKey)}</span>
                </span>
              </div>
            </article>
          ))}
        </div>
      </Card>

      <p className="m-0 text-center text-[11px] text-t3">{t('app.demoTip')}</p>
    </div>
  );
}
