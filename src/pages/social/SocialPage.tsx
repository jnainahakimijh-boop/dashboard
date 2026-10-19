import { Tag } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ResultNote } from '@shared/filters';
import { api } from '@/api/client';
import { useApi, useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatDate, formatPct, formatRange, formatValue } from '@/lib/format';
import { useTab } from '@/lib/useTab';
import { useGlobalFilters } from '@/state/filters';
import { useSession } from '@/state/session';
import { BarList, Heatmap } from '@/components/charts';
import { DataModeBadge, noteText } from '@/components/data';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { Grid2, KpiRow, TrendCard, useDimLabel } from '@/components/modules';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Drawer, EmptyState, Field, Input, Pagination, Select, Skeleton, TabPanel, Tabs, useToast } from '@/components/ui';

const TABS = ['overview', 'linkedin', 'x', 'youtube', 'posts', 'compare', 'timing'] as const;
type Tab = (typeof TABS)[number];

interface Account {
  key: string;
  name: string;
  platform: string;
  followersStart: number | null;
  followersEnd: number | null;
  followersGained: number;
  followersLost: number;
  posts: number;
  impressions: number;
  impressionsKind: 'post' | 'thumbnail';
  engagements: number | null;
  rate: number | null;
  rateCompare: number | null;
  videoViews: number | null;
  watchMinutes: number | null;
  linkClicks: number | null;
}

function Accounts() {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const q = useApi<{ accounts: Account[]; notes: ResultNote[]; mode: string }>('/api/social/accounts', gf.params);
  return (
    <Card>
      <CardHeader title={t('social.accounts')} subtitle={t('social.erNote')} badges={q.data && <DataModeBadge mode={q.data.mode} />} />
      <CardBody>
        {q.isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <>
            <DataTable
              caption={t('social.accounts')}
              rows={q.data?.accounts ?? []}
              rowKey={(r) => r.key}
              exportTitle="social-accounts"
              exportMeta={[['Period', formatRange(gf.range, lang)], ['Data mode', q.data?.mode ?? '']]}
              initialSort={{ key: 'end', desc: true }}
              columns={[
                { key: 'name', header: t('social.account'), value: (r) => r.name, unit: 'text', render: (r) => <span>{r.name}<span className="block text-[11.5px] text-t3 capitalize">{r.platform}</span></span> },
                { key: 'end', header: t('social.followersEnd'), value: (r) => r.followersEnd, unit: 'count' },
                { key: 'net', header: t('social.net'), value: (r) => r.followersGained - r.followersLost, unit: 'count', render: (r) => <span className={r.followersGained - r.followersLost < 0 ? 'text-neg' : ''}>{formatValue(r.followersGained - r.followersLost, 'count', lang)}</span> },
                { key: 'posts', header: t('social.posts'), value: (r) => r.posts, unit: 'count', hideOnMobile: true },
                { key: 'imp', header: t('social.impressions'), value: (r) => r.impressions, unit: 'count', render: (r) => <span title={r.impressionsKind === 'thumbnail' ? t('social.impressionsThumb') : undefined}>{formatValue(r.impressions, 'count', lang, { compact: true })}{r.impressionsKind === 'thumbnail' ? '*' : ''}</span> },
                { key: 'rate', header: t('social.rate'), value: (r) => r.rate, unit: 'percent' },
                { key: 'views', header: t('social.views'), value: (r) => r.videoViews, unit: 'count', hideOnMobile: true },
                { key: 'clicks', header: t('social.linkClicks'), value: (r) => r.linkClicks, unit: 'count', hideOnMobile: true },
              ]}
            />
            <p className="mt-2 text-[12px] text-t3">* {t('social.ytNote')}</p>
            {q.data?.notes.map((n, i) => (
              <p key={i} className="mt-1 text-[12px] text-warn">
                {noteText(n, t, lang)}
              </p>
            ))}
          </>
        )}
      </CardBody>
    </Card>
  );
}

interface Post {
  id: string;
  account: string;
  accountName: string;
  platform: string;
  date: string;
  hour: number;
  format: string;
  topic: string;
  pillar: string;
  objective: string;
  audience: string;
  campaign: string | null;
  text: string;
  url: string | null;
  impressions: number;
  engagements: number;
  rate: number | null;
  rateBasis: string;
  linkClicks: number;
  videoViews: number;
  watchMinutes: number;
  tags: string[];
}

function ClassifyDrawer({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const { t, L } = useI18n();
  const meta = useMeta();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<Partial<Post>>({});
  const [saving, setSaving] = useState(false);
  const terms = (kind: string) => meta.data?.taxonomy.filter((x) => x.kind === kind) ?? [];
  const cur = { ...post, ...form } as Post;
  if (!post) return null;
  const save = async () => {
    setSaving(true);
    try {
      await api.send('PUT', `/api/content/items/${encodeURIComponent(post.id)}/classification`, { topic: cur.topic, pillar: cur.pillar, objective: cur.objective, audience: cur.audience, campaign: cur.campaign, tags: cur.tags });
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/social') || String(q.queryKey[0]).startsWith('/api/content') });
      toast(t('social.saved'), 'pos');
      setForm({});
      onClose();
    } catch (e) {
      toast((e as Error).message, 'neg');
    } finally {
      setSaving(false);
    }
  };
  const sel = (kind: 'topic' | 'pillar' | 'objective' | 'audience', label: string) => (
    <Field label={label} htmlFor={`c-${kind}`}>
      <Select id={`c-${kind}`} value={cur[kind] ?? ''} onChange={(e) => setForm({ ...form, [kind]: e.target.value })}>
        {terms(kind).map((x) => (
          <option key={x.key} value={x.key}>
            {L(x.label)}
          </option>
        ))}
      </Select>
    </Field>
  );
  return (
    <Drawer
      open={!!post}
      onClose={() => (setForm({}), onClose())}
      title={t('social.classifyTitle')}
      footer={
        <>
          <Button onClick={() => (setForm({}), onClose())}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-lg bg-card2 p-3 text-[13.5px]">{post.text}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sel('topic', t('social.topic'))}
        {sel('pillar', t('social.pillar'))}
        {sel('objective', t('social.objective'))}
        {sel('audience', t('social.audience'))}
        <Field label={t('social.campaign')} htmlFor="c-campaign">
          <Select id="c-campaign" value={cur.campaign ?? ''} onChange={(e) => setForm({ ...form, campaign: e.target.value || null })}>
            <option value="">—</option>
            {meta.data?.campaigns.map((c) => (
              <option key={c.key} value={c.key}>
                {L(c.name)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset className="mt-4">
        <legend className="mb-1 text-[13px] font-medium">{t('social.tags')}</legend>
        {terms('tag').map((tg) => (
          <Checkbox key={tg.key} checked={cur.tags?.includes(tg.key) ?? false} onChange={(c) => setForm({ ...form, tags: c ? [...(cur.tags ?? []), tg.key] : (cur.tags ?? []).filter((x) => x !== tg.key) })} label={L(tg.label)} />
        ))}
      </fieldset>
    </Drawer>
  );
}

function PostsTable({ platform }: { platform?: string }) {
  const { t, lang, L } = useI18n();
  const gf = useGlobalFilters();
  const meta = useMeta();
  const { can } = useSession();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('engagements');
  const [q, setQ] = useState('');
  const [account, setAccount] = useState('');
  const [format, setFormat] = useState('');
  const [topic, setTopic] = useState('');
  const [editing, setEditing] = useState<Post | null>(null);
  const params = { ...gf.params, platform: platform ?? gf.params.platform, account, format, topic, q, sort, page, pageSize: 20 };
  const res = useApi<{ items: Post[]; total: number; page: number; pageSize: number; mode: string; ignoredFilters: string[] }>('/api/social/posts', params);
  const topicLabel = (k: string) => L(meta.data?.taxonomy.find((x) => x.kind === 'topic' && x.key === k)?.label) || k;
  return (
    <Card>
      <CardHeader title={t('social.postsTitle')} subtitle={t('social.postsHint')} badges={res.data && <DataModeBadge mode={res.data.mode} />} />
      <CardBody>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label={t('social.searchPosts')} htmlFor="p-q">
            <Input id="p-q" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} className="h-8 w-56 text-[13px]" />
          </Field>
          {!platform && (
            <Field label={t('social.account')} htmlFor="p-acc">
              <Select id="p-acc" value={account} onChange={(e) => (setAccount(e.target.value), setPage(1))} className="h-8 text-[13px]">
                <option value="">{t('social.allAccounts')}</option>
                {meta.data?.accounts.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t('social.format')} htmlFor="p-fmt">
            <Select id="p-fmt" value={format} onChange={(e) => (setFormat(e.target.value), setPage(1))} className="h-8 text-[13px]">
              <option value="">{t('social.allFormats')}</option>
              {meta.data?.catalog.formats.filter((f) => !platform || f.platforms.includes(platform)).map((f) => (
                <option key={f.id} value={f.id}>
                  {L(f.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('social.topic')} htmlFor="p-topic">
            <Select id="p-topic" value={topic} onChange={(e) => (setTopic(e.target.value), setPage(1))} className="h-8 text-[13px]">
              <option value="">{t('social.allTopics')}</option>
              {meta.data?.taxonomy.filter((x) => x.kind === 'topic').map((x) => (
                <option key={x.key} value={x.key}>
                  {L(x.label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('common.sortDesc')} htmlFor="p-sort">
            <Select id="p-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 text-[13px]">
              {['engagements', 'impressions', 'rate', 'linkClicks', 'videoViews', 'date'].map((s) => (
                <option key={s} value={s}>
                  {s === 'date' ? t('social.date') : s === 'rate' ? t('social.rate') : s === 'linkClicks' ? t('social.linkClicks') : s === 'videoViews' ? t('social.views') : t(`social.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {res.isLoading ? (
          <Skeleton className="h-64" />
        ) : !res.data?.items.length ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-brd">
            <table className="w-full text-[13px]">
              <caption className="sr-only">{t('social.postsTitle')}</caption>
              <thead className="bg-card2 text-left text-t2">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">{t('social.text')}</th>
                  <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">{t('social.topic')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">{t('social.impressions')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">{t('social.engagements')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">{t('social.rate')}</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-semibold md:table-cell">{t('social.linkClicks')}</th>
                  {can('content.tag') && <th scope="col" className="px-3 py-2"><span className="sr-only">{t('social.classify')}</span></th>}
                </tr>
              </thead>
              <tbody>
                {res.data.items.map((p) => (
                  <tr key={p.id} className="border-t border-brd align-top">
                    <td className="max-w-[380px] px-3 py-2.5">
                      <p className="line-clamp-2 text-t1">{p.text}</p>
                      <p className="mt-0.5 text-[11.5px] text-t3">
                        {p.accountName} · {formatDate(p.date, lang)} · {String(p.hour).padStart(2, '0')}h · {L(meta.data?.catalog.formats.find((f) => f.id === p.format)?.name) || p.format}
                      </p>
                      {p.tags.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {p.tags.map((tg) => (
                            <Badge key={tg}>{L(meta.data?.taxonomy.find((x) => x.kind === 'tag' && x.key === tg)?.label) || tg}</Badge>
                          ))}
                        </p>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 text-t2 md:table-cell">{topicLabel(p.topic)}</td>
                    <td className="px-3 py-2.5 text-right tnum">{p.platform === 'youtube' ? `${formatValue(p.videoViews, 'count', lang, { compact: true })} ${t('social.views').toLowerCase()}` : formatValue(p.impressions, 'count', lang, { compact: true })}</td>
                    <td className="px-3 py-2.5 text-right tnum">{formatValue(p.engagements, 'count', lang)}</td>
                    <td className="px-3 py-2.5 text-right tnum">
                      {formatPct(p.rate, lang, false)}
                      <span className="block text-[11px] text-t3">/{p.rateBasis === 'views' ? t('social.views').toLowerCase() : t('social.impressions').toLowerCase()}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tnum md:table-cell">{p.platform === 'youtube' ? '—' : formatValue(p.linkClicks, 'count', lang)}</td>
                    {can('content.tag') && (
                      <td className="px-3 py-2.5">
                        <Button size="sm" variant="ghost" icon={<Tag className="size-3.5" />} onClick={() => setEditing(p)}>
                          <span className="sr-only md:not-sr-only">{t('social.classify')}</span>
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {res.data && <Pagination page={res.data.page} pageSize={res.data.pageSize} total={res.data.total} onPage={setPage} />}
      </CardBody>
      <ClassifyDrawer post={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function Compare() {
  const { t, L } = useI18n();
  const gf = useGlobalFilters();
  const meta = useMeta();
  const lbl = useDimLabel();
  const [by, setBy] = useState('topic');
  const q = useApi<{ groups: Array<{ key: string; posts: number; impressions: number; engagements: number; rate: number | null; medianImpressions: number | null; linkClicks: number; videoViews: number; lowSample: boolean }>; mode: string }>('/api/social/compare', { ...gf.params, by });
  const label = (k: string) => {
    if (by === 'topic' || by === 'pillar' || by === 'objective' || by === 'audience') return L(meta.data?.taxonomy.find((x) => x.kind === by && x.key === k)?.label) || k;
    if (by === 'format') return L(meta.data?.catalog.formats.find((f) => f.id === k)?.name) || k;
    if (by === 'campaign') return lbl('campaign', k);
    if (by === 'account') return lbl('account', k);
    return k;
  };
  const rows = (q.data?.groups ?? []).map((g) => ({ ...g, label: label(g.key) }));
  return (
    <Card>
      <CardHeader
        title={t('social.tabCompare')}
        subtitle={t('social.compareHint')}
        badges={q.data && <DataModeBadge mode={q.data.mode} />}
        actions={
          <Field label={t('social.compareBy')} htmlFor="cmp-by">
            <Select id="cmp-by" value={by} onChange={(e) => setBy(e.target.value)} className="h-8 text-[13px]">
              {['topic', 'format', 'campaign', 'pillar', 'objective', 'audience', 'account'].map((b) => (
                <option key={b} value={b}>
                  {t(`social.by_${b}`)}
                </option>
              ))}
            </Select>
          </Field>
        }
      />
      <CardBody>
        <Grid2>
          <BarList unit="percent" showDelta={false} ariaLabel={t('social.rate')} items={rows.filter((r) => r.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)).map((r) => ({ key: r.key, label: r.label, value: r.rate, sublabel: `${r.posts} ${t('social.posts').toLowerCase()}${r.lowSample ? ` · ${t('common.lowSample')}` : ''}` }))} />
          <DataTable
            caption={t('social.tabCompare')}
            rows={rows}
            pageSize={12}
            exportTitle={`social-compare-${by}`}
            initialSort={{ key: 'posts', desc: true }}
            columns={[
              { key: 'label', header: t(`social.by_${by}`), value: (r) => r.label, unit: 'text', render: (r) => <span>{r.label} {r.lowSample && <Badge tone="warn">{t('common.lowSample')}</Badge>}</span> },
              { key: 'posts', header: t('social.posts'), value: (r) => r.posts, unit: 'count' },
              { key: 'rate', header: t('social.rate'), value: (r) => r.rate, unit: 'percent' },
              { key: 'median', header: t('social.medianImpressions'), value: (r) => r.medianImpressions, unit: 'count', hideOnMobile: true },
              { key: 'clicks', header: t('social.linkClicks'), value: (r) => r.linkClicks, unit: 'count', hideOnMobile: true },
            ]}
          />
        </Grid2>
      </CardBody>
    </Card>
  );
}

interface Timing {
  platform: string;
  slots: Array<{ id: string }>;
  cells: Array<{ weekday: number; slot: string; posts: number; medianRate: number | null }>;
  posts: number;
  overallMedianRate: number | null;
  thresholds: { minPostsPerCell: number; minPostsTotal: number; minLift: number };
  recommendation: { weekday: number; slot: string; lift: number } | null;
  reason: string;
  caveat: string;
  mode: string;
}

function TimingPanel() {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const [platform, setPlatform] = useState('linkedin');
  const q = useApi<Timing>('/api/social/timing', { ...gf.params, platform });
  const d = q.data;
  return (
    <Card>
      <CardHeader
        title={t('social.timingTitle')}
        subtitle={t('social.timingHint')}
        badges={d && <DataModeBadge mode={d.mode} />}
        actions={
          <Select aria-label={t('social.platform')} value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-8 text-[13px]">
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
            <option value="youtube">YouTube</option>
          </Select>
        }
      />
      <CardBody>
        {!d ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <div role="status" className="mb-4 rounded-lg border border-brd bg-card2 p-3 text-[13.5px]">
              {d.reason === 'sufficient' && d.recommendation
                ? t('social.timingSuggestion', { day: t(`social.day${d.recommendation.weekday}`), slot: t(`social.slot_${d.recommendation.slot}`), lift: formatPct(d.recommendation.lift, lang, false) })
                : d.reason === 'insufficient_posts'
                  ? t('social.timingInsufficient_posts', { n: d.posts, min: d.thresholds.minPostsTotal })
                  : d.reason === 'insufficient_cells'
                    ? t('social.timingInsufficient_cells', { cell: d.thresholds.minPostsPerCell })
                    : t('social.timingNoDifference', { lift: formatPct(d.thresholds.minLift, lang, false) })}
              <p className="mt-1 text-[12px] text-t3">{t('social.timingCaveat')}</p>
            </div>
            <Heatmap
              ariaLabel={t('social.timingTitle')}
              rows={[0, 1, 2, 3, 4, 5, 6].map((i) => ({ key: String(i), label: t(`social.day${i}`) }))}
              cols={d.slots.map((s) => ({ key: s.id, label: t(`social.slot_${s.id}`) }))}
              cell={(r, c) => {
                const x = d.cells.find((z) => String(z.weekday) === r && z.slot === c);
                const enough = (x?.posts ?? 0) >= d.thresholds.minPostsPerCell;
                return { value: enough ? x?.medianRate ?? null : null, muted: !enough, label: t('social.cellLabel', { day: t(`social.day${r}`), slot: t(`social.slot_${c}`), n: x?.posts ?? 0, rate: formatPct(x?.medianRate ?? null, lang, false) }) };
              }}
            />
          </>
        )}
      </CardBody>
    </Card>
  );
}

function PlatformTab({ platform }: { platform: 'linkedin' | 'x' }) {
  const { t } = useI18n();
  const f = { platform: [platform] };
  return (
    <>
      <KpiRow metrics={['social_impressions', 'social_engagements', 'social_engagement_rate', 'social_link_clicks', 'followers', 'followers_net', 'social_posts', 'followers_lost']} filters={f} />
      {platform === 'x' && <p className="text-[12.5px] text-t2">{t('social.xGapNote')}</p>}
      <TrendCard title={t('social.trend')} metrics={['social_impressions', 'social_engagements']} filters={f} />
      <PostsTable platform={platform} />
    </>
  );
}

export default function SocialPage() {
  const { t } = useI18n();
  const [tab, setTab] = useTab<Tab>(TABS, 'overview');
  return (
    <>
      <PageHeader title={t('social.title')} subtitle={t('social.subtitle')} crumbs={[{ label: t('nav.social') }]} />
      <FilterToolbar dims={['platform', 'language', 'campaign', 'bu']} extraDims={[]} />
      <PageBody>
        <Tabs label={t('social.title')} value={tab} onChange={setTab} tabs={TABS.map((id) => ({ id, label: t(`social.tab${id === 'x' ? 'X' : id[0].toUpperCase() + id.slice(1)}`) }))} />
        <TabPanel id={tab}>
          <div className="flex flex-col gap-[var(--gap-grid)]">
            {tab === 'overview' && (
              <>
                <KpiRow metrics={['social_impressions', 'social_engagement_rate', 'social_link_clicks', 'followers', 'followers_net', 'social_posts', 'yt_views', 'yt_watch_minutes']} />
                <TrendCard title={t('social.trend')} metrics={['social_impressions', 'social_engagements']} />
                <Accounts />
              </>
            )}
            {tab === 'linkedin' && <PlatformTab platform="linkedin" />}
            {tab === 'x' && <PlatformTab platform="x" />}
            {tab === 'youtube' && (
              <>
                <KpiRow metrics={['yt_views', 'yt_watch_minutes', 'yt_avg_view_minutes', 'yt_impressions', 'yt_view_rate', 'followers', 'followers_net', 'social_posts']} filters={{ platform: ['youtube'] }} />
                <p className="text-[12.5px] text-t2">{t('social.ytNote')}</p>
                <TrendCard title={t('social.views')} metrics={['yt_views']} />
                <PostsTable platform="youtube" />
              </>
            )}
            {tab === 'posts' && <PostsTable />}
            {tab === 'compare' && <Compare />}
            {tab === 'timing' && <TimingPanel />}
          </div>
        </TabPanel>
      </PageBody>
    </>
  );
}
