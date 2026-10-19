import { Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '@shared/rbac';
import { api } from '@/api/client';
import { useApi, useApiMutation, useMeta } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { relativeTime } from '@/lib/format';
import { usePrefs, type Density, type Theme } from '@/state/prefs';
import { useSession } from '@/state/session';
import { PageBody, PageHeader } from '@/components/layout/AppShell';
import { Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Segmented, useToast } from '@/components/ui';

interface SavedView {
  id: string;
  name: string;
  route: string;
  state: { preset?: string; from?: string; to?: string; compare?: string; filters?: Record<string, string[]> };
  shared: boolean;
  mine: boolean;
  createdAt: string;
}

/** URL that reopens a saved view (same query parameters as the global filter bar). */
function viewUrl(v: SavedView): string {
  const q = new URLSearchParams();
  if (v.state.preset) q.set('p', v.state.preset);
  if (v.state.preset === 'custom' && v.state.from && v.state.to) {
    q.set('from', v.state.from);
    q.set('to', v.state.to);
  }
  if (v.state.compare) q.set('cmp', v.state.compare);
  for (const [k, vals] of Object.entries(v.state.filters ?? {})) if (vals.length) q.set(k, vals.join(','));
  return `${v.route}?${q.toString()}`;
}

interface Favorite {
  id: string;
  kind: string;
  ref: string;
  label: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { t, lang, L } = useI18n();
  const { me, refresh, can } = useSession();
  const meta = useMeta();
  const { prefs, setPrefs } = usePrefs();
  const toast = useToast();
  const [name, setName] = useState(me?.user.name ?? '');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState<'name' | 'pw' | null>(null);
  const views = useApi<SavedView[]>('/api/me/views');
  const favs = useApi<Favorite[]>('/api/me/favorites');
  const delView = useApiMutation<{ id: string }>('DELETE', (b) => `/api/me/views/${b.id}`, ['/api/me/views']);
  const delFav = useApiMutation<{ id: string }>('DELETE', (b) => `/api/me/favorites/${b.id}`, ['/api/me/favorites']);
  useEffect(() => setName(me?.user.name ?? ''), [me?.user.name]);
  if (!me) return null;
  const u = me.user;
  const langs = meta.data?.org.settings.supportedLanguages ?? ['fr', 'en'];
  const saveName = async () => {
    setBusy('name');
    try {
      await api.send('PATCH', '/api/auth/me', { name: name.trim() });
      await refresh();
      toast(t('common.saved'), 'pos');
    } catch (e) {
      toast((e as Error).message, 'neg');
    } finally {
      setBusy(null);
    }
  };
  const changePw = async () => {
    setBusy('pw');
    try {
      await api.send('POST', '/api/auth/password', { current: pw.current, next: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      toast(t('settings.passwordChanged'), 'pos');
    } catch (e) {
      toast((e as Error).message, 'neg');
    } finally {
      setBusy(null);
    }
  };
  const siteNames = (u.scopes.websites ?? []).map((k) => meta.data?.sites.find((s) => s.key === k)?.name ?? k);
  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} crumbs={[{ label: t('settings.title') }]} />
      <PageBody>
        <div className="grid grid-cols-1 gap-[var(--gap-grid)] xl:grid-cols-2">
          <Card>
            <CardHeader title={t('settings.profile')} />
            <CardBody>
              <div className="flex flex-col gap-3">
                <Field label={t('settings.name')} htmlFor="s-name">
                  <div className="flex gap-2">
                    <Input id="s-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
                    <Button disabled={!name.trim() || name.trim() === u.name} loading={busy === 'name'} onClick={saveName}>
                      {t('common.save')}
                    </Button>
                  </div>
                </Field>
                <dl className="grid grid-cols-1 gap-2 text-[13.5px] sm:grid-cols-2">
                  <div>
                    <dt className="text-t3">{t('settings.email')}</dt>
                    <dd>{u.email}</dd>
                  </div>
                  <div>
                    <dt className="text-t3">{t('settings.role')}</dt>
                    <dd>{L(ROLE_LABELS[u.role])}</dd>
                  </div>
                  <div>
                    <dt className="text-t3">{t('settings.scope')}</dt>
                    <dd>{siteNames.length ? siteNames.join(', ') : t('settings.allData')}</dd>
                  </div>
                  <div>
                    <dt className="text-t3">{t('settings.modules')}</dt>
                    <dd>{u.scopes.modules?.length ? u.scopes.modules.map((m) => t(`nav.${m}`)).join(', ') : t('settings.allModules')}</dd>
                  </div>
                </dl>
                <p className="text-[12px] text-t3">{t('settings.scopeHint')}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('settings.appearance')} subtitle={t('settings.appearanceHint')} />
            <CardBody>
              <div className="flex flex-col gap-4">
                {langs.length > 1 && (
                  <div>
                    <p className="mb-1 text-[13px] font-medium">{t('settings.language')}</p>
                    <Segmented
                      label={t('settings.language')}
                      value={lang}
                      onChange={(l) => {
                        setPrefs({ language: l });
                        void api.send('PATCH', '/api/auth/me', { language: l }).catch(() => {});
                      }}
                      options={langs.map((l) => ({ value: l, label: l === 'fr' ? 'Français' : 'English' }))}
                    />
                  </div>
                )}
                <div>
                  <p className="mb-1 text-[13px] font-medium">{t('settings.theme')}</p>
                  <Segmented<Theme>
                    label={t('settings.theme')}
                    value={prefs.theme}
                    onChange={(v) => setPrefs({ theme: v })}
                    options={[
                      { value: 'light', label: t('admin.themeLight') },
                      { value: 'dark', label: t('admin.themeDark') },
                      { value: 'system', label: t('admin.themeSystem') },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[13px] font-medium">{t('settings.density')}</p>
                  <Segmented<Density>
                    label={t('settings.density')}
                    value={prefs.density}
                    onChange={(v) => setPrefs({ density: v })}
                    options={[
                      { value: 'comfortable', label: t('settings.comfortable') },
                      { value: 'compact', label: t('settings.compact') },
                    ]}
                  />
                </div>
                <p className="text-[12px] text-t3">{t('settings.syncedHint')}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('settings.security')} />
            <CardBody>
              {u.hasPassword ? (
                <div className="flex flex-col gap-3">
                  <Field label={t('settings.currentPassword')} htmlFor="pw-cur">
                    <Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                  </Field>
                  <Field label={t('settings.newPassword')} htmlFor="pw-next" hint={t('settings.passwordRule')}>
                    <Input id="pw-next" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                  </Field>
                  <Field label={t('settings.confirmPassword')} htmlFor="pw-conf" error={pw.confirm && pw.confirm !== pw.next ? t('settings.passwordMismatch') : undefined}>
                    <Input id="pw-conf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                  </Field>
                  <div className="flex justify-end">
                    <Button variant="primary" disabled={!pw.current || pw.next.length < 12 || pw.next !== pw.confirm} loading={busy === 'pw'} onClick={changePw}>
                      {t('settings.changePassword')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-t2">{t('settings.noPassword')}</p>
              )}
              <p className="mt-3 text-[12px] text-t3">{t('settings.sessionHint')}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('settings.savedViews')} subtitle={t('settings.savedViewsHint')} />
            <CardBody>
              {!views.data?.length ? (
                <EmptyState title={t('common.noViews')} />
              ) : (
                <ul className="flex flex-col divide-y divide-brd text-[13.5px]">
                  {views.data.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 py-1.5">
                      <Link to={viewUrl(v)} className="min-w-0 truncate font-medium text-acctext hover:underline">
                        {v.name}
                      </Link>
                      <span className="flex items-center gap-2 text-[12px] text-t3">
                        {v.shared && t('settings.shared')} {relativeTime(v.createdAt, lang)}
                        {(v.mine || can('dashboards.edit')) && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label={`${t('common.delete')}: ${v.name}`} onClick={() => delView.mutate({ id: v.id })} />}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium">
                <Star className="size-4" aria-hidden /> {t('common.favorites')}
              </p>
              {!favs.data?.length ? (
                <p className="mt-1 text-[12.5px] text-t3">{t('settings.noFavorites')}</p>
              ) : (
                <ul className="mt-1 flex flex-col divide-y divide-brd text-[13.5px]">
                  {favs.data.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 py-1.5">
                      <Link to={f.ref.startsWith('/') ? f.ref : '/'} className="min-w-0 truncate text-acctext hover:underline">
                        {f.label}
                      </Link>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label={`${t('common.unfavorite')}: ${f.label}`} onClick={() => delFav.mutate({ id: f.id })} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
