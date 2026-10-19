import { ExternalLink, KeyRound, Pause, Play, Plus, RefreshCw, ShieldCheck, ShieldOff, Trash2, Unplug, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { L10n } from '@shared/catalog';
import { useApi, useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatDateTime, formatValue, relativeTime } from '@/lib/format';
import { useSession } from '@/state/session';
import { DataTable } from '@/components/tables/DataTable';
import { useMetricLabel } from '@/components/data';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Drawer, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton, Switch, Textarea } from '@/components/ui';
import { ConnectionStatus, ReadOnlyNote, TypedConfirm, splitList, useAction } from '../shared';

/* ---------------- integration manager ---------------- */

interface Integration {
  id: string;
  provider: string;
  name: string;
  status: string;
  mode: 'api' | 'csv' | 'demo' | 'webhook';
  config: Record<string, unknown>;
  scopeRefs: string[];
  hasSecret: boolean;
  secretUpdatedAt: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  dataFrom: string | null;
  dataTo: string | null;
  nextSyncAt: string | null;
  recordsProcessed: number | null;
  webhookPath: string | null;
  geo: { blocker: 'not_api_mode' | 'paused' | 'no_api_key' | 'no_model' | 'not_approved' | null; approval: { approvedAt: string; approvedByName: string } | null } | null;
  definition: {
    label: string;
    modes: Array<'api' | 'csv' | 'demo' | 'webhook'>;
    configFields: Array<{ key: string; label: L10n; required: boolean; placeholder?: string }>;
    secretFields: Array<{ key: string; label: L10n; multiline?: boolean }>;
    readiness: { implementation: 'implemented' | 'partial' | 'manual_only'; verifiedLive: boolean; docs: string[]; credentials: string; prerequisites: L10n; limitations: L10n };
    canSync: boolean;
    canTest: boolean;
  } | null;
  executions: Array<{ id: string; kind: string; status: string; startedAt: string; finishedAt: string | null; rowsWritten: number; error: string | null }>;
}

const PROVIDER_GROUP: Record<string, string> = {
  ga4: 'web',
  gsc: 'web',
  drupal: 'web',
  linkedin: 'social',
  x: 'social',
  youtube: 'social',
  chatgpt_ads: 'ads',
  geo_openai: 'geo',
  geo_perplexity: 'geo',
  geo_manual: 'geo',
  ai_provider: 'platform',
  smtp: 'platform',
  oidc: 'platform',
};

function ConfigureDrawer({ conn, onClose }: { conn: Integration | null; onClose: () => void }) {
  const { t, L } = useI18n();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Integration['mode']>('demo');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!conn) return;
    setName(conn.name);
    setMode(conn.mode);
    setConfig(Object.fromEntries((conn.definition?.configFields ?? []).map((f) => [f.key, conn.config[f.key] === undefined ? '' : typeof conn.config[f.key] === 'object' ? JSON.stringify(conn.config[f.key]) : String(conn.config[f.key])])));
    setSecret({});
  }, [conn]);
  const patch = useAction<Record<string, unknown>>('PATCH', `/api/admin/integrations/${conn?.id}`, ['/api/admin/integrations', 'meta']);
  const putSecret = useAction<{ values: Record<string, string> }>('PUT', `/api/admin/integrations/${conn?.id}/secret`, ['/api/admin/integrations']);
  const delSecret = useAction<void>('DELETE', `/api/admin/integrations/${conn?.id}/secret`, ['/api/admin/integrations', 'meta']);
  if (!conn) return null;
  const def = conn.definition;
  const save = async () => {
    const cfg = Object.fromEntries(Object.entries(config).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, /^[[{]/.test(v.trim()) ? safeJson(v) : v.trim()]));
    const ok = await patch.run({ name, mode: mode !== conn.mode ? mode : undefined, config: cfg }, null);
    const values = Object.fromEntries(Object.entries(secret).filter(([, v]) => v.trim()));
    if (ok && Object.keys(values).length) await putSecret.run({ values }, null);
    if (ok) onClose();
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={`${t('admin.configure')} — ${conn.name}`}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={patch.pending || putSecret.pending} onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('common.name')} htmlFor="ic-name">
          <Input id="ic-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('admin.mode')} htmlFor="ic-mode" hint={t('admin.modeHint')}>
          <Select id="ic-mode" value={mode} onChange={(e) => setMode(e.target.value as Integration['mode'])}>
            {(def?.modes ?? [conn.mode]).map((m) => (
              <option key={m} value={m}>
                {t(`admin.mode_${m}`)}
              </option>
            ))}
          </Select>
        </Field>
        {def?.configFields.map((f) => (
          <Field key={f.key} label={L(f.label)} htmlFor={`ic-${f.key}`} required={f.required}>
            <Input id={`ic-${f.key}`} value={config[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} />
          </Field>
        ))}
        {!!def?.secretFields.length && (
          <fieldset className="rounded-lg border border-brd p-3">
            <legend className="px-1 text-[13px] font-medium">{t('admin.credentials')}</legend>
            <p className="mb-2 text-[12.5px] text-t2">{conn.hasSecret ? t('admin.secretStored', { date: conn.secretUpdatedAt ? formatDateTime(conn.secretUpdatedAt, 'en') : '—' }) : t('admin.secretNone')}</p>
            {def.secretFields.map((f) => (
              <Field key={f.key} label={L(f.label)} htmlFor={`is-${f.key}`} hint={t('admin.writeOnly')}>
                {f.multiline ? (
                  <Textarea id={`is-${f.key}`} value={secret[f.key] ?? ''} autoComplete="off" spellCheck={false} placeholder={conn.hasSecret ? '••••••••' : ''} onChange={(e) => setSecret({ ...secret, [f.key]: e.target.value })} />
                ) : (
                  <Input id={`is-${f.key}`} type="password" autoComplete="new-password" value={secret[f.key] ?? ''} placeholder={conn.hasSecret ? '••••••••' : ''} onChange={(e) => setSecret({ ...secret, [f.key]: e.target.value })} />
                )}
              </Field>
            ))}
            {conn.hasSecret && (
              <Button size="sm" variant="ghost" className="mt-2" icon={<Trash2 className="size-3.5" />} onClick={async () => (await delSecret.run(undefined)) !== undefined && onClose()}>
                {t('admin.removeCredentials')}
              </Button>
            )}
          </fieldset>
        )}
        {conn.webhookPath && (
          <div className="rounded-lg bg-card2 p-3 text-[12.5px]">
            <p className="font-medium">{t('admin.webhookEndpoint')}</p>
            <code className="mt-1 block break-all">POST {conn.webhookPath}</code>
            <p className="mt-1 text-t2">{t('admin.webhookHint')}</p>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function safeJson(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function IntegrationCard({ c, onConfigure }: { c: Integration; onConfigure: () => void }) {
  const { t, lang, L } = useI18n();
  const { can } = useSession();
  const [details, setDetails] = useState(false);
  const inv = ['/api/admin/integrations', 'meta'];
  const test = useAction<void, { ok: boolean; message: string }>('POST', `/api/admin/integrations/${c.id}/test`, inv);
  const sync = useAction<Record<string, never>>('POST', `/api/admin/integrations/${c.id}/sync`, inv);
  const pause = useAction<void>('POST', `/api/admin/integrations/${c.id}/pause`, inv);
  const resume = useAction<void>('POST', `/api/admin/integrations/${c.id}/resume`, inv);
  const disconnect = useAction<void>('POST', `/api/admin/integrations/${c.id}/disconnect`, inv);
  const approval = useAction<{ approved: boolean; confirmation?: string }>('POST', `/api/admin/integrations/${c.id}/approval`, inv);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const manage = can('integrations.manage');
  const def = c.definition;
  const r = def?.readiness;
  const idFields = (def?.configFields ?? []).filter((f) => c.config[f.key] !== undefined && typeof c.config[f.key] !== 'object');
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex min-w-0 justify-between gap-3 py-1">
      <dt className="shrink-0 text-t3">{label}</dt>
      <dd className="min-w-0 truncate text-right">{value}</dd>
    </div>
  );
  return (
    <li className="rounded-lg border border-brd bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">{c.name}</p>
          <p className="text-[12px] text-t3">
            {def?.label ?? c.provider} · {t(`admin.mode_${c.mode}`)}
          </p>
        </div>
        <ConnectionStatus status={c.status} />
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-8 text-[12.5px] md:grid-cols-2">
        {row(t('admin.identifier'), idFields.length ? idFields.map((f) => String(c.config[f.key])).join(' · ') : '—')}
        {row(t('admin.resources'), c.scopeRefs.length ? c.scopeRefs.join(', ') : '—')}
        {row(t('admin.authStatus'), def?.secretFields.length ? (c.hasSecret ? t('admin.credentialsStored') : t('admin.credentialsMissing')) : t('admin.noCredentialsNeeded'))}
        {row(t('admin.lastSuccess'), c.lastSuccessAt ? relativeTime(c.lastSuccessAt, lang) : t('admin.never'))}
        {row(t('admin.lastAttempt'), c.lastSyncAt ? relativeTime(c.lastSyncAt, lang) : t('admin.never'))}
        {row(t('admin.nextSync'), c.nextSyncAt ? formatDateTime(c.nextSyncAt, lang) : t('admin.notScheduled'))}
        {row(t('admin.records'), c.recordsProcessed === null ? '—' : formatValue(c.recordsProcessed, 'count', lang))}
        {row(t('admin.dataRange'), c.dataFrom && c.dataTo ? `${c.dataFrom} → ${c.dataTo}` : '—')}
        {c.geo && row(t('admin.geoApproval'), c.geo.approval ? t('admin.geoApprovedBy', { name: c.geo.approval.approvedByName, date: formatDateTime(c.geo.approval.approvedAt, lang) }) : t('admin.geoNotApproved'))}
      </dl>
      {c.geo?.blocker && c.status !== 'demo' && <p className="mt-2 text-[12.5px] text-t2">{t(`admin.geoBlocker_${c.geo.blocker}`)}</p>}
      {c.lastError && <p className="mt-2 rounded-md bg-negsoft px-2 py-1.5 text-[12.5px] text-neg">{c.lastError}</p>}
      {result && <p className={`mt-2 rounded-md px-2 py-1.5 text-[12.5px] ${result.ok ? 'bg-possoft text-pos' : 'bg-negsoft text-neg'}`}>{result.message}</p>}
      {c.status === 'demo' && <p className="mt-2 text-[12px] text-t3">{t('admin.demoConnNote')}</p>}
      {c.provider === 'smtp' && <p className="mt-2 text-[12px] text-t3">{t('admin.smtpEnvNote')}</p>}
      <div className="mt-3 flex flex-wrap gap-1">
        {manage && (
          <>
            {def && (def.configFields.length > 0 || def.secretFields.length > 0 || def.modes.length > 1) && (
              <Button size="sm" icon={<KeyRound className="size-3.5" />} onClick={onConfigure}>
                {!def.secretFields.length ? t('admin.configure') : c.hasSecret ? t('admin.reauthorize') : t('admin.connect')}
              </Button>
            )}
            {def?.canTest && (
              <Button size="sm" variant="ghost" icon={<Wand2 className="size-3.5" />} loading={test.pending} onClick={async () => setResult((await test.run(undefined, null)) ?? null)}>
                {t('admin.test')}
              </Button>
            )}
            {def?.canSync && (
              <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} disabled={c.mode !== 'api' || !c.hasSecret || c.status === 'paused'} title={c.mode !== 'api' || !c.hasSecret ? t('admin.syncNeedsApi') : undefined} loading={sync.pending} onClick={() => sync.run({}, t('admin.syncQueued'))}>
                {t('admin.syncNow')}
              </Button>
            )}
            {c.geo &&
              can('ai.manage') &&
              (c.geo.approval ? (
                <Button size="sm" variant="ghost" icon={<ShieldOff className="size-3.5" />} loading={approval.pending} onClick={() => window.confirm(t('common.areYouSure')) && approval.run({ approved: false })}>
                  {t('admin.revokeApproval')}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" icon={<ShieldCheck className="size-3.5" />} onClick={() => setApproving(true)}>
                  {t('admin.recordApproval')}
                </Button>
              ))}
            {c.status === 'paused' ? (
              <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} onClick={() => resume.run(undefined)}>
                {t('admin.resume')}
              </Button>
            ) : (
              c.status !== 'not_configured' &&
              c.status !== 'demo' && (
                <Button size="sm" variant="ghost" icon={<Pause className="size-3.5" />} onClick={() => pause.run(undefined)}>
                  {t('admin.pause')}
                </Button>
              )
            )}
            {['connected', 'degraded', 'paused'].includes(c.status) && (
              <Button size="sm" variant="ghost" icon={<Unplug className="size-3.5" />} onClick={() => window.confirm(t('common.areYouSure')) && disconnect.run(undefined)}>
                {t('admin.disconnect')}
              </Button>
            )}
          </>
        )}
        <Button size="sm" variant="ghost" aria-expanded={details} onClick={() => setDetails(!details)}>
          {details ? t('common.less') : t('admin.readinessDetails')}
        </Button>
      </div>
      {details && r && (
        <div className="mt-3 flex flex-col gap-2 border-t border-brd pt-3 text-[12.5px]">
          <p className="flex flex-wrap gap-1.5">
            <Badge tone={r.implementation === 'implemented' ? 'pos' : r.implementation === 'partial' ? 'warn' : 'neutral'}>{t(`admin.impl_${r.implementation}`)}</Badge>
            <Badge tone={r.verifiedLive ? 'pos' : 'warn'}>{r.verifiedLive ? t('admin.verifiedLive') : t('admin.notVerifiedLive')}</Badge>
          </p>
          <p>
            <span className="font-medium">{t('admin.credentialsNeeded')}: </span>
            {r.credentials}
          </p>
          <p>
            <span className="font-medium">{t('admin.prerequisites')}: </span>
            {L(r.prerequisites)}
          </p>
          <p>
            <span className="font-medium">{t('admin.limitations')}: </span>
            {L(r.limitations)}
          </p>
          <ul className="flex flex-col gap-0.5">
            {r.docs.map((d) => (
              <li key={d}>
                {d.startsWith('http') ? (
                  <a href={d} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-acctext hover:underline">
                    {d} <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : (
                  <code>{d}</code>
                )}
              </li>
            ))}
          </ul>
          {c.executions.length > 0 && (
            <div>
              <p className="mb-1 font-medium">{t('admin.syncHistory')}</p>
              <ul className="flex flex-col gap-0.5">
                {c.executions.map((e) => (
                  <li key={e.id} className="flex flex-wrap gap-2">
                    <span className="tnum text-t3">{formatDateTime(e.startedAt, lang)}</span>
                    <Badge tone={e.status === 'succeeded' ? 'pos' : e.status === 'failed' ? 'neg' : 'neutral'}>{e.status}</Badge>
                    <span>{e.kind}</span>
                    <span className="tnum">{t('admin.rowsCount', { n: formatValue(e.rowsWritten, 'count', lang) })}</span>
                    {e.error && <span className="text-neg">{e.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {c.geo && (
        <TypedConfirm
          open={approving}
          onClose={() => setApproving(false)}
          title={t('admin.recordApproval')}
          word="APPROVE"
          pending={approval.pending}
          body={<p>{t('admin.geoApprovalBody', { provider: c.name })}</p>}
          onConfirm={async (typed) => (await approval.run({ approved: true, confirmation: typed })) !== undefined && setApproving(false)}
        />
      )}
    </li>
  );
}

export function IntegrationsSection() {
  const { t } = useI18n();
  const q = useApi<Integration[]>('/api/admin/integrations');
  const [editing, setEditing] = useState<Integration | null>(null);
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const groups = ['web', 'social', 'ads', 'geo', 'platform', 'other'];
  const rows = q.data ?? [];
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="integrations.manage" />
      <p role="note" className="rounded-lg border border-brd bg-card px-3 py-2 text-[13px] text-t2">
        {t('admin.integrationsNote')}
      </p>
      <div className="flex flex-wrap gap-1.5 text-[12px] text-t2" aria-label={t('admin.statusLegend')}>
        {['connected', 'degraded', 'disconnected', 'paused', 'not_configured', 'demo'].map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <ConnectionStatus status={s} />
          </span>
        ))}
      </div>
      {groups.map((g) => {
        const items = rows.filter((c) => (PROVIDER_GROUP[c.provider] ?? 'other') === g);
        if (!items.length) return null;
        return (
          <Card key={g}>
            <CardHeader title={t(`admin.group_${g}`)} />
            <CardBody>
              <ul className="flex flex-col gap-2">
                {items.map((c) => (
                  <IntegrationCard key={c.id} c={c} onConfigure={() => setEditing(c)} />
                ))}
              </ul>
            </CardBody>
          </Card>
        );
      })}
      <Card>
        <CardHeader title={t('admin.fileImports')} subtitle={t('admin.fileImportsHint')} actions={<Link to="/admin?section=data" className="text-[13px] font-medium text-acctext hover:underline">{t('admin.openDataManagement')} →</Link>} />
      </Card>
      <ConfigureDrawer conn={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/* ---------------- websites ---------------- */

interface Website {
  id: string;
  key: string;
  name: string;
  domain: string;
  basePath: string;
  language: 'en' | 'fr';
  businessUnit: string | null;
  ga4Property: string | null;
  gscProperty: string | null;
  drupalEnabled: boolean;
  status: 'active' | 'archived';
  settings: { countries?: string[]; regions?: string[]; contentCategories?: string[]; conversionEvents?: string[] };
}

interface KpiRegistry {
  events: Array<{ id: string; name: L10n; keyEvent: boolean }>;
  conversionEvents: string[];
}

function WebsiteModal({ site, open, onClose }: { site: Website | null; open: boolean; onClose: () => void }) {
  const { t, L } = useI18n();
  const meta = useMeta();
  const kpis = useApi<KpiRegistry>('/api/admin/kpis');
  const empty = { key: '', name: '', domain: '', basePath: '/', language: 'fr' as 'en' | 'fr', businessUnit: '', ga4Property: '', gscProperty: '', drupalEnabled: true, status: 'active' as 'active' | 'archived', countries: '', regions: '', contentCategories: '', conversionEvents: [] as string[] };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(
      site
        ? { key: site.key, name: site.name, domain: site.domain, basePath: site.basePath, language: site.language, businessUnit: site.businessUnit ?? '', ga4Property: site.ga4Property ?? '', gscProperty: site.gscProperty ?? '', drupalEnabled: site.drupalEnabled, status: site.status, countries: (site.settings.countries ?? []).join(', '), regions: (site.settings.regions ?? []).join(', '), contentCategories: (site.settings.contentCategories ?? []).join(', '), conversionEvents: site.settings.conversionEvents ?? [] }
        : empty,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, site]);
  const create = useAction<Record<string, unknown>>('POST', '/api/admin/websites', ['/api/admin/websites', 'meta']);
  const update = useAction<Record<string, unknown>>('PATCH', `/api/admin/websites/${site?.id}`, ['/api/admin/websites', 'meta']);
  const body = {
    name: f.name.trim(),
    domain: f.domain.trim().toLowerCase(),
    basePath: f.basePath.trim() || '/',
    language: f.language,
    businessUnit: f.businessUnit || undefined,
    ga4Property: f.ga4Property.trim() || undefined,
    gscProperty: f.gscProperty.trim() || undefined,
    drupalEnabled: f.drupalEnabled,
    status: f.status,
    settings: { countries: splitList(f.countries).map((x) => x.toUpperCase()), regions: splitList(f.regions), contentCategories: splitList(f.contentCategories), conversionEvents: f.conversionEvents },
  };
  const submit = async () => ((site ? await update.run(body) : await create.run({ key: f.key.trim(), ...body })) !== undefined ? onClose() : undefined);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={site ? t('admin.editWebsite') : t('admin.addWebsite')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.pending || update.pending} disabled={!f.name.trim() || !f.domain.trim() || (!site && !f.key.trim())} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('admin.key')} htmlFor="w-key" hint={t('admin.keyHint')} required>
          <Input id="w-key" value={f.key} disabled={!!site} onChange={(e) => setF({ ...f, key: e.target.value })} />
        </Field>
        <Field label={t('common.name')} htmlFor="w-name" required>
          <Input id="w-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t('admin.domain')} htmlFor="w-domain" hint="www.veolia.com" required>
          <Input id="w-domain" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} />
        </Field>
        <Field label={t('admin.basePath')} htmlFor="w-path" hint="/fr">
          <Input id="w-path" value={f.basePath} onChange={(e) => setF({ ...f, basePath: e.target.value })} />
        </Field>
        <Field label={t('common.language')} htmlFor="w-lang">
          <Select id="w-lang" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as 'en' | 'fr' })}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label={t('admin.businessUnit')} htmlFor="w-bu">
          <Select id="w-bu" value={f.businessUnit} onChange={(e) => setF({ ...f, businessUnit: e.target.value })}>
            <option value="">—</option>
            {meta.data?.catalog.businessUnits.map((b) => (
              <option key={b.id} value={b.id}>
                {L(b.name)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('admin.ga4Property')} htmlFor="w-ga4" hint="properties/123456789">
          <Input id="w-ga4" value={f.ga4Property} onChange={(e) => setF({ ...f, ga4Property: e.target.value })} />
        </Field>
        <Field label={t('admin.gscProperty')} htmlFor="w-gsc" hint="sc-domain:veolia.com">
          <Input id="w-gsc" value={f.gscProperty} onChange={(e) => setF({ ...f, gscProperty: e.target.value })} />
        </Field>
        <Field label={t('admin.countries')} htmlFor="w-countries" hint={t('admin.countriesHint')}>
          <Input id="w-countries" value={f.countries} onChange={(e) => setF({ ...f, countries: e.target.value })} />
        </Field>
        <Field label={t('admin.regions')} htmlFor="w-regions" hint={t('admin.listHint')}>
          <Input id="w-regions" value={f.regions} onChange={(e) => setF({ ...f, regions: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('admin.contentCategories')} htmlFor="w-cats" hint={t('admin.listHint')}>
            <Input id="w-cats" value={f.contentCategories} onChange={(e) => setF({ ...f, contentCategories: e.target.value })} />
          </Field>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-[13px] font-medium">{t('admin.siteConversions')}</legend>
          <p className="mb-1 text-[12px] text-t3">{t('admin.siteConversionsHint')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {kpis.data?.events.map((e) => (
              <Checkbox key={e.id} checked={f.conversionEvents.includes(e.id)} onChange={(c) => setF({ ...f, conversionEvents: c ? [...f.conversionEvents, e.id] : f.conversionEvents.filter((x) => x !== e.id) })} label={`${L(e.name)} (${e.id})`} />
            ))}
          </div>
        </fieldset>
        <Switch checked={f.drupalEnabled} onChange={(v) => setF({ ...f, drupalEnabled: v })} label={t('admin.drupalEnabled')} />
        <Switch checked={f.status === 'active'} onChange={(v) => setF({ ...f, status: v ? 'active' : 'archived' })} label={t('admin.siteActive')} />
      </div>
    </Modal>
  );
}

export function WebsitesSection() {
  const { t } = useI18n();
  const { can } = useSession();
  const q = useApi<Website[]>('/api/admin/websites');
  const [modal, setModal] = useState<{ open: boolean; site: Website | null }>({ open: false, site: null });
  const edit = can('integrations.manage');
  if (q.isLoading) return <Skeleton className="h-72" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="integrations.manage" />
      <Card>
        <CardHeader
          title={t('admin.websites')}
          subtitle={t('admin.websitesHint')}
          actions={
            edit && (
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setModal({ open: true, site: null })}>
                {t('admin.addWebsite')}
              </Button>
            )
          }
        />
        <CardBody>
          <DataTable
            rows={q.data ?? []}
            caption={t('admin.websites')}
            rowKey={(w) => w.id}
            onRowClick={edit ? (w) => setModal({ open: true, site: w }) : undefined}
            columns={[
              { key: 'name', header: t('common.name'), value: (w) => w.name, unit: 'text', render: (w) => <span className="font-medium">{w.name}</span> },
              { key: 'domain', header: t('admin.domain'), value: (w) => `${w.domain}${w.basePath}`, unit: 'text' },
              { key: 'lang', header: t('common.language'), value: (w) => w.language.toUpperCase(), unit: 'text' },
              { key: 'ga4', header: 'GA4', value: (w) => w.ga4Property ?? '—', unit: 'text', hideOnMobile: true },
              { key: 'gsc', header: 'Search Console', value: (w) => w.gscProperty ?? '—', unit: 'text', hideOnMobile: true },
              { key: 'conv', header: t('admin.siteConversions'), value: (w) => (w.settings.conversionEvents?.length ? w.settings.conversionEvents.join(', ') : t('admin.orgDefault')), unit: 'text', hideOnMobile: true },
              { key: 'status', header: t('common.status'), value: (w) => w.status, unit: 'text', render: (w) => <Badge tone={w.status === 'active' ? 'pos' : 'neutral'}>{t(`admin.siteStatus_${w.status}`)}</Badge> },
            ]}
          />
          <p className="mt-3 text-[12px] text-t3">{t('admin.websitesNote')}</p>
        </CardBody>
      </Card>
      {edit && <WebsiteModal open={modal.open} site={modal.site} onClose={() => setModal({ open: false, site: null })} />}
    </div>
  );
}

/* ---------------- social accounts ---------------- */

interface SocialAccount {
  id: string;
  key: string;
  platform: string;
  name: string;
  handle: string | null;
  externalId: string | null;
  language: 'en' | 'fr';
  region: string | null;
  businessUnit: string | null;
  status: 'active' | 'archived';
  connectionId: string | null;
  metrics: string[];
}

const PLATFORM_METRICS: Record<string, string[]> = {
  linkedin: ['social_impressions', 'social_engagements', 'social_engagement_rate', 'social_link_clicks', 'followers', 'followers_net', 'social_posts'],
  x: ['social_impressions', 'social_engagements', 'social_engagement_rate', 'social_link_clicks', 'followers', 'followers_net', 'social_posts'],
  youtube: ['yt_views', 'yt_watch_minutes', 'yt_impressions', 'social_engagements', 'followers', 'followers_net', 'social_posts'],
};

function AccountModal({ acc, open, onClose }: { acc: SocialAccount | null; open: boolean; onClose: () => void }) {
  const { t, L } = useI18n();
  const meta = useMeta();
  const labelOf = useMetricLabel();
  const empty = { key: '', platform: 'linkedin', name: '', handle: '', externalId: '', language: 'fr' as 'en' | 'fr', region: '', businessUnit: '', status: 'active' as 'active' | 'archived', metrics: [] as string[] };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(acc ? { key: acc.key, platform: acc.platform, name: acc.name, handle: acc.handle ?? '', externalId: acc.externalId ?? '', language: acc.language, region: acc.region ?? '', businessUnit: acc.businessUnit ?? '', status: acc.status, metrics: acc.metrics } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, acc]);
  const create = useAction<Record<string, unknown>>('POST', '/api/admin/social-accounts', ['/api/admin/social-accounts', '/api/admin/integrations', 'meta']);
  const update = useAction<Record<string, unknown>>('PATCH', `/api/admin/social-accounts/${acc?.id}`, ['/api/admin/social-accounts', 'meta']);
  const body = { name: f.name.trim(), handle: f.handle.trim() || undefined, externalId: f.externalId.trim() || undefined, language: f.language, region: f.region || undefined, businessUnit: f.businessUnit || undefined, status: f.status, metrics: f.metrics };
  const submit = async () => ((acc ? await update.run(body) : await create.run({ key: f.key.trim(), platform: f.platform, ...body })) !== undefined ? onClose() : undefined);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={acc ? t('admin.editAccount') : t('admin.addAccount')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.pending || update.pending} disabled={!f.name.trim() || (!acc && !f.key.trim())} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('admin.key')} htmlFor="s-key" hint={t('admin.keyHint')} required>
          <Input id="s-key" value={f.key} disabled={!!acc} onChange={(e) => setF({ ...f, key: e.target.value })} />
        </Field>
        <Field label={t('admin.platform')} htmlFor="s-platform">
          <Select id="s-platform" value={f.platform} disabled={!!acc} onChange={(e) => setF({ ...f, platform: e.target.value, metrics: [] })}>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
            <option value="youtube">YouTube</option>
          </Select>
        </Field>
        <Field label={t('admin.displayName')} htmlFor="s-name" required>
          <Input id="s-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t('admin.handle')} htmlFor="s-handle">
          <Input id="s-handle" value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} />
        </Field>
        <Field label={t('admin.externalId')} htmlFor="s-ext" hint={t('admin.externalIdHint')}>
          <Input id="s-ext" value={f.externalId} onChange={(e) => setF({ ...f, externalId: e.target.value })} />
        </Field>
        <Field label={t('common.language')} htmlFor="s-lang">
          <Select id="s-lang" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as 'en' | 'fr' })}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label={t('admin.region')} htmlFor="s-region">
          <Select id="s-region" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>
            <option value="">{t('admin.global')}</option>
            {meta.data?.catalog.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {L(r.name)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('admin.businessUnit')} htmlFor="s-bu">
          <Select id="s-bu" value={f.businessUnit} onChange={(e) => setF({ ...f, businessUnit: e.target.value })}>
            <option value="">—</option>
            {meta.data?.catalog.businessUnits.map((b) => (
              <option key={b.id} value={b.id}>
                {L(b.name)}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-[13px] font-medium">{t('admin.reportedMetrics')}</legend>
          <p className="mb-1 text-[12px] text-t3">{t('admin.allWhenEmpty')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {(PLATFORM_METRICS[f.platform] ?? []).map((m) => (
              <Checkbox key={m} checked={f.metrics.includes(m)} onChange={(c) => setF({ ...f, metrics: c ? [...f.metrics, m] : f.metrics.filter((x) => x !== m) })} label={labelOf(m)} />
            ))}
          </div>
        </fieldset>
        <Switch checked={f.status === 'active'} onChange={(v) => setF({ ...f, status: v ? 'active' : 'archived' })} label={t('admin.accountActive')} />
      </div>
    </Modal>
  );
}

export function SocialAccountsSection() {
  const { t, L } = useI18n();
  const { can } = useSession();
  const meta = useMeta();
  const q = useApi<SocialAccount[]>('/api/admin/social-accounts');
  const conns = useApi<Integration[]>('/api/admin/integrations');
  const [modal, setModal] = useState<{ open: boolean; acc: SocialAccount | null }>({ open: false, acc: null });
  const edit = can('integrations.manage');
  if (q.isLoading) return <Skeleton className="h-72" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const connOf = (a: SocialAccount) => conns.data?.find((c) => c.id === a.connectionId) ?? conns.data?.find((c) => c.provider === a.platform);
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="integrations.manage" />
      <Card>
        <CardHeader
          title={t('admin.socialAccounts')}
          subtitle={t('admin.socialAccountsHint')}
          actions={
            edit && (
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setModal({ open: true, acc: null })}>
                {t('admin.addAccount')}
              </Button>
            )
          }
        />
        <CardBody>
          <DataTable
            rows={q.data ?? []}
            caption={t('admin.socialAccounts')}
            rowKey={(a) => a.id}
            onRowClick={edit ? (a) => setModal({ open: true, acc: a }) : undefined}
            columns={[
              { key: 'name', header: t('admin.displayName'), value: (a) => a.name, unit: 'text', render: (a) => <span className="font-medium">{a.name}</span> },
              { key: 'platform', header: t('admin.platform'), value: (a) => a.platform, unit: 'text', render: (a) => meta.data?.catalog.platforms.find((p) => p.id === a.platform)?.name ?? a.platform },
              { key: 'handle', header: t('admin.handle'), value: (a) => a.handle ?? '—', unit: 'text', hideOnMobile: true },
              { key: 'region', header: t('admin.region'), value: (a) => (a.region ? L(meta.data?.catalog.regions.find((r) => r.id === a.region)?.name) || a.region : t('admin.global')), unit: 'text', hideOnMobile: true },
              { key: 'lang', header: t('common.language'), value: (a) => a.language.toUpperCase(), unit: 'text', hideOnMobile: true },
              { key: 'sync', header: t('admin.synchronisation'), value: (a) => connOf(a)?.status ?? '', unit: 'text', render: (a) => (connOf(a) ? <ConnectionStatus status={connOf(a)!.status} /> : '—') },
            ]}
          />
          <p className="mt-3 text-[12px] text-t3">
            {t('admin.socialSyncNote')}{' '}
            <Link to="/admin?section=integrations" className="font-medium text-acctext hover:underline">
              {t('admin.integrations')} →
            </Link>
          </p>
        </CardBody>
      </Card>
      {edit && <AccountModal open={modal.open} acc={modal.acc} onClose={() => setModal({ open: false, acc: null })} />}
    </div>
  );
}

/* ---------------- advertising ---------------- */

interface AdvertisingData {
  accounts: Array<{ id: string; key: string; name: string; externalId: string | null; currency: string; status: string }>;
  campaigns: Array<{ id: string; key: string; name: string; category: 'industries' | 'collectivities'; objective: string | null; status: string; monthlyBudget: number | null; externalId: string | null; utmCampaign: string | null; businessUnit: string | null; startDate: string | null }>;
  groups: Array<{ id: string; campaignId: string; name: string }>;
  ads: Array<{ id: string; groupId: string; name: string; landingUrl: string | null; externalId: string | null; siteKey: string | null; status: string }>;
}

function CampaignModal({ c, onClose }: { c: AdvertisingData['campaigns'][number] | null; onClose: () => void }) {
  const { t, L } = useI18n();
  const meta = useMeta();
  const [f, setF] = useState({ category: 'industries', objective: 'consideration', businessUnit: '', monthlyBudget: '', externalId: '', utmCampaign: '' });
  useEffect(() => {
    if (c) setF({ category: c.category, objective: c.objective ?? 'consideration', businessUnit: c.businessUnit ?? '', monthlyBudget: c.monthlyBudget === null ? '' : String(c.monthlyBudget), externalId: c.externalId ?? '', utmCampaign: c.utmCampaign ?? '' });
  }, [c]);
  const save = useAction<Record<string, unknown>>('PATCH', `/api/admin/advertising/campaigns/${c?.id}`, ['/api/admin/advertising', '/api/ads', 'meta']);
  if (!c) return null;
  const submit = async () =>
    (await save.run({ category: f.category, objective: f.objective, businessUnit: f.businessUnit || undefined, monthlyBudget: f.monthlyBudget === '' ? null : Number(f.monthlyBudget), externalId: f.externalId.trim() || null, utmCampaign: f.utmCampaign.trim() || undefined })) !== undefined && onClose();
  return (
    <Modal
      open
      onClose={onClose}
      title={c.name}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={save.pending} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <p className="mb-3 rounded-md bg-card2 p-2 text-[12.5px] text-t2">{t('admin.adsLocalOnly')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('admin.reportingCategory')} htmlFor="c-cat">
          <Select id="c-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="industries">{t('ads.category_industries')}</option>
            <option value="collectivities">{t('ads.category_collectivities')}</option>
          </Select>
        </Field>
        <Field label={t('admin.objective')} htmlFor="c-obj">
          <Select id="c-obj" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })}>
            {['awareness', 'consideration', 'conversion'].map((o) => (
              <option key={o} value={o}>
                {t(`admin.objective_${o}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('admin.businessUnit')} htmlFor="c-bu">
          <Select id="c-bu" value={f.businessUnit} onChange={(e) => setF({ ...f, businessUnit: e.target.value })}>
            <option value="">—</option>
            {meta.data?.catalog.businessUnits.map((b) => (
              <option key={b.id} value={b.id}>
                {L(b.name)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('ads.budget')} htmlFor="c-budget" hint={t('admin.budgetHint')}>
          <Input id="c-budget" type="number" min={0} value={f.monthlyBudget} onChange={(e) => setF({ ...f, monthlyBudget: e.target.value })} />
        </Field>
        <Field label={t('admin.externalId')} htmlFor="c-ext" hint={t('admin.externalIdAdsHint')}>
          <Input id="c-ext" value={f.externalId} onChange={(e) => setF({ ...f, externalId: e.target.value })} />
        </Field>
        <Field label="utm_campaign" htmlFor="c-utm" hint={t('admin.utmHint')}>
          <Input id="c-utm" value={f.utmCampaign} onChange={(e) => setF({ ...f, utmCampaign: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function AdvertisingSection() {
  const { t, lang, L } = useI18n();
  const { can } = useSession();
  const meta = useMeta();
  const q = useApi<AdvertisingData>('/api/admin/advertising');
  const [editing, setEditing] = useState<AdvertisingData['campaigns'][number] | null>(null);
  const edit = can('integrations.manage');
  if (q.isLoading) return <Skeleton className="h-72" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <p role="note" className="flex items-start gap-2 rounded-lg border border-brd bg-card px-3 py-2 text-[13px] text-t2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('admin.adsSeparation')}
      </p>
      <ReadOnlyNote permission="integrations.manage" />
      <Card>
        <CardHeader title={t('admin.adAccounts')} />
        <CardBody>
          <ul className="flex flex-col divide-y divide-brd text-[13px]">
            {d.accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span className="font-medium">{a.name}</span>
                <span className="text-t2">
                  {t('admin.externalId')}
                  {t('common.colon')} {a.externalId ?? '—'} · {a.currency}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.campaignMapping')} subtitle={t('admin.campaignMappingHint')} />
        <CardBody>
          <DataTable
            rows={d.campaigns}
            caption={t('admin.campaignMapping')}
            rowKey={(c) => c.id}
            onRowClick={edit ? setEditing : undefined}
            columns={[
              { key: 'name', header: t('ads.campaign'), value: (c) => c.name, unit: 'text', render: (c) => <span className="font-medium">{c.name}</span> },
              { key: 'cat', header: t('admin.reportingCategory'), value: (c) => t(`ads.category_${c.category}`), unit: 'text' },
              { key: 'obj', header: t('admin.objective'), value: (c) => (c.objective ? t(`admin.objective_${c.objective}`) : '—'), unit: 'text', hideOnMobile: true },
              { key: 'bu', header: t('admin.businessUnit'), value: (c) => L(meta.data?.catalog.businessUnits.find((b) => b.id === c.businessUnit)?.name) || c.businessUnit || '—', unit: 'text', hideOnMobile: true },
              { key: 'budget', header: t('ads.budget'), value: (c) => c.monthlyBudget, render: (c) => formatValue(c.monthlyBudget, 'currency', lang) },
              { key: 'utm', header: 'utm_campaign', value: (c) => c.utmCampaign ?? '—', unit: 'text', hideOnMobile: true },
              { key: 'status', header: t('common.status'), value: (c) => c.status, unit: 'text', render: (c) => <Badge tone={c.status === 'active' ? 'pos' : 'neutral'}>{t(`ads.status_${c.status}`)}</Badge> },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.utmConventions')} subtitle={t('admin.utmConventionsHint')} />
        <CardBody>
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {d.campaigns.map((c) => (
              <li key={c.id}>
                <code className="break-all">?utm_source=chatgpt&amp;utm_medium=cpc&amp;utm_campaign={c.utmCampaign ?? c.key}</code> <span className="text-t3">— {c.name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-t3">{t('admin.conversionMappingNote')}</p>
        </CardBody>
      </Card>
      <CampaignModal c={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/* ---------------- SEO & GEO configuration ---------------- */

interface CrawlScope {
  id: string;
  websiteKey: string;
  name: string;
  allowedHosts: string[];
  startUrls: string[];
  includePatterns: string[];
  excludePatterns: string[];
  maxPages: number;
  maxDepth: number;
  delayMs: number;
  authorized: boolean;
  authorizedAt: string | null;
  enabled: boolean;
}

function ScopeModal({ scope, open, onClose }: { scope: CrawlScope | null; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const meta = useMeta();
  const empty = { websiteKey: '', name: '', allowedHosts: '', startUrls: '', includePatterns: '', excludePatterns: '', maxPages: 200, maxDepth: 4, delayMs: 1500 };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(scope ? { websiteKey: scope.websiteKey, name: scope.name, allowedHosts: scope.allowedHosts.join('\n'), startUrls: scope.startUrls.join('\n'), includePatterns: scope.includePatterns.join('\n'), excludePatterns: scope.excludePatterns.join('\n'), maxPages: scope.maxPages, maxDepth: scope.maxDepth, delayMs: scope.delayMs } : { ...empty, websiteKey: meta.data?.sites[0]?.key ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope]);
  const create = useAction<Record<string, unknown>>('POST', '/api/admin/crawl-scopes', ['/api/seo/crawl-scopes']);
  const update = useAction<Record<string, unknown>>('PATCH', `/api/admin/crawl-scopes/${scope?.id}`, ['/api/seo/crawl-scopes']);
  const body = { websiteKey: f.websiteKey, name: f.name.trim(), allowedHosts: splitList(f.allowedHosts), startUrls: splitList(f.startUrls), includePatterns: splitList(f.includePatterns), excludePatterns: splitList(f.excludePatterns), maxPages: f.maxPages, maxDepth: f.maxDepth, delayMs: f.delayMs };
  const submit = async () => ((scope ? await update.run(body) : await create.run(body)) !== undefined ? onClose() : undefined);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={scope ? t('admin.editScope') : t('admin.addScope')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.pending || update.pending} disabled={!f.name.trim() || !splitList(f.allowedHosts).length || !splitList(f.startUrls).length} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {scope?.authorized && <p className="mb-3 rounded-md bg-warnsoft p-2 text-[12.5px] text-warn">{t('admin.scopeEditWithdraws')}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('admin.website')} htmlFor="sc-site">
          <Select id="sc-site" value={f.websiteKey} onChange={(e) => setF({ ...f, websiteKey: e.target.value })}>
            {meta.data?.sites.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.name')} htmlFor="sc-name" required>
          <Input id="sc-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t('admin.allowedHosts')} htmlFor="sc-hosts" hint={t('admin.allowedHostsHint')} required>
          <Textarea id="sc-hosts" value={f.allowedHosts} onChange={(e) => setF({ ...f, allowedHosts: e.target.value })} />
        </Field>
        <Field label={t('admin.startUrls')} htmlFor="sc-start" hint={t('admin.onePerLine')} required>
          <Textarea id="sc-start" value={f.startUrls} onChange={(e) => setF({ ...f, startUrls: e.target.value })} />
        </Field>
        <Field label={t('admin.includePatterns')} htmlFor="sc-inc" hint={t('admin.onePerLine')}>
          <Textarea id="sc-inc" value={f.includePatterns} onChange={(e) => setF({ ...f, includePatterns: e.target.value })} />
        </Field>
        <Field label={t('admin.excludePatterns')} htmlFor="sc-exc" hint={t('admin.onePerLine')}>
          <Textarea id="sc-exc" value={f.excludePatterns} onChange={(e) => setF({ ...f, excludePatterns: e.target.value })} />
        </Field>
        <Field label={t('admin.maxPages')} htmlFor="sc-pages" hint="1–2000">
          <Input id="sc-pages" type="number" min={1} max={2000} value={f.maxPages} onChange={(e) => setF({ ...f, maxPages: Number(e.target.value) })} />
        </Field>
        <Field label={t('admin.maxDepth')} htmlFor="sc-depth" hint="0–8">
          <Input id="sc-depth" type="number" min={0} max={8} value={f.maxDepth} onChange={(e) => setF({ ...f, maxDepth: Number(e.target.value) })} />
        </Field>
        <Field label={t('admin.delayMs')} htmlFor="sc-delay" hint={t('admin.delayHint')}>
          <Input id="sc-delay" type="number" min={500} max={30000} step={100} value={f.delayMs} onChange={(e) => setF({ ...f, delayMs: Number(e.target.value) })} />
        </Field>
      </div>
    </Modal>
  );
}

export function SeoGeoSection() {
  const { t, lang } = useI18n();
  const { can } = useSession();
  const scopes = useApi<CrawlScope[]>('/api/seo/crawl-scopes');
  const comps = useApi<Array<{ id: string; name: string; domain: string; topics: string[] }>>('/api/seo/competitors');
  const conns = useApi<Integration[]>('/api/admin/integrations');
  const [modal, setModal] = useState<{ open: boolean; scope: CrawlScope | null }>({ open: false, scope: null });
  const [authorising, setAuthorising] = useState<CrawlScope | null>(null);
  const authorize = useAction<{ id: string; authorized: boolean; confirmation?: string }>('POST', (b) => `/api/admin/crawl-scopes/${b.id}/authorize`, ['/api/seo/crawl-scopes']);
  const edit = can('integrations.manage');
  const geoConns = useMemo(() => (conns.data ?? []).filter((c) => PROVIDER_GROUP[c.provider] === 'geo'), [conns.data]);
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="integrations.manage" />
      <Card>
        <CardHeader
          title={t('admin.auditScopes')}
          subtitle={t('admin.auditScopesHint')}
          actions={
            edit && (
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setModal({ open: true, scope: null })}>
                {t('admin.addScope')}
              </Button>
            )
          }
        />
        <CardBody>
          {scopes.isLoading ? (
            <Skeleton className="h-40" />
          ) : !scopes.data?.length ? (
            <EmptyState title={t('admin.noScopes')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {scopes.data.map((s) => (
                <li key={s.id} className="rounded-lg border border-brd p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{s.name}</p>
                      <p className="text-[12.5px] text-t2">
                        {s.allowedHosts.join(', ')} · {t('admin.scopeLimits', { pages: s.maxPages, depth: s.maxDepth, delay: s.delayMs })}
                      </p>
                      <p className="text-[12px] text-t3">{s.startUrls.join(' · ')}</p>
                    </div>
                    {s.authorized ? (
                      <Badge tone="pos">
                        <ShieldCheck className="size-3" aria-hidden /> {t('admin.authorised')} {s.authorizedAt ? `· ${formatDateTime(s.authorizedAt, lang)}` : ''}
                      </Badge>
                    ) : (
                      <Badge tone="warn">
                        <ShieldOff className="size-3" aria-hidden /> {t('admin.notAuthorised')}
                      </Badge>
                    )}
                  </div>
                  {edit && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, scope: s })}>
                        {t('common.edit')}
                      </Button>
                      {s.authorized ? (
                        <Button size="sm" variant="ghost" icon={<ShieldOff className="size-3.5" />} onClick={() => authorize.run({ id: s.id, authorized: false })}>
                          {t('admin.revoke')}
                        </Button>
                      ) : (
                        <Button size="sm" icon={<ShieldCheck className="size-3.5" />} onClick={() => setAuthorising(s)}>
                          {t('admin.authorise')}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-t3">{t('admin.crawlerRules')}</p>
        </CardBody>
      </Card>
      <div className="grid grid-cols-1 gap-[var(--gap-grid)] xl:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.geoProviders')} subtitle={t('admin.geoProvidersHint')} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-brd text-[13px]">
              {geoConns.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>{c.name}</span>
                  <ConnectionStatus status={c.status} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-t3">{t('admin.geoCitationRule')}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('admin.competitors')} subtitle={t('admin.competitorsHint')} actions={<Link to="/seo?tab=competitors" className="text-[13px] font-medium text-acctext hover:underline">{t('admin.manage')} →</Link>} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-brd text-[13px]">
              {(comps.data ?? []).map((c) => (
                <li key={c.id} className="flex justify-between gap-2 py-1.5">
                  <span>{c.name}</span>
                  <span className="text-t3">{c.domain}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('admin.keywordsAndPrompts')} />
          <CardBody>
            <ul className="flex flex-col gap-1.5 text-[13px]">
              <li>
                <Link to="/seo?tab=keywords" className="font-medium text-acctext hover:underline">
                  {t('admin.keywordLists')} →
                </Link>
              </li>
              <li>
                <Link to="/geo?tab=prompts" className="font-medium text-acctext hover:underline">
                  {t('admin.promptLibrary')} →
                </Link>
              </li>
              <li>
                <Link to="/admin?section=system" className="font-medium text-acctext hover:underline">
                  {t('admin.schedulesLink')} →
                </Link>
              </li>
              <li>
                <Link to="/admin?section=organization" className="font-medium text-acctext hover:underline">
                  {t('admin.retentionLink')} →
                </Link>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
      {edit && <ScopeModal open={modal.open} scope={modal.scope} onClose={() => setModal({ open: false, scope: null })} />}
      <TypedConfirm
        open={!!authorising}
        onClose={() => setAuthorising(null)}
        title={t('admin.authoriseTitle')}
        word="AUTHORISE"
        pending={authorize.pending}
        body={
          <>
            <p>{t('admin.authoriseBody', { hosts: authorising?.allowedHosts.join(', ') ?? '' })}</p>
            <p className="mt-2">{t('admin.authoriseLimits', { pages: authorising?.maxPages ?? 0, delay: authorising?.delayMs ?? 0 })}</p>
          </>
        }
        onConfirm={async (typed) => {
          if (!authorising) return;
          if ((await authorize.run({ id: authorising.id, authorized: true, confirmation: typed })) !== undefined) setAuthorising(null);
        }}
      />
    </div>
  );
}
