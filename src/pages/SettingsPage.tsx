import type { ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { useSettings, type Settings } from '@/state/SettingsContext';
import { useToast } from '@/state/ToastContext';
import { Card, Segmented } from '@/components/ui/primitives';
import { NAV_SECTIONS } from '@/lib/nav';

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-brd py-3 last:border-b-0">
      <div className="min-w-40">
        <div className="text-[12.5px] font-medium text-t1">{label}</div>
        {hint && <div className="mt-0.5 max-w-72 text-[10.5px] leading-snug text-t3">{hint}</div>}
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
      className={`relative h-5.5 w-10 rounded-full border transition-colors ${checked ? 'border-accbrd bg-acc' : 'border-brds bg-inset'}`}
    >
      <span
        aria-hidden
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-[left] ${checked ? 'left-[21px] bg-accink' : 'left-[3px] bg-card2 border border-brds'}`}
      />
      <span className="sr-only">{checked ? t('set.on') : t('set.off')}</span>
    </button>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const { toast } = useToast();

  const save = (patch: Partial<Settings>) => {
    update(patch);
    toast(t('set.saved'));
  };

  const selectCls = 'h-8 min-w-44 rounded-[9px] border border-brd bg-card2 px-2 text-[12px] text-t1 hover:border-brds';
  const inputCls = 'h-8 min-w-44 rounded-[9px] border border-brd bg-inset px-2.5 text-[12px] text-t1';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--gap-grid)] p-4 md:p-6">
      <Card title={t('set.profile')}>
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

      <Card title={t('set.appearance')}>
        <Row label={t('set.theme')}>
          <Segmented
            ariaLabel={t('set.theme')}
            options={[
              { id: 'dark', label: t('set.theme.dark') },
              { id: 'light', label: t('set.theme.light') },
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

      <Card title={t('set.language')}>
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

      <Card title={t('set.prefs')}>
        <Row label={t('set.defaultPage')}>
          <select className={selectCls} value={settings.defaultPage} onChange={(e) => save({ defaultPage: e.target.value })} aria-label={t('set.defaultPage')}>
            {NAV_SECTIONS.flatMap((s) => s.items).map((i) => (
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

      <Card title={t('set.notifications')}>
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

      <Card title={t('set.exports')}>
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
    </div>
  );
}
