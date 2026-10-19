import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROLE_LABELS, type Role } from '@shared/rbac';
import { useApi } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useSession } from '@/state/session';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, ErrorState, Field, Input, Select, Skeleton, Switch } from '@/components/ui';
import { ConnectionStatus, ReadOnlyNote, useAction } from '../shared';

interface Overview {
  usersByRole: Array<{ role: Role; status: string; n: number }>;
  connections: Array<{ provider: string; name: string; status: string; mode: string; lastSuccessAt: string | null; lastError: string | null }>;
  openAlerts: Array<{ severity: string; n: number }>;
  failedJobs24h: number;
  lastImports: Array<{ id: string; dataset: string; fileName: string; status: string; acceptedRows: number; rejectedRows: number; createdAt: string }>;
  recentAudit: Array<{ id: string; action: string; userEmail: string | null; outcome: string; createdAt: string }>;
  demoMode: boolean;
  emailConfigured: boolean;
  encryptionConfigured: boolean;
  ai: { available: boolean; reason: string };
}

function Stat({ label, value, to, hint }: { label: string; value: React.ReactNode; to?: string; hint?: string }) {
  const body = (
    <>
      <span className="block text-[12.5px] text-t2">{label}</span>
      <span className="text-[22px] font-semibold tnum">{value}</span>
      {hint && <span className="block text-[12px] text-t3">{hint}</span>}
    </>
  );
  return to ? (
    <Link to={to} className="rounded-lg border border-brd bg-card p-3 transition-colors hover:border-brds">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-brd bg-card p-3">{body}</div>
  );
}

export function OverviewSection() {
  const { t, lang, L } = useI18n();
  const q = useApi<Overview>('/api/admin/overview');
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const activeUsers = d.usersByRole.filter((u) => u.status === 'active').reduce((s, u) => s + Number(u.n), 0);
  const alerts = d.openAlerts.reduce((s, a) => s + Number(a.n), 0);
  const live = d.connections.filter((c) => c.status === 'connected').length;
  const checks: Array<[string, boolean, string]> = [
    [t('admin.checkEncryption'), d.encryptionConfigured, t(d.encryptionConfigured ? 'admin.checkEncryptionOk' : 'admin.checkEncryptionNo')],
    [t('admin.checkEmail'), d.emailConfigured, t(d.emailConfigured ? 'admin.checkEmailOk' : 'admin.checkEmailNo')],
    [t('admin.checkDemo'), !d.demoMode, t(d.demoMode ? 'admin.checkDemoOn' : 'admin.checkDemoOff')],
    [t('admin.checkAi'), true, t(`admin.aiReason_${d.ai.reason}`)],
  ];
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label={t('admin.activeUsers')} value={activeUsers} to="/admin?section=users" />
        <Stat label={t('admin.liveConnections')} value={`${live} / ${d.connections.length}`} to="/admin?section=integrations" hint={t('admin.liveConnectionsHint')} />
        <Stat label={t('admin.openAlerts')} value={alerts} to="/insights?tab=alerts" />
        <Stat label={t('admin.failedJobs')} value={d.failedJobs24h} to="/admin?section=system" />
      </div>
      <div className="grid grid-cols-1 gap-[var(--gap-grid)] xl:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.readiness')} subtitle={t('admin.readinessHint')} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-brd text-[13.5px]">
              {checks.map(([label, ok, text]) => (
                <li key={label} className="flex items-start justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="block text-[12.5px] text-t2">{text}</span>
                  </span>
                  <Badge tone={ok ? 'pos' : 'warn'}>{ok ? t('admin.ok') : t('admin.attention')}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('admin.connections')} actions={<Link to="/admin?section=integrations" className="text-[13px] font-medium text-acctext hover:underline">{t('admin.manage')} →</Link>} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-brd text-[13px]">
              {d.connections.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate">{c.name}</span>
                  <ConnectionStatus status={c.status} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('admin.usersByRole')} />
          <CardBody>
            <ul className="flex flex-col gap-1 text-[13px]">
              {Object.keys(ROLE_LABELS).map((r) => {
                const n = d.usersByRole.filter((u) => u.role === r && u.status === 'active').reduce((s, u) => s + Number(u.n), 0);
                return (
                  <li key={r} className="flex justify-between">
                    <span>{L(ROLE_LABELS[r as Role])}</span>
                    <span className="tnum">{n}</span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('admin.recentActivity')} actions={<Link to="/admin?section=audit" className="text-[13px] font-medium text-acctext hover:underline">{t('admin.auditLog')} →</Link>} />
          <CardBody>
            <ul className="flex flex-col divide-y divide-brd text-[12.5px]">
              {d.recentAudit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>
                    <code className="text-[12px]">{a.action}</code> · {a.userEmail ?? t('insights.system')}
                    {a.outcome !== 'success' && (
                      <Badge tone="neg" className="ml-1">
                        {a.outcome}
                      </Badge>
                    )}
                  </span>
                  <span className="text-t3" title={formatDateTime(a.createdAt, lang)}>
                    {relativeTime(a.createdAt, lang)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- organisation ---------------- */

interface Org {
  name: string;
  timezone: string;
  defaultLanguage: 'en' | 'fr';
  currency: string;
  logoDataUrl: string | null;
  demoMode: boolean;
  envDemoMode: boolean;
  settings: {
    appName?: string;
    supportedLanguages?: Array<'en' | 'fr'>;
    dateFormat?: 'locale' | 'iso';
    numberLocale?: 'fr-FR' | 'en-GB' | 'en-US';
    defaultPeriod?: string;
    defaultCompare?: 'previous' | 'yoy' | 'none';
    defaultTheme?: 'light' | 'dark' | 'system';
    fiscalYearStartMonth?: number;
    weekStartsOn?: number;
    dataRetentionMonths?: number;
    auditRetentionMonths?: number;
    reportRetentionDays?: number;
    geoRetentionMonths?: number;
  };
}

const PERIODS = ['last7', 'last30', 'last90', 'mtd', 'qtd', 'ytd', 'prevMonth', 'prevQuarter', 'prevYear'];

export function OrganizationSection() {
  const { t } = useI18n();
  const { can } = useSession();
  const q = useApi<Org>('/api/admin/org');
  const save = useAction<Record<string, unknown>>('PATCH', '/api/admin/org', ['/api/admin/org', 'meta']);
  const logo = useAction<{ dataUrl: string }>('POST', '/api/admin/org/logo', ['/api/admin/org', 'meta']);
  const delLogo = useAction<void>('DELETE', '/api/admin/org/logo', ['/api/admin/org', 'meta']);
  const [f, setF] = useState<Org | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (q.data) setF(q.data);
  }, [q.data]);
  if (q.isLoading || !f) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const edit = can('org.manage');
  const st = f.settings;
  const setS = (p: Partial<Org['settings']>) => setF({ ...f, settings: { ...st, ...p } });
  const submit = () =>
    save.run({
      name: f.name,
      timezone: f.timezone,
      defaultLanguage: f.defaultLanguage,
      currency: f.currency,
      demoMode: f.demoMode,
      settings: {
        appName: st.appName || undefined,
        supportedLanguages: st.supportedLanguages,
        dateFormat: st.dateFormat,
        numberLocale: st.numberLocale,
        defaultPeriod: st.defaultPeriod,
        defaultCompare: st.defaultCompare,
        defaultTheme: st.defaultTheme,
        fiscalYearStartMonth: st.fiscalYearStartMonth,
        weekStartsOn: st.weekStartsOn,
        dataRetentionMonths: st.dataRetentionMonths,
        auditRetentionMonths: st.auditRetentionMonths,
        reportRetentionDays: st.reportRetentionDays,
        geoRetentionMonths: st.geoRetentionMonths,
      },
    });
  const onFile = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => void logo.run({ dataUrl: String(r.result) });
    r.readAsDataURL(file);
  };
  const langs = st.supportedLanguages ?? ['fr', 'en'];
  const num = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="org.manage" />
      <Card>
        <CardHeader title={t('admin.identity')} subtitle={t('admin.identityHint')} />
        <CardBody>
          <fieldset disabled={!edit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('admin.orgName')} htmlFor="o-name">
              <Input id="o-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label={t('admin.appName')} htmlFor="o-app" hint={t('admin.appNameHint')}>
              <Input id="o-app" value={st.appName ?? ''} placeholder="Veolia Digital Intelligence" onChange={(e) => setS({ appName: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
              <p className="mb-1 text-[13px] font-medium">{t('admin.logo')}</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-14 w-28 items-center justify-center rounded-lg border border-dashed border-brds bg-card2">{f.logoDataUrl ? <img src={f.logoDataUrl} alt={t('admin.currentLogo')} className="max-h-12 max-w-24" /> : <span className="text-[12px] text-t3">{t('admin.noLogo')}</span>}</div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={t('admin.uploadLogo')} onChange={(e) => onFile(e.target.files?.[0])} />
                <Button size="sm" icon={<ImageUp className="size-3.5" />} loading={logo.pending} onClick={() => fileRef.current?.click()}>
                  {t('admin.uploadLogo')}
                </Button>
                {f.logoDataUrl && (
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => delLogo.run(undefined)}>
                    {t('common.delete')}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[12px] text-t3">{t('admin.logoHint')}</p>
            </div>
          </fieldset>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.regional')} subtitle={t('admin.regionalHint')} />
        <CardBody>
          <fieldset disabled={!edit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={t('admin.timezone')} htmlFor="o-tz" hint={t('admin.timezoneHint')}>
              <Input id="o-tz" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} />
            </Field>
            <Field label={t('admin.defaultLanguage')} htmlFor="o-lang">
              <Select id="o-lang" value={f.defaultLanguage} onChange={(e) => setF({ ...f, defaultLanguage: e.target.value as 'en' | 'fr' })}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </Select>
            </Field>
            <div>
              <p className="mb-1 text-[13px] font-medium">{t('admin.supportedLanguages')}</p>
              {(['fr', 'en'] as const).map((l) => (
                <Checkbox key={l} checked={langs.includes(l)} disabled={!edit || (langs.length === 1 && langs.includes(l))} onChange={(c) => setS({ supportedLanguages: c ? [...langs, l] : langs.filter((x) => x !== l) })} label={l === 'fr' ? 'Français' : 'English'} />
              ))}
            </div>
            <Field label={t('admin.currency')} htmlFor="o-cur">
              <Input id="o-cur" value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
            </Field>
            <Field label={t('admin.numberFormat')} htmlFor="o-num">
              <Select id="o-num" value={st.numberLocale ?? ''} onChange={(e) => setS({ numberLocale: (e.target.value || undefined) as Org['settings']['numberLocale'] })}>
                <option value="">{t('admin.followLanguage')}</option>
                <option value="fr-FR">1 234,5 (fr-FR)</option>
                <option value="en-GB">1,234.5 (en-GB)</option>
                <option value="en-US">1,234.5 (en-US)</option>
              </Select>
            </Field>
            <Field label={t('admin.dateFormat')} htmlFor="o-date">
              <Select id="o-date" value={st.dateFormat ?? 'locale'} onChange={(e) => setS({ dateFormat: e.target.value as 'locale' | 'iso' })}>
                <option value="locale">{t('admin.dateLocale')}</option>
                <option value="iso">2026-10-18 (ISO 8601)</option>
              </Select>
            </Field>
            <Field label={t('admin.fiscalYear')} htmlFor="o-fy">
              <Select id="o-fy" value={st.fiscalYearStartMonth ?? 1} onChange={(e) => setS({ fiscalYearStartMonth: Number(e.target.value) })}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {new Intl.DateTimeFormat(f.defaultLanguage === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, i, 1)))}
                  </option>
                ))}
              </Select>
            </Field>
          </fieldset>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.defaultsTitle')} subtitle={t('admin.defaultsHint')} />
        <CardBody>
          <fieldset disabled={!edit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={t('admin.defaultPeriod')} htmlFor="o-period">
              <Select id="o-period" value={st.defaultPeriod ?? 'last30'} onChange={(e) => setS({ defaultPeriod: e.target.value })}>
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {t(`reports.preset_${p}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('admin.defaultCompare')} htmlFor="o-cmp">
              <Select id="o-cmp" value={st.defaultCompare ?? 'previous'} onChange={(e) => setS({ defaultCompare: e.target.value as 'previous' })}>
                <option value="previous">{t('common.vsPrevious')}</option>
                <option value="yoy">{t('common.vsYoy')}</option>
                <option value="none">{t('common.noComparison')}</option>
              </Select>
            </Field>
            <Field label={t('admin.defaultTheme')} htmlFor="o-theme" hint={t('admin.defaultThemeHint')}>
              <Select id="o-theme" value={st.defaultTheme ?? 'light'} onChange={(e) => setS({ defaultTheme: e.target.value as 'light' })}>
                <option value="light">{t('admin.themeLight')}</option>
                <option value="dark">{t('admin.themeDark')}</option>
                <option value="system">{t('admin.themeSystem')}</option>
              </Select>
            </Field>
          </fieldset>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('admin.dataPolicy')} subtitle={t('admin.dataPolicyHint')} />
        <CardBody>
          <fieldset disabled={!edit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label={t('admin.retentionData')} htmlFor="o-r1">
              <Input id="o-r1" type="number" min={3} max={120} value={st.dataRetentionMonths ?? ''} placeholder="36" onChange={(e) => setS({ dataRetentionMonths: num(e.target.value) })} />
            </Field>
            <Field label={t('admin.retentionGeo')} htmlFor="o-r4">
              <Input id="o-r4" type="number" min={3} max={120} value={st.geoRetentionMonths ?? ''} placeholder="24" onChange={(e) => setS({ geoRetentionMonths: num(e.target.value) })} />
            </Field>
            <Field label={t('admin.retentionAudit')} htmlFor="o-r2">
              <Input id="o-r2" type="number" min={6} max={120} value={st.auditRetentionMonths ?? ''} placeholder="24" onChange={(e) => setS({ auditRetentionMonths: num(e.target.value) })} />
            </Field>
            <Field label={t('admin.retentionReports')} htmlFor="o-r3">
              <Input id="o-r3" type="number" min={7} max={3650} value={st.reportRetentionDays ?? ''} placeholder="365" onChange={(e) => setS({ reportRetentionDays: num(e.target.value) })} />
            </Field>
            <div className="md:col-span-4">
              <Switch checked={f.demoMode} disabled={!edit || !f.envDemoMode} onChange={(v) => setF({ ...f, demoMode: v })} label={t('admin.demoMode')} description={f.envDemoMode ? t('admin.demoModeHint') : t('admin.demoModeEnvOff')} />
            </div>
          </fieldset>
        </CardBody>
      </Card>
      {edit && (
        <div className="flex justify-end">
          <Button variant="primary" loading={save.pending} onClick={submit}>
            {t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
