import { Play, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useApi, useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatDate, formatDateTime, formatDelta, formatRange, formatValue } from '@/lib/format';
import { useTab } from '@/lib/useTab';
import { useGlobalFilters } from '@/state/filters';
import { useSession } from '@/state/session';
import type { ResultNote } from '@shared/filters';
import { Sparkline, SplitBar } from '@/components/charts';
import { DataModeBadge, noteText } from '@/components/data';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { Grid2, KpiRow, TrendCard, useDimLabel } from '@/components/modules';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Drawer, Field, Input, Modal, Select, Skeleton, TabPanel, Tabs, Textarea, severityTone, useToast } from '@/components/ui';

const TABS = ['overview', 'keywords', 'queries', 'audit', 'issues', 'competitors'] as const;
type Tab = (typeof TABS)[number];

function useInvalidate() {
  const qc = useQueryClient();
  return (prefix: string) => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(prefix) });
}

function BrandSplit() {
  const { t } = useI18n();
  const gf = useGlobalFilters();
  const q = useApi<{ brandSplit: Array<{ key: string; value: number | null }> | null; mode: string }>('/api/seo/queries', { ...gf.params, limit: 1 });
  return (
    <Card>
      <CardHeader title={t('seo.brandSplit')} subtitle={t('seo.queriesHint')} badges={q.data && <DataModeBadge mode={q.data.mode} />} />
      <CardBody>{!q.data ? <Skeleton className="h-10" /> : <SplitBar ariaLabel={t('seo.brandSplit')} parts={(q.data.brandSplit ?? []).map((x) => ({ key: x.key, label: x.key === 'brand' ? t('seo.brand') : t('seo.nonBrand'), value: x.value ?? 0 }))} />}</CardBody>
    </Card>
  );
}

interface KeywordRow {
  id: string;
  keyword: string;
  siteKey: string;
  group: string | null;
  groupId: string | null;
  targetUrl: string | null;
  brand: boolean;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
  positionCompare: number | null;
  trend: Array<number | null>;
  noData: boolean;
}

function Keywords() {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const { can } = useSession();
  const lbl = useDimLabel();
  const inval = useInvalidate();
  const toast = useToast();
  const [group, setGroup] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ keyword: '', siteKey: 'veolia-fr', groupId: '', targetUrl: '', brand: false });
  const groups = useApi<Array<{ id: string; name: string }>>('/api/seo/keyword-groups');
  const q = useApi<{ items: KeywordRow[]; mode: string; notes: ResultNote[]; rankTracker: { note: string } }>('/api/seo/keywords', { ...gf.params, group });
  const add = async () => {
    try {
      await api.send('POST', '/api/seo/keywords', { keyword: form.keyword, siteKey: form.siteKey, groupId: form.groupId || null, targetUrl: form.targetUrl || null, brand: form.brand, language: form.siteKey === 'veolia-fr' ? 'fr' : 'en' });
      setAdding(false);
      setForm({ ...form, keyword: '', targetUrl: '' });
      await inval('/api/seo/keywords');
      toast(t('common.saved'), 'pos');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  const remove = async (id: string) => {
    if (!confirm(t('common.areYouSure'))) return;
    await api.send('DELETE', `/api/seo/keywords/${id}`);
    await inval('/api/seo/keywords');
  };
  return (
    <Card>
      <CardHeader
        title={t('seo.keywords')}
        subtitle={t('seo.keywordsHint')}
        badges={q.data && <DataModeBadge mode={q.data.mode} />}
        actions={
          <>
            <Select aria-label={t('seo.group')} value={group} onChange={(e) => setGroup(e.target.value)} className="h-8 text-[13px]">
              <option value="">{t('seo.allGroups')}</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            {can('seo.keywords.manage') && (
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
                {t('seo.addKeyword')}
              </Button>
            )}
          </>
        }
      />
      <CardBody>
        {q.data?.notes.map((n, i) => (
          <p key={i} className="mb-2 text-[12px] text-t3">
            {noteText(n, t, lang)}
          </p>
        ))}
        {q.isLoading ? (
          <Skeleton className="h-72" />
        ) : (
          <DataTable
            caption={t('seo.keywords')}
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            exportTitle="tracked-keywords"
            exportMeta={[['Period', formatRange(gf.range, lang)], ['Position source', 'Search Console average (not rank tracking)']]}
            initialSort={{ key: 'clicks', desc: true }}
            pageSize={20}
            columns={[
              { key: 'keyword', header: t('seo.keyword'), value: (r) => r.keyword, unit: 'text', render: (r) => <span>{r.keyword} {r.brand && <Badge>{t('seo.brand')}</Badge>}<span className="block text-[11.5px] text-t3">{lbl('site', r.siteKey)}{r.group ? ` · ${r.group}` : ''}</span></span> },
              { key: 'clicks', header: t('seo.clicks'), value: (r) => r.clicks, unit: 'count' },
              { key: 'impressions', header: t('seo.impressions'), value: (r) => r.impressions, unit: 'count', hideOnMobile: true },
              { key: 'ctr', header: t('seo.ctr'), value: (r) => r.ctr, unit: 'percent', hideOnMobile: true },
              {
                key: 'position',
                header: t('seo.position'),
                value: (r) => r.position,
                unit: 'position',
                render: (r) =>
                  r.noData ? (
                    <span className="text-t3">{t('seo.noImpressions')}</span>
                  ) : (
                    <span>
                      {formatValue(r.position, 'position', lang)}
                      {r.positionCompare !== null && r.position !== null && <span className={`ml-1.5 text-[11.5px] ${r.position - r.positionCompare > 0.05 ? 'text-neg' : r.position - r.positionCompare < -0.05 ? 'text-pos' : 'text-t3'}`}>{formatDelta(r.position - r.positionCompare, 'position', lang)}</span>}
                    </span>
                  ),
              },
              { key: 'trend', header: t('seo.trend12w'), value: () => null, sortable: false, hideOnMobile: true, render: (r) => <div className="w-28"><Sparkline values={r.trend.map((v) => (v === null ? null : -v))} slot={0} height={24} ariaLabel={`${t('seo.trend12w')}: ${r.trend.map((v) => (v === null ? '—' : v.toFixed(1))).join(', ')}`} /></div> },
              { key: 'target', header: t('seo.target'), value: (r) => r.targetUrl, unit: 'text', hideOnMobile: true, render: (r) => <span className="block max-w-[220px] truncate text-[12px] text-t2">{r.targetUrl?.replace('https://www.veolia.com', '') ?? '—'}</span> },
              ...(can('seo.keywords.manage') ? [{ key: 'del', header: '', value: () => null, sortable: false, render: (r: KeywordRow) => <button type="button" className="rounded p-1 text-t3 hover:text-neg" aria-label={`${t('seo.deleteKeyword')}: ${r.keyword}`} onClick={() => remove(r.id)}><Trash2 className="size-3.5" /></button> }] : []),
            ]}
          />
        )}
      </CardBody>
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t('seo.addKeyword')}
        size="sm"
        footer={
          <>
            <Button onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!form.keyword.trim()} onClick={add}>
              {t('common.add')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t('seo.keyword')} htmlFor="kw" required>
            <Input id="kw" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
          </Field>
          <Field label={t('seo.site')} htmlFor="kw-site">
            <Select id="kw-site" value={form.siteKey} onChange={(e) => setForm({ ...form, siteKey: e.target.value })}>
              <option value="veolia-fr">{lbl('site', 'veolia-fr')}</option>
              <option value="veolia-en">{lbl('site', 'veolia-en')}</option>
            </Select>
          </Field>
          <Field label={t('seo.group')} htmlFor="kw-group">
            <Select id="kw-group" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
              <option value="">—</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('seo.target')} htmlFor="kw-url" hint="https://www.veolia.com/…">
            <Input id="kw-url" type="url" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} />
          </Field>
          <Checkbox checked={form.brand} onChange={(v) => setForm({ ...form, brand: v })} label={t('seo.brandKeyword')} />
        </div>
      </Modal>
    </Card>
  );
}

interface GscItem {
  key: string;
  label: string;
  site: string;
  clicks: number;
  clicksCompare: number | null;
  impressions: number;
  ctr: number | null;
  position: number | null;
  positionCompare: number | null;
}

function GscTable({ path, title, subtitle, dimLabel }: { path: string; title: string; subtitle?: string; dimLabel: string }) {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const q = useApi<{ items: GscItem[]; mode: string; notes: ResultNote[] }>(path, { ...gf.params, limit: 200 });
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} badges={q.data && <DataModeBadge mode={q.data.mode} />} />
      <CardBody>
        {q.data?.notes.map((n, i) => (
          <p key={i} className="mb-2 text-[12px] text-t3">
            {noteText(n, t, lang)}
          </p>
        ))}
        {q.isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <DataTable
            caption={title}
            rows={q.data?.items ?? []}
            exportTitle={title}
            exportMeta={[['Period', formatRange(gf.range, lang)]]}
            initialSort={{ key: 'clicks', desc: true }}
            columns={[
              { key: 'label', header: dimLabel, value: (r) => r.label, unit: 'text', render: (r) => <span className="block max-w-[360px] truncate" title={r.label}>{r.label}</span> },
              { key: 'clicks', header: t('seo.clicks'), value: (r) => r.clicks, unit: 'count' },
              { key: 'impressions', header: t('seo.impressions'), value: (r) => r.impressions, unit: 'count', hideOnMobile: true },
              { key: 'ctr', header: t('seo.ctr'), value: (r) => r.ctr, unit: 'percent', hideOnMobile: true },
              { key: 'position', header: t('seo.position'), value: (r) => r.position, unit: 'position' },
              { key: 'pchange', header: t('common.change'), value: (r) => (r.position !== null && r.positionCompare !== null ? r.position - r.positionCompare : null), unit: 'position', hideOnMobile: true, render: (r) => (r.position !== null && r.positionCompare !== null ? formatDelta(r.position - r.positionCompare, 'position', lang) : '—') },
            ]}
          />
        )}
      </CardBody>
    </Card>
  );
}

interface Scope {
  id: string;
  websiteKey: string;
  name: string;
  allowedHosts: string[];
  maxPages: number;
  maxDepth: number;
  delayMs: number;
  authorized: boolean;
  authorizedAt: string | null;
}
interface Crawl {
  id: string;
  scopeId: string;
  scopeName: string;
  status: string;
  source: string;
  startedAt: string;
  pagesCrawled: number;
  issuesFound: number;
  error: string | null;
}

function Audit() {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const inval = useInvalidate();
  const toast = useToast();
  const scopes = useApi<Scope[]>('/api/seo/crawl-scopes');
  const crawls = useApi<Crawl[]>('/api/seo/crawls', undefined, { refetchInterval: 10_000 });
  const latest = crawls.data?.[0];
  const pages = useApi<Array<{ id: string; url: string; statusCode: number | null; title: string | null; responseMs: number | null; wordCount: number | null; depth: number; blockedByRobots: boolean; redirectedTo: string | null }>>(latest ? `/api/seo/crawls/${latest.id}/pages` : null);
  const run = async (scopeId: string) => {
    try {
      await api.send('POST', '/api/seo/crawls', { scopeId });
      toast(t('seo.crawlQueued'), 'pos');
      await inval('/api/seo/crawls');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  return (
    <>
      <Card>
        <CardHeader title={t('seo.scopes')} subtitle={t('seo.scopesHint')} />
        <CardBody>
          <ul className="flex flex-col divide-y divide-brd">
            {scopes.data?.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">
                    {s.name} <Badge tone={s.authorized ? 'pos' : 'neutral'}>{s.authorized ? t('seo.authorised') : t('seo.notAuthorised')}</Badge>
                  </p>
                  <p className="text-[12.5px] text-t2">
                    {t('seo.hosts')}: {s.allowedHosts.join(', ')} · {t('seo.pagesBudget', { pages: s.maxPages, depth: s.maxDepth, delay: (s.delayMs / 1000).toFixed(1) })}
                  </p>
                </div>
                {can('seo.crawl.run') && (
                  <Button size="sm" icon={<Play className="size-3.5" />} disabled={!s.authorized} title={s.authorized ? undefined : t('seo.notAuthorised')} onClick={() => run(s.id)}>
                    {t('seo.runCrawl')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('seo.crawls')} />
        <CardBody>
          <DataTable
            caption={t('seo.crawls')}
            rows={crawls.data ?? []}
            pageSize={8}
            columns={[
              { key: 'started', header: t('seo.started'), value: (r) => r.startedAt, unit: 'text', render: (r) => formatDateTime(r.startedAt, lang) },
              { key: 'scope', header: t('seo.scopes'), value: (r) => r.scopeName, unit: 'text' },
              { key: 'source', header: t('common.source'), value: (r) => r.source, unit: 'text', render: (r) => <Badge tone={r.source === 'demo_snapshot' ? 'warn' : 'info'}>{t(`seo.crawlSource_${r.source}`)}</Badge> },
              { key: 'status', header: t('common.status'), value: (r) => r.status, unit: 'text', render: (r) => <span>{r.status}{r.error ? <span className="block text-[11.5px] text-neg">{r.error}</span> : null}</span> },
              { key: 'pages', header: t('seo.pagesCrawled'), value: (r) => r.pagesCrawled, unit: 'count' },
              { key: 'issues', header: t('seo.issuesFound'), value: (r) => r.issuesFound, unit: 'count' },
            ]}
          />
        </CardBody>
      </Card>
      {latest && (
        <Card>
          <CardHeader title={`${t('seo.crawlPages')} — ${latest.scopeName}`} badges={latest.source === 'demo_snapshot' ? <DataModeBadge mode="demo" /> : undefined} />
          <CardBody>
            <DataTable
              caption={t('seo.crawlPages')}
              rows={pages.data ?? []}
              exportTitle="crawled-urls"
              columns={[
                { key: 'url', header: t('seo.url'), value: (r) => r.url, unit: 'text', render: (r) => <span className="block max-w-[420px] truncate" title={r.url}>{r.url.replace(/^https?:\/\/[^/]+/, '')}{r.redirectedTo && <span className="block text-[11.5px] text-t3">→ {r.redirectedTo}</span>}</span> },
                { key: 'status', header: t('seo.statusCode'), value: (r) => r.statusCode, unit: 'text', render: (r) => (r.blockedByRobots ? <Badge>robots.txt</Badge> : <Badge tone={(r.statusCode ?? 0) >= 400 ? 'neg' : (r.statusCode ?? 0) >= 300 ? 'warn' : 'pos'}>{r.statusCode ?? '—'}</Badge>) },
                { key: 'ms', header: t('seo.responseMs'), value: (r) => r.responseMs, unit: 'count', hideOnMobile: true },
                { key: 'words', header: t('seo.words'), value: (r) => r.wordCount, unit: 'count', hideOnMobile: true },
              ]}
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}

interface Issue {
  id: string;
  websiteKey: string;
  rule: string;
  ruleLabel: { en: string; fr: string };
  severity: string;
  url: string;
  details: Record<string, unknown>;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

function IssueDrawer({ issue, onClose }: { issue: Issue | null; onClose: () => void }) {
  const { t, lang, L } = useI18n();
  const { can, me } = useSession();
  const inval = useInvalidate();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');
  const hist = useApi<Array<{ id: string; action: string; fromValue: string | null; toValue: string | null; comment: string | null; userName: string | null; createdAt: string }>>(issue ? `/api/seo/issues/${issue.id}/history` : null);
  if (!issue) return null;
  const save = async (assignMe?: boolean) => {
    try {
      await api.send('PATCH', `/api/seo/issues/${issue.id}`, { ...(status && status !== issue.status ? { status } : {}), ...(comment ? { comment } : {}), ...(assignMe ? { ownerId: me?.user.id } : {}) });
      setComment('');
      setStatus('');
      await inval('/api/seo/issues');
      toast(t('common.saved'), 'pos');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  return (
    <Drawer open onClose={onClose} title={t('seo.issueDetail')}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[15px] font-semibold">{L(issue.ruleLabel)}</p>
          <p className="mt-1 text-[13px] break-all text-t2">{issue.url}</p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={severityTone(issue.severity)}>{t(`common.${issue.severity}`)}</Badge>
            <Badge>{t(`seo.issueStatus_${issue.status}`)}</Badge>
            <Badge>{issue.websiteKey}</Badge>
          </p>
          {Object.keys(issue.details).length > 0 && <pre className="mt-3 overflow-x-auto rounded-lg bg-card2 p-3 text-[12px]">{JSON.stringify(issue.details, null, 2)}</pre>}
          <p className="mt-2 text-[12px] text-t3">
            {t('seo.firstSeen')}: {formatDate(issue.firstSeenAt, lang)} · {t('seo.lastSeen')}: {formatDate(issue.lastSeenAt, lang)} · {t('seo.assign')}: {issue.ownerName ?? t('common.unassigned')}
          </p>
        </div>
        {can('seo.issues.manage') && (
          <div className="flex flex-col gap-3 rounded-lg border border-brd p-3">
            <Field label={t('common.status')} htmlFor="is-status">
              <Select id="is-status" value={status || issue.status} onChange={(e) => setStatus(e.target.value)}>
                {['open', 'in_progress', 'resolved', 'ignored'].map((s) => (
                  <option key={s} value={s}>
                    {t(`seo.issueStatus_${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('seo.comment')} htmlFor="is-comment">
              <Textarea id="is-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => save()}>
                {t('seo.update')}
              </Button>
              {issue.ownerId !== me?.user.id && <Button onClick={() => save(true)}>{lang === 'fr' ? 'M’attribuer' : 'Assign to me'}</Button>}
            </div>
          </div>
        )}
        <div>
          <p className="eyebrow mb-2">{t('seo.history')}</p>
          <ol className="flex flex-col gap-2 text-[13px]">
            {hist.data?.map((h) => (
              <li key={h.id} className="border-l-2 border-brd pl-3">
                <p className="text-t1">
                  {h.action}
                  {h.toValue && ` → ${h.toValue}`}
                </p>
                {h.comment && <p className="text-t2">{h.comment}</p>}
                <p className="text-[11.5px] text-t3">
                  {h.userName ?? 'system'} · {formatDateTime(h.createdAt, lang)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Drawer>
  );
}

function Issues() {
  const { t, lang, L } = useI18n();
  const [status, setStatus] = useState('open,in_progress');
  const [severity, setSeverity] = useState('');
  const [selected, setSelected] = useState<Issue | null>(null);
  const q = useApi<{ items: Issue[]; summary: Array<{ status: string; severity: string; n: number }> }>('/api/seo/issues', { status, severity });
  const sum = (sev: string) => q.data?.summary.filter((s) => s.severity === sev && (s.status === 'open' || s.status === 'in_progress')).reduce((a, b) => a + Number(b.n), 0) ?? 0;
  return (
    <Card>
      <CardHeader
        title={t('seo.issues')}
        actions={
          <>
            <Select aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 text-[13px]">
              <option value="open,in_progress">{`${t('seo.issueStatus_open')} + ${t('seo.issueStatus_in_progress')}`}</option>
              <option value="">{t('seo.allStatuses')}</option>
              {['open', 'in_progress', 'resolved', 'ignored'].map((s) => (
                <option key={s} value={s}>
                  {t(`seo.issueStatus_${s}`)}
                </option>
              ))}
            </Select>
            <Select aria-label={t('common.severity')} value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-8 text-[13px]">
              <option value="">{t('seo.allSeverities')}</option>
              {['critical', 'high', 'medium', 'low', 'info'].map((s) => (
                <option key={s} value={s}>
                  {t(`common.${s}`)}
                </option>
              ))}
            </Select>
          </>
        }
      />
      <CardBody>
        <div className="mb-4 flex flex-wrap gap-2">
          {['critical', 'high', 'medium', 'low'].map((s) => (
            <Badge key={s} tone={severityTone(s)}>
              {t(`common.${s}`)}: {sum(s)}
            </Badge>
          ))}
        </div>
        {q.isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <DataTable
            caption={t('seo.issues')}
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={setSelected}
            exportTitle="seo-issues"
            pageSize={15}
            columns={[
              { key: 'sev', header: t('common.severity'), value: (r) => ['critical', 'high', 'medium', 'low', 'info'].indexOf(r.severity), unit: 'text', render: (r) => <Badge tone={severityTone(r.severity)}>{t(`common.${r.severity}`)}</Badge> },
              { key: 'rule', header: t('seo.rule'), value: (r) => L(r.ruleLabel), unit: 'text' },
              { key: 'url', header: t('seo.url'), value: (r) => r.url, unit: 'text', render: (r) => <span className="block max-w-[340px] truncate" title={r.url}>{r.url.replace(/^https?:\/\/[^/]+/, '')}</span> },
              { key: 'status', header: t('common.status'), value: (r) => r.status, unit: 'text', render: (r) => t(`seo.issueStatus_${r.status}`) },
              { key: 'owner', header: t('seo.assign'), value: (r) => r.ownerName, unit: 'text', hideOnMobile: true, render: (r) => r.ownerName ?? '—' },
              { key: 'last', header: t('seo.lastSeen'), value: (r) => r.lastSeenAt, unit: 'text', hideOnMobile: true, render: (r) => formatDate(r.lastSeenAt, lang) },
            ]}
          />
        )}
      </CardBody>
      <IssueDrawer issue={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

interface Competitor {
  id: string;
  name: string;
  domain: string;
  topics: string[];
  isDemo: boolean;
  notes: string | null;
  observations: Array<{ id: string; metric: string; value: number; periodStart: string; periodEnd: string; source: string; sourceUrl: string | null; note: string | null }>;
}

function Competitors() {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const inval = useInvalidate();
  const toast = useToast();
  const q = useApi<Competitor[]>('/api/seo/competitors');
  const [obsFor, setObsFor] = useState<Competitor | null>(null);
  const [adding, setAdding] = useState(false);
  const [comp, setComp] = useState({ name: '', domain: '' });
  const [obs, setObs] = useState({ metric: '', value: '', periodStart: '', periodEnd: '', source: '', sourceUrl: '' });
  const addComp = async () => {
    try {
      await api.send('POST', '/api/seo/competitors', comp);
      setAdding(false);
      setComp({ name: '', domain: '' });
      await inval('/api/seo/competitors');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  const addObs = async () => {
    try {
      await api.send('POST', `/api/seo/competitors/${obsFor!.id}/observations`, { ...obs, value: Number(obs.value), sourceUrl: obs.sourceUrl || undefined });
      setObsFor(null);
      setObs({ metric: '', value: '', periodStart: '', periodEnd: '', source: '', sourceUrl: '' });
      await inval('/api/seo/competitors');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  return (
    <Card>
      <CardHeader
        title={t('seo.competitors')}
        subtitle={t('seo.competitorsHint')}
        actions={
          can('seo.keywords.manage') && (
            <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
              {t('seo.addCompetitor')}
            </Button>
          )
        }
      />
      <CardBody>
        <Link to="/geo?tab=overview" className="mb-4 inline-block text-[13px] font-medium text-acctext hover:underline">
          {t('seo.geoLink')}
        </Link>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {q.data?.map((c) => (
            <div key={c.id} className="rounded-lg border border-brd p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-medium">
                    {c.name} {c.isDemo && <Badge tone="warn">{t('seo.demoCompetitor')}</Badge>}
                  </p>
                  <p className="text-[12.5px] text-t3">{c.domain}</p>
                </div>
                {can('seo.keywords.manage') && (
                  <Button size="sm" variant="ghost" onClick={() => setObsFor(c)}>
                    {t('seo.addObservation')}
                  </Button>
                )}
              </div>
              {c.observations.length ? (
                <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">
                  {c.observations.map((o) => (
                    <li key={o.id}>
                      <span className="font-medium">{o.metric}</span>: <span className="tnum">{formatValue(o.value, 'decimal', lang)}</span> · {formatRange({ from: o.periodStart, to: o.periodEnd }, lang)} · <span className="text-t3">{o.source}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12.5px] text-t3">{t('seo.noObservations')}</p>
              )}
            </div>
          ))}
        </div>
      </CardBody>
      <Modal open={adding} onClose={() => setAdding(false)} title={t('seo.addCompetitor')} size="sm" footer={<><Button onClick={() => setAdding(false)}>{t('common.cancel')}</Button><Button variant="primary" disabled={!comp.name || !comp.domain} onClick={addComp}>{t('common.add')}</Button></>}>
        <div className="flex flex-col gap-3">
          <Field label={t('common.name')} htmlFor="cp-name" required>
            <Input id="cp-name" value={comp.name} onChange={(e) => setComp({ ...comp, name: e.target.value })} />
          </Field>
          <Field label={t('seo.domain')} htmlFor="cp-domain" required hint="example.com">
            <Input id="cp-domain" value={comp.domain} onChange={(e) => setComp({ ...comp, domain: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <Modal open={!!obsFor} onClose={() => setObsFor(null)} title={`${t('seo.addObservation')} — ${obsFor?.name ?? ''}`} footer={<><Button onClick={() => setObsFor(null)}>{t('common.cancel')}</Button><Button variant="primary" disabled={!obs.metric || !obs.value || !obs.periodStart || !obs.periodEnd || obs.source.length < 2} onClick={addObs}>{t('common.add')}</Button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('seo.metric')} htmlFor="ob-m" required>
            <Input id="ob-m" value={obs.metric} onChange={(e) => setObs({ ...obs, metric: e.target.value })} placeholder="Estimated organic traffic" />
          </Field>
          <Field label={t('common.value')} htmlFor="ob-v" required>
            <Input id="ob-v" type="number" value={obs.value} onChange={(e) => setObs({ ...obs, value: e.target.value })} />
          </Field>
          <Field label={t('seo.periodStart')} htmlFor="ob-s" required>
            <Input id="ob-s" type="date" value={obs.periodStart} onChange={(e) => setObs({ ...obs, periodStart: e.target.value })} />
          </Field>
          <Field label={t('seo.periodEnd')} htmlFor="ob-e" required>
            <Input id="ob-e" type="date" value={obs.periodEnd} onChange={(e) => setObs({ ...obs, periodEnd: e.target.value })} />
          </Field>
          <Field label={t('seo.sourceRequired')} htmlFor="ob-src" required>
            <Input id="ob-src" value={obs.source} onChange={(e) => setObs({ ...obs, source: e.target.value })} />
          </Field>
          <Field label={t('seo.sourceUrl')} htmlFor="ob-url">
            <Input id="ob-url" type="url" value={obs.sourceUrl} onChange={(e) => setObs({ ...obs, sourceUrl: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

export default function SeoPage() {
  const { t } = useI18n();
  const [tab, setTab] = useTab<Tab>(TABS, 'overview');
  useMeta();
  return (
    <>
      <PageHeader title={t('seo.title')} subtitle={t('seo.subtitle')} crumbs={[{ label: t('nav.seo') }]} />
      <FilterToolbar dims={['site', 'country', 'region', 'language', 'bu']} extraDims={['device']} />
      <PageBody>
        <Tabs label={t('seo.title')} value={tab} onChange={setTab} tabs={TABS.map((id) => ({ id, label: t(`seo.tab${id[0].toUpperCase()}${id.slice(1)}`) }))} />
        <TabPanel id={tab}>
          <div className="flex flex-col gap-[var(--gap-grid)]">
            {tab === 'overview' && (
              <>
                <KpiRow metrics={['organic_clicks', 'organic_impressions', 'organic_ctr', 'avg_position', 'keyword_visibility', 'non_branded_clicks', 'branded_clicks', 'organic_sessions']} />
                <p className="text-[12.5px] text-t2">{t('seo.gscDelay')}</p>
                <Grid2>
                  <TrendCard title={t('seo.clicks')} metrics={['organic_clicks']} />
                  <TrendCard title={t('seo.position')} subtitle={t('seo.positionHint')} metrics={['avg_position']} />
                </Grid2>
                <BrandSplit />
              </>
            )}
            {tab === 'keywords' && <Keywords />}
            {tab === 'queries' && (
              <>
                <GscTable path="/api/seo/queries" title={t('seo.queries')} subtitle={t('seo.queriesHint')} dimLabel={t('seo.query')} />
                <GscTable path="/api/seo/pages" title={t('seo.pages')} dimLabel={t('seo.page')} />
              </>
            )}
            {tab === 'audit' && <Audit />}
            {tab === 'issues' && <Issues />}
            {tab === 'competitors' && <Competitors />}
          </div>
        </TabPanel>
      </PageBody>
    </>
  );
}


