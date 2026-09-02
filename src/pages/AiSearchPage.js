import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Bot, CheckCircle2, ExternalLink, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { comparisonQ, toQ } from '/src/lib/aggregate.js';
import { aiSearchSnapshot } from '/src/lib/aiSearch.js';
import { cvr, engagementRateWeb, deltaAbs, deltaRate } from '/src/lib/metrics.js';
import { fmtCompact, fmtInt, fmtPct } from '/src/lib/format.js';
import { KpiCard, KpiGrid } from '/src/components/kpi/KpiCard.js';
import { Badge, Card, MiniBar, SectionHeading } from '/src/components/ui/primitives.js';
import { MultiMetricTrend } from '/src/components/charts/MultiMetricTrend.js';
import { RankedList } from '/src/components/charts/RankedList.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';

function pctLabel(v, lang) { return fmtPct(v, lang, 1); }
function RateRow({ label, value, sub, color = 'var(--ch-1)' }) {
  return _jsxs('div', { className: 'grid grid-cols-[minmax(120px,1fr)_minmax(100px,1.8fr)_70px] items-center gap-3 py-2', children: [
    _jsxs('div', { className: 'min-w-0', children: [_jsx('div', { className: 'truncate text-[12px] font-medium text-t1', children: label }), sub && _jsx('div', { className: 'mt-0.5 truncate text-[10.5px] text-t3', children: sub })] }),
    _jsx(MiniBar, { pct: value, color }),
    _jsx('div', { className: 'mono text-right text-[11.5px] font-semibold text-t1 tnum', children: `${value.toFixed(1)}%` }),
  ]});
}

export default function AiSearchPage() {
  const { filters } = useFilters();
  const { lang } = useI18n();
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const now = useMemo(() => aiSearchSnapshot(q), [q]);
  const prev = useMemo(() => aiSearchSnapshot(p), [p]);
  const compare = filters.compare !== 'none';
  const copy = lang === 'fr' ? {
    sample: 'DONNÉES DE DÉMONSTRATION', sampleText: 'Module AEO/AI Search inspiré des pratiques d’intelligence de recherche modernes. Les métriques sont synthétiques jusqu’à connexion d’un fournisseur/API approuvé.',
    visibility: 'Visibilité IA', citation: 'Taux de citation', sov: 'Part de voix IA', aiSessions: 'Sessions référées par l’IA', aiCvr: 'Taux de conversion IA', prompts: 'Prompts suivis',
    trend: 'Mentions & citations dans les réponses IA', trendSub: 'Suivi quotidien du nombre de réponses échantillonnées où Veolia apparaît ou est cité.',
    engines: 'Performance par moteur IA', enginesSub: 'Visibilité, citations et trafic attribué par surface de réponse.',
    market: 'Part de voix concurrentielle', marketSub: 'Benchmark synthétique de présence dans les conversations suivies.',
    impact: 'IA vs recherche organique', impactSub: 'Relier la visibilité aux sessions, à l’engagement et aux conversions.',
    topics: 'Opportunités par sujet', topicsSub: 'Prioriser les sujets où l’intention est pertinente mais la visibilité/citation reste perfectible.',
    promptsTable: 'Analyse des prompts', promptsSub: 'Exemples de questions suivies — pas de “volume de recherche IA” inventé.',
    citations: 'Pages les plus citées', citationsSub: 'Contenus gagnant de l’autorité dans les réponses IA.',
    health: 'Découvrabilité pour les moteurs IA', healthSub: 'Signaux techniques à connecter aux logs/crawlers en production.',
    recs: 'Actions prioritaires AEO', recsSub: 'Transformer le signal en travail concret pour SEO, contenu et web.',
  } : {
    sample: 'SAMPLE DATA', sampleText: 'AEO / AI Search module inspired by modern search-intelligence workflows. Metrics are synthetic until an approved provider/API is connected.',
    visibility: 'AI visibility', citation: 'Citation rate', sov: 'AI share of voice', aiSessions: 'AI referral sessions', aiCvr: 'AI conversion rate', prompts: 'Tracked prompts',
    trend: 'AI answer mentions & citations', trendSub: 'Daily sample of monitored answers where Veolia is mentioned or cited.',
    engines: 'AI engine performance', enginesSub: 'Visibility, citations and attributed traffic by answer surface.',
    market: 'Competitive share of voice', marketSub: 'Synthetic benchmark of presence across monitored conversations.',
    impact: 'AI vs organic search', impactSub: 'Connect visibility to sessions, engagement and conversions.',
    topics: 'Topic opportunity map', topicsSub: 'Prioritise topics with relevant intent but underdeveloped visibility or citation authority.',
    promptsTable: 'Prompt analysis', promptsSub: 'Tracked question examples — deliberately no invented “AI search volume”.',
    citations: 'Top cited pages', citationsSub: 'Content earning authority in AI answers.',
    health: 'AI crawler discoverability', healthSub: 'Technical signals to connect to real crawler/log data in production.',
    recs: 'Prioritised AEO actions', recsSub: 'Turn the signal into concrete SEO, content and web work.',
  };

  const kpis = [
    { label: copy.visibility, def: lang === 'fr' ? 'Réponses suivies mentionnant Veolia ÷ réponses évaluées.' : 'Monitored answers mentioning Veolia ÷ evaluated answers.', value: pctLabel(now.visibilityRate, lang), prev: pctLabel(prev.visibilityRate, lang), delta: deltaRate(now.visibilityRate, prev.visibilityRate) },
    { label: copy.citation, def: lang === 'fr' ? 'Réponses suivies citant une page Veolia ÷ réponses évaluées.' : 'Monitored answers citing a Veolia page ÷ evaluated answers.', value: pctLabel(now.citationRate, lang), prev: pctLabel(prev.citationRate, lang), delta: deltaRate(now.citationRate, prev.citationRate) },
    { label: copy.sov, def: lang === 'fr' ? 'Part estimée des mentions dans le benchmark de marques suivi.' : 'Estimated share of monitored brand mentions within the peer benchmark.', value: pctLabel(now.shareOfVoice, lang), prev: pctLabel(prev.shareOfVoice, lang), delta: deltaRate(now.shareOfVoice, prev.shareOfVoice) },
    { label: copy.aiSessions, def: lang === 'fr' ? 'Sessions attribuées aux référents provenant de moteurs de réponse IA.' : 'Sessions attributed to referrals from AI answer engines.', value: fmtCompact(now.aiSessions, lang), prev: fmtCompact(prev.aiSessions, lang), delta: deltaAbs(now.aiSessions, prev.aiSessions) },
    { label: copy.aiCvr, def: lang === 'fr' ? 'Conversions attribuées aux sessions IA ÷ sessions IA.' : 'Attributed AI conversions ÷ AI referral sessions.', value: pctLabel(now.aiCvr, lang), prev: pctLabel(prev.aiCvr, lang), delta: deltaRate(now.aiCvr, prev.aiCvr) },
    { label: copy.prompts, def: lang === 'fr' ? 'Ensemble de questions configurées par sujet, audience et intention.' : 'Configured prompt set across topics, audiences and intents.', value: fmtInt(now.trackedPrompts, lang), prev: fmtInt(prev.trackedPrompts, lang), delta: deltaAbs(now.trackedPrompts, prev.trackedPrompts) },
  ];

  const engineRows = now.engineRows.map(e => ({ id: e.id, label: e.name, value: e.visibilityPct, valueLabel: pctLabel(e.visibilityPct, lang), share: null, sub: `${lang === 'fr' ? 'Citation' : 'Citation'} ${pctLabel(e.citationPct, lang)} · ${fmtCompact(e.referralSessions, lang)} ${lang === 'fr' ? 'sessions' : 'sessions'}` }));
  const peerRows = now.competitors.map(r => ({ id: r.id, label: r.label, value: r.value, valueLabel: pctLabel(r.value, lang), share: null, color: r.id === 'veolia' ? 'var(--accent)' : undefined }));

  const promptCols = [
    { id: 'prompt', header: lang === 'fr' ? 'Prompt suivi' : 'Tracked prompt', cell: r => _jsxs('div', { className: 'max-w-[420px]', children: [_jsx('div', { className: 'text-[12px] font-medium text-t1', children: lang === 'fr' ? r.fr : r.en }), _jsxs('div', { className: 'mt-1 flex flex-wrap gap-1.5', children: [_jsx(Badge, { tone: 'neutral', children: r.engine }), _jsx(Badge, { tone: 'info', children: r.intent })] })] }), searchText: r => `${r.en} ${r.fr} ${r.topic} ${r.engine}` },
    { id: 'vis', header: lang === 'fr' ? 'Visibilité' : 'Visibility', align: 'right', sortValue: r => r.visibility, cell: r => _jsx(Num, { strong: true, children: pctLabel(r.visibility, lang) }) },
    { id: 'cite', header: lang === 'fr' ? 'Citation' : 'Citation', align: 'center', sortValue: r => r.cited ? 1 : 0, cell: r => r.cited ? _jsx(CheckCircle2, { size: 16, className: 'mx-auto text-pos', 'aria-label': 'Cited' }) : _jsx(TriangleAlert, { size: 16, className: 'mx-auto text-warn', 'aria-label': 'Not cited' }) },
    { id: 'seo', header: lang === 'fr' ? 'Position SEO' : 'SEO position', align: 'right', sortValue: r => r.seoPosition, cell: r => _jsx(Num, { children: r.seoPosition.toFixed(1) }) },
    { id: 'opp', header: lang === 'fr' ? 'Opportunité' : 'Opportunity', align: 'right', sortValue: r => r.opportunity, cell: r => _jsxs('span', { className: 'flex items-center justify-end gap-2', children: [_jsx(MiniBar, { pct: r.opportunity, className: 'max-w-16', color: 'var(--ch-4)' }), _jsx(Num, { strong: true, children: r.opportunity })] }) },
  ];

  const citedCols = [
    { id: 'page', header: lang === 'fr' ? 'Page citée' : 'Cited page', cell: r => _jsxs('span', { className: 'flex items-center gap-2 text-[12px] font-medium text-t1', children: [_jsx(ExternalLink, { size: 13, className: 'text-t3' }), r.page] }), searchText: r => `${r.page} ${r.topic}` },
    { id: 'topic', header: lang === 'fr' ? 'Sujet' : 'Topic', cell: r => _jsx(Badge, { tone: 'neutral', children: r.topic }) },
    { id: 'citations', header: lang === 'fr' ? 'Citations' : 'Citations', align: 'right', sortValue: r => r.citations, cell: r => _jsx(Num, { strong: true, children: fmtInt(r.citations, lang) }) },
    { id: 'sessions', header: lang === 'fr' ? 'Sessions IA' : 'AI sessions', align: 'right', sortValue: r => r.sessions, cell: r => _jsx(Num, { children: fmtInt(r.sessions, lang) }) },
    { id: 'conv', header: lang === 'fr' ? 'Conversions' : 'Conversions', align: 'right', sortValue: r => r.conversions, cell: r => _jsx(Num, { children: fmtInt(r.conversions, lang) }) },
  ];

  const organicEr = engagementRateWeb(now.organicEngaged, now.organicSessions);
  const aiEr = engagementRateWeb(now.aiEngaged, now.aiSessions);
  const organicCvr = cvr(now.organicConversions, now.organicSessions);
  const aiCvr = cvr(now.aiConversions, now.aiSessions);
  const recs = now.topics.slice(0, 4).map((topic, i) => ({
    id: topic.id,
    title: lang === 'fr' ? `Renforcer “${topic.fr}” dans les réponses IA` : `Strengthen “${topic.en}” in AI answers`,
    body: lang === 'fr' ? `Score d’opportunité ${topic.score}/100 · visibilité ${topic.visibility.toFixed(0)}% · citations ${topic.citation.toFixed(0)}%. Consolider les pages sources, les données structurées et les preuves d’autorité.` : `Opportunity score ${topic.score}/100 · visibility ${topic.visibility.toFixed(0)}% · citations ${topic.citation.toFixed(0)}%. Strengthen source pages, structured data and authority signals.`,
    tone: i < 2 ? 'accent' : 'info',
  }));

  const heading = (step, title, description, extra) => _jsx(SectionHeading, { key: `sec-${step}`, step, title, description, className: extra });

  return _jsxs('div', { className: 'page-shell flex flex-col gap-4', children: [
    _jsxs('div', { className: 'rounded-[6px] border border-accbrd bg-accsoft px-4 py-3 text-[11.5px] leading-5 text-t2', children: [_jsx(Badge, { tone: 'accent', children: copy.sample }), _jsx('span', { className: 'ml-2', children: copy.sampleText })] }),
    heading(1, lang === 'fr' ? 'Visibilité IA' : 'AI visibility', lang === 'fr' ? 'Présence de Veolia dans les réponses des moteurs IA suivis, sur l\u2019ensemble de prompts configuré.' : 'Veolia’s presence in the answers of the monitored AI engines, across the configured prompt set.'),
    _jsx(KpiGrid, { children: kpis.map(k => _jsx(KpiCard, { label: k.label, definition: k.def, value: k.value, prevValue: k.prev, delta: compare ? k.delta : undefined, compareLabel: lang === 'fr' ? 'vs préc.' : 'vs prev.', href: '/ai-search', lang }, k.label)) }),
    heading(2, lang === 'fr' ? 'Comment cela évolue' : 'How it is evolving', lang === 'fr' ? 'Mentions et citations dans le temps, puis la part de voix face aux marques suivies.' : 'Mentions and citations over time, then share of voice against the monitored peer set.', 'mt-3'),
    _jsxs('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-[1.35fr_.65fr]', children: [
      _jsx(Card, { title: copy.trend, subtitle: copy.trendSub, children: _jsx(MultiMetricTrend, { points: now.points, lang, ariaLabel: copy.trend, series: [ { key: 'mentions', label: lang === 'fr' ? 'Mentions' : 'Mentions', format: v => fmtInt(v, lang) }, { key: 'citations', label: lang === 'fr' ? 'Citations' : 'Citations', format: v => fmtInt(v, lang) } ] }) }),
      _jsx(Card, { title: copy.market, subtitle: copy.marketSub, children: _jsxs('div', { children: [_jsx(RankedList, { rows: peerRows, lang, ariaLabel: copy.market, showShare: false }), _jsxs('div', { className: 'mt-5 border-t border-brd pt-4', children: [_jsx('div', { className: 'mb-2 text-[11px] font-semibold uppercase tracking-[.04em] text-t3', children: lang === 'fr' ? 'Sentiment de marque dans les réponses' : 'Brand sentiment in AI answers' }), _jsx('div', { className: 'grid gap-1', children: now.sentiment.map((r, i) => _jsx(RateRow, { label: lang === 'fr' ? (r.id === 'positive' ? 'Positif' : r.id === 'neutral' ? 'Neutre' : 'À examiner') : r.label, value: r.value, color: i === 0 ? 'var(--ch-6)' : i === 1 ? 'var(--ch-1)' : 'var(--ch-5)' }, r.id)) })] })] }) }),
    ] }),
    heading(3, lang === 'fr' ? 'Où cela se passe' : 'Where it is happening', lang === 'fr' ? 'Performance par moteur de réponse, puis comparaison directe avec la recherche organique.' : 'Performance by answer engine, then a direct comparison with organic search.', 'mt-3'),
    _jsxs('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-2', children: [
      _jsx(Card, { title: copy.engines, subtitle: copy.enginesSub, children: _jsx('div', { className: 'grid gap-1', children: now.engineRows.map((e, i) => _jsx(RateRow, { label: e.name, value: e.visibilityPct, sub: `${lang === 'fr' ? 'Citation' : 'Citation'} ${pctLabel(e.citationPct, lang)} · ${fmtCompact(e.referralSessions, lang)} sessions`, color: `var(--ch-${(i % 6) + 1})` }, e.id)) }) }),
      _jsx(Card, { title: copy.impact, subtitle: copy.impactSub, children: _jsxs('div', { className: 'grid gap-3 sm:grid-cols-2', children: [
        _jsxs('div', { className: 'rounded-[6px] border border-brd bg-card2 p-4', children: [_jsxs('div', { className: 'mb-3 flex items-center gap-2', children: [_jsx(Search, { size: 15, className: 'text-acctext' }), _jsx('b', { className: 'text-[12.5px] text-t1', children: lang === 'fr' ? 'Recherche organique' : 'Organic search' })] }), _jsx('div', { className: 'text-[24px] font-bold text-t1 tnum', children: fmtCompact(now.organicSessions, lang) }), _jsx('div', { className: 'mt-1 text-[10.5px] text-t3', children: lang === 'fr' ? 'sessions' : 'sessions' }), _jsxs('div', { className: 'mt-3 grid gap-1.5 text-[11px] text-t2', children: [_jsxs('div', { className: 'flex justify-between', children: [_jsx('span', { children: lang === 'fr' ? 'Engagement' : 'Engagement' }), _jsx('b', { children: pctLabel(organicEr, lang) })] }), _jsxs('div', { className: 'flex justify-between', children: [_jsx('span', { children: 'CVR' }), _jsx('b', { children: pctLabel(organicCvr, lang) })] }), _jsxs('div', { className: 'flex justify-between', children: [_jsx('span', { children: lang === 'fr' ? 'Conversions' : 'Conversions' }), _jsx('b', { children: fmtInt(now.organicConversions, lang) })] })] })] }),
        _jsxs('div', { className: 'rounded-[6px] border border-accbrd bg-accsoft p-4', children: [_jsxs('div', { className: 'mb-3 flex items-center gap-2', children: [_jsx(Bot, { size: 15, className: 'text-acctext' }), _jsx('b', { className: 'text-[12.5px] text-t1', children: lang === 'fr' ? 'Référents IA' : 'AI referrals' })] }), _jsx('div', { className: 'text-[24px] font-bold text-t1 tnum', children: fmtCompact(now.aiSessions, lang) }), _jsx('div', { className: 'mt-1 text-[10.5px] text-t3', children: lang === 'fr' ? 'sessions attribuées' : 'attributed sessions' }), _jsxs('div', { className: 'mt-3 grid gap-1.5 text-[11px] text-t2', children: [_jsxs('div', { className: 'flex justify-between', children: [_jsx('span', { children: lang === 'fr' ? 'Engagement' : 'Engagement' }), _jsx('b', { children: pctLabel(aiEr, lang) })] }), _jsxs('div', { className: 'flex justify-between', children: [_jsx('span', { children: 'CVR' }), _jsx('b', { children: pctLabel(aiCvr, lang) })] }), _jsxs('div', { className: 'flex justify-between', children: [_jsx('span', { children: lang === 'fr' ? 'Conversions' : 'Conversions' }), _jsx('b', { children: fmtInt(now.aiConversions, lang) })] })] })] }),
      ] }) }),
    ] }),
    heading(4, lang === 'fr' ? 'Pourquoi cela se passe' : 'Why it is happening', lang === 'fr' ? 'Sujets, prompts suivis et pages effectivement citées : ce qui gagne ou perd de l\u2019autorité.' : 'Topics, tracked prompts and the pages actually cited: what is gaining or losing authority.', 'mt-3'),
    _jsx(Card, { title: copy.topics, subtitle: copy.topicsSub, children: _jsx('div', { className: 'grid gap-2 md:grid-cols-2 xl:grid-cols-3', children: now.topics.map(t => _jsxs('article', { className: 'rounded-[6px] border border-brd bg-card2 p-3.5', children: [_jsxs('div', { className: 'flex items-start justify-between gap-2', children: [_jsx('div', { className: 'text-[12.5px] font-semibold text-t1', children: lang === 'fr' ? t.fr : t.en }), _jsx(Badge, { tone: t.score >= 85 ? 'accent' : 'info', children: `${t.score}/100` })] }), _jsx('div', { className: 'mt-1 text-[10.5px] text-t3', children: t.intent }), _jsxs('div', { className: 'mt-3 grid gap-2 text-[11px]', children: [_jsxs('div', { children: [_jsxs('div', { className: 'mb-1 flex justify-between text-t2', children: [_jsx('span', { children: copy.visibility }), _jsx('b', { children: pctLabel(t.visibility, lang) })] }), _jsx(MiniBar, { pct: t.visibility, color: 'var(--ch-1)' })] }), _jsxs('div', { children: [_jsxs('div', { className: 'mb-1 flex justify-between text-t2', children: [_jsx('span', { children: copy.citation }), _jsx('b', { children: pctLabel(t.citation, lang) })] }), _jsx(MiniBar, { pct: t.citation, color: 'var(--ch-2)' })] })] })] }, t.id)) }) }),
    _jsx(Card, { title: copy.promptsTable, subtitle: copy.promptsSub, children: _jsx(DataTable, { columns: promptCols, rows: now.promptRows, rowKey: r => r.id, searchable: true, pageSize: 8, defaultSort: { id: 'opp', dir: 'desc' }, ariaLabel: copy.promptsTable }) }),
    _jsxs('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-[1.25fr_.75fr]', children: [
      _jsx(Card, { title: copy.citations, subtitle: copy.citationsSub, children: _jsx(DataTable, { columns: citedCols, rows: now.citedPages, rowKey: r => r.id, defaultSort: { id: 'citations', dir: 'desc' }, ariaLabel: copy.citations }) }),
      _jsx(Card, { title: copy.health, subtitle: copy.healthSub, children: _jsx('div', { className: 'grid gap-2', children: [
        [lang === 'fr' ? 'Accès bots IA' : 'AI bot access', now.crawl.aiBotAccessiblePct, 'var(--ch-1)'],
        [lang === 'fr' ? 'Pages indexables' : 'Indexable pages', now.crawl.indexablePct, 'var(--ch-2)'],
        [lang === 'fr' ? 'Données structurées' : 'Structured data', now.crawl.structuredDataPct, 'var(--ch-4)'],
        [lang === 'fr' ? 'Contenu récemment actualisé' : 'Recently refreshed content', now.crawl.freshContentPct, 'var(--ch-6)'],
      ].map(([label, value, color]) => _jsx(RateRow, { label, value, color }, label)) }) }),
    ] }),
    heading(5, lang === 'fr' ? 'Ce qu\u2019il faut faire' : 'What to do', lang === 'fr' ? 'Les actions AEO à confier au SEO, au contenu et au web.' : 'The AEO actions to hand to SEO, content and web teams.', 'mt-3'),
    _jsx(Card, { title: copy.recs, subtitle: copy.recsSub, children: _jsx('div', { className: 'grid gap-2 lg:grid-cols-2', children: recs.map((r, i) => _jsxs('article', { className: 'rounded-[6px] border border-brd bg-card2 p-3.5', children: [_jsxs('div', { className: 'flex items-start gap-2', children: [_jsx(Sparkles, { size: 15, className: 'mt-0.5 shrink-0 text-acctext' }), _jsxs('div', { children: [_jsxs('div', { className: 'flex flex-wrap items-center gap-2', children: [_jsx('div', { className: 'text-[12.5px] font-semibold text-t1', children: r.title }), _jsx(Badge, { tone: r.tone, children: i < 2 ? (lang === 'fr' ? 'PRIORITÉ' : 'PRIORITY') : (lang === 'fr' ? 'OPPORTUNITÉ' : 'OPPORTUNITY') })] }), _jsx('p', { className: 'm-0 mt-1.5 text-[11px] leading-5 text-t2', children: r.body })] })] })] }, r.id)) }) }),
  ]});
}
