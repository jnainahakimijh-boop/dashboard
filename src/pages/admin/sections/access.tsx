import { Check, Download, KeyRound, Lock, Pencil, Plus, ScrollText, Unlock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { APP_MODULES, ROLE_LABELS, type Role } from '@shared/rbac';
import { download } from '@/api/client';
import { useApi, useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useSession } from '@/state/session';
import { DataTable } from '@/components/tables/DataTable';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, ErrorState, Field, IconButton, Input, Modal, Pagination, Select, Skeleton, useToast } from '@/components/ui';
import { ReadOnlyNote, useAction } from '../shared';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'disabled';
  language: 'en' | 'fr';
  scopes: { websites?: string[]; modules?: string[] };
  isDemo: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  hasPassword: boolean;
  lockedUntil: string | null;
}

interface RolesInfo {
  roles: Array<{ id: Role; label: { en: string; fr: string }; description: { en: string; fr: string }; permissions: string[] }>;
  permissions: string[];
  assignable: Role[];
}

function UserModal({ user, open, onClose, assignable }: { user: AdminUser | null; open: boolean; onClose: () => void; assignable: Role[] }) {
  const { t, L } = useI18n();
  const meta = useMeta();
  const empty = { email: '', name: '', role: 'analyst' as Role, language: 'fr' as 'en' | 'fr', password: '', websites: [] as string[], modules: [] as string[] };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(user ? { email: user.email, name: user.name, role: user.role, language: user.language, password: '', websites: user.scopes.websites ?? [], modules: user.scopes.modules ?? [] } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);
  const create = useAction<Record<string, unknown>>('POST', '/api/admin/users', ['/api/admin/users']);
  const update = useAction<Record<string, unknown>>('PATCH', `/api/admin/users/${user?.id}`, ['/api/admin/users']);
  const scopes = { websites: f.websites.length ? f.websites : undefined, modules: f.modules.length ? f.modules : undefined };
  const submit = async () => {
    const ok = user ? await update.run({ name: f.name, role: f.role !== user.role ? f.role : undefined, language: f.language, scopes }) : await create.run({ email: f.email.trim(), name: f.name.trim(), role: f.role, language: f.language, password: f.password || undefined, scopes });
    if (ok) onClose();
  };
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={user ? t('admin.editUser') : t('admin.addUser')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!f.name.trim() || (!user && !f.email.includes('@'))} loading={create.pending || update.pending} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('admin.email')} htmlFor="u-email" required>
          <Input id="u-email" type="email" value={f.email} disabled={!!user} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label={t('common.name')} htmlFor="u-name" required>
          <Input id="u-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t('admin.role')} htmlFor="u-role">
          <Select id="u-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r} disabled={!assignable.includes(r) && r !== user?.role}>
                {L(ROLE_LABELS[r])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.language')} htmlFor="u-lang">
          <Select id="u-lang" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as 'en' | 'fr' })}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </Select>
        </Field>
        {!user && (
          <div className="sm:col-span-2">
            <Field label={t('admin.initialPassword')} htmlFor="u-pw" hint={t('admin.initialPasswordHint')}>
              <Input id="u-pw" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </Field>
          </div>
        )}
        <fieldset>
          <legend className="mb-1 text-[13px] font-medium">{t('admin.websiteAccess')}</legend>
          <p className="mb-1 text-[12px] text-t3">{t('admin.allWhenEmpty')}</p>
          {meta.data?.sites.map((s) => (
            <Checkbox key={s.key} checked={f.websites.includes(s.key)} onChange={(c) => setF({ ...f, websites: toggle(f.websites, s.key, c) })} label={s.name} />
          ))}
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-[13px] font-medium">{t('admin.moduleAccess')}</legend>
          <p className="mb-1 text-[12px] text-t3">{t('admin.allWhenEmpty')}</p>
          {APP_MODULES.map((m) => (
            <Checkbox key={m} checked={f.modules.includes(m)} onChange={(c) => setF({ ...f, modules: toggle(f.modules, m, c) })} label={t(`nav.${m}`)} />
          ))}
        </fieldset>
      </div>
    </Modal>
  );
}

function PasswordModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { t } = useI18n();
  const [pw, setPw] = useState('');
  const reset = useAction<{ password: string }>('POST', `/api/admin/users/${user?.id}/password`, ['/api/admin/users']);
  return (
    <Modal
      open={!!user}
      onClose={() => (setPw(''), onClose())}
      size="sm"
      title={t('admin.setPassword')}
      footer={
        <>
          <Button onClick={() => (setPw(''), onClose())}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={pw.length < 12} loading={reset.pending} onClick={async () => (await reset.run({ password: pw })) && (setPw(''), onClose())}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-t2">{t('admin.setPasswordHint', { name: user?.name ?? '' })}</p>
      <Field label={t('admin.newPassword')} htmlFor="pw-new" hint={t('admin.passwordPolicy')}>
        <Input id="pw-new" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
    </Modal>
  );
}

export function UsersSection({ onShowAudit }: { onShowAudit: (email: string) => void }) {
  const { t, lang, L } = useI18n();
  const { can, me } = useSession();
  const q = useApi<AdminUser[]>('/api/admin/users');
  const roles = useApi<RolesInfo>('/api/admin/roles');
  const patch = useAction<{ id: string; body: Record<string, unknown> }>('PATCH', (b) => `/api/admin/users/${b.id}`, ['/api/admin/users']);
  const [modal, setModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [pwUser, setPwUser] = useState<AdminUser | null>(null);
  const edit = can('users.manage');
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const send = (u: AdminUser, body: Record<string, unknown>) => patch.run({ id: u.id, body });
  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <ReadOnlyNote permission="users.manage" />
      <Card>
        <CardHeader
          title={t('admin.users')}
          subtitle={t('admin.usersHint')}
          actions={
            edit && (
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setModal({ open: true, user: null })}>
                {t('admin.addUser')}
              </Button>
            )
          }
        />
        <CardBody>
          <DataTable
            rows={q.data ?? []}
            caption={t('admin.users')}
            rowKey={(u) => u.id}
            exportTitle="users"
            columns={[
              {
                key: 'name',
                header: t('common.name'),
                value: (u) => u.name,
                unit: 'text',
                render: (u) => (
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {u.name} {u.isDemo && <Badge className="ml-1">{t('admin.demoAccount')}</Badge>}
                    </span>
                    <span className="text-[12px] text-t3">{u.email}</span>
                  </span>
                ),
              },
              { key: 'role', header: t('admin.role'), value: (u) => L(ROLE_LABELS[u.role]), unit: 'text' },
              {
                key: 'scope',
                header: t('admin.access'),
                value: (u) => [...(u.scopes.websites ?? []), ...(u.scopes.modules ?? [])].join(', ') || t('admin.fullAccess'),
                unit: 'text',
                hideOnMobile: true,
              },
              {
                key: 'status',
                header: t('common.status'),
                value: (u) => u.status,
                unit: 'text',
                render: (u) =>
                  u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                    <Badge tone="warn">
                      <Lock className="size-3" aria-hidden /> {t('admin.locked')}
                    </Badge>
                  ) : (
                    <Badge tone={u.status === 'active' ? 'pos' : 'neutral'}>{t(`admin.userStatus_${u.status}`)}</Badge>
                  ),
              },
              { key: 'login', header: t('admin.lastLogin'), value: (u) => u.lastLoginAt, unit: 'text', render: (u) => (u.lastLoginAt ? <span title={formatDateTime(u.lastLoginAt, lang)}>{relativeTime(u.lastLoginAt, lang)}</span> : t('admin.never')), hideOnMobile: true },
              {
                key: 'act',
                header: '',
                value: () => null,
                sortable: false,
                render: (u) => {
                  const protectedTarget = u.role === 'super_admin' && me?.user.role !== 'super_admin';
                  return (
                    <span className="flex flex-nowrap justify-end gap-0.5">
                      <IconButton label={`${t('admin.history')}: ${u.name}`} onClick={() => onShowAudit(u.email)}>
                        <ScrollText className="size-4" />
                      </IconButton>
                      {edit && !protectedTarget && (
                        <>
                          <IconButton label={`${t('common.edit')}: ${u.name}`} onClick={() => setModal({ open: true, user: u })}>
                            <Pencil className="size-4" />
                          </IconButton>
                          <IconButton label={`${t('admin.setPassword')}: ${u.name}`} onClick={() => setPwUser(u)}>
                            <KeyRound className="size-4" />
                          </IconButton>
                          {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                            <IconButton label={`${t('admin.unlock')}: ${u.name}`} onClick={() => send(u, { unlock: true })}>
                              <Unlock className="size-4" />
                            </IconButton>
                          )}
                          {u.id !== me?.user.id && (
                            <Button size="sm" variant="ghost" className="whitespace-nowrap" onClick={() => send(u, { status: u.status === 'active' ? 'disabled' : 'active' })}>
                              {u.status === 'active' ? t('admin.deactivate') : t('admin.activate')}
                            </Button>
                          )}
                        </>
                      )}
                    </span>
                  );
                },
              },
            ]}
          />
          <p className="mt-3 text-[12px] text-t3">{t('admin.ssoNote')}</p>
        </CardBody>
      </Card>
      {edit && <UserModal open={modal.open} user={modal.user} assignable={roles.data?.assignable ?? []} onClose={() => setModal({ open: false, user: null })} />}
      {edit && <PasswordModal user={pwUser} onClose={() => setPwUser(null)} />}
    </div>
  );
}

export function RolesSection() {
  const { t, L } = useI18n();
  const q = useApi<RolesInfo>('/api/admin/roles');
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { roles, permissions } = q.data;
  return (
    <Card>
      <CardHeader title={t('admin.rolesTitle')} subtitle={t('admin.rolesHint')} />
      <CardBody>
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="rounded-lg border border-brd p-3">
              <p className="text-[14px] font-semibold">{L(r.label)}</p>
              <p className="mt-0.5 text-[12.5px] text-t2">{L(r.description)}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border border-brd">
          <table className="w-full text-[12.5px]">
            <caption className="sr-only">{t('admin.rolesTitle')}</caption>
            <thead className="bg-card2">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  {t('admin.permission')}
                </th>
                {roles.map((r) => (
                  <th key={r.id} scope="col" className="px-2 py-2 text-center font-semibold">
                    {L(r.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p} className="border-t border-brd">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {t(`admin.perm_${p.replace(/\./g, '_')}`)}
                    <code className="ml-1.5 text-[11px] text-t3">{p}</code>
                  </th>
                  {roles.map((r) => (
                    <td key={r.id} className="px-2 py-1.5 text-center">
                      {r.permissions.includes(p) ? <Check className="mx-auto size-4 text-pos" aria-label={t('common.yes')} /> : <X className="mx-auto size-3.5 text-t3" aria-label={t('common.no')} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-t3">{t('admin.rolesServerNote')}</p>
      </CardBody>
    </Card>
  );
}

/* ---------------- audit ---------------- */

interface AuditRow {
  id: string;
  createdAt: string;
  userEmail: string | null;
  action: string;
  outcome: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  details: Record<string, unknown>;
}

export function AuditSection({ initialUser }: { initialUser?: string }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [action, setAction] = useState('');
  const [user, setUser] = useState(initialUser ?? '');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setUser(initialUser ?? ''), [initialUser]);
  const params = { action: action || undefined, user: user || undefined, outcome: outcome || undefined, from: from || undefined, page, pageSize: 50 };
  const q = useApi<{ items: AuditRow[]; total: number; page: number; pageSize: number }>('/api/admin/audit', params);
  const exportCsv = async () => {
    try {
      const qs = new URLSearchParams(Object.entries({ ...params, format: 'csv' }).filter(([, v]) => v !== undefined) as Array<[string, string]>).toString();
      await download(`/api/admin/audit?${qs}`, undefined, 'audit-log.csv');
    } catch (e) {
      toast((e as Error).message, 'neg');
    }
  };
  return (
    <Card>
      <CardHeader
        title={t('admin.auditTitle')}
        subtitle={t('admin.auditHint')}
        actions={
          <Button size="sm" icon={<Download className="size-3.5" />} onClick={exportCsv}>
            {t('common.exportCsv')}
          </Button>
        }
      />
      <CardBody>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label={t('admin.actionPrefix')} htmlFor="a-act">
            <Input id="a-act" value={action} placeholder="user. / integration. / auth." onChange={(e) => (setAction(e.target.value), setPage(1))} className="h-8 w-56 text-[13px]" />
          </Field>
          <Field label={t('admin.user')} htmlFor="a-user">
            <Input id="a-user" value={user} onChange={(e) => (setUser(e.target.value), setPage(1))} className="h-8 w-56 text-[13px]" />
          </Field>
          <Field label={t('admin.outcome')} htmlFor="a-out">
            <Select id="a-out" value={outcome} onChange={(e) => (setOutcome(e.target.value), setPage(1))} className="h-8 text-[13px]">
              <option value="">{t('common.all')}</option>
              <option value="success">{t('admin.outcome_success')}</option>
              <option value="failure">{t('admin.outcome_failure')}</option>
              <option value="denied">{t('admin.outcome_denied')}</option>
            </Select>
          </Field>
          <Field label={t('admin.since')} htmlFor="a-from">
            <Input id="a-from" type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} className="h-8 text-[13px]" />
          </Field>
        </div>
        {q.isLoading ? (
          <Skeleton className="h-72" />
        ) : q.isError || !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-brd">
              <table className="w-full text-[12.5px]">
                <caption className="sr-only">{t('admin.auditTitle')}</caption>
                <thead className="bg-card2 text-left text-t2">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">{t('admin.when')}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t('admin.user')}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t('admin.action')}</th>
                    <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">{t('admin.target')}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t('admin.outcome')}</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.items.map((a) => (
                    <tr key={a.id} className="border-t border-brd align-top">
                      <td className="px-3 py-1.5 whitespace-nowrap tnum">{formatDateTime(a.createdAt, lang)}</td>
                      <td className="px-3 py-1.5">{a.userEmail ?? t('insights.system')}</td>
                      <td className="px-3 py-1.5">
                        <button type="button" className="text-left hover:underline" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
                          <code>{a.action}</code>
                        </button>
                        {open === a.id && <pre className="mt-1 max-w-[520px] overflow-x-auto rounded bg-card2 p-2 text-[11.5px] whitespace-pre-wrap">{JSON.stringify(a.details, null, 2)}</pre>}
                      </td>
                      <td className="hidden px-3 py-1.5 text-t2 md:table-cell">{a.entityType ? `${a.entityType}${a.entityId ? ` · ${a.entityId.slice(0, 36)}` : ''}` : '—'}</td>
                      <td className="px-3 py-1.5">
                        <Badge tone={a.outcome === 'success' ? 'pos' : a.outcome === 'denied' ? 'warn' : 'neg'}>{t(`admin.outcome_${a.outcome}`)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2">
              <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
            </div>
            <p className="mt-2 text-[12px] text-t3">{t('admin.auditPrivacy')}</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
