import { ExternalLink, Info, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { L10n } from '@shared/catalog';
import { useApi, useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatDate, formatRange, formatValue } from '@/lib/format';
import { useTab } from '@/lib/useTab';
import { useGlobalFilters } from '@/state/filters';
import { useSession } from '@/state/session';
import { BarList } from '@/components/charts';
import { ChangeLabel } from '@/components/kpi/KpiCard';
import { DataModeBadge } from '@/components/data';
import { ClassifyDrawer, type Classifiable } from '@/components/content/ClassifyDrawer';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { Grid2 } from '@/components/modules';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { Badge, Button, Card, CardBody, CardHeader, ErrorState, Field, Input, Segmented, Select, Skeleton, TabPanel, Tabs } from '@/components/ui';

const TABS = ['catalogue', 'topics', 'freshness'] as const;
type Tab = (typeof TABS)[number];
type Kind = 'web_page' | 'social_post' | 'video';

interface Item {
  key: string;
  id: string | null;
  kind: Kind;
  channel: string;
  account?: string;
  title: string;
  url: string | null;
  language: string;
  published: string | null;
  updated?: string | null;
  topic: string | null;
  businessUnit: string | null;
  pillar: string | null;
  objective: string | null;
  audience: string | null;
  campaign: string | null;
  format: string | null;
  owner?: string | null;
  tags: string[];
  metrics: Record<string, number | null>;
  modes: Record<string, string>;
}

interface Catalog {
  range: { from: string; to: string };
  total: number;
  items: Item[];
  byTopic: Array<{ topic: string; items: number; sessions: number; impressions: number; engagements: number; videoViews: number; socialRate: number | null }>;
}

function useCatalog(extra: Record<string, string> = {}) {
  const gf = useGlobalFilters();
  return useApi<Catalog>('/api/content/catalog', { ...gf.params, ...extra });
}

function useTerm() {
  const { L } = useI18n();
  const meta = useMeta();
  return (kind: string, key: string | null | undefined) => (key ? L(meta.data?.taxonomy.find((x) => x.kind === kind && x.key === key)?.label as L10n | undefined) || key : '—');
}

function toClassifiable(x: Item): Classifiable {
  return { key: x.key, text: x.title, topic: x.topic, pillar: x.pillar, objective: x.objective, audience: x.audience, campaign: x.campaign, tags: x.tags };
}

function TitleCell({ x }: { x: Item }) {
  const term = useTerm();
  return (
    <span className="flex min-w-0 flex-col">
      <span className="line-clamp-2 font-medium text-t1">{x.title}</span>
      <span className="flex flex-wrap items-center gap-1 text-[12px] text-t3">
        {x.url && (
          <a href={x.url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-[260px] items-center gap-0.5 truncate hover:underline" onClick={(e) => e.stopPropagation()}>
            <span className="truncate">{x.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </a>
        )}
        {x.tags.map((tg) => (
          <Badge key={tg} className="!py-0 text-[11px]">
            {term('tag', tg)}
          </Badge>
        ))}
      </span>
    </span>
  );
}

function Catalogue() {
  const { t, lang, L } = useI18n();
  const meta = useMeta();
  const term = useTerm();
  const { can } = useSession();
  const [kind, setKind] = useState<Kind>('web_page');
  const [topic, setTopic] = useState('');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const res = useCatalog({ kind, topic, tag, q });
  const canTag = can('content.tag');
  const platformName = (k: string) => meta.data?.catalog.platforms.find((p) => p.id === k)?.name ?? k;

  const common: Column<Item>[] = [
    { key: 'title', header: t('content.item'), value: (x) => x.title, unit: 'text', render: (x) => <TitleCell x={x} />, width: '30%' },
    { key: 'topic', header: t('content.topic'), value: (x) => term('topic', x.topic), unit: 'text', hideOnMobile: true },
  ];
  const actions: Column<Item>[] = canTag
    ? [
        {
          key: 'act',
          header: '',
          value: () => null,
          sortable: false,
          render: (x) => (
            <Button size="sm" variant="ghost" icon={<Tag className="size-3.5" />} onClick={(e) => (e.stopPropagation(), setEditing(x))} aria-label={`${t('content.classify')}: ${x.title}`}>
              <span className="hidden xl:inline">{t('content.classify')}</span>
            </Button>
          ),
        },
      ]
    : [];
  const byKind: Record<Kind, Column<Item>[]> = {
    web_page: [
      ...common,
      { key: 'sessions', header: t('content.sessions'), value: (x) => x.metrics.sessions, unit: 'count' },
      {
        key: 'delta',
        header: t('content.change'),
        value: (x) => (x.metrics.sessionsCompare ? (x.metrics.sessions ?? 0) / x.metrics.sessionsCompare - 1 : null),
        render: (x) => {
          const cur = x.metrics.sessions ?? 0;
          const cmp = x.metrics.sessionsCompare ?? null;
          return <ChangeLabel metric="sessions" result={{ compare: cmp, delta: cmp === null ? null : cur - cmp, deltaPct: cmp ? cur / cmp - 1 : null }} compact />;
        },
        hideOnMobile: true,
      },
      { key: 'er', header: t('content.engagementRate'), value: (x) => x.metrics.engagementRate, unit: 'percent', hideOnMobile: true },
      { key: 'ke', header: t('content.keyEvents'), value: (x) => x.metrics.keyEvents, unit: 'count' },
      { key: 'oc', header: t('content.organicClicks'), value: (x) => x.metrics.organicClicks, unit: 'count', hideOnMobile: true },
      { key: 'sp', header: t('content.socialPosts'), value: (x) => x.metrics.socialPosts, unit: 'count', hideOnMobile: true },
      { key: 'ai', header: t('content.aiCitations'), value: (x) => x.metrics.aiCitations, unit: 'count', hideOnMobile: true },
      ...actions,
    ],
    social_post: [
      ...common,
      { key: 'platform', header: t('content.platform'), value: (x) => `${platformName(x.channel)} · ${x.account ?? ''}`, unit: 'text', hideOnMobile: true },
      { key: 'date', header: t('content.published'), value: (x) => x.published, unit: 'text', render: (x) => formatDate(x.published, lang, 'short'), hideOnMobile: true },
      { key: 'imp', header: t('content.impressions'), value: (x) => x.metrics.impressions, unit: 'count' },
      { key: 'eng', header: t('content.engagements'), value: (x) => x.metrics.engagements, unit: 'count' },
      { key: 'rate', header: t('content.engagementRateImpr'), value: (x) => x.metrics.rate, unit: 'percent' },
      { key: 'lc', header: t('content.linkClicks'), value: (x) => x.metrics.linkClicks, unit: 'count', hideOnMobile: true },
      ...actions,
    ],
    video: [
      ...common,
      { key: 'date', header: t('content.published'), value: (x) => x.published, unit: 'text', render: (x) => formatDate(x.published, lang, 'short'), hideOnMobile: true },
      { key: 'views', header: t('content.views'), value: (x) => x.metrics.videoViews, unit: 'count' },
      { key: 'wm', header: t('content.watchMinutes'), value: (x) => x.metrics.watchMinutes, unit: 'count' },
      { key: 'eng', header: t('content.engagements'), value: (x) => x.metrics.engagements, unit: 'count', hideOnMobile: true },
      { key: 'rate', header: t('content.engagementRateViews'), value: (x) => x.metrics.rate, unit: 'percent' },
      ...actions,
    ],
  };
  const initialSort = { web_page: 'sessions', social_post: 'eng', video: 'views' }[kind];
  const first = res.data?.items[0];
  const mode = first ? Object.values(first.modes)[0] : undefined;
  return (
    <Card>
      <CardHeader title={t('content.catalogueTitle')} subtitle={t('content.catalogueHint')} badges={<DataModeBadge mode={mode} />} />
      <CardBody>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Segmented
            label={t('content.kind')}
            value={kind}
            onChange={setKind}
            options={(['web_page', 'social_post', 'video'] as const).map((k) => ({ value: k, label: t(`content.kind_${k}`) }))}
          />
          <Field label={t('content.search')} htmlFor="c-q">
            <Input id="c-q" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56 text-[13px]" />
          </Field>
          <Field label={t('content.topic')} htmlFor="c-topic">
            <Select id="c-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-8 text-[13px]">
              <option value="">{t('content.allTopics')}</option>
              {meta.data?.taxonomy
                .filter((x) => x.kind === 'topic')
                .map((x) => (
                  <option key={x.key} value={x.key}>
                    {L(x.label)}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t('content.tags')} htmlFor="c-tag">
            <Select id="c-tag" value={tag} onChange={(e) => setTag(e.target.value)} className="h-8 text-[13px]">
              <option value="">{t('content.allTags')}</option>
              {meta.data?.taxonomy
                .filter((x) => x.kind === 'tag')
                .map((x) => (
                  <option key={x.key} value={x.key}>
                    {L(x.label)}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        {res.isLoading ? (
          <Skeleton className="h-72" />
        ) : res.isError ? (
          <ErrorState error={res.error} onRetry={() => res.refetch()} />
        ) : (
          <>
            <p className="mb-2 text-[12.5px] text-t3 tnum">
              {t('content.count', { n: formatValue(res.data!.total, 'count', lang) })} · {formatRange(res.data!.range, lang)}
            </p>
            <DataTable
              key={kind}
              rows={res.data!.items}
              columns={byKind[kind]}
              caption={t('content.catalogueTitle')}
              exportTitle={`content-${kind}`}
              exportMeta={[[t('common.period'), formatRange(res.data!.range, lang)]]}
              initialSort={{ key: initialSort, desc: true }}
              rowKey={(x) => x.key}
              onRowClick={canTag ? (x) => setEditing(x) : undefined}
            />
          </>
        )}
        {kind === 'web_page' && <p className="mt-3 text-[12px] text-t3">{t('content.webNote')}</p>}
      </CardBody>
      <ClassifyDrawer item={editing && toClassifiable(editing)} onClose={() => setEditing(null)} />
    </Card>
  );
}

function Topics() {
  const { t, lang } = useI18n();
  const term = useTerm();
  const res = useCatalog();
  if (res.isLoading) return <Skeleton className="h-72" />;
  if (res.isError || !res.data) return <ErrorState error={res.error} onRetry={() => res.refetch()} />;
  const rows = res.data.byTopic;
  const label = (k: string) => (k === '(untagged)' ? t('content.untagged') : term('topic', k));
  const top = (pick: (r: (typeof rows)[number]) => number) =>
    [...rows]
      .sort((a, b) => pick(b) - pick(a))
      .slice(0, 8)
      .map((r) => ({ key: r.topic, label: label(r.topic), value: pick(r) }));
  return (
    <>
      <Grid2>
        <Card>
          <CardHeader title={t('content.topicSessions')} subtitle={t('content.topicSessionsHint')} />
          <CardBody>
            <BarList items={top((r) => r.sessions)} unit="count" showDelta={false} ariaLabel={t('content.topicSessions')} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('content.topicImpressions')} subtitle={t('content.topicImpressionsHint')} />
          <CardBody>
            <BarList items={top((r) => r.impressions)} unit="count" showDelta={false} ariaLabel={t('content.topicImpressions')} />
          </CardBody>
        </Card>
      </Grid2>
      <Card>
        <CardHeader title={t('content.topicTable')} subtitle={t('content.topicTableHint')} />
        <CardBody>
          <DataTable
            rows={rows}
            caption={t('content.topicTable')}
            exportTitle="content-topics"
            exportMeta={[[t('common.period'), formatRange(res.data.range, lang)]]}
            initialSort={{ key: 'sessions', desc: true }}
            rowKey={(r) => r.topic}
            columns={[
              { key: 'topic', header: t('content.topic'), value: (r) => label(r.topic), unit: 'text' },
              { key: 'items', header: t('content.items'), value: (r) => r.items, unit: 'count' },
              { key: 'sessions', header: t('content.sessions'), value: (r) => r.sessions, unit: 'count' },
              { key: 'impressions', header: t('content.socialImpressions'), value: (r) => r.impressions, unit: 'count', hideOnMobile: true },
              { key: 'engagements', header: t('content.socialEngagements'), value: (r) => r.engagements, unit: 'count', hideOnMobile: true },
              { key: 'rate', header: t('content.engagementRateImpr'), value: (r) => r.socialRate, unit: 'percent' },
              { key: 'views', header: t('content.views'), value: (r) => r.videoViews, unit: 'count', hideOnMobile: true },
            ]}
          />
        </CardBody>
      </Card>
    </>
  );
}

const STALE_DAYS = 365;

function Freshness() {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const term = useTerm();
  const res = useCatalog({ kind: 'web_page' });
  const pages = useMemo(() => res.data?.items ?? [], [res.data]);
  if (res.isLoading) return <Skeleton className="h-72" />;
  if (res.isError || !res.data) return <ErrorState error={res.error} onRetry={() => res.refetch()} />;
  const age = (d: string | null | undefined) => (d ? Math.floor((Date.parse(gf.asOf) - Date.parse(d)) / 86400000) : null);
  const stale = pages.filter((x) => (age(x.updated) ?? 0) >= STALE_DAYS && (x.metrics.sessions ?? 0) > 0);
  const noAi = pages.filter((x) => (x.metrics.aiCitations ?? 0) === 0 && (x.metrics.organicClicks ?? 0) > 0);
  const noSocial = pages.filter((x) => (x.metrics.socialPosts ?? 0) === 0 && (x.metrics.sessions ?? 0) > 0);
  const cols = (extra: Column<Item>[]): Column<Item>[] => [
    { key: 'title', header: t('content.item'), value: (x) => x.title, unit: 'text', render: (x) => <TitleCell x={x} />, width: '40%' },
    { key: 'topic', header: t('content.topic'), value: (x) => term('topic', x.topic), unit: 'text', hideOnMobile: true },
    { key: 'owner', header: t('content.owner'), value: (x) => x.owner ?? '—', unit: 'text', hideOnMobile: true },
    ...extra,
  ];
  return (
    <>
      <p role="note" className="flex items-start gap-2 rounded-lg border border-brd bg-card px-3 py-2 text-[13px] text-t2">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('content.gapsNote')}
      </p>
      <Card>
        <CardHeader title={t('content.staleTitle', { n: stale.length })} subtitle={t('content.staleHint', { days: STALE_DAYS })} />
        <CardBody>
          <DataTable
            rows={stale}
            caption={t('content.staleTitle', { n: stale.length })}
            exportTitle="content-stale-pages"
            initialSort={{ key: 'sessions', desc: true }}
            rowKey={(x) => x.key}
            pageSize={10}
            columns={cols([
              { key: 'updated', header: t('content.lastUpdated'), value: (x) => x.updated ?? null, unit: 'text', render: (x) => formatDate(x.updated ?? null, lang, 'medium') },
              { key: 'sessions', header: t('content.sessions'), value: (x) => x.metrics.sessions, unit: 'count' },
            ])}
          />
        </CardBody>
      </Card>
      <Grid2>
        <Card>
          <CardHeader title={t('content.noAiTitle', { n: noAi.length })} subtitle={t('content.noAiHint')} />
          <CardBody>
            <DataTable
              dense
              rows={noAi}
              caption={t('content.noAiTitle', { n: noAi.length })}
              exportTitle="content-no-ai-citation"
              initialSort={{ key: 'oc', desc: true }}
              rowKey={(x) => x.key}
              pageSize={8}
              columns={[
                { key: 'title', header: t('content.item'), value: (x) => x.title, unit: 'text', render: (x) => <TitleCell x={x} /> },
                { key: 'oc', header: t('content.organicClicks'), value: (x) => x.metrics.organicClicks, unit: 'count' },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('content.noSocialTitle', { n: noSocial.length })} subtitle={t('content.noSocialHint')} />
          <CardBody>
            <DataTable
              dense
              rows={noSocial}
              caption={t('content.noSocialTitle', { n: noSocial.length })}
              exportTitle="content-no-social-post"
              initialSort={{ key: 'sessions', desc: true }}
              rowKey={(x) => x.key}
              pageSize={8}
              columns={[
                { key: 'title', header: t('content.item'), value: (x) => x.title, unit: 'text', render: (x) => <TitleCell x={x} /> },
                { key: 'sessions', header: t('content.sessions'), value: (x) => x.metrics.sessions, unit: 'count' },
              ]}
            />
          </CardBody>
        </Card>
      </Grid2>
    </>
  );
}

export default function ContentPage() {
  const { t } = useI18n();
  const [tab, setTab] = useTab<Tab>(TABS, 'catalogue');
  return (
    <>
      <PageHeader title={t('content.title')} subtitle={t('content.subtitle')} crumbs={[{ label: t('nav.content') }]} />
      <FilterToolbar dims={['site', 'language', 'platform', 'bu', 'campaign']} extraDims={[]} />
      <PageBody>
        <p role="note" className="flex items-start gap-2 rounded-lg border border-brd bg-card px-3 py-2 text-[13px] text-t2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('content.noScore')}
        </p>
        <Tabs label={t('content.title')} value={tab} onChange={setTab} tabs={TABS.map((id) => ({ id, label: t(`content.tab_${id}`) }))} />
        <TabPanel id={tab}>
          <div className="flex flex-col gap-[var(--gap-grid)]">
            {tab === 'catalogue' && <Catalogue />}
            {tab === 'topics' && <Topics />}
            {tab === 'freshness' && <Freshness />}
          </div>
        </TabPanel>
      </PageBody>
    </>
  );
}
