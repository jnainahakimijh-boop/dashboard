import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Bell, Download, Globe2, LayoutDashboard, Palette, UserRound } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useSettings, type Settings } from '@/state/SettingsContext';
import { useToast } from '@/state/ToastContext';
import { Card, Segmented } from '@/components/ui/primitives';
import { NAV_BOTTOM, NAV_SECTIONS } from '@/lib/nav';
import type { MsgKey } from '@/i18n/messages';

type SectionId = 'appearance' | 'language' | 'dashboard' | 'notifications' | 'exports' | 'account';

const SECTIONS: Array<{ id: SectionId; labelKey: MsgKey; icon: typeof Palette }> = [
  { id: 'appearance', labelKey: 'set.section.appearance', icon: Palette },
  { id: 'language', labelKey: 'set.section.language', icon: Globe2 },
  { id: 'dashboard', labelKey: 'set.section.dashboard', icon: LayoutDashboard },
  { id: 'notifications', labelKey: 'set.section.notifications', icon: Bell },
  { id: 'exports', labelKey: 'set.section.exports', icon: Download },
  { id: 'account', labelKey: 'set.section.account', icon: UserRound },
];

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2.5 border-b border-brd py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="min-w-44">
        <div className="text-[13.5px] font-medium text-t1">{label}</div>
        {hint && <div className="mt-0.5 max-w-80 text-[12px] leading-snug text-t3">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full border transition-colors ${checked ? 'border-accbrd bg-acc' : 'border-brds bg-inset'}`}
    >
      <span
        aria-hidden
        className={`absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full transition-[left] ${checked ? 'left-[22px] bg-accink' : 'left-[3px] border border-brds bg-card'}`}
      />
      <span className="sr-only">{checked ? t('set.on') : t('set.off')}</span>
    </button>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const [section, setSection] = useState<SectionId>('appearance');

  const save = (patch: Partial<Settings>) => {
    update(patch);
    toast(t('set.saved'));
  };

  const selectCls = 'h-9 min-w-48 rounded-[9px] border border-brd bg-card px-2.5 text-[13px] font-medium text-t1 hover:border-brds';
  const inputCls = 'h-9 min-w-48 rounded-[9px] border border-brd bg-card px-3 text-[13px] text-t1';

  return (
    <div className="mx-auto grid w-full max-w-5xl items-start gap-[var(--gap-grid)] p-5 md:p-8 lg:grid-cols-[220px_1fr]">
      {/* Settings sub-navigation */}
      <nav aria-label={t('set.title')} className="min-w-0 max-w-full lg:sticky lg:top-[88px]">
        <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0 lg:flex-col">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={section === s.id ? 'page' : undefined}
                onClick={() => setSection(s.id)}
                className={clsx(
                  'flex w-full items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-left text-[13px] transition-colors',
                  section === s.id ? 'bg-card font-semibold text-t1 shadow-[var(--shadow-card)]' : 'text-t2 hover:bg-hov hover:text-t1',
                )}
              >
                <s.icon size={15} className={section === s.id ? 'text-acctext' : 'text-t3'} aria-hidden />
                {t(s.labelKey)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content pane */}
      <div className="min-w-0">
        {section === 'appearance' && (
          <Card title={t('set.section.appearance')}>
            <Row label={t('set.theme')}>
              <Segmented
                ariaLabel={t('set.theme')}
                options={[
                  { id: 'light', label: t('set.theme.light') },
                  { id: 'dark', label: t('set.theme.dark') },
                  { id: 'system', label: t('set.theme.system') },
                ]}
                value={settings.theme}
                onChange={(v) => save({ theme: v })}
              />
            </Row>
            <Row label={t('set.density')}>
              <Segmented
                ariaLabel={t('set.density')}
                options={[
                  { id: 'comfortable', label: t('set.density.comfortable') },
                  { id: 'compact', label: t('set.density.compact') },
                ]}
                value={settings.density}
                onChange={(v) => save({ density: v })}
              />
            </Row>
            <Row label={t('set.animations')}>
              <Toggle checked={settings.chartAnimations} onChange={(v) => save({ chartAnimations: v })} label={t('set.animations')} />
            </Row>
          </Card>
        )}

        {section === 'language' && (
          <Card title={t('set.section.language')}>
            <Row label={t('set.lang')}>
              <Segmented
                ariaLabel={t('set.lang')}
                options={[
                  { id: 'en', label: 'English' },
                  { id: 'fr', label: 'Français' },
                ]}
                value={settings.lang}
                onChange={(v) => save({ lang: v })}
              />
            </Row>
          </Card>
        )}

        {section === 'dashboard' && (
          <Card title={t('set.section.dashboard')}>
            <Row label={t('set.defaultPage')}>
              <select className={selectCls} value={settings.defaultPage} onChange={(e) => save({ defaultPage: e.target.value })} aria-label={t('set.defaultPage')}>
                {[...NAV_SECTIONS.flatMap((s) => s.items), ...NAV_BOTTOM].map((i) => (
                  <option key={i.path} value={i.path}>
                    {t(i.labelKey)}
                  </option>
                ))}
              </select>
            </Row>
            <Row label={t('set.defaultRange')}>
              <Segmented
                ariaLabel={t('set.defaultRange')}
                options={[
                  { id: '7d', label: t('range.7d') },
                  { id: '28d', label: t('range.28d') },
                  { id: '90d', label: t('range.90d') },
                ]}
                value={settings.defaultRange}
                onChange={(v) => save({ defaultRange: v })}
              />
            </Row>
          </Card>
        )}

        {section === 'notifications' && (
          <Card title={t('set.section.notifications')}>
            <Row label={t('set.notif.anomalies')}>
              <Toggle checked={settings.notifAnomalies} onChange={(v) => save({ notifAnomalies: v })} label={t('set.notif.anomalies')} />
            </Row>
            <Row label={t('set.notif.sources')}>
              <Toggle checked={settings.notifSources} onChange={(v) => save({ notifSources: v })} label={t('set.notif.sources')} />
            </Row>
            <Row label={t('set.notif.digest')}>
              <Toggle checked={settings.notifDigest} onChange={(v) => save({ notifDigest: v })} label={t('set.notif.digest')} />
            </Row>
            <Row label={t('set.notif.reports')}>
              <Toggle checked={settings.notifReports} onChange={(v) => save({ notifReports: v })} label={t('set.notif.reports')} />
            </Row>
          </Card>
        )}

        {section === 'exports' && (
          <Card title={t('set.section.exports')}>
            <Row label={t('set.exportFormat')}>
              <Segmented
                ariaLabel={t('set.exportFormat')}
                options={[
                  { id: 'csv', label: 'CSV' },
                  { id: 'xlsx', label: 'XLSX' },
                ]}
                value={settings.exportFormat}
                onChange={(v) => save({ exportFormat: v })}
              />
            </Row>
            <Row label={t('set.includeMethodology')}>
              <Toggle checked={settings.exportMethodology} onChange={(v) => save({ exportMethodology: v })} label={t('set.includeMethodology')} />
            </Row>
            <Row label={t('set.includeComparison')}>
              <Toggle checked={settings.exportComparison} onChange={(v) => save({ exportComparison: v })} label={t('set.includeComparison')} />
            </Row>
          </Card>
        )}

        {section === 'account' && (
          <Card title={t('set.section.account')}>
            <Row label={t('set.name')}>
              <input className={inputCls} value={settings.profileName} onChange={(e) => update({ profileName: e.target.value })} onBlur={() => toast(t('set.saved'))} aria-label={t('set.name')} />
            </Row>
            <Row label={t('set.role')}>
              <select className={selectCls} value={settings.profileRole} onChange={(e) => save({ profileRole: e.target.value })} aria-label={t('set.role')}>
                {['Administrator', 'Analyst', 'Editor', 'Viewer'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Row>
            <Row label={t('set.email')}>
              <input className={inputCls} type="email" value={settings.profileEmail} onChange={(e) => update({ profileEmail: e.target.value })} onBlur={() => toast(t('set.saved'))} aria-label={t('set.email')} />
            </Row>
          </Card>
        )}
      </div>
    </div>
  );
}
