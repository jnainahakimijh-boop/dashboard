import { useState, type FormEvent } from 'react';
import { BarChart3, Lock, ShieldCheck, Sparkles, User } from 'lucide-react';
import { useAuth } from '@/state/AuthContext';
import { useI18n } from '@/i18n';
import { useSettings } from '@/state/SettingsContext';
import { Btn, DemoTag } from '@/components/ui/primitives';
import type { MsgKey } from '@/i18n/messages';

const FEATURES: Array<{ icon: typeof BarChart3; titleKey: MsgKey; descKey: MsgKey }> = [
  { icon: BarChart3, titleKey: 'login.f1', descKey: 'login.f1d' },
  { icon: Sparkles, titleKey: 'login.f2', descKey: 'login.f2d' },
  { icon: ShieldCheck, titleKey: 'login.f3', descKey: 'login.f3d' },
  { icon: Lock, titleKey: 'login.f4', descKey: 'login.f4d' },
];

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!login(user, pass)) setError(true);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-app p-5" style={{ background: 'linear-gradient(160deg, var(--bg-app) 0%, var(--bg-inset) 100%)' }}>
      <div className="grid w-full max-w-[1020px] overflow-hidden rounded-[20px] border border-brd bg-card shadow-[var(--shadow-pop)] lg:grid-cols-[1.02fr_1fr]">
        {/* Brand panel — typography only, no logo */}
        <div className="relative hidden flex-col justify-between gap-10 p-10 lg:flex" style={{ background: 'linear-gradient(180deg, var(--side-bg) 0%, var(--side-bg2) 100%)' }}>
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10 bg-white/[0.03]" />
          <div>
            <div className="text-[22px] font-bold tracking-[-0.01em] text-st1">Digital Performance</div>
            <div className="mono mt-1 text-[11.5px] uppercase tracking-[0.24em] text-st3">Intelligence Platform</div>
          </div>
          <div>
            <h1 className="m-0 max-w-sm text-[30px] font-bold leading-[1.12] tracking-[-0.02em] text-st1">
              {settings.lang === 'fr' ? 'La performance digitale, gouvernée et actionnable.' : 'Digital performance, governed and actionable.'}
            </h1>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {FEATURES.map((f) => (
                <div key={f.titleKey} className="rounded-[12px] border border-sbrd bg-white/[0.04] p-3.5">
                  <f.icon size={16} className="text-acc" aria-hidden />
                  <div className="mt-2 text-[13px] font-semibold text-st1">{t(f.titleKey)}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-st2">{t(f.descKey)}</div>
                </div>
              ))}
            </div>
          </div>
          <DemoTag label={t('app.demo')} tip={t('app.demoTip')} onDark />
        </div>

        {/* Sign-in panel */}
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <div className="lg:hidden">
            <div className="text-[19px] font-bold tracking-[-0.01em] text-t1">Digital Performance</div>
            <div className="mono mt-0.5 text-[11px] uppercase tracking-[0.22em] text-t3">Intelligence Platform</div>
          </div>
          <h2 className="m-0 mt-6 text-[24px] font-bold tracking-[-0.015em] text-t1 lg:mt-0">{t('login.secure')}</h2>
          <p className="m-0 mt-1.5 text-[13.5px] text-t2">{t('login.subtitle')}</p>

          <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">{t('login.username')}</span>
              <span className="relative flex items-center">
                <User size={15} className="pointer-events-none absolute left-3 text-t3" aria-hidden />
                <input
                  value={user}
                  onChange={(e) => {
                    setUser(e.target.value);
                    setError(false);
                  }}
                  autoComplete="username"
                  className="h-11 w-full rounded-[10px] border border-brds bg-card pl-9 pr-3 text-[14px] font-medium text-t1 placeholder:text-t3"
                  placeholder="admin"
                />
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">{t('login.password')}</span>
              <span className="relative flex items-center">
                <Lock size={15} className="pointer-events-none absolute left-3 text-t3" aria-hidden />
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => {
                    setPass(e.target.value);
                    setError(false);
                  }}
                  autoComplete="current-password"
                  className="h-11 w-full rounded-[10px] border border-brds bg-card pl-9 pr-3 text-[14px] font-medium text-t1 placeholder:text-t3"
                  placeholder="admin"
                />
              </span>
            </label>

            {error && (
              <p role="alert" className="m-0 rounded-[10px] border border-neg/25 bg-negsoft px-3.5 py-2.5 text-[12.5px] font-medium text-neg">
                {t('login.error')}
              </p>
            )}

            <Btn variant="primary" type="submit" className="h-11 text-[14px]">
              {t('login.signin')}
            </Btn>
          </form>

          <div className="mt-5 flex items-center justify-between gap-3 rounded-[11px] border border-dashed border-brds bg-card2 px-3.5 py-3">
            <div>
              <div className="text-[12.5px] font-semibold text-t1">{t('login.demo')}</div>
              <div className="mono mt-0.5 text-[11px] text-t2">{t('login.demoCreds')}</div>
            </div>
            <Btn
              size="sm"
              onClick={() => {
                setUser('admin');
                setPass('admin');
                setError(false);
              }}
            >
              {t('login.fill')}
            </Btn>
          </div>

          <p className="m-0 mt-5 text-[11.5px] leading-relaxed text-t3">{t('login.sso')}</p>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => update({ lang: 'en' })}
              aria-pressed={settings.lang === 'en'}
              className={`rounded-[7px] px-2 py-1 text-[11.5px] font-medium ${settings.lang === 'en' ? 'bg-act text-t1' : 'text-t3 hover:text-t1'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => update({ lang: 'fr' })}
              aria-pressed={settings.lang === 'fr'}
              className={`rounded-[7px] px-2 py-1 text-[11.5px] font-medium ${settings.lang === 'fr' ? 'bg-act text-t1' : 'text-t3 hover:text-t1'}`}
            >
              Français
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
