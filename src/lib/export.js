import { CHANNELS, MARKETS, PLATFORMS, dayToDate } from '/src/data/dimensions.js';
import { contentItems, toQ, webBy, webTotals, socialTotals, campaignTotals, comparisonQ } from '/src/lib/aggregate.js';
import { advocacyTotals } from '/src/lib/advocacy.js';
import { seoTotals } from '/src/lib/seo.js';
import { aiSearchSnapshot } from '/src/lib/aiSearch.js';
import { cvr, engagementRateSocial, engagementRateWeb, ctr } from '/src/lib/metrics.js';
function csvEscape(v) {
    if (v === null)
        return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function iso(d) {
    return dayToDate(d).toISOString().slice(0, 10);
}
function number(v) {
    return v === null ? null : Math.round(v * 100) / 100;
}
export function buildReportCsv(filters, scope, opts) {
    const q = toQ(filters);
    const p = comparisonQ(q, filters.compare);
    const now = webTotals(q);
    const prev = webTotals(p);
    const soc = socialTotals(q);
    const socPrev = socialTotals(p);
    const cmp = campaignTotals(q);
    const cmpPrev = campaignTotals(p);
    const adv = advocacyTotals(q, filters.advocacyPrograms, filters.advocateGroups);
    const advPrev = advocacyTotals(p, filters.advocacyPrograms, filters.advocateGroups);
    const seo = seoTotals(q);
    const seoPrev = seoTotals(p);
    const aiSearch = aiSearchSnapshot(q);
    const aiSearchPrev = aiSearchSnapshot(p);
    const content = contentItems(q);
    const lines = [];
    lines.push('# Veolia Digital Performance — export (PROTOTYPE DATA ADAPTER)');
    lines.push(`# Scope,${scope}`);
    lines.push(`# Generated,${new Date().toISOString()}`);
    lines.push(`# Period,${iso(q.from)},${iso(q.to)}`);
    if (opts.comparison && filters.compare !== 'none')
        lines.push(`# Comparison period,${iso(p.from)},${iso(p.to)}`);
    const fparts = [];
    if (filters.markets.length)
        fparts.push(`markets=${filters.markets.join('+')}`);
    if (filters.regions.length)
        fparts.push(`regions=${filters.regions.join('+')}`);
    if (filters.languages.length)
        fparts.push(`languages=${filters.languages.join('+')}`);
    if (filters.channels.length)
        fparts.push(`channels=${filters.channels.join('+')}`);
    if (filters.platforms.length)
        fparts.push(`platforms=${filters.platforms.join('+')}`);
    if (filters.devices.length)
        fparts.push(`devices=${filters.devices.join('+')}`);
    if (filters.campaigns.length)
        fparts.push(`campaigns=${filters.campaigns.join('+')}`);
    if (filters.themes.length)
        fparts.push(`themes=${filters.themes.join('+')}`);
    if (filters.formats.length)
        fparts.push(`formats=${filters.formats.join('+')}`);
    if (filters.advocacyPrograms.length)
        fparts.push(`advocacy_programmes=${filters.advocacyPrograms.join('+')}`);
    if (filters.advocateGroups.length)
        fparts.push(`advocate_groups=${filters.advocateGroups.join('+')}`);
    lines.push(`# Applied filters,${fparts.length ? fparts.join(' ') : 'none'}`);
    lines.push('');
    const include = (s) => scope === 'all' || scope === 'selection' || scope === 'overview' || scope === s;
    const row = (name, cur, pv) => lines.push([csvEscape(name), csvEscape(number(cur)), ...(opts.comparison && filters.compare !== 'none' ? [csvEscape(number(pv))] : [])].join(','));
    lines.push('metric,current' + (opts.comparison && filters.compare !== 'none' ? ',comparison' : ''));
    if (include('web')) {
        row('web_sessions', now.sessions, prev.sessions);
        row('web_users', now.users, prev.users);
        row('web_engaged_sessions', now.engaged, prev.engaged);
        row('web_engagement_rate_pct', engagementRateWeb(now.engaged, now.sessions), engagementRateWeb(prev.engaged, prev.sessions));
        row('web_bounce_rate_pct', now.sessions ? ((now.sessions - now.engaged) / now.sessions) * 100 : null, prev.sessions ? ((prev.sessions - prev.engaged) / prev.sessions) * 100 : null);
        row('web_conversions', now.conversions, prev.conversions);
        row('web_cvr_pct', cvr(now.conversions, now.sessions), cvr(prev.conversions, prev.sessions));
    }
    if (include('social')) {
        row('social_reach', soc.reach, socPrev.reach);
        row('social_impressions', soc.impressions, socPrev.impressions);
        row('social_engagements', soc.engagements, socPrev.engagements);
        row('social_engagement_rate_pct', engagementRateSocial(soc.engagements, soc.impressions), engagementRateSocial(socPrev.engagements, socPrev.impressions));
        row('social_clicks', soc.clicks, socPrev.clicks);
        row('social_ctr_pct', ctr(soc.clicks, soc.impressions), ctr(socPrev.clicks, socPrev.impressions));
        row('social_net_follower_growth', soc.followerNet, socPrev.followerNet);
    }
    if (include('advocacy')) {
        row('advocacy_registered', adv.registered, advPrev.registered);
        row('advocacy_active', adv.active, advPrev.active);
        row('advocacy_participation_pct', adv.registered ? (adv.active / adv.registered) * 100 : null, advPrev.registered ? (advPrev.active / advPrev.registered) * 100 : null);
        row('advocacy_reach', adv.reach, advPrev.reach);
        row('advocacy_engagement_rate_pct', engagementRateSocial(adv.engagements, adv.impressions), engagementRateSocial(advPrev.engagements, advPrev.impressions));
        row('advocacy_sessions', adv.sessions, advPrev.sessions);
        row('advocacy_conversions', adv.conversions, advPrev.conversions);
    }
    if (include('seo')) {
        row('seo_clicks', seo.clicks, seoPrev.clicks);
        row('seo_impressions', seo.impressions, seoPrev.impressions);
        row('seo_ctr_pct', ctr(seo.clicks, seo.impressions), ctr(seoPrev.clicks, seoPrev.impressions));
        row('seo_average_position', seo.avgPosition, seoPrev.avgPosition);
        row('seo_ranking_keywords', seo.rankingKeywords, seoPrev.rankingKeywords);
    }
    if (include('ai-search')) {
        row('ai_search_visibility_pct', aiSearch.visibilityRate, aiSearchPrev.visibilityRate);
        row('ai_search_citation_rate_pct', aiSearch.citationRate, aiSearchPrev.citationRate);
        row('ai_search_share_of_voice_pct', aiSearch.shareOfVoice, aiSearchPrev.shareOfVoice);
        row('ai_referral_sessions', aiSearch.aiSessions, aiSearchPrev.aiSessions);
        row('ai_referral_conversions', aiSearch.aiConversions, aiSearchPrev.aiConversions);
        row('ai_referral_cvr_pct', aiSearch.aiCvr, aiSearchPrev.aiCvr);
        row('ai_tracked_prompts', aiSearch.trackedPrompts, aiSearchPrev.trackedPrompts);
    }
    if (include('campaigns')) {
        row('campaign_impressions', cmp.impressions, cmpPrev.impressions);
        row('campaign_clicks', cmp.clicks, cmpPrev.clicks);
        row('campaign_spend_eur', cmp.spend, cmpPrev.spend);
        row('campaign_conversions', cmp.conversions, cmpPrev.conversions);
    }
    if (scope === 'all' || scope === 'selection' || scope === 'overview')
        row('content_published', content.length, null);
    lines.push('');
    if (include('web')) {
        lines.push('channel,sessions,users,engaged_sessions,bounce_rate_pct,conversions,cvr_pct');
        const byCh = webBy(q, 'channel');
        for (const ch of CHANNELS) {
            const t = byCh.get(ch.id);
            if (!t)
                continue;
            lines.push([ch.name, t.sessions, t.users, t.engaged, csvEscape(number(t.sessions ? ((t.sessions - t.engaged) / t.sessions) * 100 : null)), t.conversions, csvEscape(number(cvr(t.conversions, t.sessions)))].join(','));
        }
        lines.push('');
    }
    if (opts.methodology) {
        lines.push('# Methodology: derived metrics are computed from source values, never independently hard-coded.');
        lines.push('# web_engagement_rate = engaged_sessions / sessions × 100 ; bounce_rate = non_engaged_sessions / sessions × 100');
        lines.push('# cvr = conversions / sessions × 100 ; ctr = clicks / impressions × 100 ; advocacy_participation = active / registered × 100');
        lines.push('# Campaign traffic is a subset of Paid Media. Social-channel sessions are modelled from platform clicks in the local adapter.');
        lines.push(`# Dimensions: markets=${MARKETS.map((m) => m.id).join('+')} platforms=${PLATFORMS.map((p2) => p2.id).join('+')}`);
    }
    return lines.join('\n');
}
/** Backward-compatible overview export used by the header. */
export function buildOverviewCsv(filters, opts) {
    return buildReportCsv(filters, 'overview', opts);
}
export function downloadCsv(content, filename) {
    downloadText(content, filename, 'text/csv;charset=utf-8');
}
function downloadText(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
function parseCsvRow(line) {
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (quoted && line[i + 1] === '"') {
                cur += '"';
                i++;
            }
            else
                quoted = !quoted;
        }
        else if (ch === ',' && !quoted) {
            out.push(cur);
            cur = '';
        }
        else
            cur += ch;
    }
    out.push(cur);
    return out;
}
/** SpreadsheetML 2003: opens natively in Excel without adding a heavy client-side xlsx dependency. */
export function downloadExcelCompatible(csv, filename) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = csv.split('\n').filter(Boolean).map((line) => `<Row>${parseCsvRow(line).map((cell) => `<Cell><Data ss:Type="String">${esc(cell)}</Data></Cell>`).join('')}</Row>`).join('');
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Performance"><Table>${rows}</Table></Worksheet></Workbook>`;
    downloadText(xml, filename, 'application/vnd.ms-excel;charset=utf-8');
}
