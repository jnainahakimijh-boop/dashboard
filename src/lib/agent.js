import { CHANNELS, MARKETS } from '/src/data/dimensions.js';
import { campaignTotals, comparisonQ, socialTotals, toQ, webBy, webTotals } from '/src/lib/aggregate.js';
import { bounceRate, cpa, cvr, engagementRateSocial, engagementRateWeb, ppChange, relChange } from '/src/lib/metrics.js';
import { fmtCompact, fmtEur, fmtPct, fmtRange, fmtRelDelta } from '/src/lib/format.js';
import { topSignals } from '/src/lib/insights.js';
import { buildRecommendations } from '/src/lib/recommendations.js';
import { healthScore } from '/src/lib/dataQuality.js';
import { advocacyTotals } from '/src/lib/advocacy.js';
import { seoTotals } from '/src/lib/seo.js';
import { aiSearchSnapshot } from '/src/lib/aiSearch.js';
import { runtimeConfig } from '/src/config/runtime.js';
export function buildAgentSnapshot(filters, lang) {
    const q = toQ(filters);
    const web = webTotals(q);
    const social = socialTotals(q);
    const campaigns = campaignTotals(q);
    const advocacy = advocacyTotals(q, filters.advocacyPrograms, filters.advocateGroups);
    const seo = seoTotals(q);
    const aiSearch = aiSearchSnapshot(q);
    return {
        range: fmtRange(filters.from, filters.to, lang),
        filters: {
            markets: filters.markets,
            regions: filters.regions,
            languages: filters.languages,
            channels: filters.channels,
            platforms: filters.platforms,
            devices: filters.devices,
            campaigns: filters.campaigns,
            themes: filters.themes,
            formats: filters.formats,
            advocacyPrograms: filters.advocacyPrograms,
            advocateGroups: filters.advocateGroups,
        },
        web,
        social,
        campaigns,
        advocacy,
        seo,
        aiSearch,
        metrics: {
            webEngagementRate: engagementRateWeb(web.engaged, web.sessions),
            conversionRate: cvr(web.conversions, web.sessions),
            socialEngagementRate: engagementRateSocial(social.engagements, social.impressions),
            campaignCpa: cpa(campaigns.spend, campaigns.conversions),
            advocacyParticipationRate: advocacy.registered ? advocacy.active / advocacy.registered * 100 : null,
            organicCtr: seo.impressions ? seo.clicks / seo.impressions * 100 : null,
        },
    };
}
function topWebDimension(filters, kind, metric) {
    const q = toQ(filters);
    const rows = [...webBy(q, kind).entries()].map(([id, totals]) => ({ id: String(id), totals, value: metric === 'sessions' ? totals.sessions : totals.conversions }));
    return rows.sort((a, b) => b.value - a.value)[0] ?? null;
}
function localAnswer(question, filters, lang) {
    const fr = lang === 'fr';
    const q = toQ(filters);
    const p = comparisonQ(q, filters.compare);
    const web = webTotals(q);
    const prevWeb = webTotals(p);
    const social = socialTotals(q);
    const campaigns = campaignTotals(q);
    const advocacy = advocacyTotals(q, filters.advocacyPrograms, filters.advocateGroups);
    const seo = seoTotals(q);
    const aiSearch = aiSearchSnapshot(q);
    const text = question.toLowerCase();
    const range = fmtRange(filters.from, filters.to, lang);
    const webCvr = cvr(web.conversions, web.sessions);
    const webEr = engagementRateWeb(web.engaged, web.sessions);
    const webBounce = bounceRate(web.engaged, web.sessions);
    const prevBounce = bounceRate(prevWeb.engaged, prevWeb.sessions);
    const insightOptions = { advocacyPrograms: filters.advocacyPrograms, advocateGroups: filters.advocateGroups };
    const comparisonWording = filters.compare === 'none' ? (fr ? 'sans comparaison active' : 'with no active comparison') : (fr ? 'vs la comparaison sélectionnée' : 'vs the selected comparison');
    if (/what changed|changed|movement|trend|évolu|changé|variation|signal/.test(text)) {
        const signals = topSignals(q, lang, 4, insightOptions);
        const lines = signals.map((s) => `• ${s.text}`).join('\n');
        return fr ? `Voici les principaux mouvements sur ${range} :\n${lines}` : `Here are the main movements for ${range}:\n${lines}`;
    }
    if (/recommend|action|priority|priorit|recommand|que faire|what should/.test(text)) {
        const recs = buildRecommendations(q, insightOptions).slice(0, 3);
        return recs.map((r, i) => `${i + 1}. ${r.action[lang]}\n   ${fr ? 'Pourquoi' : 'Why'}: ${r.signal[lang]}`).join('\n\n');
    }
    if (/data quality|quality|fresh|source|qualité|fraîcheur|fiabil/.test(text)) {
        const h = healthScore();
        return fr
            ? `Le score de santé des données est de ${h.total}/100. Fraîcheur : ${h.freshness}/100, complétude : ${h.completeness}/100, réconciliation : ${h.reconciliation}/100.`
            : `The data health score is ${h.total}/100. Freshness: ${h.freshness}/100, completeness: ${h.completeness}/100, reconciliation: ${h.reconciliation}/100.`;
    }
    if (/best channel|top channel|channel perform|meilleur canal|canal.*meilleur/.test(text)) {
        const metric = /conversion|convert/.test(text) ? 'conversions' : 'sessions';
        const top = topWebDimension(filters, 'channel', metric);
        if (!top)
            return fr ? 'Aucune donnée canal pour cette sélection.' : 'There is no channel data for this selection.';
        const def = CHANNELS.find((c) => c.id === top.id);
        const label = def ? (fr ? def.nameFr : def.name) : top.id;
        return fr
            ? `${label} est le canal n°1 sur ${metric === 'sessions' ? 'les sessions' : 'les conversions'} avec ${fmtCompact(top.value, lang)}.`
            : `${label} is the top channel by ${metric} with ${fmtCompact(top.value, lang)}.`;
    }
    if (/best market|top market|country|market perform|meilleur marché|pays/.test(text)) {
        const top = topWebDimension(filters, 'market', 'sessions');
        if (!top)
            return fr ? 'Aucune donnée marché pour cette sélection.' : 'There is no market data for this selection.';
        const def = MARKETS.find((m) => m.id === top.id);
        const label = def ? (fr ? def.nameFr : def.name) : top.id;
        return fr ? `${label} est le premier marché avec ${fmtCompact(top.value, lang)} sessions sur la période sélectionnée.` : `${label} is the leading market with ${fmtCompact(top.value, lang)} sessions in the selected period.`;
    }
    if (/bounce|rebond/.test(text)) {
        const change = ppChange(webBounce, prevBounce);
        return fr
            ? `Le taux de rebond est de ${fmtPct(webBounce, lang)} (${web.sessions - web.engaged} sessions non engagées / ${web.sessions} sessions), ${comparisonWording}${change === null ? '' : ` : ${change > 0 ? '+' : ''}${change.toFixed(1).replace('.', ',')} pt`}. À interpréter avec l’engagement, la conversion, la source et l’intention de la page.`
            : `Bounce rate is ${fmtPct(webBounce, lang)} (${web.sessions - web.engaged} non-engaged sessions / ${web.sessions} sessions), ${comparisonWording}${change === null ? '' : `: ${change > 0 ? '+' : ''}${change.toFixed(1)} pp`}. Interpret it alongside engagement, conversion, source and page intent.`;
    }
    if (/conversion rate|cvr|conversion.*rate|taux de conversion/.test(text)) {
        const previous = cvr(prevWeb.conversions, prevWeb.sessions);
        const change = ppChange(webCvr, previous);
        return fr
            ? `Le taux de conversion est de ${fmtPct(webCvr, lang)} (${web.conversions.toLocaleString('fr-FR')} conversions / ${web.sessions.toLocaleString('fr-FR')} sessions). Écart ${comparisonWording} : ${change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1).replace('.', ',')} pt`}.`
            : `Conversion rate is ${fmtPct(webCvr, lang)} (${web.conversions.toLocaleString('en-GB')} conversions / ${web.sessions.toLocaleString('en-GB')} sessions). Change ${comparisonWording}: ${change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)} pp`}.`;
    }
    if (/session|traffic|trafic/.test(text)) {
        const change = relChange(web.sessions, prevWeb.sessions);
        return fr
            ? `Il y a ${fmtCompact(web.sessions, lang)} sessions sur ${range}, soit ${fmtRelDelta(change, lang)} ${comparisonWording}. Le taux d'engagement web est ${fmtPct(webEr, lang)}.`
            : `There are ${fmtCompact(web.sessions, lang)} sessions for ${range}, ${fmtRelDelta(change, lang)} ${comparisonWording}. Web engagement rate is ${fmtPct(webEr, lang)}.`;
    }
    if (/advocacy|advocate|employee|ambassador|collaborateur|ambassadeur/.test(text)) {
        const participation = advocacy.registered ? advocacy.active / advocacy.registered * 100 : null;
        const er = engagementRateSocial(advocacy.engagements, advocacy.impressions);
        const rate = cvr(advocacy.conversions, advocacy.sessions);
        return fr
            ? `Employee Advocacy : ${fmtCompact(advocacy.active, lang)} participants actifs sur ${fmtCompact(advocacy.registered, lang)} inscrits (${fmtPct(participation, lang)} de participation), ${fmtCompact(advocacy.reach, lang)} de reach, ${fmtPct(er, lang)} d’engagement et ${fmtPct(rate, lang)} de conversion sur le trafic attribué.`
            : `Employee Advocacy: ${fmtCompact(advocacy.active, lang)} active advocates out of ${fmtCompact(advocacy.registered, lang)} registered (${fmtPct(participation, lang)} participation), ${fmtCompact(advocacy.reach, lang)} reach, ${fmtPct(er, lang)} engagement and ${fmtPct(rate, lang)} conversion on attributed traffic.`;
    }
    if (/ai search|aeo|answer engine|chatgpt|perplexity|google aio|ai overview|citation|llm|recherche ia|moteur de réponse|visibilité ia/.test(text)) {
        const topEngine = [...aiSearch.engineRows].sort((a,b) => b.visibilityPct - a.visibilityPct)[0];
        const topTopic = aiSearch.topics[0];
        return fr
            ? `Recherche IA / AEO : visibilité ${fmtPct(aiSearch.visibilityRate, lang)}, taux de citation ${fmtPct(aiSearch.citationRate, lang)}, part de voix ${fmtPct(aiSearch.shareOfVoice, lang)} et ${fmtCompact(aiSearch.aiSessions, lang)} sessions référées par l’IA. ${topEngine?.name ?? 'Le moteur principal'} affiche la meilleure visibilité (${fmtPct(topEngine?.visibilityPct ?? null, lang)}). Opportunité prioritaire : ${topTopic ? topTopic.fr : '—'}. Données de démonstration jusqu’à connexion d’une source approuvée.`
            : `AI Search / AEO: ${fmtPct(aiSearch.visibilityRate, lang)} visibility, ${fmtPct(aiSearch.citationRate, lang)} citation rate, ${fmtPct(aiSearch.shareOfVoice, lang)} share of voice and ${fmtCompact(aiSearch.aiSessions, lang)} AI referral sessions. ${topEngine?.name ?? 'The leading engine'} has the strongest visibility (${fmtPct(topEngine?.visibilityPct ?? null, lang)}). Top opportunity: ${topTopic ? topTopic.en : '—'}. Sample data until an approved source is connected.`;
    }
    if (/seo|search|organic|keyword|query|recherche|organique|mot.?clé/.test(text)) {
        const organicCtr = seo.impressions ? seo.clicks / seo.impressions * 100 : null;
        return fr
            ? `SEO : ${fmtCompact(seo.impressions, lang)} impressions Search, ${fmtCompact(seo.clicks, lang)} clics, CTR organique ${fmtPct(organicCtr, lang)}, position moyenne ${seo.avgPosition === null ? '—' : seo.avgPosition.toFixed(1)} et ${fmtCompact(seo.rankingKeywords, lang)} mots-clés classés.`
            : `SEO: ${fmtCompact(seo.impressions, lang)} search impressions, ${fmtCompact(seo.clicks, lang)} clicks, ${fmtPct(organicCtr, lang)} organic CTR, average position ${seo.avgPosition === null ? '—' : seo.avgPosition.toFixed(1)} and ${fmtCompact(seo.rankingKeywords, lang)} ranking keywords.`;
    }
    if (/social|impression|engagement/.test(text)) {
        const er = engagementRateSocial(social.engagements, social.impressions);
        return fr
            ? `Social : ${fmtCompact(social.impressions, lang)} impressions, ${fmtCompact(social.engagements, lang)} engagements et un taux d'engagement de ${fmtPct(er, lang)}.`
            : `Social performance: ${fmtCompact(social.impressions, lang)} impressions, ${fmtCompact(social.engagements, lang)} engagements and a ${fmtPct(er, lang)} engagement rate.`;
    }
    if (/campaign|paid|spend|cpa|campagne|dépense/.test(text)) {
        const campaignCpa = cpa(campaigns.spend, campaigns.conversions);
        return fr
            ? `Campagnes : ${fmtCompact(campaigns.impressions, lang)} impressions, ${fmtCompact(campaigns.clicks, lang)} clics, ${fmtCompact(campaigns.conversions, lang)} conversions, ${fmtEur(campaigns.spend, lang)} dépensés et un CPA de ${fmtEur(campaignCpa, lang)}.`
            : `Campaigns: ${fmtCompact(campaigns.impressions, lang)} impressions, ${fmtCompact(campaigns.clicks, lang)} clicks, ${fmtCompact(campaigns.conversions, lang)} conversions, ${fmtEur(campaigns.spend, lang)} spend and ${fmtEur(campaignCpa, lang)} CPA.`;
    }
    const sessionChange = relChange(web.sessions, prevWeb.sessions);
    return fr
        ? `Sur ${range}, le tableau de bord affiche ${fmtCompact(web.sessions, lang)} sessions (${fmtRelDelta(sessionChange, lang)} ${comparisonWording}), ${fmtCompact(web.conversions, lang)} conversions et un CVR de ${fmtPct(webCvr, lang)}. Vous pouvez me demander : « Qu'est-ce qui a changé ? », « Quel est le meilleur canal ? », « Que faut-il prioriser ? » ou « Quelle est la qualité des données ? ».`
        : `For ${range}, the dashboard shows ${fmtCompact(web.sessions, lang)} sessions (${fmtRelDelta(sessionChange, lang)} ${comparisonWording}), ${fmtCompact(web.conversions, lang)} conversions and a ${fmtPct(webCvr, lang)} CVR. Try asking “What changed?”, “Which channel performs best?”, “What should we prioritise?” or “How is data quality?”.`;
}
export async function askPerformanceAgent(question, filters, lang, pathname) {
    const endpoint = runtimeConfig.aiAgentEndpoint;
    if (endpoint) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ question, language: lang, pathname, context: buildAgentSnapshot(filters, lang) }),
            });
            if (response.ok) {
                const data = await response.json();
                if (typeof data.answer === 'string' && data.answer.trim())
                    return { text: data.answer.trim(), mode: 'live' };
            }
        }
        catch {
            // Fall through to the governed local analytical assistant.
        }
    }
    return { text: localAnswer(question, filters, lang), mode: 'local' };
}
