import { useMemo } from 'react';
import { FORMATS, PLATFORMS, THEMES } from '@/data/dimensions';
import { useFilters } from '@/state/FiltersContext';
import { useI18n } from '@/i18n';
import { contentItems, toQ } from '@/lib/aggregate';
import { engagementRateSocial, ratio } from '@/lib/metrics';
import { fmtCompact, fmtDayFull, fmtInt, fmtPct } from '@/lib/format';
import { RankedList } from '@/components/charts/RankedList';
import { ScatterMatrix, type MatrixPoint, type Quadrant, type QuadrantCopy } from '@/components/charts/ScatterMatrix';
import { Card, EmptyState, MiniBar } from '@/components/ui/primitives';
import { DataTable, Num, type Column } from '@/components/tables/DataTable';
import type { ContentItem } from '@/types';

export default function ContentPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const q = useMemo(() => toQ(filters), [filters]);
  const items = contentItems(q);

  /* topics */
  const byTheme = useMemo(() => {
    const m = new Map<string, { imp: number; eng: number; clicks: number; conv: number; n: number }>();
    for (const it of items) {
      const cur = m.get(it.theme) ?? { imp: 0, eng: 0, clicks: 0, conv: 0, n: 0 };
      cur.imp += it.impressions;
      cur.eng += it.reactions + it.comments + it.shares;
      cur.clicks += it.clicks;
      cur.conv += it.conversions;
      cur.n += 1;
      m.set(it.theme, cur);
    }
    return m;
  }, [items]);

  const totalEng = [...byTheme.values()].reduce((s, v) => s + v.eng, 0);
  const topicRows = THEMES.filter((th) => byTheme.has(th.id))
    .map((th) => {
      const v = byTheme.get(th.id)!;
      const er = engagementRateSocial(v.eng, v.imp);
      const share = ratio(v.eng, totalEng);
      return {
        id: th.id,
        label: lang === 'fr' ? th.nameFr : th.name,
        sub: `${v.n} · ER ${fmtPct(er, lang)} · ${fmtInt(v.conv, lang)} conv.`,
        value: v.eng,
        valueLabel: fmtCompact(v.eng, lang),
        share: share === null ? null : share * 100,
      };
    })
    .sort((a, b) => b.value - a.value);

  /* formats */
  const byFormat = useMemo(() => {
    const m = new Map<string, { imp: number; eng: number; n: number }>();
    for (const it of items) {
      const cur = m.get(it.format) ?? { imp: 0, eng: 0, n: 0 };
      cur.imp += it.impressions;
      cur.eng += it.reactions + it.comments + it.shares;
      cur.n += 1;
      m.set(it.format, cur);
    }
    return m;
  }, [items]);

  const formatRows = FORMATS.filter((f) => byFormat.has(f.id))
    .map((f) => {
      const v = byFormat.get(f.id)!;
      const er = engagementRateSocial(v.eng, v.imp) ?? 0;
      return { id: f.id, name: lang === 'fr' ? f.nameFr : f.name, er, n: v.n, imp: v.imp };
    })
    .sort((a, b) => b.er - a.er);
  const maxEr = Math.max(...formatRows.map((r) => r.er), 0.001);

  /* matrix */
  const matrixPoints: MatrixPoint[] = items.map((it) => ({
    id: it.id,
    label: lang === 'fr' ? it.titleFr : it.title,
    sub: `${PLATFORMS.find((p) => p.id === it.platform)?.name} · ${fmtDayFull(it.publishD, lang)}`,
    x: it.impressions,
    y: engagementRateSocial(it.reactions + it.comments + it.shares, it.impressions) ?? 0,
    z: it.conversions,
  }));

  const quadCopy: Record<Quadrant, QuadrantCopy> = {
    amplify: { label: t('cnt.q.amplify'), desc: t('cnt.q.amplifyDesc') },
    optimise: { label: t('cnt.q.optimise'), desc: t('cnt.q.optimiseDesc') },
    distribute: { label: t('cnt.q.distribute'), desc: t('cnt.q.distributeDesc') },
    reconsider: { label: t('cnt.q.reconsider'), desc: t('cnt.q.reconsiderDesc') },
  };

  /* library table */
  const libCols: Column<ContentItem>[] = [
    {
      id: 'title',
      header: t('nav.content'),
      cell: (r) => (
        <span className="block max-w-72 truncate text-[12px] font-medium text-t1" title={lang === 'fr' ? r.titleFr : r.title}>
          {lang === 'fr' ? r.titleFr : r.title}
        </span>
      ),
      sortValue: (r) => (lang === 'fr' ? r.titleFr : r.title),
      searchText: (r) => `${r.title} ${r.titleFr}`,
    },
    { id: 'platform', header: t('filters.platform'), cell: (r) => <Num muted>{PLATFORMS.find((p) => p.id === r.platform)?.name}</Num>, sortValue: (r) => r.platform },
    {
      id: 'theme',
      header: t('filters.theme'),
      cell: (r) => <Num muted>{(lang === 'fr' ? THEMES.find((x) => x.id === r.theme)?.nameFr : THEMES.find((x) => x.id === r.theme)?.name) ?? r.theme}</Num>,
      sortValue: (r) => r.theme,
    },
    {
      id: 'format',
      header: t('filters.format'),
      cell: (r) => <Num muted>{(lang === 'fr' ? FORMATS.find((x) => x.id === r.format)?.nameFr : FORMATS.find((x) => x.id === r.format)?.name) ?? r.format}</Num>,
      sortValue: (r) => r.format,
    },
    { id: 'date', header: t('cnt.published'), cell: (r) => <Num muted>{fmtDayFull(r.publishD, lang)}</Num>, sortValue: (r) => r.publishD },
    { id: 'imp', header: t('kpi.impressions'), align: 'right', sortValue: (r) => r.impressions, cell: (r) => <Num>{fmtCompact(r.impressions, lang)}</Num> },
    {
      id: 'er',
      header: t('kpi.engagementRate'),
      align: 'right',
      sortValue: (r) => engagementRateSocial(r.reactions + r.comments + r.shares, r.impressions),
      cell: (r) => <Num strong>{fmtPct(engagementRateSocial(r.reactions + r.comments + r.shares, r.impressions), lang)}</Num>,
    },
    { id: 'clicks', header: t('kpi.clicks'), align: 'right', sortValue: (r) => r.clicks, cell: (r) => <Num>{fmtInt(r.clicks, lang)}</Num> },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.conversions, cell: (r) => <Num>{fmtInt(r.conversions, lang)}</Num> },
  ];

  const empty = items.length === 0;

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-4 md:p-6">
      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2">
        <Card title={t('cnt.topics')} subtitle={t('cnt.topicsSub')}>
          {topicRows.length > 0 ? (
            <RankedList rows={topicRows} lang={lang} ariaLabel={t('cnt.topics')} />
          ) : (
            <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
          )}
        </Card>

        <Card title={t('cnt.formats')} subtitle={t('cnt.formatsSub')}>
          {formatRows.length > 0 ? (
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label={t('cnt.formats')}>
              {formatRows.map((r) => (
                <li key={r.id} className="grid grid-cols-[minmax(80px,130px)_1fr_auto] items-center gap-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium text-t1">{r.name}</div>
                    <div className="mono text-[9.5px] text-t3">{r.n} · {fmtCompact(r.imp, lang)} imp.</div>
                  </div>
                  <MiniBar pct={(r.er / maxEr) * 100} color="var(--ch-3)" />
                  <Num strong>{fmtPct(r.er, lang)}</Num>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
          )}
        </Card>
      </div>

      <Card title={t('cnt.matrix')} subtitle={t('cnt.matrixSub')}>
        {matrixPoints.length >= 4 ? (
          <ScatterMatrix
            points={matrixPoints}
            lang={lang}
            copy={quadCopy}
            xLabel={t('kpi.impressions')}
            yLabel={t('kpi.engagementRate')}
            zLabel={t('kpi.conversions')}
            ariaLabel={`${t('cnt.matrix')} — ${t('cnt.matrixSub')}`}
          />
        ) : (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        )}
      </Card>

      <Card title={t('cnt.items')} subtitle={t('cnt.itemsSub')}>
        {!empty ? (
          <DataTable columns={libCols} rows={items} rowKey={(r) => r.id} defaultSort={{ id: 'imp', dir: 'desc' }} searchable pageSize={10} ariaLabel={t('cnt.items')} />
        ) : (
          <EmptyState title={t('state.empty.title')} body={t('state.empty.body')} />
        )}
      </Card>
    </div>
  );
}
