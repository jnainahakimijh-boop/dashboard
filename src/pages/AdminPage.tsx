import { useState } from 'react';
import { Activity, Check, Database, Mail, Minus, Plug, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/state/ToastContext';
import { Badge, Btn, Card, Segmented, type BadgeTone } from '@/components/ui/primitives';
import { DataTable, Num, type Column } from '@/components/tables/DataTable';
import { fmtInt } from '@/lib/format';
import { healthScore } from '@/lib/dataQuality';
import type { MsgKey } from '@/i18n/messages';

type Tab = 'overview' | 'users' | 'roles' | 'integrations' | 'governance' | 'flags' | 'security' | 'audit';

/* ---------------- demo data ---------------- */

interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Analyst' | 'Editor' | 'Viewer';
  scope: string;
  status: 'active' | 'invited' | 'deactivated';
  lastActive: { en: string; fr: string };
}

const INITIAL_USERS: DemoUser[] = [
  { id: 'u1', name: 'Alex Moreau', email: 'alex.moreau@example.com', role: 'Analyst', scope: 'Global', status: 'active', lastActive: { en: '4 min ago', fr: 'il y a 4 min' } },
  { id: 'u2', name: 'Priya Sharma', email: 'priya.sharma@example.com', role: 'Administrator', scope: 'Global', status: 'active', lastActive: { en: '1 h ago', fr: 'il y a 1 h' } },
  { id: 'u3', name: 'Jonas Weber', email: 'jonas.weber@example.com', role: 'Editor', scope: 'DACH', status: 'active', lastActive: { en: 'Yesterday', fr: 'Hier' } },
  { id: 'u4', name: 'Marta Kowalska', email: 'marta.kowalska@example.com', role: 'Analyst', scope: 'Poland', status: 'active', lastActive: { en: '2 d ago', fr: 'il y a 2 j' } },
  { id: 'u5', name: 'Sofia Ruiz', email: 'sofia.ruiz@example.com', role: 'Viewer', scope: 'Spain', status: 'invited', lastActive: { en: '—', fr: '—' } },
  { id: 'u6', name: 'Tom Carter', email: 'tom.carter@example.com', role: 'Viewer', scope: 'North America', status: 'deactivated', lastActive: { en: '3 w ago', fr: 'il y a 3 sem.' } },
];

const PERMISSIONS: Array<{ id: string; label: { en: string; fr: string }; grants: Record<DemoUser['role'], boolean> }> = [
  { id: 'view', label: { en: 'View dashboards', fr: 'Voir les tableaux de bord' }, grants: { Administrator: true, Analyst: true, Editor: true, Viewer: true } },
  { id: 'export', label: { en: 'Export data', fr: 'Exporter les données' }, grants: { Administrator: true, Analyst: true, Editor: true, Viewer: false } },
  { id: 'reports', label: { en: 'Manage reports', fr: 'Gérer les rapports' }, grants: { Administrator: true, Analyst: true, Editor: true, Viewer: false } },
  { id: 'kpis', label: { en: 'Manage KPIs', fr: 'Gérer les KPI' }, grants: { Administrator: true, Analyst: true, Editor: false, Viewer: false } },
  { id: 'integrations', label: { en: 'Manage integrations', fr: 'Gérer les intégrations' }, grants: { Administrator: true, Analyst: false, Editor: false, Viewer: false } },
  { id: 'users', label: { en: 'Manage users', fr: 'Gérer les utilisateurs' }, grants: { Administrator: true, Analyst: false, Editor: false, Viewer: false } },
  { id: 'audit', label: { en: 'View audit log', fr: "Voir le journal d'audit" }, grants: { Administrator: true, Analyst: true, Editor: false, Viewer: false } },
  { id: 'settings', label: { en: 'Edit platform settings', fr: 'Modifier les paramètres' }, grants: { Administrator: true, Analyst: false, Editor: false, Viewer: false } },
];

interface Integration {
  id: string;
  name: string;
  status: 'connected' | 'degraded';
  lastSync: { en: string; fr: string };
  frequency: string;
  records: number;
  health: number;
}

const INTEGRATIONS: Integration[] = [
  { id: 'web', name: 'Web Analytics', status: 'connected', lastSync: { en: '4 min ago', fr: 'il y a 4 min' }, frequency: '15 min', records: 121824, health: 98 },
  { id: 'linkedin', name: 'LinkedIn', status: 'connected', lastSync: { en: '38 min ago', fr: 'il y a 38 min' }, frequency: '1 h', records: 40320, health: 96 },
  { id: 'youtube', name: 'YouTube', status: 'connected', lastSync: { en: '52 min ago', fr: 'il y a 52 min' }, frequency: '6 h', records: 18216, health: 95 },
  { id: 'x', name: 'X', status: 'degraded', lastSync: { en: '2 d ago', fr: 'il y a 2 j' }, frequency: '6 h', records: 12684, health: 71 },
  { id: 'crm', name: 'CRM', status: 'connected', lastSync: { en: '3 h ago', fr: 'il y a 3 h' }, frequency: '24 h', records: 48210, health: 93 },
  { id: 'paid', name: 'Paid Media', status: 'connected', lastSync: { en: '1 h ago', fr: 'il y a 1 h' }, frequency: '3 h', records: 8412, health: 91 },
  { id: 'dwh', name: 'Data Warehouse', status: 'connected', lastSync: { en: '26 min ago', fr: 'il y a 26 min' }, frequency: '1 h', records: 214540, health: 97 },
];

interface GovKpi {
  id: string;
  name: string;
  formula: string;
  owner: string;
  source: string;
  target: string;
  status: 'validated' | 'draft' | 'archived';
}

const INITIAL_GOV: GovKpi[] = [
  { id: 'g1', name: 'Conversion rate', formula: 'conversions / sessions × 100', owner: 'Demand Gen', source: 'Web Analytics', target: '2.8%', status: 'validated' },
  { id: 'g2', name: 'Engagement rate (web)', formula: 'engaged_sessions / sessions × 100', owner: 'Analytics', source: 'Web Analytics', target: '60%', status: 'validated' },
  { id: 'g3', name: 'CPA', formula: 'spend / conversions', owner: 'Paid Media', source: 'Paid Media', target: '≤ €40', status: 'validated' },
  { id: 'g4', name: 'Social ER', formula: 'engagements / impressions × 100', owner: 'Social', source: 'Social analytics', target: '4.0%', status: 'draft' },
  { id: 'g5', name: 'Marketing-sourced pipeline', formula: 'sum(opportunity_value where source=marketing)', owner: 'RevOps', source: 'CRM', target: '—', status: 'draft' },
];

const FLAGS: Array<{ id: string; label: { en: string; fr: string }; desc: { en: string; fr: string }; on: boolean }> = [
  { id: 'ai-recs', label: { en: 'AI recommendations', fr: 'Recommandations IA' }, desc: { en: 'Rule-based insight engine on Overview and Insights.', fr: "Moteur d'insights sur la vue d'ensemble et Insights." }, on: true },
  { id: 'benchmarks', label: { en: 'Advanced benchmarking', fr: 'Benchmarking avancé' }, desc: { en: 'Cross-market benchmark module (beta).', fr: 'Module de benchmark inter-marchés (bêta).' }, on: false },
  { id: 'sched-exports', label: { en: 'Scheduled exports', fr: 'Exports planifiés' }, desc: { en: 'Email delivery of saved report views.', fr: 'Envoi par email des vues de rapport.' }, on: true },
  { id: 'audience-enrich', label: { en: 'Audience enrichment', fr: "Enrichissement d'audience" }, desc: { en: 'Third-party firmographic enrichment.', fr: 'Enrichissement firmographique tiers.' }, on: false },
  { id: 'exp-attribution', label: { en: 'Experimental attribution model', fr: "Modèle d'attribution expérimental" }, desc: { en: 'Position-based attribution (validation pending).', fr: 'Attribution positionnelle (en validation).' }, on: false },
];

const AUDIT_LOG: Array<{ time: string; user: string; action: { en: string; fr: string }; object: string; result: 'Success' | 'Denied'; ip: string }> = [
  { time: '14:32', user: 'Priya Sharma', action: { en: 'Changed Analyst permissions', fr: 'Modification des permissions Analyst' }, object: 'Role', result: 'Success', ip: '10.4.12.8 · Chrome' },
  { time: '13:58', user: 'Priya Sharma', action: { en: 'Invited sofia.ruiz@example.com', fr: 'Invitation de sofia.ruiz@example.com' }, object: 'User', result: 'Success', ip: '10.4.12.8 · Chrome' },
  { time: '11:41', user: 'System', action: { en: 'X connector sync failed (401)', fr: 'Échec de synchro du connecteur X (401)' }, object: 'Integration', result: 'Denied', ip: 'scheduler' },
  { time: '09:15', user: 'Alex Moreau', action: { en: 'Exported overview CSV', fr: "Export CSV de la vue d'ensemble" }, object: 'Report', result: 'Success', ip: '10.4.9.31 · Firefox' },
  { time: 'Yesterday 18:03', user: 'Jonas Weber', action: { en: 'Edited KPI target: CPA', fr: 'Modification de la cible KPI : CPA' }, object: 'KPI', result: 'Success', ip: '10.4.2.17 · Edge' },
  { time: 'Yesterday 16:47', user: 'System', action: { en: 'Retention policy applied (24 months)', fr: 'Politique de rétention appliquée (24 mois)' }, object: 'Data', result: 'Success', ip: 'scheduler' },
];

/* ---------------- page ---------------- */

export default function AdminPage() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [users, setUsers] = useState(INITIAL_USERS);
  const [gov, setGov] = useState(INITIAL_GOV);
  const [flags, setFlags] = useState(FLAGS);
  const [syncing, setSyncing] = useState<string | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t('adm.tab.overview') },
    { id: 'users', label: t('adm.users') },
    { id: 'roles', label: t('adm.roles') },
    { id: 'integrations', label: t('adm.integrations') },
    { id: 'governance', label: t('adm.governance') },
    { id: 'flags', label: t('adm.flags') },
    { id: 'security', label: t('adm.security') },
    { id: 'audit', label: t('adm.audit') },
  ];

  const statusTone: Record<DemoUser['status'], BadgeTone> = { active: 'pos', invited: 'info', deactivated: 'neutral' };
  const statusKey: Record<DemoUser['status'], MsgKey> = { active: 'adm.active', invited: 'adm.invited', deactivated: 'adm.deactivated' };

  const userCols: Column<DemoUser>[] = [
    {
      id: 'name',
      header: t('adm.name'),
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full border border-brds bg-card2 text-[10.5px] font-semibold text-t1">
            {r.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
          </span>
          <span className="text-[13px] font-medium text-t1">{r.name}</span>
        </span>
      ),
      sortValue: (r) => r.name,
      searchText: (r) => `${r.name} ${r.email}`,
    },
    { id: 'email', header: t('adm.email'), cell: (r) => <Num muted>{r.email}</Num>, sortValue: (r) => r.email },
    {
      id: 'role',
      header: t('adm.role'),
      sortValue: (r) => r.role,
      cell: (r) => (
        <select
          value={r.role}
          disabled={r.status === 'deactivated'}
          onChange={(e) => {
            setUsers((prev) => prev.map((u) => (u.id === r.id ? { ...u, role: e.target.value as DemoUser['role'] } : u)));
            toast(`${r.name}: ${e.target.value} ✓`);
          }}
          aria-label={`${t('adm.role')}: ${r.name}`}
          className="h-7 rounded-[8px] border border-brd bg-card2 px-1.5 text-[11px] text-t1 hover:border-brds disabled:opacity-40"
        >
          {['Administrator', 'Analyst', 'Editor', 'Viewer'].map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      ),
    },
    { id: 'scope', header: t('adm.scope'), cell: (r) => <Num muted>{r.scope}</Num>, sortValue: (r) => r.scope },
    { id: 'status', header: t('adm.status'), cell: (r) => <Badge tone={statusTone[r.status]}>{t(statusKey[r.status]).toUpperCase()}</Badge>, sortValue: (r) => r.status },
    { id: 'last', header: t('adm.lastActive'), cell: (r) => <Num muted>{r.lastActive[lang]}</Num> },
    {
      id: 'actions',
      header: t('adm.actions'),
      align: 'right',
      cell: (r) => (
        <span className="flex justify-end gap-1.5">
          <Btn
            size="sm"
            onClick={() => {
              setUsers((prev) => prev.map((u) => (u.id === r.id ? { ...u, status: u.status === 'deactivated' ? 'active' : 'deactivated' } : u)));
              toast(`${r.name}: ${r.status === 'deactivated' ? t('adm.activate') : t('adm.deactivate')} ✓`);
            }}
          >
            {r.status === 'deactivated' ? t('adm.activate') : t('adm.deactivate')}
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => toast(`${t('adm.resetAccess')}: ${r.email} ✓`, 'info')}>
            {t('adm.resetAccess')}
          </Btn>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-5 md:p-8">
      <div className="overflow-x-auto">
        <Segmented ariaLabel={t('adm.title')} options={tabs} value={tab} onChange={setTab} />
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 gap-[var(--gap-grid)] sm:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: Users, label: t('adm.activeUsers'), value: fmtInt(users.filter((u) => u.status === 'active').length, lang), sub: `${users.length} ${t('adm.users').toLowerCase()}` },
              { icon: Database, label: t('adm.connectedSources'), value: fmtInt(INTEGRATIONS.filter((i2) => i2.status === 'connected').length, lang), sub: `${INTEGRATIONS.length} ${t('adm.integrations').toLowerCase()}` },
              { icon: Activity, label: t('adm.dataHealth'), value: `${healthScore().total}/100`, sub: t('dq.healthSub').split('.')[0] },
              { icon: Mail, label: t('adm.pendingInvites'), value: fmtInt(users.filter((u) => u.status === 'invited').length, lang), sub: t('adm.invited') },
            ].map((card) => (
              <div key={card.label} className="rounded-[14px] border border-brd bg-card p-[var(--pad-card)] shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-inset text-t2"><card.icon size={15} aria-hidden /></span>
                  <span className="eyebrow">{card.label}</span>
                </div>
                <div className="mt-3 text-[26px] font-bold leading-none tracking-[-0.02em] text-t1 tnum">{card.value}</div>
                <div className="mt-2 truncate text-[12px] text-t3">{card.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2">
            <Card title={t('adm.systemHealth')}>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {INTEGRATIONS.map((integ) => (
                  <li key={integ.id} className="flex items-center gap-3 rounded-[10px] border border-brd bg-card2 px-3.5 py-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${integ.status === 'connected' ? 'bg-pos' : 'bg-warn'}`} aria-hidden />
                    <span className="flex-1 text-[13px] font-medium text-t1">{integ.name}</span>
                    <span className="mono text-[11.5px] text-t3">{integ.lastSync[lang]}</span>
                    <span className="mono w-14 text-right text-[12px] font-medium text-t1 tnum">{integ.health}/100</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card
              title={t('adm.recentActivity')}
              right={
                <button type="button" onClick={() => setTab('audit')} className="text-[12.5px] font-semibold text-acctext hover:underline">
                  {t('adm.viewAudit')}
                </button>
              }
            >
              <ul className="m-0 flex list-none flex-col p-0">
                {AUDIT_LOG.slice(0, 5).map((row, i) => (
                  <li key={i} className="flex items-start gap-3 border-b border-brd py-2.5 last:border-b-0">
                    <span className="mono mt-0.5 w-24 shrink-0 text-[11.5px] text-t3">{row.time}</span>
                    <span className="min-w-0 flex-1 text-[13px] text-t1">
                      <span className="font-medium">{row.user}</span> · <span className="text-t2">{row.action[lang]}</span>
                    </span>
                    <Badge tone={row.result === 'Success' ? 'pos' : 'neg'}>{row.result === 'Success' ? 'OK' : 'DENIED'}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}

      {tab === 'users' && (
        <Card
          title={t('adm.users')}
          right={
            <Btn
              variant="primary"
              size="sm"
              onClick={() => {
                const n = users.length + 1;
                setUsers((prev) => [
                  ...prev,
                  { id: `u${n}`, name: `Invited User ${n}`, email: `user${n}@example.com`, role: 'Viewer', scope: 'Global', status: 'invited', lastActive: { en: '—', fr: '—' } },
                ]);
                toast(t('adm.invite') + ' ✓');
              }}
            >
              <UserPlus size={13} aria-hidden />
              {t('adm.invite')}
            </Btn>
          }
        >
          <DataTable columns={userCols} rows={users} rowKey={(r) => r.id} searchable defaultSort={{ id: 'name', dir: 'asc' }} ariaLabel={t('adm.users')} />
        </Card>
      )}

      {tab === 'roles' && (
        <Card title={t('adm.roles')}>
          <div className="overflow-x-auto rounded-[10px] border border-brd">
            <table className="w-full border-collapse text-[12px]" aria-label={t('adm.roles')}>
              <thead>
                <tr className="bg-card2">
                  <th scope="col" className="border-b border-brd px-3 py-2 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-t3">{t('adm.permission')}</span>
                  </th>
                  {(['Administrator', 'Analyst', 'Editor', 'Viewer'] as const).map((role) => (
                    <th key={role} scope="col" className="border-b border-brd px-3 py-2 text-center">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-t3">{role}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm) => (
                  <tr key={perm.id} className="border-b border-brd last:border-b-0">
                    <td className="px-3 py-2.5 text-[12px] text-t1">{perm.label[lang]}</td>
                    {(['Administrator', 'Analyst', 'Editor', 'Viewer'] as const).map((role) => (
                      <td key={role} className="px-3 py-2.5 text-center">
                        {perm.grants[role] ? (
                          <Check size={14} className="inline text-pos" aria-label={t('set.on')} />
                        ) : (
                          <Minus size={14} className="inline text-t3" aria-label={t('set.off')} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'integrations' && (
        <div className="grid gap-[var(--gap-grid)] md:grid-cols-2 xl:grid-cols-3">
          {INTEGRATIONS.map((integ) => (
            <Card
              key={integ.id}
              title={
                <span className="flex items-center gap-2">
                  <Plug size={13} className="text-t3" aria-hidden />
                  {integ.name}
                </span>
              }
              right={<Badge tone={integ.status === 'connected' ? 'pos' : 'warn'}>{integ.status === 'connected' ? t('adm.integration.connected').toUpperCase() : t('dq.degraded').toUpperCase()}</Badge>}
            >
              <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <dt className="text-t3">{t('adm.integration.lastSync')}</dt>
                <dd className="mono m-0 text-right text-t1">{integ.lastSync[lang]}</dd>
                <dt className="text-t3">{t('adm.integration.frequency')}</dt>
                <dd className="mono m-0 text-right text-t1">{integ.frequency}</dd>
                <dt className="text-t3">{t('adm.integration.records')}</dt>
                <dd className="mono m-0 text-right text-t1 tnum">{fmtInt(integ.records, lang)}</dd>
                <dt className="text-t3">{t('adm.integration.health')}</dt>
                <dd className="mono m-0 text-right text-t1 tnum">{integ.health}/100</dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-brd pt-3">
                <Btn size="sm" onClick={() => toast(`${integ.name}: ${t('adm.integration.configure')} — demo`, 'info')}>
                  {t('adm.integration.configure')}
                </Btn>
                <Btn size="sm" onClick={() => toast(`${integ.name}: ${t('adm.integration.testOk')}`)}>
                  {t('adm.integration.test')}
                </Btn>
                <Btn
                  size="sm"
                  disabled={syncing === integ.id}
                  onClick={() => {
                    setSyncing(integ.id);
                    window.setTimeout(() => {
                      setSyncing(null);
                      toast(`${integ.name}: ${t('adm.integration.testOk')}`);
                    }, 1100);
                  }}
                >
                  <RefreshCw size={11} aria-hidden className={syncing === integ.id ? 'animate-spin' : ''} />
                  {syncing === integ.id ? t('adm.integration.syncing') : t('adm.integration.refresh')}
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'governance' && (
        <Card title={t('adm.governance')}>
          <div className="overflow-x-auto rounded-[10px] border border-brd">
            <table className="w-full border-collapse text-[12px]" aria-label={t('adm.governance')}>
              <thead>
                <tr className="bg-card2">
                  {[t('cat.metric'), t('cat.formula'), t('cat.owner'), t('cat.sourceCol'), t('misc.target'), t('cat.status'), t('adm.actions')].map((h, i) => (
                    <th key={h} scope="col" className={`border-b border-brd px-3 py-2 ${i === 6 ? 'text-right' : 'text-left'}`}>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-t3">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gov.map((k) => (
                  <tr key={k.id} className="border-b border-brd last:border-b-0">
                    <td className="px-3 py-2.5 text-[13px] font-medium text-t1">{k.name}</td>
                    <td className="px-3 py-2.5">
                      <code className="mono rounded-[5px] border border-brd bg-inset px-1.5 py-0.5 text-[11px] text-acctext">{k.formula}</code>
                    </td>
                    <td className="mono px-3 py-2.5 text-[11px] text-t2">{k.owner}</td>
                    <td className="mono px-3 py-2.5 text-[11px] text-t2">{k.source}</td>
                    <td className="mono px-3 py-2.5 text-[11px] text-t1 tnum">{k.target}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={k.status === 'validated' ? 'pos' : k.status === 'draft' ? 'warn' : 'neutral'}>
                        {t(k.status === 'validated' ? 'cat.validated' : k.status === 'draft' ? 'cat.draft' : 'cat.deprecated').toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {k.status === 'draft' ? (
                        <Btn
                          size="sm"
                          onClick={() => {
                            setGov((prev) => prev.map((g) => (g.id === k.id ? { ...g, status: 'validated' } : g)));
                            toast(`${k.name}: ${t('cat.validated')} ✓`);
                          }}
                        >
                          <ShieldCheck size={11} aria-hidden />
                          {t('cat.validated')}
                        </Btn>
                      ) : (
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setGov((prev) => prev.map((g) => (g.id === k.id ? { ...g, status: g.status === 'archived' ? 'validated' : 'archived' } : g)));
                            toast(`${k.name} ✓`, 'info');
                          }}
                        >
                          {k.status === 'archived' ? t('adm.activate') : (lang === 'fr' ? 'Archiver' : 'Archive')}
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'flags' && (
        <Card title={t('adm.flags')} subtitle={t('adm.flag.desc')}>
          <ul className="m-0 flex list-none flex-col p-0">
            {flags.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 border-b border-brd py-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-t1">{f.label[lang]}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-t3">{f.desc[lang]}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={f.on}
                  aria-label={f.label[lang]}
                  onClick={() => {
                    setFlags((prev) => prev.map((x) => (x.id === f.id ? { ...x, on: !x.on } : x)));
                    toast(`${f.label[lang]}: ${f.on ? t('set.off') : t('set.on')}`);
                  }}
                  className={`relative h-5.5 w-10 shrink-0 rounded-full border transition-colors ${f.on ? 'border-accbrd bg-acc' : 'border-brds bg-inset'}`}
                >
                  <span aria-hidden className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-[left] ${f.on ? 'left-[21px] bg-accink' : 'left-[3px] border border-brds bg-card2'}`} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'security' && (
        <div className="grid gap-[var(--gap-grid)] md:grid-cols-2">
          {[
            { label: t('adm.sec.sso'), value: 'SAML 2.0 · Okta', badge: { tone: 'pos' as BadgeTone, text: t('adm.integration.connected') } },
            { label: t('adm.sec.mfa'), value: lang === 'fr' ? 'Obligatoire pour tous les rôles' : 'Required for all roles', badge: { tone: 'pos' as BadgeTone, text: 'ENFORCED' } },
            { label: t('adm.sec.session'), value: lang === 'fr' ? '8 heures (inactivité 30 min)' : '8 hours (30 min idle)', badge: null },
            { label: t('adm.sec.domains'), value: 'example.com · partner-example.com', badge: null },
            { label: t('adm.sec.retention'), value: lang === 'fr' ? '24 mois de données événement' : '24 months of event data', badge: null },
            { label: t('adm.sec.tokens'), value: lang === 'fr' ? '2 jetons actifs · rotation 90 j' : '2 active tokens · 90-day rotation', badge: { tone: 'info' as BadgeTone, text: 'API' } },
            { label: t('adm.sec.downloads'), value: lang === 'fr' ? 'Exports limités aux rôles Analyst+' : 'Exports limited to Analyst+ roles', badge: null },
            { label: t('adm.audit'), value: lang === 'fr' ? 'Activé · rétention 12 mois' : 'Enabled · 12-month retention', badge: { tone: 'pos' as BadgeTone, text: 'ON' } },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-[12px] border border-brd bg-card p-4">
              <div>
                <div className="eyebrow text-[10px]">{row.label}</div>
                <div className="mt-1 text-[12.5px] text-t1">{row.value}</div>
              </div>
              {row.badge && <Badge tone={row.badge.tone}>{row.badge.text.toUpperCase()}</Badge>}
            </div>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <Card title={t('adm.audit')}>
          <div className="overflow-x-auto rounded-[10px] border border-brd">
            <table className="w-full border-collapse text-[12px]" aria-label={t('adm.audit')}>
              <thead>
                <tr className="bg-card2">
                  {[t('adm.audit.time'), t('adm.audit.user'), t('adm.audit.action'), t('adm.audit.object'), t('adm.audit.result'), t('adm.audit.ip')].map((h) => (
                    <th key={h} scope="col" className="border-b border-brd px-3 py-2 text-left">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-t3">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AUDIT_LOG.map((row, i) => (
                  <tr key={i} className="border-b border-brd last:border-b-0">
                    <td className="mono px-3 py-2.5 text-[11px] text-t3">{row.time}</td>
                    <td className="px-3 py-2.5 text-[13px] font-medium text-t1">{row.user}</td>
                    <td className="px-3 py-2.5 text-[12px] text-t2">{row.action[lang]}</td>
                    <td className="mono px-3 py-2.5 text-[11px] text-t3">{row.object}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={row.result === 'Success' ? 'pos' : 'neg'}>{row.result === 'Success' ? 'SUCCESS' : 'DENIED'}</Badge>
                    </td>
                    <td className="mono px-3 py-2.5 text-[11px] text-t3">{row.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
