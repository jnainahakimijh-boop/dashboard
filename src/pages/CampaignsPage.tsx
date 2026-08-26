import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { MARKETS, THEMES } from '@/data/dimensions';
import { CAMPAIGN_DEFS, type CampaignDef } from '@/data/campaigns';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { campaignBy, toQ, type CampaignTotals } from '@/lib/aggregate';
import { cpa, cpc, cpm, ctr, cvr, relChange } from '@/lib/metrics';
import { dataset } from '@/data';
import { fmtCompact, fmtDayFull, fmtEur, fmtInt, fmtPct, fmtRelDelta } from '@/lib/format';
import { TrendChart, type TrendPoint } from '@/components/charts/TrendChart';
import { FunnelSteps } from '@/components/charts/FunnelSteps';
import { Badge, Card, EmptyState, InfoTip, type BadgeTone } from '@/components/ui/primitives';
import { DataTable, Num, type Column } from '@/components/tables/DataTable';
import type { MsgKey } from '@/i18n/messages';

interface CampRow {
  def: CampaignDef;
  t: CampaignTotals | null;
}

const STATUS_TONE: Record<CampaignDef['status'], BadgeTone> = {
  active: 'pos',
  completed: 'info',
  paused: 'warn',
  planned: 'neutral',
};

export default function CampaignsPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = useMemo(() => toQ(filters), [filters]);
  const byCampaign = campaignBy(q, 'campaign') as Map<string, CampaignTotals>;

  const rows: CampRow[] = CAMPAIGN_DEFS.filter((c) => {
    if (filters.campaigns.length > 0 && !filters.campaigns.includes(c.id)) return false;
    if (filters.themes.length > 0 && !filters.themes.includes(c.theme)) return false;
    if (filters.markets.length > 0 && !c.markets.some((m) => filters.markets.includes(m))) return false;
    return true;
  }).map((def) => ({ def, t: byCampaign.get(def.id) ?? null }));

  const detailId = params.get('detail');
  const detail = detailId ? rows.find((r) => r.def.id === detailId) ?? CAMPAIGN_DEFS.filter((c) => c.id === detailId).map((def) => ({ def, t: byCampaign.get(def.id) ?? null }))[0] : undefined;

  const openDetail = (id: string) =>
    setParams(
      (prev) => {
        const p2 = new URLSearchParams(prev);
        p2.set('detail', id);
        return p2;
      },
      { replace: true },
    );
  const closeDetail = () =>
    setParams(
      (prev) => {
        const p2 = new URLSearchParams(prev);
        p2.delete('detail');
        return p2;
      },
      { replace: true },
    );

  const statusKey = (s: CampaignDef['status']): MsgKey => (`cmp.status.${s}` as MsgKey);

  const cols: Column<CampRow>[] = [
    {
      id: 'name',
      header: t('filters.campaign'),
      cell: (r) => (
        <span className="block max-w-52 truncate text-[13px] font-medium text-t1" title={r.def.name}>
          {r.def.name}
        </span>
      ),
      sortValue: (r) => r.def.name,
      searchText: (r) => r.def.name,
    },
    { id: 'status', header: t('adm.status'), cell: (r) => <Badge tone={STATUS_TONE[r.def.status]}>{t(statusKey(r.def.status)).toUpperCase()}</Badge>, sortValue: (r) => r.def.status },
    {
      id: 'period',
      header: t('cmp.period'),
      cell: (r) => <Num muted>{`${fmtDayFull(r.def.startD, lang)} – ${r.def.endD > 223 ? '…' : fmtDayFull(r.def.endD, lang)}`}</Num>,
      sortValue: (r) => r.def.startD,
    },
    { id: 'imp', header: t('kpi.impressions'), align: 'right', sortValue: (r) => r.t?.impressions ?? null, cell: (r) => <Num>{r.t ? fmtCompact(r.t.impressions, lang) : '—'}</Num> },
    { id: 'clicks', header: t('kpi.clicks'), align: 'right', sortValue: (r) => r.t?.clicks ?? null, cell: (r) => <Num>{r.t ? fmtCompact(r.t.clicks, lang) : '—'}</Num> },
    { id: 'ctr', header: t('kpi.ctr'), align: 'right', sortValue: (r) => (r.t ? ctr(r.t.clicks, r.t.impressions) : null), cell: (r) => <Num>{r.t ? fmtPct(ctr(r.t.clicks, r.t.impressions), lang) : '—'}</Num> },
    { id: 'sessions', header: t('kpi.sessions'), align: 'right', sortValue: (r) => r.t?.sessions ?? null, cell: (r) => <Num>{r.t ? fmtCompact(r.t.sessions, lang) : '—'}</Num> },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.t?.conversions ?? null, cell: (r) => <Num>{r.t ? fmtInt(r.t.conversions, lang) : '—'}</Num> },
    { id: 'cvr', header: t('kpi.cvr'), align: 'right', sortValue: (r) => (r.t ? cvr(r.t.conversions, r.t.sessions) : null), cell: (r) => <Num>{r.t ? fmtPct(cvr(r.t.conversions, r.t.sessions), lang) : '—'}</Num> },
    { id: 'spend', header: t('kpi.spend'), align: 'right', sortValue: (r) => r.t?.spend ?? null, cell: (r) => <Num>{r.t ? fmtEur(r.t.spend, lang) : '—'}</Num> },
    {
      id: 'cpa',
      header: t('kpi.cpa'),
      align: 'right',
      sortValue: (r) => (r.t ? cpa(r.t.spend, r.t.conversions) : null),
      cell: (r) => {
        if (!r.t) return <Num muted>—</Num>;
        const v = cpa(r.t.spend, r.t.conversions);
        return v === null ? (
          <span title={t('cmp.cpaNoConv')}>
            <Num muted>—</Num>
          </span>
        ) : (
          <Num strong>{fmtEur(v, lang)}</Num>
        );
      },
    },
    {
      id: 'target',
      header: t('cmp.vsTarget'),
      align: 'right',
      headerTitle: `${t('cmp.targetCpa')} — CPA vs target`,
      sortValue: (r) => {
        if (!r.t) return null;
        const v = cpa(r.t.spend, r.t.conversions);
        return v === null ? null : relChange(v, r.def.targetCpa);
      },
      cell: (r) => {
        if (!r.t) return <Num muted>—</Num>;
        const v = cpa(r.t.spend, r.t.conversions);
        if (v === null) return <Num muted>—</Num>;
        const d = relChange(v, r.def.targetCpa);
        if (d === null) return <Num muted>—</Num>;
        const over = d > 5;
        const under = d < -5;
        return (
          <Badge tone={over ? 'neg' : under ? 'pos' : 'neutral'} title={`${t('cmp.targetCpa')}: ${fmtEur(r.def.targetCpa, lang)}`}>
            {fmtRelDelta(d, lang)}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-5 md:p-8">
      <Card title={t('cmp.table')} subtitle={t('cmp.subtitle')}>
        {rows.length > 0 ? (
          <DataTable columns={cols} rows={rows} rowKey={(r) => r.def.id} defaultSort={{ id: 'spend', dir: 'desc' }} searchable onRowClick={(r) => openDetail(r.def.id)} ariaLabel={t('cmp.table')} />
        ) : (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        )}
      </Card>

      {detail && <CampaignDrawer row={detail} q={q} onClose={closeDetail} />}
    </div>
  );
}

function CampaignDrawer({ row, q, onClose }: { row: CampRow; q: ReturnType<typeof toQ>; onClose: () => void }) {
  const { t, lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { def } = row;
  const facts = useMemo(() => dataset.campaignFacts.filter((f) => f.campaign === def.id && f.d >= q.from && f.d <= q.to), [def.id, q]);
  const tot = row.t;

  const points: TrendPoint[] = useMemo(() => {
    const map = new Map(facts.map((f) => [f.d, f]));
    const out: TrendPoint[] = [];
    for (let d = q.from; d <= q.to; d++) {
      const f = map.get(d);
      // days outside the campaign's flight are gaps, not zeros
      const inFlight = d >= def.startD && d <= def.endD;
      out.push({ d, value: f ? f.clicks : inFlight ? 0 : null, prev: null, prevD: null });
    }
    return out;
  }, [facts, q, def]);

  const statusKey = (`cmp.status.${def.status}`) as MsgKey;
  const theme = THEMES.find((th) => th.id === def.theme);
  const cpaV = tot ? cpa(tot.spend, tot.conversions) : null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/55" onMouseDown={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${t('cmp.detail')}: ${def.name}`}
        tabIndex={-1}
        className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto border-l border-brd bg-app p-5 outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow text-[10.5px]">{t('cmp.detail')}</div>
            <h2 className="m-0 mt-0.5 text-[16px] font-semibold text-t1">{def.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={def.status === 'active' ? 'pos' : def.status === 'paused' ? 'warn' : def.status === 'planned' ? 'neutral' : 'info'}>{t(statusKey).toUpperCase()}</Badge>
              <span className="mono text-[11px] text-t3">
                {fmtDayFull(def.startD, lang)} – {def.endD > 223 ? '…' : fmtDayFull(def.endD, lang)} · {def.owner} · {lang === 'fr' ? theme?.nameFr : theme?.name}
              </span>
            </div>
          </div>
          <button type="button" aria-label={t('misc.close')} onClick={onClose} className="rounded-[8px] border border-brd p-1.5 text-t2 hover:bg-hov">
            <X size={15} aria-hidden />
          </button>
        </div>

        {!tot ? (
          <EmptyState title={t('cmp.noDelivery')} body={t('state.empty.body')} />
        ) : (
          <div className="flex flex-col gap-[var(--gap-grid)]">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[
                { label: t('kpi.spend'), v: fmtEur(tot.spend, lang) },
                { label: t('kpi.impressions'), v: fmtCompact(tot.impressions, lang) },
                { label: t('kpi.clicks'), v: fmtCompact(tot.clicks, lang) },
                { label: t('kpi.ctr'), v: fmtPct(ctr(tot.clicks, tot.impressions), lang) },
                { label: t('kpi.cpc'), v: fmtEur(cpc(tot.spend, tot.clicks), lang) },
                { label: t('kpi.cpm'), v: fmtEur(cpm(tot.spend, tot.impressions), lang) },
                { label: t('kpi.conversions'), v: fmtInt(tot.conversions, lang) },
                { label: t('kpi.cvr'), v: fmtPct(cvr(tot.conversions, tot.sessions), lang) },
                {
                  label: `${t('kpi.cpa')} / ${t('misc.target').toLowerCase()}`,
                  v: cpaV === null ? '—' : `${fmtEur(cpaV, lang)} / ${fmtEur(def.targetCpa, lang)}`,
                  title: cpaV === null ? t('cmp.cpaNoConv') : undefined,
                },
              ].map((kv) => (
                <div key={kv.label} className="rounded-[10px] border border-brd bg-card p-2.5" title={kv.title}>
                  <div className="eyebrow text-[10px]">{kv.label}</div>
                  <div className="mono mt-1 text-[15px] font-semibold text-t1 tnum">{kv.v}</div>
                </div>
              ))}
            </div>

            <Card title={t('cmp.trend')} subtitle={`${t('kpi.clicks')} ${t('misc.perDay')}`}>
              <TrendChart
                points={points}
                format={(v) => fmtInt(v, lang)}
                metricLabel={t('kpi.clicks')}
                deltaKind="rel"
                showCompare={false}
                lang={lang}
                height={180}
                description={`${def.name} — ${t('kpi.clicks')}`}
              />
            </Card>

            <Card title={t('cmp.funnel')} subtitle={t('ov.funnelSub')}>
              <FunnelSteps
                stages={[
                  { id: 'imp', label: t('kpi.impressions'), value: tot.impressions },
                  { id: 'clicks', label: t('kpi.clicks'), value: tot.clicks },
                  { id: 'sessions', label: t('kpi.sessions'), value: tot.sessions },
                  { id: 'conv', label: t('kpi.conversions'), value: tot.conversions },
                ]}
                lang={lang}
                ariaLabel={`${def.name} — ${t('cmp.funnel')}`}
              />
            </Card>

            <Card title={t('cmp.markets')}>
              <div className="flex flex-wrap gap-1.5">
                {def.markets.map((m) => {
                  const mk = MARKETS.find((x) => x.id === m);
                  return (
                    <Badge key={m} tone="neutral">
                      {(lang === 'fr' ? mk?.nameFr : mk?.name) ?? m}
                    </Badge>
                  );
                })}
              </div>
              <p className="m-0 mt-2.5 text-[11px] leading-snug text-t3">
                <InfoTip text={t('rep.methodologyText')} /> {t('ov.funnelNote')}
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
