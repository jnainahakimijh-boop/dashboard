import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PLATFORMS } from '@/data/dimensions';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { contentItems, prevQ, socialBy, socialMissingDays, socialTotals, toQ, type SocialTotals } from '@/lib/aggregate';
import { ctr, engagementRateSocial } from '@/lib/metrics';
import { SOCIAL_KPIS, kpiDelta } from '@/lib/kpis';
import { fmtCompact, fmtDayFull, fmtInt, fmtPct, fmtSignedInt } from '@/lib/format';
import { KpiCard, KpiGrid } from '@/components/kpi/KpiCard';
import { TrendChart, type TrendPoint } from '@/components/charts/TrendChart';
import { StackedBars } from '@/components/charts/StackedBars';
import { Badge, Card, EmptyState, Segmented } from '@/components/ui/primitives';
import { DataTable, Num, type Column } from '@/components/tables/DataTable';
import { FORMATS, THEMES } from '@/data/dimensions';

type SocMetric = 'impressions' | 'engagements' | 'clicks';

export default function SocialPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => prevQ(q), [q]);
  const showCompare = filters.compare === 'previous';

  const now = socialTotals(q);
  const prev = socialTotals(p);
  const dayMap = socialBy(q, 'day') as Map<string | number, SocialTotals>;
  const prevDayMap = socialBy(p, 'day') as Map<string | number, SocialTotals>;

  const xFilteredIn = filters.platforms.length === 0 || filters.platforms.includes('x');
  const missingX = xFilteredIn ? socialMissingDays(q, 'x') : [];

  const [metric, setMetric] = useState<SocMetric>('impressions');

  // a day with no collected rows at all renders as a gap (null), never zero
  const seriesOf = (map: Map<string | number, SocialTotals>, range: { from: number; to: number }): (number | null)[] => {
    const out: (number | null)[] = [];
    for (let d = range.from; d <= range.to; d++) {
      const s = map.get(d);
      out.push(s ? s[metric] : null);
    }
    return out;
  };

  const cur = seriesOf(dayMap, q);
  const prv = seriesOf(prevDayMap, p);
  const points: TrendPoint[] = cur.map((v, i) => ({ d: q.from + i, value: v, prev: prv[i] ?? null, prevD: p.from + i <= p.to ? p.from + i : null }));

  /* platform table */
  const byPlatform = socialBy(q, 'platform') as Map<string, SocialTotals>;
  interface PfRow {
    id: string;
    name: string;
    t: SocialTotals;
  }
  const pfRows: PfRow[] = PLATFORMS.filter((pf) => byPlatform.has(pf.id)).map((pf) => ({ id: pf.id, name: pf.name, t: byPlatform.get(pf.id)! }));
  const pfCols: Column<PfRow>[] = [
    { id: 'name', header: t('filters.platform'), cell: (r) => <span className="text-[12px] font-medium text-t1">{r.name}</span>, sortValue: (r) => r.name, searchText: (r) => r.name },
    { id: 'impressions', header: t('kpi.impressions'), align: 'right', sortValue: (r) => r.t.impressions, cell: (r) => <Num strong>{fmtCompact(r.t.impressions, lang)}</Num> },
    { id: 'reach', header: t('kpi.reach'), align: 'right', sortValue: (r) => r.t.reach, cell: (r) => <Num>{fmtCompact(r.t.reach, lang)}</Num> },
    { id: 'eng', header: t('kpi.engagements'), align: 'right', sortValue: (r) => r.t.engagements, cell: (r) => <Num>{fmtCompact(r.t.engagements, lang)}</Num> },
    {
      id: 'er',
      header: t('kpi.engagementRate'),
      align: 'right',
      sortValue: (r) => engagementRateSocial(r.t.engagements, r.t.impressions),
      cell: (r) => <Num>{fmtPct(engagementRateSocial(r.t.engagements, r.t.impressions), lang)}</Num>,
    },
    { id: 'clicks', header: t('kpi.clicks'), align: 'right', sortValue: (r) => r.t.clicks, cell: (r) => <Num>{fmtCompact(r.t.clicks, lang)}</Num> },
    { id: 'ctr', header: t('kpi.ctr'), align: 'right', sortValue: (r) => ctr(r.t.clicks, r.t.impressions), cell: (r) => <Num>{fmtPct(ctr(r.t.clicks, r.t.impressions), lang)}</Num> },
    { id: 'video', header: t('kpi.videoViews'), align: 'right', sortValue: (r) => r.t.videoViews, cell: (r) => <Num muted>{r.t.videoViews > 0 ? fmtCompact(r.t.videoViews, lang) : '—'}</Num> },
    { id: 'followers', header: t('kpi.followerNet'), align: 'right', sortValue: (r) => r.t.followerNet, cell: (r) => <Num>{fmtSignedInt(r.t.followerNet, lang)}</Num> },
  ];

  /* engagement composition */
  const compData = pfRows.map((r) => ({
    name: r.name,
    reactions: r.t.reactions,
    comments: r.t.comments,
    shares: r.t.shares,
    clicks: r.t.clicks,
  }));

  /* top posts */
  const items = contentItems(q);
  const topPosts = useMemo(
    () =>
      [...items]
        .map((c) => ({ ...c, er: engagementRateSocial(c.reactions + c.comments + c.shares, c.impressions) }))
        .sort((a, b) => (b.er ?? 0) * Math.log10(Math.max(b.impressions, 10)) - (a.er ?? 0) * Math.log10(Math.max(a.impressions, 10)))
        .slice(0, 8),
    [items],
  );

  type PostRow = (typeof topPosts)[number];
  const postAction = (r: PostRow): { label: string; tone: 'pos' | 'info' | 'warn' | 'neutral' } => {
    const medianImp = 12000;
    if ((r.er ?? 0) > 4 && r.impressions > medianImp) return { label: t('cnt.q.amplify'), tone: 'pos' };
    if ((r.er ?? 0) > 4) return { label: t('cnt.q.distribute'), tone: 'info' };
    if (r.impressions > medianImp) return { label: t('cnt.q.optimise'), tone: 'warn' };
    return { label: t('cnt.q.reconsider'), tone: 'neutral' };
  };
  const postCols: Column<PostRow>[] = [
    {
      id: 'title',
      header: t('nav.content'),
      cell: (r) => (
        <span className="block max-w-64 truncate text-[12px] font-medium text-t1" title={lang === 'fr' ? r.titleFr : r.title}>
          {lang === 'fr' ? r.titleFr : r.title}
        </span>
      ),
      sortValue: (r) => (lang === 'fr' ? r.titleFr : r.title),
      searchText: (r) => `${r.title} ${r.titleFr}`,
    },
    { id: 'platform', header: t('filters.platform'), cell: (r) => <Num muted>{PLATFORMS.find((pf) => pf.id === r.platform)?.name}</Num>, sortValue: (r) => r.platform },
    { id: 'date', header: t('cnt.published'), cell: (r) => <Num muted>{fmtDayFull(r.publishD, lang)}</Num>, sortValue: (r) => r.publishD },
    { id: 'theme', header: t('filters.theme'), cell: (r) => <Num muted>{(lang === 'fr' ? THEMES.find((x) => x.id === r.theme)?.nameFr : THEMES.find((x) => x.id === r.theme)?.name) ?? r.theme}</Num>, sortValue: (r) => r.theme },
    { id: 'format', header: t('filters.format'), cell: (r) => <Num muted>{(lang === 'fr' ? FORMATS.find((x) => x.id === r.format)?.nameFr : FORMATS.find((x) => x.id === r.format)?.name) ?? r.format}</Num>, sortValue: (r) => r.format },
    { id: 'imp', header: t('kpi.impressions'), align: 'right', sortValue: (r) => r.impressions, cell: (r) => <Num>{fmtCompact(r.impressions, lang)}</Num> },
    { id: 'er', header: t('kpi.engagementRate'), align: 'right', sortValue: (r) => r.er, cell: (r) => <Num strong>{fmtPct(r.er, lang)}</Num> },
    { id: 'clicks', header: t('kpi.clicks'), align: 'right', sortValue: (r) => r.clicks, cell: (r) => <Num>{fmtInt(r.clicks, lang)}</Num> },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.conversions, cell: (r) => <Num>{fmtInt(r.conversions, lang)}</Num> },
    {
      id: 'action',
      header: t('ins.action'),
      align: 'right',
      cell: (r) => {
        const a = postAction(r);
        return <Badge tone={a.tone}>{a.label.toUpperCase()}</Badge>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-4 md:p-6">
      {missingX.length > 0 && (
        <div role="status" className="flex items-center gap-2.5 rounded-[11px] border border-warn/30 bg-warnsoft px-3.5 py-2.5 text-[12px] text-t1">
          <AlertTriangle size={14} className="shrink-0 text-warn" aria-hidden />
          {t('soc.gapNote', { n: missingX.length })}
        </div>
      )}

      <KpiGrid dense>
        {SOCIAL_KPIS.slice(0, 6).map((k) => (
          <KpiCard
            key={k.id}
            label={t(k.labelKey)}
            definition={t(k.defKey)}
            value={k.format(k.value(now), lang)}
            prevValue={k.format(k.value(prev), lang)}
            delta={showCompare ? kpiDelta(k, now, prev) : undefined}
            compareLabel={showCompare ? t('compare.short') : undefined}
            compareLabelFull={showCompare ? t('compare.label') : undefined}
            lang={lang}
          />
        ))}
      </KpiGrid>

      <Card
        title={t('soc.overTime')}
        subtitle={t('ov.trendSub')}
        right={
          <Segmented
            ariaLabel={t('soc.overTime')}
            size="sm"
            options={[
              { id: 'impressions', label: t('kpi.impressions') },
              { id: 'engagements', label: t('kpi.engagements') },
              { id: 'clicks', label: t('kpi.clicks') },
            ]}
            value={metric}
            onChange={setMetric}
          />
        }
      >
        {now.impressions > 0 ? (
          <TrendChart
            points={points}
            format={(v) => fmtInt(v, lang)}
            metricLabel={t(metric === 'impressions' ? 'kpi.impressions' : metric === 'engagements' ? 'kpi.engagements' : 'kpi.clicks')}
            deltaKind="rel"
            showCompare={showCompare}
            lang={lang}
            description={`${t('soc.title')} — ${t('ov.trendSub')}`}
            height={260}
          />
        ) : (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        )}
      </Card>

      <Card title={t('soc.platforms')} subtitle={t('soc.platformsSub')}>
        {pfRows.length > 0 ? (
          <DataTable columns={pfCols} rows={pfRows} rowKey={(r) => r.id} defaultSort={{ id: 'impressions', dir: 'desc' }} ariaLabel={t('soc.platforms')} />
        ) : (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        )}
      </Card>

      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-5">
        <Card title={t('soc.composition')} subtitle={t('soc.compositionSub')} className="lg:col-span-2">
          {compData.length > 0 ? (
            <StackedBars
              data={compData}
              series={[
                { key: 'reactions', label: lang === 'fr' ? 'Réactions' : 'Reactions' },
                { key: 'comments', label: lang === 'fr' ? 'Commentaires' : 'Comments' },
                { key: 'shares', label: lang === 'fr' ? 'Partages' : 'Shares' },
                { key: 'clicks', label: t('kpi.clicks') },
              ]}
              lang={lang}
              ariaLabel={t('soc.composition')}
              height={300}
            />
          ) : (
            <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
          )}
        </Card>

        <Card title={t('soc.topPosts')} subtitle={t('soc.topPostsSub')} className="lg:col-span-3">
          {topPosts.length > 0 ? (
            <DataTable columns={postCols} rows={topPosts} rowKey={(r) => r.id} ariaLabel={t('soc.topPosts')} />
          ) : (
            <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
          )}
        </Card>
      </div>
    </div>
  );
}
