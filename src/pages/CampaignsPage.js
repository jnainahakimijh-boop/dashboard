import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { MARKETS, THEMES } from '/src/data/dimensions.js';
import { CAMPAIGN_DEFS } from '/src/data/campaigns.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { campaignBy, campaignTotals, comparisonQ, toQ } from '/src/lib/aggregate.js';
import { cpa, cpc, cpm, ctr, cvr, deltaAbs, deltaRate, ratio, relChange } from '/src/lib/metrics.js';
import { dataset } from '/src/data/index.js';
import { fmtCompact, fmtDayFull, fmtEur, fmtInt, fmtPct, fmtRelDelta } from '/src/lib/format.js';
import { KpiCard } from '/src/components/kpi/KpiCard.js';
import { TrendChart } from '/src/components/charts/TrendChart.js';
import { FunnelSteps } from '/src/components/charts/FunnelSteps.js';
import { RankedList } from '/src/components/charts/RankedList.js';
import { Badge, Card, EmptyState, InfoTip, MiniBar, SectionHeading, Segmented, StatTile } from '/src/components/ui/primitives.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';
const STATUS_TONE = {
    active: 'pos',
    completed: 'info',
    paused: 'warn',
    planned: 'neutral',
};
function overlapBudget(def, range) {
    const from = Math.max(range.from, def.startD);
    const to = Math.min(range.to, def.endD);
    if (to < from)
        return 0;
    return (to - from + 1) * def.dailyBudget;
}
function neutralAbs(current, previous) {
    return { value: relChange(current, previous), kind: 'rel', sentiment: 0 };
}
export default function CampaignsPage() {
    const { filters } = useFilters();
    const { t, lang } = useI18n();
    const [params, setParams] = useSearchParams();
    const [trendMetric, setTrendMetric] = useState('spend');
    const q = useMemo(() => toQ(filters), [filters]);
    const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
    const showCompare = filters.compare !== 'none';
    const now = campaignTotals(q);
    const prev = campaignTotals(p);
    const byCampaign = campaignBy(q, 'campaign');
    const byCampaignPrev = campaignBy(p, 'campaign');
    const filteredDefs = CAMPAIGN_DEFS.filter((c) => {
        if (filters.campaigns.length > 0 && !filters.campaigns.includes(c.id))
            return false;
        if (filters.themes.length > 0 && !filters.themes.includes(c.theme))
            return false;
        if (filters.markets.length > 0 && !c.markets.some((m) => filters.markets.includes(m)))
            return false;
        return true;
    });
    const rows = filteredDefs.map((def) => ({ def, t: byCampaign.get(def.id) ?? null }));
    const delivered = rows.filter((r) => r.t && (r.t.impressions > 0 || r.t.spend > 0));
    const plannedBudget = filteredDefs.reduce((sum, def) => sum + overlapBudget(def, q), 0);
    const budgetPacing = ratio(now.spend, plannedBudget);
    const onTargetRows = delivered.filter((r) => {
        const actual = cpa(r.t.spend, r.t.conversions);
        return actual !== null && actual <= r.def.targetCpa;
    });
    const targetAttainment = delivered.length ? (onTargetRows.length / delivered.length) * 100 : null;
    const prevDelivered = filteredDefs.map((def) => ({ def, t: byCampaignPrev.get(def.id) ?? null })).filter((r) => r.t && (r.t.impressions > 0 || r.t.spend > 0));
    const prevOnTarget = prevDelivered.filter((r) => {
        const actual = cpa(r.t.spend, r.t.conversions);
        return actual !== null && actual <= r.def.targetCpa;
    });
    const prevTargetAttainment = prevDelivered.length ? (prevOnTarget.length / prevDelivered.length) * 100 : null;
    const statusCounts = filteredDefs.reduce((acc, d) => {
        acc[d.status] = (acc[d.status] ?? 0) + 1;
        return acc;
    }, {});
    const dayMap = campaignBy(q, 'day');
    const prevDayMap = campaignBy(p, 'day');
    const trendValue = (w) => {
        if (!w)
            return null;
        if (trendMetric === 'spend')
            return w.spend;
        if (trendMetric === 'clicks')
            return w.clicks;
        if (trendMetric === 'conversions')
            return w.conversions;
        if (trendMetric === 'cpa')
            return cpa(w.spend, w.conversions);
        return null;
    };
    const trendPoints = [];
    for (let i = 0; i <= q.to - q.from; i++) {
        const d = q.from + i;
        const pd = p.from + i;
        trendPoints.push({ d, value: trendValue(dayMap.get(d)), prev: pd <= p.to ? trendValue(prevDayMap.get(pd)) : null, prevD: pd <= p.to ? pd : null });
    }
    const spendRanking = [...delivered].sort((a, b) => b.t.spend - a.t.spend).map((r) => ({
        id: r.def.id,
        label: r.def.name,
        sub: r.def.owner,
        value: r.t.spend,
        valueLabel: fmtEur(r.t.spend, lang),
        share: now.spend > 0 ? (r.t.spend / now.spend) * 100 : null,
    }));
    const efficiencyRows = delivered.map((r) => {
        const actual = cpa(r.t.spend, r.t.conversions);
        const variance = actual === null ? null : relChange(actual, r.def.targetCpa);
        const efficiency = actual === null ? null : ratio(r.def.targetCpa, actual);
        return { ...r, actual, variance, efficiency };
    }).filter((r) => r.actual !== null).sort((a, b) => (b.variance ?? -999) - (a.variance ?? -999));
    const detailId = params.get('detail');
    const detail = detailId ? rows.find((r) => r.def.id === detailId) ?? CAMPAIGN_DEFS.filter((c) => c.id === detailId).map((def) => ({ def, t: byCampaign.get(def.id) ?? null }))[0] : undefined;
    const openDetail = (id) => setParams((prevParams) => {
        const p2 = new URLSearchParams(prevParams);
        p2.set('detail', id);
        return p2;
    }, { replace: true });
    const closeDetail = () => setParams((prevParams) => {
        const p2 = new URLSearchParams(prevParams);
        p2.delete('detail');
        return p2;
    }, { replace: true });
    const statusKey = (s) => `cmp.status.${s}`;
    const cols = [
        {
            id: 'name',
            header: t('filters.campaign'),
            cell: (r) => (_jsx("span", { className: "block max-w-52 truncate text-[12px] font-medium text-t1", title: r.def.name, children: r.def.name })),
            sortValue: (r) => r.def.name,
            searchText: (r) => r.def.name,
        },
        { id: 'status', header: t('adm.status'), cell: (r) => _jsx(Badge, { tone: STATUS_TONE[r.def.status], children: t(statusKey(r.def.status)).toUpperCase() }), sortValue: (r) => r.def.status },
        {
            id: 'period',
            header: t('cmp.period'),
            cell: (r) => _jsx(Num, { muted: true, children: `${fmtDayFull(r.def.startD, lang)} – ${r.def.endD > 223 ? '…' : fmtDayFull(r.def.endD, lang)}` }),
            sortValue: (r) => r.def.startD,
        },
        { id: 'imp', header: t('kpi.impressions'), align: 'right', sortValue: (r) => r.t?.impressions ?? null, cell: (r) => _jsx(Num, { children: r.t ? fmtCompact(r.t.impressions, lang) : '—' }) },
        { id: 'clicks', header: t('kpi.clicks'), align: 'right', sortValue: (r) => r.t?.clicks ?? null, cell: (r) => _jsx(Num, { children: r.t ? fmtCompact(r.t.clicks, lang) : '—' }) },
        { id: 'ctr', header: t('kpi.ctr'), align: 'right', sortValue: (r) => (r.t ? ctr(r.t.clicks, r.t.impressions) : null), cell: (r) => _jsx(Num, { children: r.t ? fmtPct(ctr(r.t.clicks, r.t.impressions), lang) : '—' }) },
        { id: 'sessions', header: t('kpi.sessions'), align: 'right', sortValue: (r) => r.t?.sessions ?? null, cell: (r) => _jsx(Num, { children: r.t ? fmtCompact(r.t.sessions, lang) : '—' }) },
        { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.t?.conversions ?? null, cell: (r) => _jsx(Num, { children: r.t ? fmtInt(r.t.conversions, lang) : '—' }) },
        { id: 'cvr', header: t('kpi.cvr'), align: 'right', sortValue: (r) => (r.t ? cvr(r.t.conversions, r.t.sessions) : null), cell: (r) => _jsx(Num, { children: r.t ? fmtPct(cvr(r.t.conversions, r.t.sessions), lang) : '—' }) },
        { id: 'spend', header: t('kpi.spend'), align: 'right', sortValue: (r) => r.t?.spend ?? null, cell: (r) => _jsx(Num, { children: r.t ? fmtEur(r.t.spend, lang) : '—' }) },
        {
            id: 'cpa',
            header: t('kpi.cpa'),
            align: 'right',
            sortValue: (r) => (r.t ? cpa(r.t.spend, r.t.conversions) : null),
            cell: (r) => {
                if (!r.t)
                    return _jsx(Num, { muted: true, children: "—" });
                const v = cpa(r.t.spend, r.t.conversions);
                return v === null ? (_jsx("span", { title: t('cmp.cpaNoConv'), children: _jsx(Num, { muted: true, children: "—" }) })) : (_jsx(Num, { strong: true, children: fmtEur(v, lang) }));
            },
        },
        {
            id: 'target',
            header: t('cmp.vsTarget'),
            align: 'right',
            headerTitle: `${t('cmp.targetCpa')} — CPA vs target`,
            sortValue: (r) => {
                if (!r.t)
                    return null;
                const v = cpa(r.t.spend, r.t.conversions);
                return v === null ? null : relChange(v, r.def.targetCpa);
            },
            cell: (r) => {
                if (!r.t)
                    return _jsx(Num, { muted: true, children: "—" });
                const v = cpa(r.t.spend, r.t.conversions);
                if (v === null)
                    return _jsx(Num, { muted: true, children: "—" });
                const d = relChange(v, r.def.targetCpa);
                if (d === null)
                    return _jsx(Num, { muted: true, children: "—" });
                const over = d > 5;
                const under = d < -5;
                return (_jsx(Badge, { tone: over ? 'neg' : under ? 'pos' : 'neutral', title: `${t('cmp.targetCpa')}: ${fmtEur(r.def.targetCpa, lang)}`, children: fmtRelDelta(d, lang) }));
            },
        },
    ];
    const kpiCards = [
        { id: 'spend', label: t('kpi.spend'), def: lang === 'fr' ? 'Dépenses média cumulées des campagnes livrées sur la période sélectionnée.' : 'Cumulative media spend for campaigns delivered in the selected period.', value: fmtEur(now.spend, lang), prev: fmtEur(prev.spend, lang), delta: neutralAbs(now.spend, prev.spend) },
        { id: 'impressions', label: t('kpi.impressions'), def: lang === 'fr' ? 'Nombre total d’impressions générées par les campagnes.' : 'Total impressions generated by campaigns.', value: fmtCompact(now.impressions, lang), prev: fmtCompact(prev.impressions, lang), delta: deltaAbs(now.impressions, prev.impressions, true) },
        { id: 'clicks', label: t('kpi.clicks'), def: lang === 'fr' ? 'Clics générés par les campagnes sur la période.' : 'Clicks generated by campaigns in the selected period.', value: fmtCompact(now.clicks, lang), prev: fmtCompact(prev.clicks, lang), delta: deltaAbs(now.clicks, prev.clicks, true) },
        { id: 'ctr', label: t('kpi.ctr'), def: lang === 'fr' ? 'Clics ÷ impressions × 100.' : 'Clicks ÷ impressions × 100.', value: fmtPct(ctr(now.clicks, now.impressions), lang), prev: fmtPct(ctr(prev.clicks, prev.impressions), lang), delta: deltaRate(ctr(now.clicks, now.impressions), ctr(prev.clicks, prev.impressions), true) },
        { id: 'sessions', label: t('kpi.sessions'), def: lang === 'fr' ? 'Sessions web attribuées aux campagnes via les paramètres de tracking.' : 'Website sessions attributed to campaigns through tracking parameters.', value: fmtCompact(now.sessions, lang), prev: fmtCompact(prev.sessions, lang), delta: deltaAbs(now.sessions, prev.sessions, true) },
        { id: 'conversions', label: t('kpi.conversions'), def: lang === 'fr' ? 'Conversions attribuées aux campagnes sur la période.' : 'Conversions attributed to campaigns in the selected period.', value: fmtCompact(now.conversions, lang), prev: fmtCompact(prev.conversions, lang), delta: deltaAbs(now.conversions, prev.conversions, true) },
        { id: 'cpa', label: t('kpi.cpa'), def: lang === 'fr' ? 'Dépenses ÷ conversions. Plus bas est généralement plus efficient.' : 'Spend ÷ conversions. Lower is generally more efficient.', value: fmtEur(cpa(now.spend, now.conversions), lang), prev: fmtEur(cpa(prev.spend, prev.conversions), lang), delta: deltaAbs(cpa(now.spend, now.conversions), cpa(prev.spend, prev.conversions), false) },
    ];
    return (_jsxs("div", { className: "page-shell flex flex-col gap-4", children: [
        _jsx(SectionHeading, { step: 1, title: lang === 'fr' ? 'Ce qui se passe' : 'What is happening', description: lang === 'fr' ? 'Diffusion, efficacité et coût du portefeuille de campagnes sur la période.' : 'Delivery, efficiency and cost of the campaign portfolio over the period.' }),
        _jsx("div", { className: "grid gap-[var(--gap-grid)] sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7", children: kpiCards.map((k) => _jsx(KpiCard, { label: k.label, definition: k.def, value: k.value, prevValue: k.prev, delta: showCompare ? k.delta : undefined, compareLabel: showCompare ? t('compare.short') : undefined, compareLabelFull: showCompare ? t('compare.label') : undefined, href: k.id === 'conversions' ? '/campaigns#campaign-funnel' : '/campaigns#campaign-trend', lang: lang }, k.id)) }),
        _jsx(SectionHeading, { step: 2, className: "mt-3", title: lang === 'fr' ? 'Comment cela évolue' : 'How it is evolving', description: lang === 'fr' ? 'Une métrique de diffusion ou d\u2019efficacité à la fois, avec la période de comparaison.' : 'One delivery or efficiency metric at a time, against the comparison period.' }),
        _jsx(Card, { id: "campaign-trend", title: lang === 'fr' ? 'Tendance de performance des campagnes' : 'Campaign performance trend', subtitle: lang === 'fr' ? 'Évolution quotidienne de la diffusion et de l’efficacité sur la période sélectionnée.' : 'Daily delivery and efficiency trend across the selected period.', right: _jsx(Segmented, { ariaLabel: lang === 'fr' ? 'Métrique de tendance campagne' : 'Campaign trend metric', size: "sm", options: [
            { id: 'spend', label: t('kpi.spend') },
            { id: 'clicks', label: t('kpi.clicks') },
            { id: 'conversions', label: t('kpi.conversions') },
            { id: 'cpa', label: t('kpi.cpa') },
        ], value: trendMetric, onChange: setTrendMetric }), children: now.impressions > 0 ? _jsx(TrendChart, { points: trendPoints, format: (v) => trendMetric === 'spend' || trendMetric === 'cpa' ? fmtEur(v, lang) : fmtInt(v, lang), metricLabel: trendMetric === 'spend' ? t('kpi.spend') : trendMetric === 'clicks' ? t('kpi.clicks') : trendMetric === 'conversions' ? t('kpi.conversions') : t('kpi.cpa'), deltaKind: "rel", showCompare: showCompare, lang: lang, height: 255, description: lang === 'fr' ? 'Tendance de performance des campagnes' : 'Campaign performance trend' }) : _jsx(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }) }),
        _jsx(SectionHeading, { step: 3, className: "mt-3", title: lang === 'fr' ? 'Où va le budget' : 'Where the budget goes', description: lang === 'fr' ? 'Répartition des dépenses, puis écart au CPA cible campagne par campagne.' : 'Spend allocation, then the gap to target CPA campaign by campaign.' }),
        _jsxs("div", { className: "grid gap-[var(--gap-grid)] xl:grid-cols-2", children: [
            _jsx(Card, { title: lang === 'fr' ? 'Répartition des dépenses par campagne' : 'Spend allocation by campaign', subtitle: lang === 'fr' ? 'Part des dépenses de la période par campagne ayant effectivement livré.' : 'Share of selected-period spend by campaigns with delivery.', children: spendRanking.length ? _jsxs("div", { children: [
                _jsx(RankedList, { rows: spendRanking, lang: lang, ariaLabel: lang === 'fr' ? 'Classement des dépenses par campagne' : 'Campaign spend ranking' }),
                _jsx("div", { className: "mt-4 grid grid-cols-2 gap-2 border-t border-brd pt-4 sm:grid-cols-4", children: [
                    { label: t('kpi.spend'), value: fmtEur(now.spend, lang), hint: lang === 'fr' ? 'Sur la période' : 'In the period' },
                    { label: lang === 'fr' ? 'Budget théorique' : 'Planned budget', value: fmtEur(plannedBudget, lang), hint: lang === 'fr' ? 'Budgets quotidiens × jours' : 'Daily budgets × days' },
                    { label: t('kpi.cpc'), value: fmtEur(cpc(now.spend, now.clicks), lang), hint: lang === 'fr' ? 'Coût par clic' : 'Cost per click' },
                    { label: t('kpi.cpm'), value: fmtEur(cpm(now.spend, now.impressions), lang), hint: lang === 'fr' ? 'Coût pour mille' : 'Cost per thousand' },
                ].map((tile) => _jsx(StatTile, { label: tile.label, value: tile.value, hint: tile.hint }, tile.label)) })
            ] }) : _jsx(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }) }),
            _jsx(Card, { title: lang === 'fr' ? 'CPA vs objectif' : 'CPA vs target', subtitle: lang === 'fr' ? 'Les campagnes au-dessus de l’objectif nécessitent une investigation créative, ciblage ou landing page.' : 'Campaigns above target require investigation across creative, targeting or landing-page performance.', children: efficiencyRows.length ? _jsx("div", { className: "flex flex-col gap-3", children: efficiencyRows.map((r) => {
                const tone = r.variance > 5 ? 'neg' : r.variance < -5 ? 'pos' : 'neutral';
                const efficiencyPct = r.efficiency === null ? 0 : Math.min(100, r.efficiency * 100);
                return _jsxs("div", { className: "rounded-[6px] border border-brd bg-card2 p-3", children: [
                    _jsxs("div", { className: "mb-2 flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate text-[12px] font-semibold text-t1", title: r.def.name, children: r.def.name }), _jsxs("div", { className: "mono mt-0.5 text-[10.5px] text-t3", children: [lang === 'fr' ? 'Réel' : 'Actual', " ", fmtEur(r.actual, lang), " · ", lang === 'fr' ? 'Objectif' : 'Target', " ", fmtEur(r.def.targetCpa, lang)] })] }), _jsx(Badge, { tone: tone, children: fmtRelDelta(r.variance, lang) })] }),
                    _jsx(MiniBar, { pct: efficiencyPct, color: tone === 'neg' ? 'var(--ch-3)' : 'var(--ch-6)' })
                ] }, r.def.id);
            }) }) : _jsx(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }) })
        ] }),
        _jsx(SectionHeading, { step: 4, className: "mt-3", title: lang === 'fr' ? 'Pourquoi cela se passe' : 'Why it is happening', description: lang === 'fr' ? 'Le funnel de campagne et la santé globale du portefeuille : rythme budgétaire, atteinte des objectifs et statuts.' : 'The campaign funnel and overall portfolio health: budget pacing, target attainment and status mix.' }),
        _jsxs("div", { className: "grid gap-[var(--gap-grid)] xl:grid-cols-[1.15fr_.85fr]", children: [
            _jsxs(Card, { id: "campaign-funnel", title: lang === 'fr' ? 'Funnel de conversion des campagnes' : 'Campaign conversion funnel', subtitle: lang === 'fr' ? 'De l’impression à la conversion, avec les taux entre chaque étape.' : 'From impression to conversion, including step-to-step rates.', children: [now.impressions > 0 ? _jsx(FunnelSteps, { stages: [
                { id: 'imp', label: t('kpi.impressions'), value: now.impressions },
                { id: 'clicks', label: t('kpi.clicks'), value: now.clicks },
                { id: 'sessions', label: t('kpi.sessions'), value: now.sessions },
                { id: 'conv', label: t('kpi.conversions'), value: now.conversions },
            ], lang: lang, ariaLabel: lang === 'fr' ? 'Funnel de conversion des campagnes' : 'Campaign conversion funnel' }) : _jsx(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }), now.impressions > 0 && _jsx("div", { className: "mt-4 grid grid-cols-2 gap-2 border-t border-brd pt-4 sm:grid-cols-4", children: [
                { label: lang === 'fr' ? 'Coût par 1 000 impressions' : 'Cost per 1,000 impressions', value: fmtEur(cpm(now.spend, now.impressions), lang) },
                { label: lang === 'fr' ? 'Coût par clic' : 'Cost per click', value: fmtEur(cpc(now.spend, now.clicks), lang) },
                { label: lang === 'fr' ? 'Coût par session' : 'Cost per session', value: fmtEur(ratio(now.spend, now.sessions), lang) },
                { label: lang === 'fr' ? 'Coût par conversion' : 'Cost per conversion', value: fmtEur(cpa(now.spend, now.conversions), lang) },
            ].map((tile) => _jsx(StatTile, { label: tile.label, value: tile.value }, tile.label)) })] }),
            _jsx(Card, { title: lang === 'fr' ? 'Santé du portefeuille campagnes' : 'Campaign portfolio health', subtitle: lang === 'fr' ? 'Rythme budgétaire, efficacité et statut du portefeuille sélectionné.' : 'Budget pacing, efficiency and status of the selected campaign portfolio.', children: _jsxs("div", { className: "flex flex-col gap-3", children: [
                _jsxs("div", { className: "grid grid-cols-2 gap-2.5", children: [
                    _jsxs("div", { className: "rounded-[6px] border border-brd bg-card2 p-3", children: [_jsx("div", { className: "eyebrow text-[10.5px]", children: lang === 'fr' ? 'Campagnes avec diffusion' : 'Campaigns with delivery' }), _jsx("div", { className: "mono mt-1 text-[20px] font-semibold text-t1", children: fmtInt(delivered.length, lang) })] }),
                    _jsxs("div", { className: "rounded-[6px] border border-brd bg-card2 p-3", children: [_jsx("div", { className: "eyebrow text-[10.5px]", children: lang === 'fr' ? 'Dans l’objectif CPA' : 'Within CPA target' }), _jsx("div", { className: "mono mt-1 text-[20px] font-semibold text-t1", children: targetAttainment === null ? '—' : fmtPct(targetAttainment, lang) }), showCompare && prevTargetAttainment !== null && _jsx("div", { className: "mono mt-0.5 text-[10.5px] text-t3", children: `${t('compare.short')} · ${fmtPct(prevTargetAttainment, lang)}` })] })
                ] }),
                _jsxs("div", { className: "rounded-[6px] border border-brd bg-card2 p-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-[12px] font-medium text-t1", children: lang === 'fr' ? 'Rythme budgétaire' : 'Budget pacing' }), _jsx("span", { className: "mono text-[12px] font-semibold text-t1", children: budgetPacing === null ? '—' : fmtPct(budgetPacing * 100, lang) })] }), _jsx(MiniBar, { pct: budgetPacing === null ? 0 : budgetPacing * 100, color: budgetPacing !== null && budgetPacing > 1.08 ? 'var(--ch-3)' : 'var(--ch-1)' }), _jsxs("div", { className: "mono mt-1.5 text-[10.5px] text-t3", children: [lang === 'fr' ? 'Dépenses' : 'Spend', " ", fmtEur(now.spend, lang), " · ", lang === 'fr' ? 'Budget théorique' : 'Planned budget', " ", fmtEur(plannedBudget, lang)] })] }),
                _jsxs("div", { className: "grid grid-cols-2 gap-2.5", children: [
                    _jsxs("div", { className: "rounded-[6px] border border-brd bg-card2 p-3", children: [_jsx("div", { className: "eyebrow text-[10.5px]", children: t('kpi.cvr') }), _jsx("div", { className: "mono mt-1 text-[16px] font-semibold text-t1", children: fmtPct(cvr(now.conversions, now.sessions), lang) })] }),
                    _jsxs("div", { className: "rounded-[6px] border border-brd bg-card2 p-3", children: [_jsx("div", { className: "eyebrow text-[10.5px]", children: t('kpi.cpc') }), _jsx("div", { className: "mono mt-1 text-[16px] font-semibold text-t1", children: fmtEur(cpc(now.spend, now.clicks), lang) })] })
                ] }),
                _jsx("div", { className: "flex flex-wrap gap-1.5", children: ['active', 'completed', 'paused', 'planned'].map((s) => _jsxs(Badge, { tone: STATUS_TONE[s], children: [t(statusKey(s)), " · ", fmtInt(statusCounts[s] ?? 0, lang)] }, s)) })
            ] }) })
        ] }),
        _jsx(SectionHeading, { step: 5, className: "mt-3", title: lang === 'fr' ? 'Détail opérationnel' : 'Operational detail', description: lang === 'fr' ? 'La couche détaillée, à ouvrir une fois la lecture d\u2019ensemble faite. Cliquez sur une ligne pour ouvrir l\u2019analyse de campagne.' : 'The detailed layer, opened once the overall read is done. Select a row to open the campaign analysis drawer.' }),
        _jsx(Card, { title: t('cmp.table'), subtitle: lang === 'fr' ? 'Détail campagne par campagne — tri, recherche et ouverture du panneau d’analyse.' : 'Campaign-by-campaign detail — sort, search and open the analysis drawer.', children: rows.length > 0 ? (_jsx(DataTable, { columns: cols, rows: rows, rowKey: (r) => r.def.id, defaultSort: { id: 'spend', dir: 'desc' }, searchable: true, onRowClick: (r) => openDetail(r.def.id), ariaLabel: t('cmp.table') })) : (_jsx(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })) }),
        detail && _jsx(CampaignDrawer, { row: detail, q: q, onClose: closeDetail })
    ] }));
}
function CampaignDrawer({ row, q, onClose }) {
    const { t, lang } = useI18n();
    const ref = useRef(null);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        ref.current?.focus();
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    const { def } = row;
    const facts = useMemo(() => dataset.campaignFacts.filter((f) => f.campaign === def.id && f.d >= q.from && f.d <= q.to), [def.id, q]);
    const tot = row.t;
    const points = useMemo(() => {
        const map = new Map(facts.map((f) => [f.d, f]));
        const out = [];
        for (let d = q.from; d <= q.to; d++) {
            const f = map.get(d);
            const inFlight = d >= def.startD && d <= def.endD;
            out.push({ d, value: f ? f.clicks : inFlight ? 0 : null, prev: null, prevD: null });
        }
        return out;
    }, [facts, q, def]);
    const statusKey = (`cmp.status.${def.status}`);
    const theme = THEMES.find((th) => th.id === def.theme);
    const cpaV = tot ? cpa(tot.spend, tot.conversions) : null;
    const planned = overlapBudget(def, q);
    const pacing = tot ? ratio(tot.spend, planned) : null;
    return (_jsxs("div", { className: "fixed inset-0 z-[70]", children: [_jsx("div", { className: "absolute inset-0 bg-black/55", onMouseDown: onClose, "aria-hidden": true }), _jsxs("div", { ref: ref, role: "dialog", "aria-modal": "true", "aria-label": `${t('cmp.detail')}: ${def.name}`, tabIndex: -1, className: "drawer-in absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto border-l border-brd bg-app p-5 outline-none", children: [_jsxs("div", { className: "mb-4 flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow text-[10.5px]", children: t('cmp.detail') }), _jsx("h2", { className: "m-0 mt-0.5 text-[16px] font-semibold text-t1", children: def.name }), _jsxs("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", children: [_jsx(Badge, { tone: def.status === 'active' ? 'pos' : def.status === 'paused' ? 'warn' : def.status === 'planned' ? 'neutral' : 'info', children: t(statusKey).toUpperCase() }), _jsxs("span", { className: "mono text-[11px] text-t3", children: [fmtDayFull(def.startD, lang), " – ", def.endD > 223 ? '…' : fmtDayFull(def.endD, lang), " · ", def.owner, " · ", lang === 'fr' ? theme?.nameFr : theme?.name] })] })] }), _jsx("button", { type: "button", "aria-label": t('misc.close'), onClick: onClose, className: "rounded-[6px] border border-brd p-1.5 text-t2 hover:bg-hov", children: _jsx(X, { size: 15, "aria-hidden": true }) })] }), !tot ? (_jsx(EmptyState, { title: t('cmp.noDelivery'), body: t('state.empty.body') })) : (_jsxs("div", { className: "flex flex-col gap-[var(--gap-grid)]", children: [_jsx("div", { className: "grid grid-cols-2 gap-2.5 sm:grid-cols-3", children: [
                                    { label: t('kpi.spend'), v: fmtEur(tot.spend, lang) },
                                    { label: lang === 'fr' ? 'Budget théorique' : 'Planned budget', v: fmtEur(planned, lang) },
                                    { label: lang === 'fr' ? 'Rythme budgétaire' : 'Budget pacing', v: pacing === null ? '—' : fmtPct(pacing * 100, lang) },
                                    { label: t('kpi.impressions'), v: fmtCompact(tot.impressions, lang) },
                                    { label: t('kpi.clicks'), v: fmtCompact(tot.clicks, lang) },
                                    { label: t('kpi.ctr'), v: fmtPct(ctr(tot.clicks, tot.impressions), lang) },
                                    { label: t('kpi.cpc'), v: fmtEur(cpc(tot.spend, tot.clicks), lang) },
                                    { label: t('kpi.cpm'), v: fmtEur(cpm(tot.spend, tot.impressions), lang) },
                                    { label: t('kpi.conversions'), v: fmtInt(tot.conversions, lang) },
                                    { label: t('kpi.cvr'), v: fmtPct(cvr(tot.conversions, tot.sessions), lang) },
                                    {
                                        label: `${t('kpi.cpa')} / ${t('misc.target').toLowerCase()}`,
                                        v: cpaV === null ? '—' : `${fmtEur(cpaV, lang)} / ${fmtEur(def.targetCpa, lang)}`,
                                        title: cpaV === null ? t('cmp.cpaNoConv') : undefined,
                                    },
                                ].map((kv) => (_jsxs("div", { className: "rounded-[6px] border border-brd bg-card p-2.5", title: kv.title, children: [_jsx("div", { className: "eyebrow text-[10.5px]", children: kv.label }), _jsx("div", { className: "mono mt-1 text-[15px] font-semibold text-t1 tnum", children: kv.v })] }, kv.label))) }), _jsx(Card, { title: t('cmp.trend'), subtitle: `${t('kpi.clicks')} ${t('misc.perDay')}`, children: _jsx(TrendChart, { points: points, format: (v) => fmtInt(v, lang), metricLabel: t('kpi.clicks'), deltaKind: "rel", showCompare: false, lang: lang, height: 180, description: `${def.name} — ${t('kpi.clicks')}` }) }), _jsx(Card, { title: t('cmp.funnel'), subtitle: t('ov.funnelSub'), children: _jsx(FunnelSteps, { stages: [
                                        { id: 'imp', label: t('kpi.impressions'), value: tot.impressions },
                                        { id: 'clicks', label: t('kpi.clicks'), value: tot.clicks },
                                        { id: 'sessions', label: t('kpi.sessions'), value: tot.sessions },
                                        { id: 'conv', label: t('kpi.conversions'), value: tot.conversions },
                                    ], lang: lang, ariaLabel: `${def.name} — ${t('cmp.funnel')}` }) }), _jsxs(Card, { title: t('cmp.markets'), children: [_jsx("div", { className: "flex flex-wrap gap-1.5", children: def.markets.map((m) => {
                                            const mk = MARKETS.find((x) => x.id === m);
                                            return (_jsx(Badge, { tone: "neutral", children: (lang === 'fr' ? mk?.nameFr : mk?.name) ?? m }, m));
                                        }) }), _jsxs("p", { className: "m-0 mt-2.5 text-[11px] leading-snug text-t3", children: [_jsx(InfoTip, { text: t('rep.methodologyText') }), " ", t('ov.funnelNote')] })] })] }))] })] }));
}
