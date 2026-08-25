import { useI18n } from '@/i18n';
import { Badge, Card, type BadgeTone } from '@/components/ui/primitives';
import { DataTable, Num, type Column } from '@/components/tables/DataTable';
import type { MsgKey } from '@/i18n/messages';

interface CatalogueEntry {
  id: string;
  nameKey: MsgKey;
  defKey: MsgKey;
  formula: string;
  source: { en: string; fr: string };
  unit: string;
  owner: string;
  refresh: { en: string; fr: string };
  status: 'validated' | 'draft' | 'deprecated';
}

const ENTRIES: CatalogueEntry[] = [
  { id: 'sessions', nameKey: 'kpi.sessions', defKey: 'def.sessions', formula: 'count(session_start)', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: '#', owner: 'Analytics', refresh: { en: '15 min', fr: '15 min' }, status: 'validated' },
  { id: 'users', nameKey: 'kpi.users', defKey: 'def.users', formula: 'count(distinct user_id)', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: '#', owner: 'Analytics', refresh: { en: '15 min', fr: '15 min' }, status: 'validated' },
  { id: 'engagedSessions', nameKey: 'kpi.engagedSessions', defKey: 'def.engagedSessions', formula: 'count(sessions where engaged)', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: '#', owner: 'Analytics', refresh: { en: '15 min', fr: '15 min' }, status: 'validated' },
  { id: 'engagementRateWeb', nameKey: 'kpi.engagementRate', defKey: 'def.engagementRateWeb', formula: 'engaged_sessions / sessions × 100', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: '%', owner: 'Analytics', refresh: { en: '15 min', fr: '15 min' }, status: 'validated' },
  { id: 'avgEngTime', nameKey: 'kpi.avgEngTime', defKey: 'def.avgEngTime', formula: 'total_engagement_time / sessions', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: 's', owner: 'Analytics', refresh: { en: '15 min', fr: '15 min' }, status: 'validated' },
  { id: 'conversions', nameKey: 'kpi.conversions', defKey: 'def.conversions', formula: 'count(goal_completion)', source: { en: 'Web Analytics + CRM', fr: 'Web Analytics + CRM' }, unit: '#', owner: 'Demand Gen', refresh: { en: '1 h', fr: '1 h' }, status: 'validated' },
  { id: 'cvr', nameKey: 'kpi.cvr', defKey: 'def.cvr', formula: 'conversions / sessions × 100', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: '%', owner: 'Demand Gen', refresh: { en: '1 h', fr: '1 h' }, status: 'validated' },
  { id: 'impressions', nameKey: 'kpi.impressions', defKey: 'def.impressions', formula: 'sum(impressions)', source: { en: 'Social analytics + Paid Media', fr: 'Analytics social + Média payant' }, unit: '#', owner: 'Social', refresh: { en: '1–6 h', fr: '1–6 h' }, status: 'validated' },
  { id: 'reach', nameKey: 'kpi.reach', defKey: 'def.reach', formula: 'sum(unique_accounts_reached)', source: { en: 'Social analytics', fr: 'Analytics social' }, unit: '#', owner: 'Social', refresh: { en: '6 h', fr: '6 h' }, status: 'draft' },
  { id: 'engagementRateSocial', nameKey: 'kpi.engagementRate', defKey: 'def.engagementRateSocial', formula: 'engagements / impressions × 100', source: { en: 'Social analytics', fr: 'Analytics social' }, unit: '%', owner: 'Social', refresh: { en: '1–6 h', fr: '1–6 h' }, status: 'validated' },
  { id: 'ctr', nameKey: 'kpi.ctr', defKey: 'def.ctr', formula: 'clicks / impressions × 100', source: { en: 'Social analytics + Paid Media', fr: 'Analytics social + Média payant' }, unit: '%', owner: 'Social', refresh: { en: '1–6 h', fr: '1–6 h' }, status: 'validated' },
  { id: 'videoViews', nameKey: 'kpi.videoViews', defKey: 'def.videoViews', formula: 'count(video_view ≥ 3s)', source: { en: 'Social analytics', fr: 'Analytics social' }, unit: '#', owner: 'Social', refresh: { en: '6 h', fr: '6 h' }, status: 'validated' },
  { id: 'cpa', nameKey: 'kpi.cpa', defKey: 'def.cpa', formula: 'spend / conversions', source: { en: 'Paid Media', fr: 'Média payant' }, unit: '€', owner: 'Paid Media', refresh: { en: '3 h', fr: '3 h' }, status: 'validated' },
  { id: 'cpc', nameKey: 'kpi.cpc', defKey: 'def.clicks', formula: 'spend / clicks', source: { en: 'Paid Media', fr: 'Média payant' }, unit: '€', owner: 'Paid Media', refresh: { en: '3 h', fr: '3 h' }, status: 'validated' },
  { id: 'cpm', nameKey: 'kpi.cpm', defKey: 'def.impressions', formula: 'spend / impressions × 1000', source: { en: 'Paid Media', fr: 'Média payant' }, unit: '€', owner: 'Paid Media', refresh: { en: '3 h', fr: '3 h' }, status: 'validated' },
  { id: 'followerNet', nameKey: 'kpi.followerNet', defKey: 'def.followerNet', formula: 'follows − unfollows', source: { en: 'Social analytics', fr: 'Analytics social' }, unit: '#', owner: 'Social', refresh: { en: '24 h', fr: '24 h' }, status: 'draft' },
  { id: 'bounceRate', nameKey: 'kpi.engagementRate', defKey: 'def.engagementRateWeb', formula: '1 − engagement_rate (legacy)', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: '%', owner: 'Analytics', refresh: { en: '—', fr: '—' }, status: 'deprecated' },
];

const STATUS_TONE: Record<CatalogueEntry['status'], BadgeTone> = { validated: 'pos', draft: 'warn', deprecated: 'neutral' };
const STATUS_KEY: Record<CatalogueEntry['status'], MsgKey> = { validated: 'cat.validated', draft: 'cat.draft', deprecated: 'cat.deprecated' };

export default function KpiCataloguePage() {
  const { t, lang } = useI18n();

  const cols: Column<CatalogueEntry>[] = [
    {
      id: 'name',
      header: t('cat.metric'),
      cell: (r) => <span className="text-[12px] font-semibold text-t1">{r.id === 'bounceRate' ? (lang === 'fr' ? 'Taux de rebond' : 'Bounce rate') : t(r.nameKey)}</span>,
      sortValue: (r) => t(r.nameKey),
      searchText: (r) => `${t(r.nameKey)} ${t(r.defKey)} ${r.formula} ${r.id}`,
    },
    {
      id: 'def',
      header: t('cat.definition'),
      cell: (r) => <span className="block max-w-72 text-[11.5px] leading-snug text-t2">{t(r.defKey)}</span>,
    },
    {
      id: 'formula',
      header: t('cat.formula'),
      cell: (r) => <code className="mono rounded-[5px] border border-brd bg-inset px-1.5 py-0.5 text-[10.5px] text-acctext">{r.formula}</code>,
      searchText: (r) => r.formula,
    },
    { id: 'source', header: t('cat.sourceCol'), cell: (r) => <Num muted>{r.source[lang]}</Num>, sortValue: (r) => r.source[lang] },
    { id: 'unit', header: t('cat.unit'), cell: (r) => <Num muted>{r.unit}</Num>, sortValue: (r) => r.unit },
    { id: 'owner', header: t('cat.owner'), cell: (r) => <Num muted>{r.owner}</Num>, sortValue: (r) => r.owner },
    { id: 'refresh', header: t('cat.refresh'), cell: (r) => <Num muted>{r.refresh[lang]}</Num>, sortValue: (r) => r.refresh[lang] },
    { id: 'status', header: t('cat.status'), cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(STATUS_KEY[r.status]).toUpperCase()}</Badge>, sortValue: (r) => r.status },
  ];

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] p-4 md:p-6">
      <Card title={t('cat.title')} subtitle={t('cat.subtitle')}>
        <DataTable columns={cols} rows={ENTRIES} rowKey={(r) => r.id} searchable defaultSort={{ id: 'name', dir: 'asc' }} ariaLabel={t('cat.title')} />
      </Card>
    </div>
  );
}
