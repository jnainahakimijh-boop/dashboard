import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Lock } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, api } from '@/api/client';
import { useI18n } from '@/i18n';
import { usePrefs } from '@/state/prefs';
import { Button, Field, Input, Segmented } from '@/components/ui';

interface AuthConfig {
  demoLogin: boolean;
  demoAccounts: Array<{ role: string; email: string; name: string; scoped: boolean }>;
  sso: { configured: boolean };
  demoMode: boolean;
}

export function LoginPage() {
  const { t, lang } = useI18n();
  const { setPrefs } = usePrefs();
  const qc = useQueryClient();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/';
  const cfg = useQuery({ queryKey: ['auth-config'], queryFn: () => api.get<AuthConfig>('/api/auth/config') });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const done = async () => {
    await qc.invalidateQueries({ queryKey: ['me'] });
    nav(from, { replace: true });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('password');
    try {
      await api.send('POST', '/api/auth/login', { email, password });
      await done();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t('login.locked') : t('login.invalid'));
    } finally {
      setBusy(null);
    }
  };
  const demo = async (acct: string) => {
    setBusy(acct);
    try {
      await api.send('POST', '/api/auth/demo-login', { email: acct });
      await done();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-app lg:flex-row">
      <section className="flex flex-col justify-between bg-side px-8 py-10 text-st1 lg:w-[44%] lg:px-14">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.12em] text-st3 uppercase">{t('common.appTagline')}</p>
          <h1 className="mt-3 text-[30px] leading-tight font-semibold tracking-tight">{t('common.appName')}</h1>
          <p className="mt-4 max-w-md text-[15px] text-st2">{t('overview.subtitle')}</p>
        </div>
        <p className="mt-10 flex items-center gap-2 text-[12.5px] text-st3">
          <Lock className="size-3.5" aria-hidden />
          {t('login.footer')}
        </p>
      </section>
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex justify-end">
            <Segmented size="sm" label={t('common.language')} value={lang} onChange={(l) => setPrefs({ language: l })} options={[{ value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }]} />
          </div>
          <h2 className="text-[22px] font-semibold">{t('login.title')}</h2>
          <p className="mt-1 text-[14px] text-t2">{t('login.subtitle')}</p>
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
            <Field label={t('login.email')} htmlFor="email" required>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label={t('login.password')} htmlFor="password" required>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error && (
              <p role="alert" className="rounded-md bg-negsoft px-3 py-2 text-[13px] text-neg">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" loading={busy === 'password'} disabled={!email || !password}>
              {t('login.submit')}
            </Button>
            <Button disabled={!cfg.data?.sso.configured} title={cfg.data?.sso.configured ? undefined : t('login.ssoUnavailable')} onClick={() => (window.location.href = '/api/auth/sso/start')}>
              {t('login.sso')}
            </Button>
            {!cfg.data?.sso.configured && <p className="-mt-2 text-[12px] text-t3">{t('login.ssoUnavailable')}</p>}
          </form>
          {cfg.data?.demoLogin && cfg.data.demoAccounts.length > 0 && (
            <section className="mt-8 rounded-[var(--radius-card)] border border-warn/30 bg-warnsoft p-4" aria-labelledby="demo-title">
              <h3 id="demo-title" className="text-[14px] font-semibold text-t1">
                {t('login.demoTitle')}
              </h3>
              <p className="mt-0.5 text-[12.5px] text-t2">{t('login.demoHint')}</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {cfg.data.demoAccounts.map((a) => (
                  <li key={a.email}>
                    <button type="button" disabled={!!busy} onClick={() => demo(a.email)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-brd bg-card px-3 py-2 text-left hover:border-brds disabled:opacity-60">
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium text-t1">
                          {t(`login.role_${a.role}`)}
                          {a.scoped && <span className="ml-1.5 text-[12px] font-normal text-t3">· {t('login.scoped')}</span>}
                        </span>
                        <span className="block truncate text-[12px] text-t3">{a.email}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-t3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
