import { CHANNELS, dayToDate } from '/src/data/dimensions.js';
import { advocacyTotals } from '/src/lib/advocacy.js';
import { campaignTotals, comparisonQ, contentItems, pagesBy, socialTotals, toQ, webBy, webTotals } from '/src/lib/aggregate.js';
import { filteredQueries, seoTotals } from '/src/lib/seo.js';
import { aiSearchSnapshot } from '/src/lib/aiSearch.js';
import { bounceRate, cpa, ctr, cvr, engagementRateSocial, engagementRateWeb, relChange } from '/src/lib/metrics.js';
const A4 = { w: 595.28, h: 841.89 };
const M = 46;
const RED = [238, 0, 0];
const NAVY = [0, 45, 98];
const GREY = [85, 85, 90];
const LIGHT = [242, 241, 249];
const BORDER = [213, 211, 227];
function ascii(input) {
    return input
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, '-')
        .replace(/×/g, 'x')
        .replace(/→/g, '->')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E\n]/g, '?');
}
function pdfString(input) {
    return ascii(input).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function rgb(rgb) { return rgb.map((v) => (v / 255).toFixed(4)).join(' '); }
function text(x, y, value, size = 10, bold = false, color = GREY) {
    return `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfString(value)}) Tj ET`;
}
function rect(x, y, w, h, fill, stroke) {
    const parts = [`${rgb(fill)} rg`];
    if (stroke)
        parts.push(`${rgb(stroke)} RG 0.7 w`);
    parts.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${stroke ? 'B' : 'f'}`);
    return parts.join(' ');
}
function line(x1, y1, x2, y2, color = BORDER, width = 0.7) {
    return `${rgb(color)} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
}
function wrap(value, maxChars) {
    const words = ascii(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const word of words) {
        if (!cur)
            cur = word;
        else if ((cur + ' ' + word).length <= maxChars)
            cur += ` ${word}`;
        else {
            lines.push(cur);
            cur = word;
        }
    }
    if (cur)
        lines.push(cur);
    return lines.length ? lines : [''];
}
function fmtInt(v) {
    if (v == null || !Number.isFinite(v))
        return '-';
    return Math.round(v).toLocaleString('en-US');
}
function fmtPct(v) {
    if (v == null || !Number.isFinite(v))
        return '-';
    return `${v.toFixed(1)}%`;
}
function fmtMoney(v) {
    if (v == null || !Number.isFinite(v))
        return '-';
    return `EUR ${v.toFixed(v < 100 ? 2 : 0)}`;
}
function iso(d) { return dayToDate(d).toISOString().slice(0, 10); }
function delta(cur, prev) {
    const d = relChange(cur, prev);
    return d == null ? '-' : `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
}
class ReportCanvas {
    pages = [[]];
    page = 0;
    y = A4.h - M;
    get p() { return this.pages[this.page]; }
    newPage() {
        this.pages.push([]);
        this.page += 1;
        this.y = A4.h - M;
        this.header(false);
    }
    ensure(h) { if (this.y - h < M + 26)
        this.newPage(); }
    header(first) {
        this.p.push(rect(0, A4.h - 16, A4.w, 16, RED));
        if (!first) {
            this.p.push(text(M, A4.h - 34, 'VEOLIA DIGITAL PERFORMANCE', 8.5, true, NAVY));
            this.p.push(text(A4.w - 93, A4.h - 34, `Page ${this.page + 1}`, 8, false, GREY));
            this.p.push(line(M, A4.h - 40, A4.w - M, A4.h - 40));
            this.y = A4.h - 58;
        }
    }
    title(value) {
        this.ensure(44);
        this.y -= 7;
        this.p.push(text(M, this.y, value, 17, true, NAVY));
        this.y -= 25;
    }
    paragraph(value, size = 9.5, maxChars = 92) {
        const lines = wrap(value, maxChars);
        this.ensure(lines.length * 13 + 6);
        for (const l of lines) {
            this.p.push(text(M, this.y, l, size, false, GREY));
            this.y -= 13;
        }
        this.y -= 4;
    }
    kpiGrid(items) {
        const cols = 3;
        const gap = 10;
        const w = (A4.w - M * 2 - gap * (cols - 1)) / cols;
        const h = 65;
        const rows = Math.ceil(items.length / cols);
        this.ensure(rows * (h + gap));
        items.forEach((item, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = M + col * (w + gap);
            const top = this.y - row * (h + gap);
            const y = top - h;
            this.p.push(rect(x, y, w, h, [255, 255, 255], BORDER));
            this.p.push(rect(x, y + h - 4, w, 4, i === 0 ? RED : NAVY));
            this.p.push(text(x + 10, y + 43, item.label, 8.2, true, GREY));
            this.p.push(text(x + 10, y + 22, item.value, 16, true, NAVY));
            if (item.compare)
                this.p.push(text(x + 10, y + 8, item.compare, 7.6, false, GREY));
        });
        this.y -= rows * (h + gap) + 5;
    }
    table(headers, rows, widths) {
        const totalW = A4.w - M * 2;
        const ws = widths ?? headers.map(() => totalW / headers.length);
        const headerH = 24;
        const rowH = 22;
        this.ensure(headerH + Math.min(rows.length, 4) * rowH + 12);
        let x = M;
        this.p.push(rect(M, this.y - headerH, totalW, headerH, LIGHT, BORDER));
        headers.forEach((h, i) => { this.p.push(text(x + 6, this.y - 16, h, 7.6, true, NAVY)); x += ws[i]; });
        this.y -= headerH;
        for (const row of rows) {
            this.ensure(rowH);
            x = M;
            this.p.push(rect(M, this.y - rowH, totalW, rowH, [255, 255, 255], BORDER));
            row.forEach((cell, i) => { this.p.push(text(x + 6, this.y - 14, cell, 7.6, false, GREY)); x += ws[i]; });
            this.y -= rowH;
        }
        this.y -= 8;
    }
    bars(items) {
        const max = Math.max(1, ...items.map((x) => x.value));
        const labelW = 105;
        const barW = A4.w - M * 2 - labelW - 58;
        this.ensure(items.length * 24 + 10);
        items.forEach((item, idx) => {
            this.p.push(text(M, this.y - 10, item.label, 8, false, GREY));
            this.p.push(rect(M + labelW, this.y - 14, barW, 8, LIGHT));
            this.p.push(rect(M + labelW, this.y - 14, barW * Math.max(0, item.value) / max, 8, idx === 0 ? RED : NAVY));
            this.p.push(text(A4.w - M - 50, this.y - 11, item.display, 8, true, NAVY));
            this.y -= 24;
        });
        this.y -= 4;
    }
}
function buildPdfBytes(pages) {
    const objs = [];
    const add = (body) => { objs.push(body); return objs.length; };
    const font1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const font2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pagesObj = add('PAGES_PLACEHOLDER');
    const pageIds = [];
    for (const cmds of pages) {
        const stream = cmds.join('\n');
        const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
        const pageId = add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentId} 0 R >>`);
        pageIds.push(pageId);
    }
    objs[pagesObj - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
    const catalog = add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
    const chunks = ['%PDF-1.4\n'];
    const offsets = [0];
    let offset = chunks[0].length;
    objs.forEach((obj, idx) => {
        offsets.push(offset);
        const chunk = `${idx + 1} 0 obj\n${obj}\nendobj\n`;
        chunks.push(chunk);
        offset += chunk.length;
    });
    const xref = offset;
    let tail = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objs.length; i++)
        tail += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    tail += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    chunks.push(tail);
    return new TextEncoder().encode(chunks.join(''));
}
export function createVeoliaPdfReport(filters, opts) {
    const q = toQ(filters);
    const p = comparisonQ(q, filters.compare);
    const web = webTotals(q);
    const webPrev = webTotals(p);
    const social = socialTotals(q);
    const socialPrev = socialTotals(p);
    const adv = advocacyTotals(q, filters.advocacyPrograms, filters.advocateGroups);
    const advPrev = advocacyTotals(p, filters.advocacyPrograms, filters.advocateGroups);
    const seo = seoTotals(q);
    const seoPrev = seoTotals(p);
    const aiSearch = aiSearchSnapshot(q);
    const aiSearchPrev = aiSearchSnapshot(p);
    const camp = campaignTotals(q);
    const campPrev = campaignTotals(p);
    const content = contentItems(q);
    const pageTotals = [...pagesBy(q, 'day').values()].reduce((a, x) => {
        for (const k of ['sessions','engaged','ctaClicks','formStarts','formCompletions','conversions']) a[k] = (a[k] || 0) + (x[k] || 0);
        return a;
    }, {});
    const queryRows = filteredQueries(q);
    const top10Queries = queryRows.filter((r) => r.position <= 10).length;
    const brandedShare = seo.clicks ? (seo.brandedClicks / seo.clicks) * 100 : null;
    const include = (s) => opts.sections.includes(s);
    const compare = opts.includeComparison && filters.compare !== 'none';
    const c = new ReportCanvas();
    c.header(true);
    c.p.push(text(M, c.y - 4, 'VEOLIA', 13, true, RED));
    c.p.push(text(M + 52, c.y - 4, 'DIGITAL PERFORMANCE', 13, true, NAVY));
    c.y -= 28;
    c.p.push(text(M, c.y, opts.title || 'Digital Performance Report', 24, true, NAVY));
    c.y -= 23;
    if (opts.subtitle) {
        c.p.push(text(M, c.y, opts.subtitle, 10, false, GREY));
        c.y -= 17;
    }
    c.p.push(line(M, c.y, A4.w - M, c.y, RED, 1.5));
    c.y -= 18;
    c.table(['Analysis period', 'Comparison', 'Scope', 'Generated'], [[`${iso(q.from)} to ${iso(q.to)}`, compare ? `${iso(p.from)} to ${iso(p.to)}` : 'None', opts.scope, new Date().toISOString().slice(0, 16).replace('T', ' ')]], [128, 128, 105, 142]);
    if (opts.summary.trim()) {
        c.title(opts.language === 'fr' ? 'Resume executif' : 'Executive summary');
        c.paragraph(opts.summary, 9.8);
    }
    if (include('executive')) {
        c.title(opts.language === 'fr' ? 'Indicateurs cles' : 'Key performance indicators');
        c.kpiGrid([
            { label: 'Website sessions', value: fmtInt(web.sessions), compare: compare ? `${delta(web.sessions, webPrev.sessions)} vs comparison` : undefined },
            { label: 'Website users', value: fmtInt(web.users), compare: compare ? `${delta(web.users, webPrev.users)} vs comparison` : undefined },
            { label: 'Conversions', value: fmtInt(web.conversions), compare: compare ? `${delta(web.conversions, webPrev.conversions)} vs comparison` : undefined },
            { label: 'Conversion rate', value: fmtPct(cvr(web.conversions, web.sessions)), compare: compare ? `${fmtPct(cvr(webPrev.conversions, webPrev.sessions))} comparison` : undefined },
            { label: 'Social impressions', value: fmtInt(social.impressions), compare: compare ? `${delta(social.impressions, socialPrev.impressions)} vs comparison` : undefined },
            { label: 'Social engagement rate', value: fmtPct(engagementRateSocial(social.engagements, social.impressions)), compare: compare ? `${fmtPct(engagementRateSocial(socialPrev.engagements, socialPrev.impressions))} comparison` : undefined },
        ]);
        if (compare) {
            const sessionTarget = Math.max(1, Math.round(webPrev.sessions * 1.08));
            const conversionTarget = Math.max(1, Math.round(webPrev.conversions * 1.10));
            c.table(['Target KPI', 'Actual', 'Target', 'Attainment'], [
                ['Website sessions', fmtInt(web.sessions), fmtInt(sessionTarget), fmtPct(web.sessions / sessionTarget * 100)],
                ['Conversions', fmtInt(web.conversions), fmtInt(conversionTarget), fmtPct(web.conversions / conversionTarget * 100)],
            ], [190, 105, 105, 103]);
        }
    }
    if (include('channels')) {
        c.title(opts.language === 'fr' ? 'Contribution des canaux' : 'Channel contribution');
        const by = webBy(q, 'channel');
        const rows = CHANNELS.map((ch) => ({ label: ch.name, t: by.get(ch.id) })).filter((x) => Boolean(x.t));
        c.bars(rows.sort((a, b) => b.t.sessions - a.t.sessions).map((x) => ({ label: x.label, value: x.t.sessions, display: fmtInt(x.t.sessions) })));
    }
    if (include('web')) {
        c.title('Web performance');
        c.table(['Metric', 'Current', compare ? 'Comparison' : 'Context'], [
            ['Sessions', fmtInt(web.sessions), compare ? fmtInt(webPrev.sessions) : ''],
            ['Engagement rate', fmtPct(engagementRateWeb(web.engaged, web.sessions)), compare ? fmtPct(engagementRateWeb(webPrev.engaged, webPrev.sessions)) : ''],
            ['Bounce rate', fmtPct(bounceRate(web.engaged, web.sessions)), compare ? fmtPct(bounceRate(webPrev.engaged, webPrev.sessions)) : ''],
            ['CTA clicks', fmtInt(pageTotals.ctaClicks || 0), 'Landing-page interaction'],
            ['Form starts', fmtInt(pageTotals.formStarts || 0), 'Subset of CTA clicks'],
            ['Form completions', fmtInt(pageTotals.formCompletions || 0), 'Subset of form starts'],
            ['Conversions', fmtInt(web.conversions), compare ? fmtInt(webPrev.conversions) : ''],
            ['Conversion rate', fmtPct(cvr(web.conversions, web.sessions)), compare ? fmtPct(cvr(webPrev.conversions, webPrev.sessions)) : ''],
        ], [210, 140, 153]);
    }
    if (include('social')) {
        c.title('Social media');
        c.table(['Metric', 'Current', compare ? 'Comparison' : 'Context'], [
            ['Reach', fmtInt(social.reach), compare ? fmtInt(socialPrev.reach) : ''],
            ['Impressions', fmtInt(social.impressions), compare ? fmtInt(socialPrev.impressions) : ''],
            ['Engagements', fmtInt(social.engagements), compare ? fmtInt(socialPrev.engagements) : ''],
            ['Engagement rate', fmtPct(engagementRateSocial(social.engagements, social.impressions)), compare ? fmtPct(engagementRateSocial(socialPrev.engagements, socialPrev.impressions)) : ''],
            ['Clicks / CTR', `${fmtInt(social.clicks)} / ${fmtPct(ctr(social.clicks, social.impressions))}`, compare ? `${fmtInt(socialPrev.clicks)} / ${fmtPct(ctr(socialPrev.clicks, socialPrev.impressions))}` : ''],
            ['Video views', fmtInt(social.videoViews || 0), compare ? fmtInt(socialPrev.videoViews || 0) : ''],
            ['Video completion rate', fmtPct(social.videoViews ? (social.videoComplete || 0) / social.videoViews * 100 : null), compare ? fmtPct(socialPrev.videoViews ? (socialPrev.videoComplete || 0) / socialPrev.videoViews * 100 : null) : ''],
            ['Average video watch time', social.videoViews ? `${Math.round((social.videoWatchSeconds || 0) / social.videoViews)}s` : '-', compare && socialPrev.videoViews ? `${Math.round((socialPrev.videoWatchSeconds || 0) / socialPrev.videoViews)}s` : ''],
        ], [210, 140, 153]);
    }
    if (include('advocacy')) {
        c.title('Employee Advocacy');
        c.table(['Metric', 'Current', compare ? 'Comparison' : 'Context'], [
            ['Registered advocates', fmtInt(adv.registered), compare ? fmtInt(advPrev.registered) : ''],
            ['Active advocates', fmtInt(adv.active), compare ? fmtInt(advPrev.active) : ''],
            ['Participation rate', fmtPct(adv.registered ? adv.active / adv.registered * 100 : null), compare ? fmtPct(advPrev.registered ? advPrev.active / advPrev.registered * 100 : null) : ''],
            ['Advocacy reach', fmtInt(adv.reach), compare ? fmtInt(advPrev.reach) : ''],
            ['Website sessions', fmtInt(adv.sessions), compare ? fmtInt(advPrev.sessions) : ''],
            ['Conversions', fmtInt(adv.conversions), compare ? fmtInt(advPrev.conversions) : ''],
        ], [210, 140, 153]);
    }
    if (include('seo')) {
        c.title('SEO & Search');
        c.table(['Metric', 'Current', compare ? 'Comparison' : 'Context'], [
            ['Search impressions', fmtInt(seo.impressions), compare ? fmtInt(seoPrev.impressions) : ''],
            ['Organic clicks', fmtInt(seo.clicks), compare ? fmtInt(seoPrev.clicks) : ''],
            ['Organic CTR', fmtPct(ctr(seo.clicks, seo.impressions)), compare ? fmtPct(ctr(seoPrev.clicks, seoPrev.impressions)) : ''],
            ['Average position', seo.avgPosition == null ? '-' : seo.avgPosition.toFixed(1), compare ? (seoPrev.avgPosition == null ? '-' : seoPrev.avgPosition.toFixed(1)) : ''],
            ['Ranking keywords', fmtInt(seo.rankingKeywords), compare ? fmtInt(seoPrev.rankingKeywords) : ''],
            ['Queries in Top 10', fmtInt(top10Queries), 'Current query snapshot'],
            ['Branded click share', fmtPct(brandedShare), compare ? fmtPct(seoPrev.clicks ? seoPrev.brandedClicks / seoPrev.clicks * 100 : null) : ''],
        ], [210, 140, 153]);
    }
    if (include('ai-search')) {
        c.title('AI Search & AEO');
        c.table(['Metric', 'Current', compare ? 'Comparison' : 'Context'], [
            ['AI visibility', fmtPct(aiSearch.visibilityRate), compare ? fmtPct(aiSearchPrev.visibilityRate) : 'Synthetic monitored answers'],
            ['Citation rate', fmtPct(aiSearch.citationRate), compare ? fmtPct(aiSearchPrev.citationRate) : 'Cited Veolia pages'],
            ['AI share of voice', fmtPct(aiSearch.shareOfVoice), compare ? fmtPct(aiSearchPrev.shareOfVoice) : 'Synthetic peer benchmark'],
            ['AI referral sessions', fmtInt(aiSearch.aiSessions), compare ? fmtInt(aiSearchPrev.aiSessions) : 'Attributed sample'],
            ['AI referral conversions', fmtInt(aiSearch.aiConversions), compare ? fmtInt(aiSearchPrev.aiConversions) : 'Attributed sample'],
            ['AI conversion rate', fmtPct(aiSearch.aiCvr), compare ? fmtPct(aiSearchPrev.aiCvr) : 'Conversions / AI sessions'],
            ['Tracked prompts', fmtInt(aiSearch.trackedPrompts), compare ? fmtInt(aiSearchPrev.trackedPrompts) : 'Configured prompt set'],
        ], [210, 140, 153]);
        c.paragraph('Prototype AEO metrics are deterministic sample data. Production requires an approved AI visibility/search intelligence provider, web analytics attribution, and crawler/log sources.', 8.5);
    }
    if (include('campaigns')) {
        c.title('Campaign performance');
        c.table(['Metric', 'Current', compare ? 'Comparison' : 'Context'], [
            ['Impressions', fmtInt(camp.impressions), compare ? fmtInt(campPrev.impressions) : ''],
            ['Clicks / CTR', `${fmtInt(camp.clicks)} / ${fmtPct(ctr(camp.clicks, camp.impressions))}`, compare ? `${fmtInt(campPrev.clicks)} / ${fmtPct(ctr(campPrev.clicks, campPrev.impressions))}` : ''],
            ['Spend', fmtMoney(camp.spend), compare ? fmtMoney(campPrev.spend) : ''],
            ['Conversions', fmtInt(camp.conversions), compare ? fmtInt(campPrev.conversions) : ''],
            ['CPA', fmtMoney(cpa(camp.spend, camp.conversions)), compare ? fmtMoney(cpa(campPrev.spend, campPrev.conversions)) : ''],
        ], [210, 140, 153]);
    }
    if (include('notes') && opts.notes.trim()) {
        c.title(opts.language === 'fr' ? 'Notes et commentaires' : 'Notes and comments');
        c.paragraph(opts.notes, 9.5);
    }
    if (include('methodology')) {
        c.title(opts.language === 'fr' ? 'Methodologie' : 'Methodology');
        c.paragraph('Derived metrics are calculated from source values. AI Search / AEO metrics in this prototype are explicitly synthetic and are not presented as live Veolia measurements. CTR = clicks / impressions x 100. Conversion rate = conversions / sessions x 100. Bounce rate = non-engaged sessions / sessions x 100. Employee Advocacy attribution is reported as an attributed subset, not added again to total web outcomes.', 8.8);
    }
    c.ensure(42);
    c.p.push(line(M, c.y, A4.w - M, c.y));
    c.y -= 15;
    c.p.push(text(M, c.y, `Content published in selected period: ${fmtInt(content.length)}`, 7.8, false, GREY));
    c.y -= 12;
    c.p.push(text(M, c.y, `Generated for Veolia Digital Performance${opts.generatedBy ? ` - ${opts.generatedBy}` : ''}`, 7.8, false, GREY));
    c.pages.forEach((page, i) => {
        page.push(text(A4.w - 92, 24, `Page ${i + 1}/${c.pages.length}`, 7.2, false, GREY));
        page.push(text(M, 24, 'Veolia Digital Performance - Internal prototype report', 7.2, false, GREY));
    });
    return buildPdfBytes(c.pages);
}
export function downloadVeoliaPdf(bytes, filename) {
    // BlobPart requires an ArrayBuffer-backed value under newer DOM typings.
    // Copy into a fresh, plain ArrayBuffer so this remains compatible with
    // TypeScript/Node versions where Uint8Array.buffer is ArrayBufferLike.
    const pdfBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(pdfBuffer).set(bytes);
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
