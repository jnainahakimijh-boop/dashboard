import { Pencil, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { L10n } from '@shared/catalog';
import { api } from '@/api/client';
import { useApi, useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatDate, formatDateTime, formatPct, formatRange } from '@/lib/format';
import { useTab } from '@/lib/useTab';
import { useGlobalFilters } from '@/state/filters';
import { useSession } from '@/state/session';
import { BarList, TimeSeriesChart } from '@/components/charts';
import { DataModeBadge, useMetricLabel } from '@/components/data';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { Grid2, KpiRow, TrendCard } from '@/components/modules';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Modal, Pagination, Select, Skeleton, Switch, TabPanel, Tabs, Textarea, useToast } from '@/components/ui';

const TABS = ['overview', 'prompts', 'measurements', 'opportunities', 'vsseo'] as const;
type Tab = (typeof TABS)[number];

interface Stats {
  measurements: number;
  failed: number;
  partial: number;
  mentionRate: number | null;
  citationRate: number | null;
}

interface Summary {
  mode: string;
  sampleNote: string;
  overall: Stats;
  overallCompare: Stats | null;
  expectedPageCitationRate: number | null;
  byProvider: Array<{ id: string; name: string; method: string; cadenceDays: number; limitation: L10n; stats: Stats }>;
  byTopic: Array<{ topic: string; name: L10n; stats: Stats; compare: Stats | null }>;
  shareOfVoice: Array<{ key: string; name: string; mentions: number; share: number | null }>;
  citedDomains: Array<{ domain: string; citations: number; share: number | null }>;
  series: Array<{ week: string } & Stats>;
}

function Overview() {
  const { t, lang, L } = useI18n();
  const labelOf = useMetricLabel();
  const gf = useGlobalFilters();
  const q = useApi<Summary>('/api/geo/summary', gf.params);
  const s = q.data;
  const series = s
    ? [
        { id: 'mention', label: t('geo.mentionRate'), slot: 0, unit: 'percent' as const, points: s.series.map((p) => ({ key: p.week, label: formatDate(p.week, lang, 'short'), value: p.mentionRate })) },
        { id: 'citation', label: t('geo.citationRate'), slot: 1, unit: 'percent' as const, points: s.series.map((p) => ({ key: p.week, label: formatDate(p.week, lang, 'short'), value: p.citationRate })) },
      ]
    : [];
  return (
    <>
      <KpiRow metrics={['geo_mention_rate', 'geo_citation_rate', 'geo_measurements', 'ai_referral_sessions', 'ai_referral_share']} columns={5} />
      <Grid2>
        <Card>
          <CardHeader title={t('geo.weekly')} badges={s && <DataModeBadge mode={s.mode} />} />
          <CardBody>{!s ? <Skeleton className="h-60" /> : <TimeSeriesChart series={series} showCompare={false} ariaLabel={t('geo.weekly')} showLegend />}</CardBody>
        </Card>
        <TrendCard title={labelOf('ai_referral_sessions')} metrics={['ai_referral_sessions']} />
      </Grid2>
      <Grid2>
        <Card>
          <CardHeader title={t('geo.shareOfVoice')} subtitle={t('geo.shareOfVoiceHint')} />
          <CardBody>{s && <BarList unit="percent" showDelta={false} ariaLabel={t('geo.shareOfVoice')} items={s.shareOfVoice.map((x) => ({ key: x.key, label: x.name, value: x.share, sublabel: `${x.mentions} mentions` }))} />}</CardBody>
        </Card>
        <Card>
          <CardHeader title={t('geo.citedDomains')} subtitle={`${t('geo.expectedPageRate')}: ${formatPct(s?.expectedPageCitationRate ?? null, lang, false)} — ${t('geo.expectedPageHint')}`} />
          <CardBody>{s && <BarList unit="count" slot={1} showDelta={false} ariaLabel={t('geo.citedDomains')} items={s.citedDomains.slice(0, 10).map((x) => ({ key: x.domain, label: x.domain, value: x.citations }))} />}</CardBody>
        </Card>
      </Grid2>
      <Card>
        <CardHeader title={t('geo.providers')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {s?.byProvider.map((p) => (
              <div key={p.id} className="rounded-lg border border-brd p-3">
                <p className="text-[14px] font-medium">{p.name}</p>
                <p className="text-[12px] text-t3">
                  {t(`geo.method_${p.method}`)} · {t('geo.cadence', { n: p.cadenceDays })}
                </p>
                <p className="mt-2 text-[13px]">
                  {t('geo.mentionRate')}: <span className="tnum font-semibold">{formatPct(p.stats.mentionRate, lang, false)}</span> · {t('geo.citationRate')}: <span className="tnum font-semibold">{formatPct(p.stats.citationRate, lang, false)}</span>
                </p>
                <p className="text-[12px] text-t3">n = {p.stats.measurements}{p.stats.failed ? ` · ${p.stats.failed} failed` : ''}</p>
                <p className="mt-2 text-[12px] text-t2">{L(p.limitation)}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('geo.byTopic')} />
        <CardBody>
          <DataTable
            caption={t('geo.byTopic')}
            rows={s?.byTopic ?? []}
            exportTitle="geo-by-topic"
            exportMeta={[['Period', formatRange(gf.range, lang)], ['Scope', 'Monitored prompt sample only']]}
            initialSort={{ key: 'm', desc: true }}
            columns={[
              { key: 'topic', header: t('geo.topic'), value: (r) => L(r.name), unit: 'text' },
              { key: 'm', header: t('geo.mentionRate'), value: (r) => r.stats.mentionRate, unit: 'percent' },
              { key: 'mc', header: t('geo.mentionRateCompare'), value: (r) => r.compare?.mentionRate ?? null, unit: 'percent', hideOnMobile: true },
              { key: 'c', header: t('geo.citationRate'), value: (r) => r.stats.citationRate, unit: 'percent' },
              { key: 'n', header: 'n', value: (r) => r.stats.measurements, unit: 'count' },
            ]}
          />
        </CardBody>
      </Card>
    </>
  );
}

interface Prompt {
  id: string;
  key: string;
  text: string;
  language: string;
  topic: string;
  intent: string;
  market: string;
  priority: string;
  expectedPages: string[];
  active: boolean;
  currentVersion: number;
  versions: number;
  stats: Stats;
}

function PromptEditor({ prompt, open, onClose }: { prompt: Prompt | null; open: boolean; onClose: () => void }) {
  const { t, L } = useI18n();
  const meta = useMeta();
  const qc = useQueryClient();
  const toast = useToast();
  const init = prompt ?? { text: '', language: 'fr', topic: 'water_treatment', intent: 'informational', market: 'France', priority: 'medium', expectedPages: [] as string[], active: true as boolean };
  const [f, setF] = useState({ ...init, pages: init.expectedPages.join('\n'), changeNote: '' });
  const versions = useApi<Array<{ id: string; version: number; text: string; changeNote: string | null; createdAt: string }>>(prompt ? `/api/geo/prompts/${prompt.id}/versions` : null);
  const save = async () => {
    const body = { text: f.text, language: f.language, topic: f.topic, intent: f.intent, market: f.market, priority: f.priority, expectedPages: f.pages.split('\n').map((x) => x.trim()).filter(Boolean), ...(prompt ? { active: f.active, changeNote: f.changeNote || undefined } : {}) };
    try {
      if (prompt) await api.send('PATCH', `/api/geo/prompts/${prompt.id}`, body);
      else await api.send('POST', '/api/geo/prompts', body);
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/geo') });
      toast(t('common.saved'), 'pos');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={prompt ? `${t('geo.editPrompt')} ${prompt.key}` : t('geo.addPrompt')} size="lg" footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" disabled={f.text.trim().length < 5} onClick={save}>{t('common.save')}</Button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t('geo.prompt')} htmlFor="pr-text" required hint={t('geo.versionHint')}>
            <Textarea id="pr-text" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} maxLength={500} />
          </Field>
        </div>
        {prompt && (
          <div className="sm:col-span-2">
            <Field label={t('geo.changeNote')} htmlFor="pr-note">
              <Input id="pr-note" value={f.changeNote} onChange={(e) => setF({ ...f, changeNote: e.target.value })} maxLength={300} />
            </Field>
          </div>
        )}
        <Field label={t('geo.language')} htmlFor="pr-lang">
          <Select id="pr-lang" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </Select>
        </Field>
        <Field label={t('geo.topic')} htmlFor="pr-topic">
          <Select id="pr-topic" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
            {meta.data?.taxonomy.filter((x) => x.kind === 'topic').map((x) => (
              <option key={x.key} value={x.key}>
                {L(x.label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('geo.intent')} htmlFor="pr-intent">
          <Select id="pr-intent" value={f.intent} onChange={(e) => setF({ ...f, intent: e.target.value })}>
            {['informational', 'commercial', 'comparison', 'navigational'].map((x) => (
              <option key={x} value={x}>
                {t(`geo.intent_${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('geo.priority')} htmlFor="pr-prio">
          <Select id="pr-prio" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            {['high', 'medium', 'low'].map((x) => (
              <option key={x} value={x}>
                {t(`common.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('geo.market')} htmlFor="pr-market">
          <Input id="pr-market" value={f.market} onChange={(e) => setF({ ...f, market: e.target.value })} />
        </Field>
        <Field label={t('geo.expectedPages')} htmlFor="pr-pages" hint="/fr/… (one per line)">
          <Textarea id="pr-pages" value={f.pages} onChange={(e) => setF({ ...f, pages: e.target.value })} />
        </Field>
        {prompt && (
          <div className="sm:col-span-2">
            <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label={t('geo.activeLabel')} />
          </div>
        )}
      </div>
      {prompt && versions.data && (
        <div className="mt-5">
          <p className="eyebrow mb-2">{t('geo.versions')}</p>
          <ol className="flex flex-col gap-2 text-[13px]">
            {versions.data.map((v) => (
              <li key={v.id} className="rounded-lg border border-brd p-2.5">
                <p className="font-medium">
                  v{v.version} · <span className="text-t3">{formatDateTime(v.createdAt, 'en')}</span>
                </p>
                <p>{v.text}</p>
                {v.changeNote && <p className="text-[12px] text-t3">{v.changeNote}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}

function Prompts() {
  const { t, lang, L } = useI18n();
  const gf = useGlobalFilters();
  const meta = useMeta();
  const { can } = useSession();
  const q = useApi<Prompt[]>('/api/geo/prompts', gf.params);
  const [edit, setEdit] = useState<Prompt | null>(null);
  const [creating, setCreating] = useState(false);
  const topic = (k: string) => L(meta.data?.taxonomy.find((x) => x.kind === 'topic' && x.key === k)?.label) || k;
  return (
    <Card>
      <CardHeader
        title={t('geo.prompts')}
        subtitle={t('geo.sampleBanner')}
        actions={
          can('geo.prompts.manage') && (
            <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
              {t('geo.addPrompt')}
            </Button>
          )
        }
      />
      <CardBody>
        {q.isLoading ? (
          <Skeleton className="h-72" />
        ) : (
          <DataTable
            caption={t('geo.prompts')}
            rows={q.data ?? []}
            rowKey={(r) => r.id}
            exportTitle="geo-prompts"
            exportMeta={[['Period', formatRange(gf.range, lang)]]}
            pageSize={15}
            columns={[
              { key: 'key', header: '#', value: (r) => r.key, unit: 'text', render: (r) => <span className="tnum text-t3">{r.key}{!r.active && <Badge className="ml-1">off</Badge>}</span> },
              { key: 'text', header: t('geo.prompt'), value: (r) => r.text, unit: 'text', render: (r) => <span className="block max-w-[420px]">{r.text}<span className="block text-[11.5px] text-t3">{r.language.toUpperCase()} · {topic(r.topic)} · {t(`geo.intent_${r.intent}`)} · {r.market} · v{r.currentVersion}</span></span> },
              { key: 'prio', header: t('geo.priority'), value: (r) => ['high', 'medium', 'low'].indexOf(r.priority), unit: 'text', render: (r) => <Badge tone={r.priority === 'high' ? 'accent' : 'neutral'}>{t(`common.${r.priority}`)}</Badge> },
              { key: 'pages', header: t('geo.expectedPages'), value: (r) => r.expectedPages.length, unit: 'text', hideOnMobile: true, render: (r) => (r.expectedPages.length ? <span className="text-[12px]">{r.expectedPages.join(', ')}</span> : <Badge tone="warn">{t('geo.noExpectedPage')}</Badge>) },
              { key: 'm', header: t('geo.mentionRate'), value: (r) => r.stats.mentionRate, unit: 'percent' },
              { key: 'c', header: t('geo.citationRate'), value: (r) => r.stats.citationRate, unit: 'percent', hideOnMobile: true },
              { key: 'n', header: 'n', value: (r) => r.stats.measurements, unit: 'count', hideOnMobile: true },
              ...(can('geo.prompts.manage') ? [{ key: 'edit', header: '', value: () => null, sortable: false, render: (r: Prompt) => <button type="button" className="rounded p-1 text-t3 hover:text-t1" aria-label={`${t('geo.editPrompt')} ${r.key}`} onClick={() => setEdit(r)}><Pencil className="size-3.5" /></button> }] : []),
            ]}
          />
        )}
      </CardBody>
      {(creating || edit) && <PromptEditor key={edit?.id ?? 'new'} prompt={edit} open onClose={() => (setEdit(null), setCreating(false))} />}
    </Card>
  );
}

interface Measurement {
  id: string;
  date: string;
  provider: string;
  method: string;
  prompt: string;
  promptVersion: number;
  status: string;
  mentioned: boolean;
  cited: boolean;
  mentionRank: number | null;
  citedDomains: string[];
  competitors: string[];
  confidence: string;
  origin: string;
}

function Measurements() {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const meta = useMeta();
  const { can } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const q = useApi<{ items: Measurement[]; total: number; page: number; pageSize: number; mode: string }>('/api/geo/measurements', { ...gf.params, status, page, pageSize: 50 });
  const connected = meta.data?.connections.some((c) => (c.provider === 'geo_openai' || c.provider === 'geo_perplexity') && c.status === 'connected');
  const provName = (id: string) => meta.data?.catalog.geoProviders.find((p) => p.id === id)?.name ?? id;
  const run = async () => {
    try {
      const conn = meta.data?.connections.find((c) => (c.provider === 'geo_openai' || c.provider === 'geo_perplexity') && c.status === 'connected');
      await api.send('POST', '/api/geo/measure', { provider: conn?.provider });
      toast(t('geo.measureQueued'), 'pos');
      void qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('/api/geo') });
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  const yes = (b: boolean) => (b ? <Badge tone="pos">{t('common.yes')}</Badge> : <span className="text-t3">{t('common.no')}</span>);
  return (
    <Card>
      <CardHeader
        title={t('geo.measurements')}
        subtitle={t('geo.sampleBanner')}
        badges={q.data && <DataModeBadge mode={q.data.mode} />}
        actions={
          <>
            <Select aria-label={t('geo.status')} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="h-8 text-[13px]">
              <option value="">{t('common.all')}</option>
              <option value="completed">completed</option>
              <option value="partial">partial</option>
              <option value="failed">failed</option>
            </Select>
            {can('geo.measure.run') && (
              <Button size="sm" icon={<Play className="size-3.5" />} disabled={!connected} title={connected ? undefined : t('geo.runMeasureDisabled')} onClick={run}>
                {t('geo.runMeasure')}
              </Button>
            )}
          </>
        }
      />
      <CardBody>
        {!connected && can('geo.measure.run') && <p className="mb-3 text-[12.5px] text-t2">{t('geo.runMeasureDisabled')}</p>}
        {q.isLoading ? (
          <Skeleton className="h-72" />
        ) : (
          <DataTable
            caption={t('geo.measurements')}
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            pageSize={50}
            columns={[
              { key: 'date', header: t('common.date'), value: (r) => r.date, unit: 'text', render: (r) => formatDate(r.date, lang) },
              { key: 'prompt', header: t('geo.prompt'), value: (r) => r.prompt, unit: 'text', render: (r) => `${r.prompt} · v${r.promptVersion}` },
              { key: 'provider', header: t('geo.provider'), value: (r) => r.provider, unit: 'text', render: (r) => <span>{provName(r.provider)}<span className="block text-[11.5px] text-t3">{t(`geo.method_${r.method}`)}</span></span> },
              { key: 'status', header: t('geo.status'), value: (r) => r.status, unit: 'text', render: (r) => <Badge tone={r.status === 'failed' ? 'neg' : r.status === 'partial' ? 'warn' : 'neutral'}>{r.status}</Badge> },
              { key: 'm', header: t('geo.mentioned'), value: (r) => (r.mentioned ? 1 : 0), unit: 'text', render: (r) => yes(r.mentioned) },
              { key: 'c', header: t('geo.cited'), value: (r) => (r.cited ? 1 : 0), unit: 'text', render: (r) => yes(r.cited) },
              { key: 'rank', header: t('geo.rank'), value: (r) => r.mentionRank, unit: 'count', hideOnMobile: true },
              { key: 'comp', header: t('geo.competitors'), value: (r) => r.competitors.join(', '), unit: 'text', hideOnMobile: true },
              { key: 'conf', header: t('geo.confidence'), value: (r) => r.confidence, unit: 'text', hideOnMobile: true },
              { key: 'origin', header: t('geo.origin'), value: (r) => r.origin, unit: 'text', hideOnMobile: true, render: (r) => t(`geo.origin_${r.origin}`) },
            ]}
          />
        )}
        {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
      </CardBody>
    </Card>
  );
}

function Opportunities() {
  const { t, lang } = useI18n();
  const gf = useGlobalFilters();
  const q = useApi<{ items: Array<{ promptId: string; key: string; text: string; priority: string; type: string; stats: Stats; lowSample: boolean; competitor?: { name: string; rate: number } }>; mode: string }>('/api/geo/opportunities', gf.params);
  return (
    <Card>
      <CardHeader title={t('geo.opportunities')} subtitle={t('geo.opportunitiesHint')} badges={q.data && <DataModeBadge mode={q.data.mode} />} />
      <CardBody>
        <ul className="flex flex-col divide-y divide-brd">
          {q.data?.items.map((o, i) => (
            <li key={`${o.key}-${o.type}-${i}`} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <Badge tone={o.type === 'competitor_ahead' || o.type === 'low_mention' ? 'warn' : 'info'}>{t(`geo.opp_${o.type}`)}</Badge>
                  <Badge tone={o.priority === 'high' ? 'accent' : 'neutral'}>{t(`common.${o.priority}`)}</Badge>
                  {o.lowSample && <Badge>{t('common.lowSample')}</Badge>}
                  <span className="text-t3">{o.key}</span>
                </p>
                <p className="mt-1 text-[14px]">{o.text}</p>
              </div>
              <p className="text-right text-[12.5px] text-t2 tnum">
                {t('geo.mentionRate')}: {formatPct(o.stats.mentionRate, lang, false)}
                <br />
                {t('geo.citationRate')}: {formatPct(o.stats.citationRate, lang, false)}
                {o.competitor && (
                  <>
                    <br />
                    {o.competitor.name}: {formatPct(o.competitor.rate, lang, false)}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function VsSeo() {
  const { t, lang, L } = useI18n();
  const gf = useGlobalFilters();
  const q = useApi<{ items: Array<{ topic: string; name: L10n; prompts: number; geo: Stats; seo: { clicks: number | null; position: number | null; impressions: number | null } }> }>('/api/geo/vs-seo', gf.params);
  return (
    <Card>
      <CardHeader title={t('geo.vsSeoTitle')} subtitle={t('geo.vsSeoHint')} />
      <CardBody>
        <DataTable
          caption={t('geo.vsSeoTitle')}
          rows={q.data?.items ?? []}
          exportTitle="geo-vs-seo"
          exportMeta={[['Period', formatRange(gf.range, lang)]]}
          initialSort={{ key: 'clicks', desc: true }}
          columns={[
            { key: 'topic', header: t('geo.topic'), value: (r) => L(r.name), unit: 'text' },
            { key: 'prompts', header: t('geo.prompts'), value: (r) => r.prompts, unit: 'count' },
            { key: 'm', header: t('geo.mentionRate'), value: (r) => r.geo.mentionRate, unit: 'percent' },
            { key: 'c', header: t('geo.citationRate'), value: (r) => r.geo.citationRate, unit: 'percent' },
            { key: 'clicks', header: t('geo.seoClicks'), value: (r) => r.seo.clicks, unit: 'count' },
            { key: 'pos', header: t('geo.seoPosition'), value: (r) => r.seo.position, unit: 'position' },
          ]}
        />
      </CardBody>
    </Card>
  );
}

export default function GeoPage() {
  const { t } = useI18n();
  const [tab, setTab] = useTab<Tab>(TABS, 'overview');
  return (
    <>
      <PageHeader title={t('geo.title')} subtitle={t('geo.subtitle')} crumbs={[{ label: t('nav.geo') }]} />
      <FilterToolbar dims={['language', 'bu', 'site']} extraDims={[]} />
      <PageBody>
        <p role="note" className="rounded-lg border border-info/25 bg-infosoft px-3 py-2 text-[13px] text-info">
          {t('geo.sampleBanner')}
        </p>
        <Tabs label={t('geo.title')} value={tab} onChange={setTab} tabs={TABS.map((id) => ({ id, label: t(`geo.tab${id[0].toUpperCase()}${id.slice(1)}`) }))} />
        <TabPanel id={tab}>
          <div className="flex flex-col gap-[var(--gap-grid)]">
            {tab === 'overview' && <Overview />}
            {tab === 'prompts' && <Prompts />}
            {tab === 'measurements' && <Measurements />}
            {tab === 'opportunities' && <Opportunities />}
            {tab === 'vsseo' && <VsSeo />}
          </div>
        </TabPanel>
      </PageBody>
    </>
  );
}
