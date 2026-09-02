import { jsx as _jsx } from "react/jsx-runtime";
import { useI18n } from '/src/i18n/index.js';
import { Badge, Card } from '/src/components/ui/primitives.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';
const ENTRIES = [
    { id: 'sessions', nameKey: 'kpi.sessions', defKey: 'def.sessions', formula: 'count(session_start)', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: '#', owner: 'Analytics', refresh: { en: '15 min', fr: '15 min' }, status: 'validated' },
    { id: 'users', nameKey: 'kpi.users', defKey: 'def.users', formula: 'count(distinct user_id)', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: '#', owner: 'Analytics', refresh: { en: '15 min', fr: '15 min' }, status: 'validated' },
    { id: 'newUsers', nameKey: 'kpi.newUsers', defKey: 'def.newUsers', formula: 'count(distinct first_visit user_id)', source: { en: 'Web Analytics', fr: 'Web Analytics' }, unit: '#', owner: 'Analytics', refresh: { en: '15 min', fr: '15 min' }, status: 'validated' },
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
    { id: 'bounceRate', nameKey: 'kpi.bounceRate', defKey: 'def.bounceRate', formula: '(sessions − engaged_sessions) / sessions × 100', source: { en: 'Google Analytics 4', fr: 'Google Analytics 4' }, unit: '%', owner: 'Web Analytics', refresh: { en: '15 min', fr: '15 min' }, status: 'validated' },
    { id: 'activeAdvocates', nameKey: 'kpi.activeAdvocates', defKey: 'def.activeAdvocates', formula: 'avg(active_advocates)', source: { en: 'Employee Advocacy Platform', fr: 'Plateforme Employee Advocacy' }, unit: '#', owner: 'Employee Advocacy', refresh: { en: '3 h', fr: '3 h' }, status: 'validated' },
    { id: 'advocacyParticipation', nameKey: 'kpi.advocacyParticipation', defKey: 'def.advocacyParticipation', formula: 'active_advocates / registered_advocates × 100', source: { en: 'Employee Advocacy Platform', fr: 'Plateforme Employee Advocacy' }, unit: '%', owner: 'Employee Advocacy', refresh: { en: '3 h', fr: '3 h' }, status: 'validated' },
    { id: 'advocacyReach', nameKey: 'kpi.advocacyReach', defKey: 'def.advocacyReach', formula: 'sum(advocacy_reach)', source: { en: 'Employee Advocacy Platform', fr: 'Plateforme Employee Advocacy' }, unit: '#', owner: 'Employee Advocacy', refresh: { en: '3 h', fr: '3 h' }, status: 'draft' },
    { id: 'searchClicks', nameKey: 'kpi.searchClicks', defKey: 'def.searchClicks', formula: 'sum(search_clicks)', source: { en: 'Google Search Console', fr: 'Google Search Console' }, unit: '#', owner: 'SEO', refresh: { en: '6 h', fr: '6 h' }, status: 'validated' },
    { id: 'searchImpressions', nameKey: 'kpi.searchImpressions', defKey: 'def.searchImpressions', formula: 'sum(search_impressions)', source: { en: 'Google Search Console', fr: 'Google Search Console' }, unit: '#', owner: 'SEO', refresh: { en: '6 h', fr: '6 h' }, status: 'validated' },
    { id: 'avgPosition', nameKey: 'kpi.avgPosition', defKey: 'def.avgPosition', formula: 'sum(position × impressions) / impressions', source: { en: 'Google Search Console', fr: 'Google Search Console' }, unit: 'rank', owner: 'SEO', refresh: { en: '6 h', fr: '6 h' }, status: 'validated' },
    { id: 'rankingKeywords', nameKey: 'kpi.rankingKeywords', defKey: 'def.rankingKeywords', formula: 'count(distinct query where impressions > 0)', source: { en: 'Google Search Console', fr: 'Google Search Console' }, unit: '#', owner: 'SEO', refresh: { en: '6 h', fr: '6 h' }, status: 'draft' },
];
const STATUS_TONE = { validated: 'pos', draft: 'warn', deprecated: 'neutral' };
const STATUS_KEY = { validated: 'cat.validated', draft: 'cat.draft', deprecated: 'cat.deprecated' };
export default function KpiCataloguePage() {
    const { t, lang } = useI18n();
    const cols = [
        {
            id: 'name',
            header: t('cat.metric'),
            cell: (r) => _jsx("span", { className: "text-[12px] font-semibold text-t1", children: t(r.nameKey) }),
            sortValue: (r) => t(r.nameKey),
            searchText: (r) => `${t(r.nameKey)} ${t(r.defKey)} ${r.formula} ${r.id}`,
        },
        {
            id: 'def',
            header: t('cat.definition'),
            cell: (r) => _jsx("span", { className: "block max-w-72 text-[11.5px] leading-snug text-t2", children: t(r.defKey) }),
        },
        {
            id: 'formula',
            header: t('cat.formula'),
            cell: (r) => _jsx("code", { className: "mono rounded-[5px] border border-brd bg-inset px-1.5 py-0.5 text-[10.5px] text-acctext", children: r.formula }),
            searchText: (r) => r.formula,
        },
        { id: 'source', header: t('cat.sourceCol'), cell: (r) => _jsx(Num, { muted: true, children: r.source[lang] }), sortValue: (r) => r.source[lang] },
        { id: 'unit', header: t('cat.unit'), cell: (r) => _jsx(Num, { muted: true, children: r.unit }), sortValue: (r) => r.unit },
        { id: 'owner', header: t('cat.owner'), cell: (r) => _jsx(Num, { muted: true, children: r.owner }), sortValue: (r) => r.owner },
        { id: 'refresh', header: t('cat.refresh'), cell: (r) => _jsx(Num, { muted: true, children: r.refresh[lang] }), sortValue: (r) => r.refresh[lang] },
        { id: 'status', header: t('cat.status'), cell: (r) => _jsx(Badge, { tone: STATUS_TONE[r.status], children: t(STATUS_KEY[r.status]).toUpperCase() }), sortValue: (r) => r.status },
    ];
    return (_jsx("div", { className: "page-shell flex flex-col gap-[var(--gap-grid)]", children: _jsx(Card, { title: t('cat.title'), subtitle: t('cat.subtitle'), children: _jsx(DataTable, { columns: cols, rows: ENTRIES, rowKey: (r) => r.id, searchable: true, defaultSort: { id: 'name', dir: 'asc' }, ariaLabel: t('cat.title') }) }) }));
}
