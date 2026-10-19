import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { L10n } from '@shared/catalog';
import { METRICS, getMetric } from '@shared/metrics';
import { useApi, useMeta } from '@/api/hooks';
import type { WidgetConfig } from '@/api/types';
import { useI18n } from '@/i18n';
import { formatDate, formatValue, relativeTime } from '@/lib/format';
import { useSession } from '@/state/session';
import { useMetricLabel } from '@/components/data';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Drawer, ErrorState, Field, Input, Modal, MultiSelect, Select, Skeleton, Switch, Textarea, severityTone, useToast } from '@/components/ui';
import { ReadOnlyNote, splitList, useAction } from '../shared';

/* ---------------- KPI registry ---------------- */

interface RegistryMetric {
  id: string;
  label: L10n;
  description: L10n;
  unit: string;
  agg: { kind: string; tables?: string[]; num?: string; den?: string };
  direction: 'up' | 'down' | 'neutral';
  module: string;
  sources: string[];
  deltaPct: boolean;
  executive?: boolean;
  dimensions: string[];
  override: { enabled: boolean; labelEn: string | null; labelFr: string | null; definitionEn: string | null; definitionFr: string | null; owner: string | null; notes: string | null; updatedAt: string } | null;
}

interface Registry {
  metrics: RegistryMetric[];
  conversionEvents: string[];
  events: Array<{ id: string; name: L10n; keyEvent: boolean }>;
}

interface Term {
  id: string;
  kind: string;
  key: string;
  labelEn: string;
  labelFr: string;
  active: boolean;
}

function MetricDrawer({ m, onClose }: { m: RegistryMetric | null; onClose: () => void }) {
  const { t, L } = useI18n();
  const { can } = useSession();
  const meta = useMeta();
  const [f, setF] = useState({ enabled: true, labelEn: '', labelFr: '', definitionEn: '', definitionFr: '', owner: '', notes: '' });
  useEffect(() => {
    if (!m) return;
    const o = m.override;
    setF({ enabled: o?.enabled ?? true, labelEn: o?.labelEn ?? '', labelFr: o?.labelFr ?? '', definitionEn: o?.definitionEn ?? '', definitionFr: o?.definitionFr ?? '', owner: o?.owner ?? '', notes: o?.notes ?? '' });
  }, [m]);
  const save = useAction<Record<string, unknown>>('PATCH', `/api/admin/kpis/${m?.id}`, ['/api/admin/kpis', 'meta']);
  if (!m) return null;
  const edit = can('kpi.manage');
  const avail = m.sources.map((s) => meta.data?.sources[s]?.mode ?? 'unavailable');
  const method = m.agg.kind === 'ratio' ? `${m.agg.num} ÷ ${m.agg.den}` : m.agg.tables ? `${t(`admin.agg_${m.agg.kind}`)} — ${m.agg.tables.join(', ')}` : t(`admin.agg_${m.agg.kind}`);
  const nn = (v: string) => (v.trim() ? v.trim() : null);
  return (
    <Drawer
      open
      onClose={onClose}
      title={L(m.label)}
      footer={
        edit ? (
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={save.pending} onClick={async () => (await save.run({ enabled: f.enabled, labelEn: nn(f.labelEn), labelFr: nn(f.labelFr), definitionEn: nn(f.definitionEn), definitionFr: nn(f.definitionFr), owner: nn(f.owner), notes: nn(f.notes) })) !== undefined && onClose()}>
              {t('common.save')}
            </Button>
          </>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-t3">{t('admin.identifier')}</dt>
          <dd>
            <code>{m.id}</code>
          </dd>
        </div>
        <div>
          <dt className="text-t3">{t('admin.unit')}</dt>
          <dd>{t(`admin.unit_${m.unit}`)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-t3">{t('admin.standardDefinition')}</dt>
          <dd>{L(m.description)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-t3">{t('admin.methodology')}</dt>
          <dd>{method}</dd>
        </div>
        <div>
          <dt className="text-t3">{t('admin.dataSource')}</dt>
          <dd>{m.sources.join(', ')}</dd>
        </div>
        <div>
          <dt className="text-t3">{t('admin.availability')}</dt>
          <dd className="flex flex-wrap gap-1">
            {avail.map((a, i) => (
              <Badge key={i} tone={a === 'connected' ? 'pos' : a === 'demo' ? 'warn' : 'neutral'}>
                {t(`common.mode${a[0].toUpperCase()}${a.slice(1)}`)}
              </Badge>
            ))}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-t3">{t('admin.dimensions')}</dt>
          <dd>{m.dimensions.length ? m.dimensions.map((d) => t(`filters.dim_${d}`)).join(', ') : t('admin.noBreakdown')}</dd>
        </div>
        <div>
          <dt className="text-t3">{t('admin.granularity')}</dt>
          <dd>{t('admin.granularities')}</dd>
        </div>
        <div>
          <dt className="text-t3">{t('admin.direction')}</dt>
          <dd>{t(`admin.direction_${m.direction}`)}</dd>
        </div>
        <div>
          <dt className="text-t3">{t('admin.defaultViz')}</dt>
          <dd>{t(m.unit === 'percent' || m.unit === 'position' ? 'admin.viz_rate' : 'admin.viz_count')}</dd>
        </div>
        <div>
          <dt className="text-t3">{t('admin.changeShownAs')}</dt>
          <dd>{m.deltaPct ? t('admin.changePct') : t('admin.changeAbs')}</dd>
        </div>
      </dl>
      <fieldset disabled={!edit} className="mt-5 flex flex-col gap-3 border-t border-brd pt-4">
        <legend className="sr-only">{t('admin.localOverrides')}</legend>
        <p className="text-[13px] font-semibold">{t('admin.localOverrides')}</p>
        <p className="text-[12.5px] text-t2">{t('admin.overrideHint')}</p>
        <Switch checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={t('admin.kpiEnabled')} description={t('admin.kpiEnabledHint')} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('admin.displayNameEn')} htmlFor="k-len">
            <Input id="k-len" value={f.labelEn} placeholder={m.label.en} onChange={(e) => setF({ ...f, labelEn: e.target.value })} />
          </Field>
          <Field label={t('admin.displayNameFr')} htmlFor="k-lfr">
            <Input id="k-lfr" value={f.labelFr} placeholder={m.label.fr} onChange={(e) => setF({ ...f, labelFr: e.target.value })} />
          </Field>
          <Field label={t('admin.definitionNoteEn')} htmlFor="k-den">
            <Textarea id="k-den" value={f.definitionEn} onChange={(e) => setF({ ...f, definitionEn: e.target.value })} />
          </Field>
          <Field label={t('admin.definitionNoteFr')} htmlFor="k-dfr">
            <Textarea id="k-dfr" value={f.definitionFr} onChange={(e) => setF({ ...f, definitionFr: e.target.value })} />
          </Field>
          <Field label={t('admin.owner')} htmlFor="k-owner">
            <Input id="k-owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />
          </Field>
          <Field label={t('admin.notes')} htmlFor="k-notes">
            <Input id="k-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
      </fieldset>
    </Drawer>
  );
}

function ConversionEvents({ reg }: { reg: Registry }) {
  const { t, L } = useI18n();
  const { can } = useSession();
  const [sel, setSel] = useState<string[]>(reg.conversionEvents);
  useEffect(() => setSel(reg.conversionEvents), [reg.conversionEvents]);
  const save = useAction<{ events: string[] }>('PUT', '/api/admin/kpis/conversion-events', ['/api/admin/kpis', 'meta', 'analytics']);
  return (
    <Card>
      <CardHeader title={t('admin.conversionEvents')} subtitle={t('admin.conversionEventsHint')} />
      <CardBody>
        <fieldset disabled={!can('kpi.manage')} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="sr-only">{t('admin.conversionEvents')}</legend>
          {reg.events.map((e) => (
            <Checkbox key={e.id} checked={sel.includes(e.id)} onChange={(c) => setSel(c ? [...sel, e.id] : sel.filter((x) => x !== e.id))} label={`${L(e.name)}${e.keyEvent ? ` · ${t('admin.keyEvent')}` : ''}`} />
          ))}
        </fieldset>
        {can('kpi.manage') && (
          <div className="mt-3 flex justify-end">
            <Button variant="primary" disabled={!sel.length} loading={save.pending} onClick={() => save.run({ events: sel })}>
              {t('common.save')}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Taxonomy() {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const q = useApi<Term[]>('/api/admin/taxonomy');
  const [kind, setKind] = useState('topic');
  const [n, setN] = useState({ key: '', labelEn: '', labelFr: '' });
  const add = useAction<Record<string, unknown>>('POST', '/api/admin/taxonomy', ['/api/admin/taxonomy', 'meta']);
  const patch = useAction<{ id: string; active: boolean }>('PATCH', (b) => `/api/admin/taxonomy/${b.id}`, ['/api/admin/taxonomy', 'meta']);
  const kinds = ['topic', 'pillar', 'objective', 'audience', 'business_unit', 'tag'];
  const edit = can('kpi.manage');
  return (
    <Card>
      <CardHeader title={t('admin.taxonomy')} subtitle={t('admin.taxonomyHint')} />
      <CardBody>
        <div className="mb-3 flex flex-wrap gap-1">
          {kinds.map((k) => (
            <Button key={k} size="sm" variant={kind === k ? 'primary' : 'secondary'} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {t(`admin.kind_${k}`)}
            </Button>
          ))}
        </div>
        <ul className="flex flex-col divide-y divide-brd text-[13px]">
          {(q.data ?? [])
            .filter((x) => x.kind === kind)
            .map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className={x.active ? '' : 'text-t3 line-through'}>
                  {lang === 'fr' ? x.labelFr : x.labelEn} <code className="ml-1 text-[11.5px] text-t3">{x.key}</code>
                </span>
                {edit && (
                  <Button size="sm" variant="ghost" onClick={() => patch.run({ id: x.id, active: !x.active })}>
                    {x.active ? t('admin.deactivate') : t('admin.activate')}
                  </Button>
                )}
              </li>
            ))}
        </ul>
        {edit && (
          <div className="mt-3 grid grid-cols-1 items-end gap-2 sm:grid-cols-4">
            <Field label={t('admin.key')} htmlFor="tx-key" hint="a-z, 0-9, _">
              <Input id="tx-key" value={n.key} onChange={(e) => setN({ ...n, key: e.target.value })} />
            </Field>
            <Field label="EN" htmlFor="tx-en">
              <Input id="tx-en" value={n.labelEn} onChange={(e) => setN({ ...n, labelEn: e.target.value })} />
            </Field>
            <Field label="FR" htmlFor="tx-fr">
              <Input id="tx-fr" value={n.labelFr} onChange={(e) => setN({ ...n, labelFr: e.target.value })} />
            </Field>
            <Button icon={<Plus className="size-3.5" />} disabled={!n.key || !n.labelEn || !n.labelFr} loading={add.pending} onClick={async () => (await add.run({ kind, ...n })) !== undefined && setN({ key: '', labelEn: '', labelFr: '' })}>
              {t('common.add')}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function KpiSection() {
  const { t, L } = useI18n();
  const q = useApi<Registry>('/api/admin/kpis');
  const [open, setOpen] = useState<RegistryMetric | null>(null);
  const [mod, setMod] = useState('');
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data.metrics.filter((m) => !mod || m.module === mod);
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="kpi.manage" />
      <Card>
        <CardHeader title={t('admin.kpiRegistry')} subtitle={t('admin.kpiRegistryHint')} />
        <CardBody>
          <div className="mb-3">
            <Field label={t('admin.module')} htmlFor="k-mod">
              <Select id="k-mod" value={mod} onChange={(e) => setMod(e.target.value)} className="h-8 w-56 text-[13px]">
                <option value="">{t('common.all')}</option>
                {['web', 'forms', 'search', 'social', 'ads', 'geo'].map((m) => (
                  <option key={m} value={m}>
                    {t(`admin.module_${m}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <DataTable
            rows={rows}
            caption={t('admin.kpiRegistry')}
            rowKey={(m) => m.id}
            onRowClick={setOpen}
            exportTitle="kpi-registry"
            pageSize={20}
            columns={[
              {
                key: 'name',
                header: t('admin.displayName'),
                value: (m) => L(m.label),
                unit: 'text',
                render: (m) => (
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {L(m.label)}
                      {m.override && (m.override.labelEn || m.override.labelFr || m.override.definitionEn) && <Badge className="ml-1">{t('admin.overridden')}</Badge>}
                    </span>
                    <code className="text-[11.5px] text-t3">{m.id}</code>
                  </span>
                ),
              },
              { key: 'module', header: t('admin.module'), value: (m) => t(`admin.module_${m.module}`), unit: 'text', hideOnMobile: true },
              { key: 'source', header: t('admin.dataSource'), value: (m) => m.sources.join(', '), unit: 'text', hideOnMobile: true },
              { key: 'unit', header: t('admin.unit'), value: (m) => t(`admin.unit_${m.unit}`), unit: 'text', hideOnMobile: true },
              { key: 'agg', header: t('admin.aggregation'), value: (m) => t(`admin.agg_${m.agg.kind}`), unit: 'text', hideOnMobile: true },
              { key: 'dir', header: t('admin.direction'), value: (m) => t(`admin.direction_${m.direction}`), unit: 'text', hideOnMobile: true },
              { key: 'owner', header: t('admin.owner'), value: (m) => m.override?.owner ?? '—', unit: 'text', hideOnMobile: true },
              { key: 'enabled', header: t('common.status'), value: (m) => (m.override?.enabled === false ? 0 : 1), render: (m) => <Badge tone={m.override?.enabled === false ? 'neutral' : 'pos'}>{m.override?.enabled === false ? t('common.disabled') : t('common.enabled')}</Badge> },
            ]}
          />
          <p className="mt-3 text-[12px] text-t3">{t('admin.noSilentOverride')}</p>
        </CardBody>
      </Card>
      <ConversionEvents reg={q.data} />
      <Taxonomy />
      <MetricDrawer m={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/* ---------------- dashboard builder ---------------- */

type Widget = WidgetConfig & { size?: 'full' | 'half' };
const WIDGET_TYPES: Widget['type'][] = ['kpi_grid', 'evolution', 'channels', 'geography', 'content_snapshot', 'targets', 'alerts', 'ai_summary'];

function SortableWidget({ w, onChange, onRemove, executiveOptions, edit }: { w: Widget; onChange: (w: Widget) => void; onRemove: () => void; executiveOptions: Array<{ value: string; label: string; group?: string }>; edit: boolean }) {
  const { t } = useI18n();
  const labelOf = useMetricLabel();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id, disabled: !edit });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const metricList = w.metrics ?? [];
  const move = (i: number, d: -1 | 1) => {
    const next = [...metricList];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...w, metrics: next });
  };
  return (
    <li ref={setNodeRef} style={style} className={`rounded-lg border bg-card p-3 ${isDragging ? 'border-acc shadow-lg' : 'border-brd'} ${w.visible ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-center gap-2">
        {edit && (
          <button type="button" className="cursor-grab rounded p-1 text-t3 hover:bg-hov active:cursor-grabbing" aria-label={t('admin.dragToReorder', { name: t(`admin.widget_${w.type}`) })} {...attributes} {...listeners}>
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <span className="min-w-0 flex-1">
          <span className="text-[14px] font-semibold">{w.title || t(`admin.widget_${w.type}`)}</span>
          <span className="block text-[12px] text-t3">{t(`admin.widgetHint_${w.type}`)}</span>
        </span>
        <Select aria-label={t('admin.widgetSize')} value={w.size ?? 'full'} disabled={!edit} onChange={(e) => onChange({ ...w, size: e.target.value as 'full' | 'half' })} className="h-8 w-36 text-[13px]">
          <option value="full">{t('admin.sizeFull')}</option>
          <option value="half">{t('admin.sizeHalf')}</option>
        </Select>
        <Switch checked={w.visible} disabled={!edit} onChange={(v) => onChange({ ...w, visible: v })} label={`${t('admin.visible')}: ${t(`admin.widget_${w.type}`)}`} hideLabel />
        {edit && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label={`${t('common.delete')}: ${t(`admin.widget_${w.type}`)}`} onClick={onRemove} />}
      </div>
      {edit && (
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <Field label={t('admin.widgetTitle')} htmlFor={`wt-${w.id}`}>
            <Input id={`wt-${w.id}`} value={w.title ?? ''} placeholder={t(`admin.widget_${w.type}`)} maxLength={80} onChange={(e) => onChange({ ...w, title: e.target.value || undefined })} />
          </Field>
          {(w.type === 'kpi_grid' || w.type === 'evolution') && (
            <MultiSelect label={t('admin.widgetKpis')} placeholderAll={t('admin.noneSelected')} options={executiveOptions} value={metricList} onChange={(v) => onChange({ ...w, metrics: v.slice(0, w.type === 'evolution' ? 4 : 16) })} />
          )}
        </div>
      )}
      {(w.type === 'kpi_grid' || w.type === 'evolution') && metricList.length > 0 && (
        <ol className="mt-2 flex flex-wrap gap-1.5" aria-label={t('admin.kpiOrder')}>
          {metricList.map((m, i) => (
            <li key={m} className="inline-flex items-center gap-1 rounded-md border border-brd bg-card2 px-2 py-0.5 text-[12px]">
              <span className="tnum text-t3">{i + 1}.</span> {labelOf(m)}
              {edit && (
                <>
                  <button type="button" className="px-0.5 text-t3 hover:text-t1 disabled:opacity-30" disabled={i === 0} aria-label={t('admin.moveEarlier', { name: labelOf(m) })} onClick={() => move(i, -1)}>
                    ←
                  </button>
                  <button type="button" className="px-0.5 text-t3 hover:text-t1 disabled:opacity-30" disabled={i === metricList.length - 1} aria-label={t('admin.moveLater', { name: labelOf(m) })} onClick={() => move(i, 1)}>
                    →
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {w.type === 'evolution' && <p className="mt-1 text-[12px] text-t3">{t('admin.evolutionNote')}</p>}
    </li>
  );
}

export function DashboardSection() {
  const { t } = useI18n();
  const { can } = useSession();
  const labelOf = useMetricLabel();
  const q = useApi<{ layout: Widget[] } | null>('/api/admin/dashboards/executive');
  const [layout, setLayout] = useState<Widget[]>([]);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState<Widget['type']>('targets');
  useEffect(() => {
    if (q.data?.layout) {
      setLayout(q.data.layout);
      setDirty(false);
    }
  }, [q.data]);
  const save = useAction<{ layout: Widget[] }>('PUT', '/api/admin/dashboards/executive', ['/api/admin/dashboards', 'meta']);
  const reset = useAction<void, { layout: Widget[] }>('DELETE', '/api/admin/dashboards/executive', ['/api/admin/dashboards', 'meta']);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const edit = can('dashboards.edit');
  const executiveOptions = useMemo(() => METRICS.filter((m) => m.executive && !m.internal).map((m) => ({ value: m.id, label: labelOf(m.id), group: m.module })), [labelOf]);
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const update = (next: Widget[]) => {
    setLayout(next);
    setDirty(true);
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = layout.findIndex((w) => w.id === e.active.id);
    const to = layout.findIndex((w) => w.id === e.over!.id);
    update(arrayMove(layout, from, to));
  };
  const addWidget = () => {
    let n = 1;
    while (layout.some((w) => w.id === `${adding}_${n}`)) n++;
    update([...layout, { id: `${adding}_${n}`, type: adding, visible: true, size: 'full', ...(adding === 'kpi_grid' ? { metrics: ['sessions'] } : adding === 'evolution' ? { metrics: ['sessions'] } : {}) }]);
  };
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="dashboards.edit" />
      <Card>
        <CardHeader
          title={t('admin.dashboardBuilder')}
          subtitle={t('admin.dashboardBuilderHint')}
          actions={
            <Link to="/" className="text-[13px] font-medium text-acctext hover:underline">
              {t('admin.openOverview')} →
            </Link>
          }
        />
        <CardBody>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={layout.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {layout.map((w, i) => (
                  <SortableWidget key={w.id} w={w} edit={edit} executiveOptions={executiveOptions} onChange={(nw) => update(layout.map((x, j) => (j === i ? nw : x)))} onRemove={() => update(layout.filter((_, j) => j !== i))} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {edit && (
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-brd pt-4">
              <div className="flex items-end gap-2">
                <Field label={t('admin.addWidget')} htmlFor="add-widget">
                  <Select id="add-widget" value={adding} onChange={(e) => setAdding(e.target.value as Widget['type'])} className="h-9 w-56">
                    {WIDGET_TYPES.map((x) => (
                      <option key={x} value={x}>
                        {t(`admin.widget_${x}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button icon={<Plus className="size-3.5" />} disabled={layout.length >= 20} onClick={addWidget}>
                  {t('common.add')}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" icon={<RotateCcw className="size-3.5" />} loading={reset.pending} onClick={async () => window.confirm(t('admin.resetConfirm')) && (await reset.run(undefined))}>
                  {t('admin.resetLayout')}
                </Button>
                <Button variant="primary" disabled={!dirty || !layout.length} loading={save.pending} onClick={async () => (await save.run({ layout })) !== undefined && setDirty(false)}>
                  {t('admin.saveLayout')}
                </Button>
              </div>
            </div>
          )}
          <p className="mt-3 text-[12px] text-t3">{t('admin.dashboardScopeNote')}</p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------- alert rules ---------------- */

interface Rule {
  id: string;
  name: string;
  metricId: string;
  filters: Record<string, string[]>;
  condition: string;
  threshold: number | null;
  windowDays: number;
  compare: 'previous' | 'yoy';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cooldownHours: number;
  channels: Array<'in_app' | 'email'>;
  recipients: string[];
  enabled: boolean;
  lastEvaluatedAt: string | null;
}

const CONDITIONS = ['above', 'below', 'change_up_pct', 'change_down_pct', 'change_up_abs', 'change_down_abs', 'missing_data', 'pacing_above'];

function RuleModal({ rule, open, onClose }: { rule: Rule | null; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const meta = useMeta();
  const labelOf = useMetricLabel();
  const empty = { name: '', metricId: 'sessions', condition: 'change_down_pct', threshold: '20', windowDays: 7, compare: 'previous' as 'previous' | 'yoy', severity: 'medium' as Rule['severity'], cooldownHours: 24, inApp: true, email: false, recipients: '', enabled: true, site: '' };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(rule ? { name: rule.name, metricId: rule.metricId, condition: rule.condition, threshold: rule.threshold === null ? '' : String(rule.threshold), windowDays: rule.windowDays, compare: rule.compare, severity: rule.severity, cooldownHours: rule.cooldownHours, inApp: rule.channels.includes('in_app'), email: rule.channels.includes('email'), recipients: rule.recipients.join('\n'), enabled: rule.enabled, site: rule.filters.site?.[0] ?? '' } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule]);
  const create = useAction<Record<string, unknown>>('POST', '/api/admin/alert-rules', ['/api/admin/alert-rules']);
  const update = useAction<Record<string, unknown>>('PATCH', `/api/admin/alert-rules/${rule?.id}`, ['/api/admin/alert-rules']);
  const isPct = f.condition.endsWith('_pct') || f.condition === 'pacing_above';
  const unit = getMetric(f.metricId)?.unit;
  const body = {
    name: f.name.trim(),
    metricId: f.metricId,
    condition: f.condition,
    threshold: f.condition === 'missing_data' || f.threshold === '' ? null : isPct ? Number(f.threshold) / 100 : unit === 'percent' && (f.condition === 'above' || f.condition === 'below') ? Number(f.threshold) / 100 : Number(f.threshold),
    windowDays: f.windowDays,
    compare: f.compare,
    severity: f.severity,
    cooldownHours: f.cooldownHours,
    channels: [...(f.inApp ? ['in_app'] : []), ...(f.email ? ['email'] : [])],
    recipients: splitList(f.recipients),
    enabled: f.enabled,
    filters: f.site ? { site: [f.site] } : {},
  };
  const submit = async () => ((rule ? await update.run(body) : await create.run(body)) !== undefined ? onClose() : undefined);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={rule ? t('admin.editRule') : t('admin.addRule')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.pending || update.pending} disabled={f.name.trim().length < 3 || (f.condition !== 'missing_data' && f.threshold === '') || !body.channels.length} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t('common.name')} htmlFor="r-name" required>
            <Input id="r-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
        </div>
        <Field label={t('admin.metric')} htmlFor="r-metric">
          <Select id="r-metric" value={f.metricId} onChange={(e) => setF({ ...f, metricId: e.target.value })}>
            {METRICS.filter((m) => !m.internal).map((m) => (
              <option key={m.id} value={m.id}>
                {labelOf(m.id)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('admin.website')} htmlFor="r-site">
          <Select id="r-site" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })}>
            <option value="">{t('filters.allSites')}</option>
            {meta.data?.sites.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('admin.condition')} htmlFor="r-cond">
          <Select id="r-cond" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {t(`admin.cond_${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={isPct || unit === 'percent' ? t('admin.thresholdPct') : t('admin.threshold')} htmlFor="r-th" hint={f.condition === 'missing_data' ? t('admin.noThresholdNeeded') : undefined}>
          <Input id="r-th" type="number" step="any" value={f.threshold} disabled={f.condition === 'missing_data'} onChange={(e) => setF({ ...f, threshold: e.target.value })} />
        </Field>
        <Field label={t('admin.window')} htmlFor="r-win" hint={t('admin.windowHint')}>
          <Input id="r-win" type="number" min={1} max={90} value={f.windowDays} onChange={(e) => setF({ ...f, windowDays: Number(e.target.value) })} />
        </Field>
        <Field label={t('admin.comparePeriod')} htmlFor="r-cmp">
          <Select id="r-cmp" value={f.compare} onChange={(e) => setF({ ...f, compare: e.target.value as 'previous' | 'yoy' })}>
            <option value="previous">{t('common.vsPrevious')}</option>
            <option value="yoy">{t('common.vsYoy')}</option>
          </Select>
        </Field>
        <Field label={t('common.severity')} htmlFor="r-sev">
          <Select id="r-sev" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as Rule['severity'] })}>
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`common.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('admin.cooldown')} htmlFor="r-cool" hint={t('admin.cooldownHint')}>
          <Input id="r-cool" type="number" min={0} max={720} value={f.cooldownHours} onChange={(e) => setF({ ...f, cooldownHours: Number(e.target.value) })} />
        </Field>
        <fieldset>
          <legend className="mb-1 text-[13px] font-medium">{t('admin.notificationChannels')}</legend>
          <Checkbox checked={f.inApp} onChange={(v) => setF({ ...f, inApp: v })} label={t('admin.channel_in_app')} />
          <Checkbox checked={f.email} onChange={(v) => setF({ ...f, email: v })} label={t('admin.channel_email')} />
          {f.email && <p className="mt-1 text-[12px] text-t3">{t('admin.emailWhenConfigured')}</p>}
        </fieldset>
        <Field label={t('reports.recipients')} htmlFor="r-rcp" hint={t('reports.recipientsHint')}>
          <Textarea id="r-rcp" value={f.recipients} onChange={(e) => setF({ ...f, recipients: e.target.value })} />
        </Field>
        <Switch checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={t('common.enabled')} />
      </div>
      <p className="mt-3 text-[12px] text-t3">{t('admin.evaluationNote')}</p>
    </Modal>
  );
}

export function AlertRulesSection() {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const labelOf = useMetricLabel();
  const q = useApi<Rule[]>('/api/admin/alert-rules');
  const [modal, setModal] = useState<{ open: boolean; rule: Rule | null }>({ open: false, rule: null });
  const toggle = useAction<{ id: string; enabled: boolean }>('PATCH', (b) => `/api/admin/alert-rules/${b.id}`, ['/api/admin/alert-rules']);
  const del = useAction<{ id: string }>('DELETE', (b) => `/api/admin/alert-rules/${b.id}`, ['/api/admin/alert-rules']);
  const evaluate = useAction<void, Record<string, number>>('POST', '/api/admin/alert-rules/evaluate', ['/api/admin/alert-rules', '/api/insights/alerts', '/api/notifications']);
  const toast = useToast();
  const edit = can('alerts.manage');
  if (q.isLoading) return <Skeleton className="h-72" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const thresholdText = (r: Rule) => {
    if (r.threshold === null) return '—';
    if (r.condition.endsWith('_pct') || r.condition === 'pacing_above') return formatValue(r.threshold, 'percent', lang);
    const u = getMetric(r.metricId)?.unit;
    return formatValue(r.threshold, u ?? 'count', lang);
  };
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="alerts.manage" />
      <Card>
        <CardHeader
          title={t('admin.alertRules')}
          subtitle={t('admin.alertRulesHint')}
          actions={
            edit && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  icon={<Play className="size-3.5" />}
                  loading={evaluate.pending}
                  onClick={async () => {
                    const r = await evaluate.run(undefined, null);
                    if (r) toast(t('admin.evaluated', { created: r.created ?? 0, updated: r.updated ?? 0, resolved: r.resolved ?? 0, suppressed: r.suppressed ?? 0 }), 'pos');
                  }}
                >
                  {t('admin.evaluateNow')}
                </Button>
                <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setModal({ open: true, rule: null })}>
                  {t('admin.addRule')}
                </Button>
              </div>
            )
          }
        />
        <CardBody>
          <DataTable
            rows={q.data ?? []}
            caption={t('admin.alertRules')}
            rowKey={(r) => r.id}
            columns={[
              { key: 'name', header: t('common.name'), value: (r) => r.name, unit: 'text', render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'metric', header: t('admin.metric'), value: (r) => labelOf(r.metricId), unit: 'text', hideOnMobile: true },
              { key: 'cond', header: t('admin.condition'), value: (r) => `${t(`admin.cond_${r.condition}`)} ${thresholdText(r)}`, unit: 'text' },
              { key: 'window', header: t('admin.window'), value: (r) => r.windowDays, render: (r) => t('admin.days', { n: r.windowDays }), hideOnMobile: true },
              { key: 'sev', header: t('common.severity'), value: (r) => r.severity, unit: 'text', render: (r) => <Badge tone={severityTone(r.severity)}>{t(`common.${r.severity}`)}</Badge> },
              { key: 'cool', header: t('admin.cooldown'), value: (r) => r.cooldownHours, render: (r) => `${r.cooldownHours} h`, hideOnMobile: true },
              { key: 'chan', header: t('admin.notificationChannels'), value: (r) => r.channels.map((c) => t(`admin.channel_${c}`)).join(', '), unit: 'text', hideOnMobile: true },
              { key: 'last', header: t('admin.lastEvaluated'), value: (r) => r.lastEvaluatedAt, unit: 'text', render: (r) => (r.lastEvaluatedAt ? relativeTime(r.lastEvaluatedAt, lang) : t('admin.never')), hideOnMobile: true },
              {
                key: 'enabled',
                header: t('common.status'),
                value: (r) => (r.enabled ? 1 : 0),
                render: (r) => <Switch checked={r.enabled} disabled={!edit} onChange={(v) => toggle.run({ id: r.id, enabled: v })} label={`${t('common.enabled')}: ${r.name}`} hideLabel />,
              },
              {
                key: 'act',
                header: '',
                value: () => null,
                sortable: false,
                render: (r) =>
                  edit && (
                    <span className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, rule: r })}>
                        {t('common.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label={`${t('common.delete')}: ${r.name}`} onClick={() => window.confirm(t('common.areYouSure')) && del.run({ id: r.id })} />
                    </span>
                  ),
              },
            ]}
          />
          <p className="mt-3 text-[12px] text-t3">{t('admin.dedupNote')}</p>
        </CardBody>
      </Card>
      {edit && <RuleModal open={modal.open} rule={modal.rule} onClose={() => setModal({ open: false, rule: null })} />}
    </div>
  );
}

/* ---------------- targets ---------------- */

interface Target {
  id: string;
  metricId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  filters: Record<string, string[]>;
  owner: string | null;
  note: string | null;
  objective: string | null;
  warningRatio: number | null;
}

function TargetModal({ target, open, onClose }: { target: Target | null; open: boolean; onClose: () => void }) {
  const { t, L } = useI18n();
  const meta = useMeta();
  const labelOf = useMetricLabel();
  const empty = { metricId: 'sessions', periodStart: '', periodEnd: '', value: '', owner: '', note: '', objective: '', warning: '90', site: '', country: '', channel: '', campaign: '' };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(target ? { metricId: target.metricId, periodStart: target.periodStart, periodEnd: target.periodEnd, value: String(getMetric(target.metricId)?.unit === 'percent' ? target.value * 100 : target.value), owner: target.owner ?? '', note: target.note ?? '', objective: target.objective ?? '', warning: target.warningRatio === null ? '' : String(Math.round(target.warningRatio * 100)), site: target.filters.site?.[0] ?? '', country: target.filters.country?.[0] ?? '', channel: target.filters.channel?.[0] ?? '', campaign: target.filters.campaign?.[0] ?? '' } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);
  const create = useAction<Record<string, unknown>>('POST', '/api/admin/targets', ['/api/admin/targets', '/api/insights/targets']);
  const update = useAction<Record<string, unknown>>('PATCH', `/api/admin/targets/${target?.id}`, ['/api/admin/targets', '/api/insights/targets']);
  const pct = getMetric(f.metricId)?.unit === 'percent';
  const filters = Object.fromEntries((['site', 'country', 'channel', 'campaign'] as const).filter((k) => f[k]).map((k) => [k, [f[k]]]));
  const body = { metricId: f.metricId, periodStart: f.periodStart, periodEnd: f.periodEnd, value: pct ? Number(f.value) / 100 : Number(f.value), owner: f.owner || undefined, note: f.note || undefined, objective: f.objective || undefined, warningRatio: f.warning === '' ? null : Number(f.warning) / 100, filters };
  const submit = async () => ((target ? await update.run(body) : await create.run(body)) !== undefined ? onClose() : undefined);
  const sel = (k: 'site' | 'country' | 'channel' | 'campaign', options: Array<{ v: string; l: string }>) => (
    <Field label={t(`filters.dim_${k}`)} htmlFor={`t-${k}`}>
      <Select id={`t-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
        <option value="">{t('common.all')}</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </Select>
    </Field>
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={target ? t('admin.editTarget') : t('admin.addTarget')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.pending || update.pending} disabled={!f.periodStart || !f.periodEnd || f.value === '' || f.periodEnd < f.periodStart} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('admin.metric')} htmlFor="t-metric">
          <Select id="t-metric" value={f.metricId} onChange={(e) => setF({ ...f, metricId: e.target.value })}>
            {METRICS.filter((m) => !m.internal).map((m) => (
              <option key={m.id} value={m.id}>
                {labelOf(m.id)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={pct ? t('admin.targetValuePct') : t('admin.targetValue')} htmlFor="t-value" required>
          <Input id="t-value" type="number" step="any" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        </Field>
        <Field label={t('admin.periodStart')} htmlFor="t-start" required>
          <Input id="t-start" type="date" value={f.periodStart} onChange={(e) => setF({ ...f, periodStart: e.target.value })} />
        </Field>
        <Field label={t('admin.periodEnd')} htmlFor="t-end" required>
          <Input id="t-end" type="date" value={f.periodEnd} onChange={(e) => setF({ ...f, periodEnd: e.target.value })} />
        </Field>
        {sel('site', (meta.data?.sites ?? []).map((s) => ({ v: s.key, l: s.name })))}
        {sel('country', (meta.data?.catalog.countries ?? []).map((c) => ({ v: c.id, l: L(c.name) })))}
        {sel('channel', (meta.data?.catalog.channels ?? []).map((c) => ({ v: c.id, l: L(c.name) })))}
        {sel('campaign', (meta.data?.campaigns ?? []).map((c) => ({ v: c.key, l: L(c.name) })))}
        <Field label={t('admin.objectiveText')} htmlFor="t-obj">
          <Input id="t-obj" value={f.objective} maxLength={200} onChange={(e) => setF({ ...f, objective: e.target.value })} />
        </Field>
        <Field label={t('admin.warningThreshold')} htmlFor="t-warn" hint={t('admin.warningThresholdHint')}>
          <Input id="t-warn" type="number" min={10} max={100} value={f.warning} onChange={(e) => setF({ ...f, warning: e.target.value })} />
        </Field>
        <Field label={t('admin.owner')} htmlFor="t-owner">
          <Input id="t-owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />
        </Field>
        <Field label={t('admin.notes')} htmlFor="t-note">
          <Input id="t-note" value={f.note} maxLength={500} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function TargetsSection() {
  const { t, lang, L } = useI18n();
  const { can } = useSession();
  const meta = useMeta();
  const labelOf = useMetricLabel();
  const q = useApi<Target[]>('/api/admin/targets');
  const del = useAction<{ id: string }>('DELETE', (b) => `/api/admin/targets/${b.id}`, ['/api/admin/targets', '/api/insights/targets']);
  const [modal, setModal] = useState<{ open: boolean; target: Target | null }>({ open: false, target: null });
  const edit = can('targets.manage');
  if (q.isLoading) return <Skeleton className="h-72" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const filterText = (f: Record<string, string[]>) =>
    Object.entries(f)
      .map(([k, v]) => `${t(`filters.dim_${k}`)}: ${v.map((x) => (k === 'site' ? (meta.data?.sites.find((s) => s.key === x)?.name ?? x) : k === 'country' ? L(meta.data?.catalog.countries.find((c) => c.id === x)?.name) || x : x)).join(', ')}`)
      .join(' · ') || t('admin.allScope');
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="targets.manage" />
      <Card>
        <CardHeader
          title={t('admin.targets')}
          subtitle={t('admin.targetsHint')}
          actions={
            edit && (
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setModal({ open: true, target: null })}>
                {t('admin.addTarget')}
              </Button>
            )
          }
        />
        <CardBody>
          <DataTable
            rows={q.data ?? []}
            caption={t('admin.targets')}
            rowKey={(x) => x.id}
            exportTitle="targets"
            columns={[
              { key: 'metric', header: t('admin.metric'), value: (x) => labelOf(x.metricId), unit: 'text', render: (x) => <span className="font-medium">{labelOf(x.metricId)}</span> },
              { key: 'period', header: t('common.period'), value: (x) => x.periodStart, unit: 'text', render: (x) => `${formatDate(x.periodStart, lang)} – ${formatDate(x.periodEnd, lang)}` },
              { key: 'value', header: t('common.target'), value: (x) => x.value, render: (x) => formatValue(x.value, getMetric(x.metricId)?.unit ?? 'count', lang) },
              { key: 'scope', header: t('admin.scope'), value: (x) => filterText(x.filters), unit: 'text', hideOnMobile: true },
              { key: 'warn', header: t('admin.warningThreshold'), value: (x) => x.warningRatio, render: (x) => (x.warningRatio === null ? '—' : formatValue(x.warningRatio, 'percent', lang)), hideOnMobile: true },
              { key: 'owner', header: t('admin.owner'), value: (x) => x.owner ?? '—', unit: 'text', hideOnMobile: true },
              {
                key: 'act',
                header: '',
                value: () => null,
                sortable: false,
                render: (x) =>
                  edit && (
                    <span className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, target: x })}>
                        {t('common.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label={`${t('common.delete')}: ${labelOf(x.metricId)}`} onClick={() => window.confirm(t('common.areYouSure')) && del.run({ id: x.id })} />
                    </span>
                  ),
              },
            ]}
          />
          <p className="mt-3 text-[12px] text-t3">{t('admin.targetsNote')}</p>
        </CardBody>
      </Card>
      {edit && <TargetModal open={modal.open} target={modal.target} onClose={() => setModal({ open: false, target: null })} />}
    </div>
  );
}
