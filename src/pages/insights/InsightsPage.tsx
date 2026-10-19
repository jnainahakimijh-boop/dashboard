import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Mail, MessageSquare, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getMetric } from '@shared/metrics';
import { useApi, useApiMutation } from '@/api/hooks';
import type { AlertEvent, EvidenceItem, Recommendation } from '@/api/types';
import { useI18n } from '@/i18n';
import { formatDate, formatDateTime, formatRange, formatValue, relativeTime } from '@/lib/format';
import { useTab } from '@/lib/useTab';
import { useSession } from '@/state/session';
import { DataModeBadge, useMetricLabel } from '@/components/data';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { ExecutiveSummaryCard } from '@/pages/overview/OverviewPage';
import { Badge, Button, Card, CardBody, CardHeader, Drawer, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton, TabPanel, Tabs, Textarea, severityTone, useToast } from '@/components/ui';

const TABS = ['summary', 'recommendations', 'alerts'] as const;
type Tab = (typeof TABS)[number];
const STATUSES = ['new', 'under_review', 'approved', 'in_progress', 'completed', 'dismissed'] as const;
type Status = (typeof STATUSES)[number];
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
const LEVELS = ['high', 'medium', 'low'] as const;

// Workflow states are not severities: the brand red is never used for them.
const STATUS_TONE: Record<Status, 'neutral' | 'info' | 'warn' | 'pos'> = {
  new: 'info',
  under_review: 'warn',
  approved: 'pos',
  in_progress: 'info',
  completed: 'pos',
  dismissed: 'neutral',
};

interface Assignee {
  id: string;
  name: string;
  role: string;
}

function useRecText() {
  const { lang } = useI18n();
  return (r: Recommendation, k: 'title' | 'summary' | 'action') => (lang === 'fr' ? (r[`${k}Fr` as 'titleFr'] ?? r[k]) : r[k]);
}

function recMode(r: Recommendation): string | undefined {
  return r.evidence.find((e) => e.mode)?.mode;
}

/* ---------------- method note ---------------- */

function MethodCard() {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader title={t('insights.methodTitle')} />
      <CardBody>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-t2">
          <li>{t('insights.method1')}</li>
          <li>{t('insights.method2')}</li>
          <li>{t('insights.method3')}</li>
          <li>{t('insights.method4')}</li>
        </ul>
      </CardBody>
    </Card>
  );
}

/* ---------------- recommendations ---------------- */

function EvidenceTable({ items }: { items: EvidenceItem[] }) {
  const { t, lang, L } = useI18n();
  if (!items.length) return <p className="text-[13px] text-t3">{t('insights.noEvidence')}</p>;
  const fmt = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? '—' : formatValue(v, unit === 'text' ? undefined : (unit as never), lang));
  return (
    <div className="overflow-x-auto rounded-lg border border-brd">
      <table className="w-full text-[13px]">
        <caption className="sr-only">{t('insights.evidence')}</caption>
        <thead className="bg-card2 text-left text-t2">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">{t('insights.evidenceItem')}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">{t('common.value')}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">{t('common.comparison')}</th>
            <th scope="col" className="px-3 py-2 font-semibold">{t('common.source')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e, i) => (
            <tr key={i} className="border-t border-brd align-top">
              <td className="px-3 py-2">
                {L(e.label)}
                {e.period && <span className="block text-[11.5px] text-t3 tnum">{formatRange(e.period, lang)}</span>}
              </td>
              <td className="px-3 py-2 text-right tnum">{e.text ?? fmt(e.value, e.unit)}</td>
              <td className="px-3 py-2 text-right tnum">
                {fmt(e.compare, e.unit)}
                {e.comparePeriod && <span className="block text-[11.5px] text-t3">{formatRange(e.comparePeriod, lang)}</span>}
              </td>
              <td className="px-3 py-2 text-t2">
                {e.source === 'demo_snapshot' ? t('insights.demoSnapshot') : e.source}
                {e.mode === 'demo' && <DataModeBadge mode="demo" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecDrawer({ id, onClose, assignees }: { id: string | null; onClose: () => void; assignees: Assignee[] }) {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const text = useRecText();
  const labelOf = useMetricLabel();
  const q = useApi<Recommendation>(id ? `/api/insights/recommendations/${id}` : null);
  const patch = useApiMutation<Partial<Recommendation>>('PATCH', `/api/insights/recommendations/${id}`, ['/api/insights/recommendations', '/api/notifications']);
  const comment = useApiMutation<{ body: string }>('POST', `/api/insights/recommendations/${id}/comments`, ['/api/insights/recommendations']);
  const [draft, setDraft] = useState('');
  const r = q.data;
  const manage = can('recommendations.manage');
  const update = async (b: Partial<Recommendation>) => {
    try {
      await patch.mutateAsync(b);
      toast(t('common.saved'), 'pos');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  const send = async () => {
    if (!draft.trim()) return;
    try {
      await comment.mutateAsync({ body: draft.trim() });
      setDraft('');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  const histValue = (field: string, v: string | null) => {
    if (v === null) return '—';
    if (field === 'status') return t(`insights.status_${v}`);
    if (field === 'priority') return t(`common.${v}`);
    if (field === 'owner') return assignees.find((a) => a.id === v)?.name ?? t('insights.formerUser');
    if (field === 'dueDate') return formatDate(v, lang);
    return v;
  };
  return (
    <Drawer open={!!id} onClose={onClose} title={r ? text(r, 'title') : t('insights.recommendation')}>
      {q.isLoading || !r ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={severityTone(r.priority)}>
              {t('common.priority')}{t('common.colon')} {t(`common.${r.priority}`)}
            </Badge>
            <Badge tone={STATUS_TONE[r.status]}>{t(`insights.status_${r.status}`)}</Badge>
            <Badge>{t(`insights.origin_${r.origin}`)}</Badge>
            {recMode(r) === 'demo' && <DataModeBadge mode="demo" />}
          </div>
          <section>
            <h3 className="eyebrow mb-1">{t('insights.observation')}</h3>
            <p className="text-[14px] leading-relaxed">{text(r, 'summary')}</p>
          </section>
          <section>
            <h3 className="eyebrow mb-1">{t('insights.recommendedAction')}</h3>
            <p className="text-[14px] leading-relaxed">{text(r, 'action')}</p>
          </section>
          <section>
            <h3 className="eyebrow mb-2">{t('insights.evidence')}</h3>
            <EvidenceTable items={r.evidence} />
          </section>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <div>
              <dt className="text-t3">{t('common.impact')}</dt>
              <dd>{t(`common.${r.impact}`)}</dd>
            </div>
            <div>
              <dt className="text-t3">{t('common.effort')}</dt>
              <dd>{r.effort ? t(`common.${r.effort}`) : '—'}</dd>
            </div>
            <div>
              <dt className="text-t3">{t('insights.confidence')}</dt>
              <dd>{r.confidence ? t(`insights.confidence_${r.confidence}`) : '—'}</dd>
            </div>
            <div>
              <dt className="text-t3">{t('common.sources')}</dt>
              <dd>{r.sources.join(', ') || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-t3">{t('insights.kpis')}</dt>
              <dd>{r.kpis.map((k) => (getMetric(k) ? labelOf(k) : k)).join(', ') || '—'}</dd>
            </div>
          </dl>
          <p className="rounded-lg bg-card2 p-3 text-[12.5px] text-t2">{t('insights.associationNote')}</p>

          <section aria-labelledby="wf-title">
            <h3 id="wf-title" className="eyebrow mb-2">
              {t('insights.workflow')}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('common.status')} htmlFor="rec-status">
                <Select id="rec-status" value={r.status} disabled={!manage || patch.isPending} onChange={(e) => update({ status: e.target.value as Status })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`insights.status_${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('common.priority')} htmlFor="rec-priority">
                <Select id="rec-priority" value={r.priority} disabled={!manage || patch.isPending} onChange={(e) => update({ priority: e.target.value as Recommendation['priority'] })}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(`common.${p}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('common.owner')} htmlFor="rec-owner">
                {manage ? (
                  <Select id="rec-owner" value={r.ownerId ?? ''} disabled={patch.isPending} onChange={(e) => update({ ownerId: e.target.value || null })}>
                    <option value="">{t('common.unassigned')}</option>
                    {assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input id="rec-owner" value={r.ownerName ?? t('common.unassigned')} readOnly />
                )}
              </Field>
              <Field label={t('insights.dueDate')} htmlFor="rec-due">
                <Input id="rec-due" type="date" value={r.dueDate ?? ''} readOnly={!manage} disabled={patch.isPending} onChange={(e) => update({ dueDate: e.target.value || null })} />
              </Field>
            </div>
            {!manage && <p className="mt-2 text-[12px] text-t3">{t('insights.readOnlyWorkflow')}</p>}
          </section>

          <section aria-labelledby="cm-title">
            <h3 id="cm-title" className="eyebrow mb-2">
              {t('insights.comments')} ({r.comments?.length ?? 0})
            </h3>
            <ul className="flex flex-col gap-2">
              {r.comments?.map((c) => (
                <li key={c.id} className="rounded-lg border border-brd p-2.5 text-[13px]">
                  <p className="text-[12px] text-t3">
                    <span className="font-medium text-t2">{c.userName ?? t('insights.formerUser')}</span> · {formatDateTime(c.createdAt, lang)}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{c.body}</p>
                </li>
              ))}
            </ul>
            {can('recommendations.comment') && (
              <div className="mt-2 flex flex-col gap-2">
                <label htmlFor="rec-comment" className="sr-only">
                  {t('insights.addComment')}
                </label>
                <Textarea id="rec-comment" value={draft} maxLength={4000} placeholder={t('insights.addComment')} onChange={(e) => setDraft(e.target.value)} />
                <div className="flex justify-end">
                  <Button size="sm" variant="primary" icon={<MessageSquare className="size-3.5" />} disabled={!draft.trim()} loading={comment.isPending} onClick={send}>
                    {t('insights.postComment')}
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="hist-title">
            <h3 id="hist-title" className="eyebrow mb-2">
              {t('insights.history')}
            </h3>
            <ol className="flex flex-col gap-1.5 border-l border-brd pl-3 text-[12.5px]">
              {r.history?.map((h) => (
                <li key={h.id}>
                  <span className="text-t3 tnum">{formatDateTime(h.createdAt, lang)}</span> · <span className="font-medium">{h.userName ?? t('insights.system')}</span> — {t(`insights.field_${h.field}`)}{t('common.colon')} {histValue(h.field, h.fromValue)} → {histValue(h.field, h.toValue)}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Drawer>
  );
}

function CreateModal({ open, onClose, assignees }: { open: boolean; onClose: () => void; assignees: Assignee[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const create = useApiMutation<Record<string, unknown>>('POST', '/api/insights/recommendations', ['/api/insights/recommendations']);
  const empty = { title: '', summary: '', action: '', priority: 'medium', impact: 'medium', effort: 'medium', channels: '', ownerId: '', dueDate: '' };
  const [f, setF] = useState(empty);
  const valid = f.title.trim().length >= 3 && f.summary.trim().length >= 3 && f.action.trim().length >= 3;
  const submit = async () => {
    try {
      await create.mutateAsync({
        title: f.title.trim(),
        summary: f.summary.trim(),
        action: f.action.trim(),
        priority: f.priority,
        impact: f.impact,
        effort: f.effort,
        channels: f.channels.split(',').map((x) => x.trim()).filter(Boolean),
        ownerId: f.ownerId || null,
        dueDate: f.dueDate || null,
      });
      toast(t('insights.created'), 'pos');
      setF(empty);
      onClose();
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('insights.newRecommendation')}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!valid} loading={create.isPending} onClick={submit}>
            {t('common.create')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t('insights.fieldTitle')} htmlFor="n-title" required>
            <Input id="n-title" value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('insights.observation')} htmlFor="n-summary" hint={t('insights.observationHint')} required>
            <Textarea id="n-summary" value={f.summary} maxLength={4000} onChange={(e) => setF({ ...f, summary: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('insights.recommendedAction')} htmlFor="n-action" required>
            <Textarea id="n-action" value={f.action} maxLength={2000} onChange={(e) => setF({ ...f, action: e.target.value })} />
          </Field>
        </div>
        <Field label={t('common.priority')} htmlFor="n-priority">
          <Select id="n-priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`common.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.impact')} htmlFor="n-impact">
          <Select id="n-impact" value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })}>
            {LEVELS.map((p) => (
              <option key={p} value={p}>
                {t(`common.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.effort')} htmlFor="n-effort">
          <Select id="n-effort" value={f.effort} onChange={(e) => setF({ ...f, effort: e.target.value })}>
            {LEVELS.map((p) => (
              <option key={p} value={p}>
                {t(`common.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('insights.channels')} htmlFor="n-channels" hint={t('insights.channelsHint')}>
          <Input id="n-channels" value={f.channels} onChange={(e) => setF({ ...f, channels: e.target.value })} />
        </Field>
        <Field label={t('common.owner')} htmlFor="n-owner">
          <Select id="n-owner" value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>
            <option value="">{t('common.unassigned')}</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('insights.dueDate')} htmlFor="n-due">
          <Input id="n-due" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function Recommendations() {
  const { t, lang } = useI18n();
  const { can, me } = useSession();
  const toast = useToast();
  const text = useRecText();
  const [sp, setSp] = useSearchParams();
  const [status, setStatus] = useState<string>('open');
  const [priority, setPriority] = useState('');
  const [owner, setOwner] = useState('');
  const [creating, setCreating] = useState(false);
  const manage = can('recommendations.manage');
  const all = useApi<Recommendation[]>('/api/insights/recommendations');
  const assignees = useApi<Assignee[]>(manage ? '/api/insights/assignees' : null);
  const generate = useApiMutation<void, { created: number; refreshed: number }>('POST', '/api/insights/recommendations/generate', ['/api/insights/recommendations']);
  const openId = sp.get('rec');
  const setOpen = (id: string | null) =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (id) n.set('rec', id);
        else n.delete('rec');
        return n;
      },
      { replace: true },
    );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of all.data ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [all.data]);
  const openStatuses: Status[] = ['new', 'under_review', 'approved', 'in_progress'];
  const rows = (all.data ?? []).filter(
    (r) =>
      (status === '' || (status === 'open' ? openStatuses.includes(r.status) : r.status === status)) &&
      (!priority || r.priority === priority) &&
      (!owner || (owner === 'none' ? !r.ownerId : owner === 'mine' ? r.ownerId === me?.user.id : r.ownerId === owner)),
  );
  const runRules = async () => {
    try {
      const res = await generate.mutateAsync();
      toast(t('insights.generated', { created: res.created, refreshed: res.refreshed }), 'pos');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(status === s ? 'open' : s)}
            aria-pressed={status === s}
            className={clsx('rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-brds', status === s ? 'border-acc ring-1 ring-acc' : 'border-brd')}
          >
            <span className="block text-[12px] text-t2">{t(`insights.status_${s}`)}</span>
            <span className="text-[20px] font-semibold tnum">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>
      <Card>
        <CardHeader
          title={t('insights.recommendations')}
          subtitle={t('insights.recommendationsHint')}
          actions={
            manage && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<RefreshCw className="size-3.5" />} loading={generate.isPending} onClick={runRules}>
                  {t('insights.runRules')}
                </Button>
                <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>
                  {t('insights.newRecommendation')}
                </Button>
              </div>
            )
          }
        />
        <CardBody>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Field label={t('common.status')} htmlFor="f-status">
              <Select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 text-[13px]">
                <option value="open">{t('insights.openStatuses')}</option>
                <option value="">{t('common.all')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`insights.status_${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('common.priority')} htmlFor="f-priority">
              <Select id="f-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="h-8 text-[13px]">
                <option value="">{t('common.all')}</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`common.${p}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('common.owner')} htmlFor="f-owner">
              <Select id="f-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="h-8 text-[13px]">
                <option value="">{t('common.all')}</option>
                <option value="mine">{t('insights.mine')}</option>
                <option value="none">{t('common.unassigned')}</option>
                {assignees.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {all.isLoading ? (
            <Skeleton className="h-64" />
          ) : all.isError ? (
            <ErrorState error={all.error} onRetry={() => all.refetch()} />
          ) : !rows.length ? (
            <EmptyState title={t('insights.noRecommendations')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpen(r.id)} className="flex w-full flex-col gap-1.5 rounded-lg border border-brd bg-card p-3 text-left transition-colors hover:border-brds focus-visible:outline-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={severityTone(r.priority)}>{t(`common.${r.priority}`)}</Badge>
                      <Badge tone={STATUS_TONE[r.status]}>{t(`insights.status_${r.status}`)}</Badge>
                      {r.origin !== 'rule' && <Badge>{t(`insights.origin_${r.origin}`)}</Badge>}
                      {recMode(r) === 'demo' && <DataModeBadge mode="demo" />}
                    </span>
                    <span className="text-[14px] font-medium text-t1">{text(r, 'title')}</span>
                    <span className="line-clamp-2 text-[13px] text-t2">{text(r, 'summary')}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-t3">
                      <span>
                        {t('common.owner')}{t('common.colon')} {r.ownerName ?? t('common.unassigned')}
                      </span>
                      {r.dueDate && (
                        <span className={clsx(r.dueDate < new Date().toISOString().slice(0, 10) && !['completed', 'dismissed'].includes(r.status) && 'font-medium text-neg')}>
                          {t('insights.due')}{t('common.colon')} {formatDate(r.dueDate, lang)}
                        </span>
                      )}
                      <span>
                        {t('common.impact')}{t('common.colon')} {t(`common.${r.impact}`)}
                      </span>
                      {!!r.commentCount && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="size-3" aria-hidden /> {r.commentCount}
                          <span className="sr-only">{t('insights.comments')}</span>
                        </span>
                      )}
                      <span>{relativeTime(r.updatedAt, lang)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <RecDrawer id={openId} onClose={() => setOpen(null)} assignees={assignees.data ?? []} />
      {manage && <CreateModal open={creating} onClose={() => setCreating(false)} assignees={assignees.data ?? []} />}
    </>
  );
}

/* ---------------- alerts ---------------- */

function AlertsPanel() {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const [status, setStatus] = useState('open,acknowledged');
  const [severity, setSeverity] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const q = useApi<AlertEvent[]>('/api/insights/alerts', { status: status || undefined, severity: severity || undefined });
  const act = useApiMutation<{ id: string; to: 'acknowledge' | 'resolve' }>('POST', (b) => `/api/insights/alerts/${b.id}/${b.to}`, ['/api/insights/alerts']);
  const run = async (id: string, to: 'acknowledge' | 'resolve') => {
    try {
      await act.mutateAsync({ id, to });
      toast(t(to === 'acknowledge' ? 'insights.acknowledged' : 'insights.resolved'), 'pos');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
  const rows = (q.data ?? []).slice().sort((a, b) => (a.status === 'resolved' ? 1 : 0) - (b.status === 'resolved' ? 1 : 0) || order[a.severity] - order[b.severity] || b.lastTriggeredAt.localeCompare(a.lastTriggeredAt));
  return (
    <Card>
      <CardHeader
        title={t('insights.alerts')}
        subtitle={t('insights.alertsHint')}
        actions={
          can('alerts.manage') && (
            <Link to="/admin?section=alerts" className="text-[13px] font-medium text-acctext hover:underline">
              {t('insights.manageRules')} →
            </Link>
          )
        }
      />
      <CardBody>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label={t('common.status')} htmlFor="a-status">
            <Select id="a-status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 text-[13px]">
              <option value="open,acknowledged">{t('insights.alertsActive')}</option>
              <option value="open">{t('insights.alertStatus_open')}</option>
              <option value="acknowledged">{t('insights.alertStatus_acknowledged')}</option>
              <option value="resolved">{t('insights.alertStatus_resolved')}</option>
              <option value="">{t('common.all')}</option>
            </Select>
          </Field>
          <Field label={t('common.severity')} htmlFor="a-sev">
            <Select id="a-sev" value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-8 text-[13px]">
              <option value="">{t('common.all')}</option>
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`common.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {q.isLoading ? (
          <Skeleton className="h-48" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !rows.length ? (
          <p className="flex items-center gap-2 py-6 text-[13px] text-t2">
            <CheckCircle2 className="size-4 text-pos" aria-hidden />
            {t('insights.noAlerts')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-brd">
            {rows.map((a) => {
              const ev = a.evidence as Record<string, unknown>;
              const isOpen = expanded === a.id;
              return (
                <li key={a.id} className="py-3">
                  <div className="flex items-start gap-3">
                    {a.status === 'resolved' ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pos" aria-hidden />
                    ) : (
                      <AlertTriangle className={clsx('mt-0.5 size-4 shrink-0', a.severity === 'critical' || a.severity === 'high' ? 'text-neg' : 'text-warn')} aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] text-t1">{lang === 'fr' ? (a.titleFr ?? a.title) : a.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-t3">
                        <Badge tone={severityTone(a.severity)}>{t(`common.${a.severity}`)}</Badge>
                        <Badge tone={a.status === 'resolved' ? 'pos' : a.status === 'acknowledged' ? 'info' : 'warn'}>{t(`insights.alertStatus_${a.status}`)}</Badge>
                        <span>
                          {t('insights.firstSeen')} {formatDateTime(a.firstTriggeredAt, lang)}
                        </span>
                        <span>
                          · {t('insights.lastSeen')} {relativeTime(a.lastTriggeredAt, lang)}
                        </span>
                        {a.occurrences > 1 && <span>· ×{a.occurrences}</span>}
                        {ev.mode === 'demo' && <DataModeBadge mode="demo" />}
                      </p>
                      <button type="button" className="mt-1 text-[12.5px] font-medium text-acctext hover:underline" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : a.id)}>
                        {isOpen ? t('common.less') : t('insights.showEvidence')}
                      </button>
                      {isOpen && (
                        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg bg-card2 p-3 text-[12.5px] sm:grid-cols-2">
                          {Object.entries(ev)
                            .filter(([, v]) => v !== null && typeof v !== 'object')
                            .map(([k, v]) => (
                              <div key={k} className="flex min-w-0 gap-2">
                                <dt className="shrink-0 text-t3">{k}</dt>
                                <dd className="min-w-0 break-words">{String(v)}</dd>
                              </div>
                            ))}
                        </dl>
                      )}
                    </div>
                    {can('alerts.ack') && a.status !== 'resolved' && (
                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                        {a.status === 'open' && (
                          <Button size="sm" variant="ghost" onClick={() => run(a.id, 'acknowledge')}>
                            {t('insights.acknowledge')}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" icon={<ShieldCheck className="size-3.5" />} onClick={() => run(a.id, 'resolve')}>
                          {t('insights.resolve')}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 flex items-start gap-1.5 text-[12px] text-t3">
          <Mail className="mt-0.5 size-3 shrink-0" aria-hidden />
          {t('insights.alertsDelivery')}
        </p>
      </CardBody>
    </Card>
  );
}

export default function InsightsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useTab<Tab>(TABS, 'summary');
  const [sp] = useSearchParams();
  const active: Tab = sp.get('rec') ? 'recommendations' : tab;
  return (
    <>
      <PageHeader title={t('insights.title')} subtitle={t('insights.subtitle')} crumbs={[{ label: t('nav.insights') }]} />
      {active === 'summary' && <FilterToolbar />}
      <PageBody>
        <Tabs label={t('insights.title')} value={active} onChange={setTab} tabs={TABS.map((id) => ({ id, label: t(`insights.tab_${id}`) }))} />
        <TabPanel id={active}>
          <div className="flex flex-col gap-[var(--gap-grid)]">
            {active === 'summary' && (
              <>
                <ExecutiveSummaryCard />
                <MethodCard />
              </>
            )}
            {active === 'recommendations' && <Recommendations />}
            {active === 'alerts' && <AlertsPanel />}
          </div>
        </TabPanel>
      </PageBody>
    </>
  );
}
