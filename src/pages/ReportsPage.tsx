import { useMemo } from 'react';
import { Calendar, Download, FileText, Printer } from 'lucide-react';
import { useFilters } from '@/state/FiltersContext';
import { useSettings } from '@/state/SettingsContext';
import { useI18n } from '@/i18n';
import { useToast } from '@/state/ToastContext';
import { buildOverviewCsv, downloadCsv } from '@/lib/export';
import { fmtRange } from '@/lib/format';
import { Badge, Btn, Card, EmptyState } from '@/components/ui/primitives';

/** Demo report schedules — static catalogue, deliveries simulated. */
const SCHEDULES = [
  { id: 'sch-1', name: { en: 'Weekly performance digest', fr: 'Digest hebdomadaire de performance' }, freq: { en: 'Mondays 08:00', fr: 'Lundi 08:00' }, recipients: 'leadership@example.com', lastSent: { en: '3 days ago', fr: 'il y a 3 jours' }, next: { en: 'Mon 08:00', fr: 'lun. 08:00' } },
  { id: 'sch-2', name: { en: 'Monthly campaign review', fr: 'Revue mensuelle des campagnes' }, freq: { en: '1st of month', fr: 'Le 1er du mois' }, recipients: 'marketing@example.com', lastSent: { en: '24 days ago', fr: 'il y a 24 jours' }, next: { en: '1 Sep 08:00', fr: '1 sept. 08:00' } },
  { id: 'sch-3', name: { en: 'Data quality alert digest', fr: 'Digest des alertes qualité' }, freq: { en: 'Daily 07:00', fr: 'Quotidien 07:00' }, recipients: 'data-eng@example.com', lastSent: { en: '9 hours ago', fr: 'il y a 9 heures' }, next: { en: 'Tomorrow 07:00', fr: 'Demain 07:00' } },
];

export default function ReportsPage() {
  const { filters, savedViews, applyView } = useFilters();
  const { settings } = useSettings();
  const { t, lang } = useI18n();
  const { toast } = useToast();

  const generatedAt = useMemo(() => new Date(), []);

  const doExport = () => {
    const csv = buildOverviewCsv(filters, { methodology: settings.exportMethodology, comparison: settings.exportComparison });
    downloadCsv(csv, `digital-performance_${generatedAt.toISOString().slice(0, 10)}.csv`);
    toast(t('rep.exportCsv') + ' ✓');
  };

  const activeFilterSummary: string[] = [];
  if (filters.markets.length) activeFilterSummary.push(`${t('filters.market')}: ${filters.markets.join(', ').toUpperCase()}`);
  if (filters.channels.length) activeFilterSummary.push(`${t('filters.channel')}: ${filters.channels.join(', ')}`);
  if (filters.platforms.length) activeFilterSummary.push(`${t('filters.platform')}: ${filters.platforms.join(', ')}`);
  if (filters.devices.length) activeFilterSummary.push(`${t('filters.device')}: ${filters.devices.join(', ')}`);

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-5 md:p-8">
      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2">
        <Card title={t('rep.export')} subtitle={t('rep.exportSub')}>
          <dl className="m-0 mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11.5px]">
            <dt className="eyebrow text-[10px] leading-5">{t('range.dateRange')}</dt>
            <dd className="mono m-0 text-t1 tnum">{fmtRange(filters.from, filters.to, lang)}</dd>
            <dt className="eyebrow text-[10px] leading-5">{t('rep.appliedFilters')}</dt>
            <dd className="m-0 text-t2">{activeFilterSummary.length ? activeFilterSummary.join(' · ') : t('filters.all')}</dd>
            <dt className="eyebrow text-[10px] leading-5">{t('rep.generated')}</dt>
            <dd className="mono m-0 text-t2 tnum">
              {generatedAt.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" onClick={doExport}>
              <Download size={13} aria-hidden />
              {t('rep.exportCsv')}
            </Btn>
            <Btn onClick={() => window.print()}>
              <Printer size={13} aria-hidden />
              {t('rep.print')}
            </Btn>
          </div>
          <div className="mt-4 rounded-[10px] border border-brd bg-card2 p-3">
            <div className="eyebrow mb-1 text-[10px]">{t('rep.methodology')}</div>
            <p className="m-0 text-[11px] leading-relaxed text-t2">{t('rep.methodologyText')}</p>
          </div>
        </Card>

        <Card title={t('rep.saved')} subtitle={t('rep.savedSub')}>
          {savedViews.length === 0 ? (
            <EmptyState title={t('header.noViews')} body={t('header.saveView')} icon={<FileText size={20} aria-hidden />} />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {savedViews.map((v) => (
                <li key={v.id} className="flex items-center gap-3 rounded-[10px] border border-brd bg-card2 px-3 py-2.5">
                  <FileText size={14} className="shrink-0 text-t3" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-t1">{v.name}</div>
                    <div className="mono text-[11px] text-t3 tnum">
                      {fmtRange(v.filters.from, v.filters.to, lang)} · {new Date(v.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}
                    </div>
                  </div>
                  <Btn size="sm" onClick={() => applyView(v.id)}>
                    {t('rep.open')}
                  </Btn>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t('rep.scheduled')} subtitle={t('rep.scheduledSub')}>
        <div className="overflow-x-auto rounded-[10px] border border-brd">
          <table className="w-full border-collapse text-[12px]" aria-label={t('rep.scheduled')}>
            <thead>
              <tr className="bg-card2">
                {[t('cat.metric'), t('rep.frequency'), t('rep.recipients'), t('rep.lastSent'), t('rep.nextSend'), t('adm.status')].map((h) => (
                  <th key={h} scope="col" className="border-b border-brd px-3 py-2 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-t3">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCHEDULES.map((s) => (
                <tr key={s.id} className="border-b border-brd last:border-b-0">
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-t1">
                      <Calendar size={13} className="text-t3" aria-hidden />
                      {s.name[lang]}
                    </span>
                  </td>
                  <td className="mono px-3 py-2.5 text-[11px] text-t2">{s.freq[lang]}</td>
                  <td className="mono px-3 py-2.5 text-[11px] text-t2">{s.recipients}</td>
                  <td className="mono px-3 py-2.5 text-[11px] text-t3">{s.lastSent[lang]}</td>
                  <td className="mono px-3 py-2.5 text-[11px] text-t2">{s.next[lang]}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone="pos">{t('adm.active').toUpperCase()}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
