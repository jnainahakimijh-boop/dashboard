import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, FileSpreadsheet, FileText, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { useFilters } from '/src/state/FiltersContext.js';
import { useSettings } from '/src/state/SettingsContext.js';
import { useI18n } from '/src/i18n/index.js';
import { useToast } from '/src/state/ToastContext.js';
import { buildReportCsv, downloadCsv, downloadExcelCompatible } from '/src/lib/export.js';
import { createVeoliaPdfReport, downloadVeoliaPdf } from '/src/lib/pdfReport.js';
import { fmtRange } from '/src/lib/format.js';
import { Badge, Btn, Card, EmptyState } from '/src/components/ui/primitives.js';
const SCHEDULE_KEY = 'veolia.reports.schedules.v1';
const TEMPLATE_KEY = 'veolia.reports.template.v1';
const DEFAULT_SCHEDULES = [
    { id: 'sch-1', name: 'Weekly performance digest', frequency: 'Mondays 08:00', recipients: 'digital-leadership@veolia.example', next: 'Mon 08:00', active: true },
    { id: 'sch-2', name: 'Monthly campaign review', frequency: '1st of month 08:00', recipients: 'marketing@veolia.example', next: '1 Sep 08:00', active: true },
];
const ALL_SECTIONS = [
    { id: 'executive', en: 'Executive KPIs', fr: 'KPIs exécutifs' },
    { id: 'channels', en: 'Channel contribution', fr: 'Contribution des canaux' },
    { id: 'web', en: 'Web performance', fr: 'Performance web' },
    { id: 'social', en: 'Social media', fr: 'Réseaux sociaux' },
    { id: 'advocacy', en: 'Employee Advocacy', fr: 'Employee Advocacy' },
    { id: 'seo', en: 'SEO & Search', fr: 'SEO & Search' },
    { id: 'ai-search', en: 'AI Search & AEO', fr: 'Recherche IA & AEO' },
    { id: 'campaigns', en: 'Campaigns', fr: 'Campagnes' },
    { id: 'notes', en: 'Notes', fr: 'Notes' },
    { id: 'methodology', en: 'Methodology', fr: 'Méthodologie' },
];
function sectionsForScope(scope) {
    const tail = ['notes', 'methodology'];
    if (scope === 'overview')
        return ['executive', 'channels', ...tail];
    if (scope === 'web')
        return ['executive', 'web', 'channels', ...tail];
    if (scope === 'social')
        return ['executive', 'social', 'channels', ...tail];
    if (scope === 'advocacy')
        return ['executive', 'advocacy', ...tail];
    if (scope === 'seo')
        return ['executive', 'seo', ...tail];
    if (scope === 'ai-search')
        return ['executive', 'ai-search', ...tail];
    if (scope === 'campaigns')
        return ['executive', 'campaigns', ...tail];
    return ['executive', 'channels', 'web', 'social', 'advocacy', 'seo', 'ai-search', 'campaigns', ...tail];
}
function loadSchedules() {
    try {
        const raw = localStorage.getItem(SCHEDULE_KEY);
        return raw ? JSON.parse(raw) : DEFAULT_SCHEDULES;
    }
    catch {
        return DEFAULT_SCHEDULES;
    }
}
export default function ReportsPage() {
    const { filters, savedViews, applyView } = useFilters();
    const { settings } = useSettings();
    const { t, lang } = useI18n();
    const { toast } = useToast();
    const generatedAt = useMemo(() => new Date(), []);
    const [scope, setScope] = useState('all');
    const [title, setTitle] = useState(lang === 'fr' ? 'Rapport de performance digitale Veolia' : 'Veolia Digital Performance Report');
    const [subtitle, setSubtitle] = useState(lang === 'fr' ? 'Vue consolidée des canaux digitaux' : 'Consolidated digital-channel performance');
    const [summary, setSummary] = useState(lang === 'fr'
        ? 'Ce rapport synthétise les principaux signaux de performance sur la période sélectionnée et fournit une base claire pour les décisions de communication et de marketing digital.'
        : 'This report summarises the main performance signals for the selected period and provides a clear basis for digital communication and marketing decisions.');
    const [notes, setNotes] = useState('');
    const [sections, setSections] = useState(['executive', 'channels', 'web', 'social', 'advocacy', 'seo', 'ai-search', 'campaigns', 'methodology']);
    const [schedules, setSchedules] = useState(loadSchedules);
    useEffect(() => {
        try {
            const raw = localStorage.getItem(TEMPLATE_KEY);
            if (!raw)
                return;
            const v = JSON.parse(raw);
            if (v.title)
                setTitle(v.title);
            if (v.subtitle)
                setSubtitle(v.subtitle);
            if (v.summary)
                setSummary(v.summary);
            if (typeof v.notes === 'string')
                setNotes(v.notes);
            if (v.scope)
                setScope(v.scope);
            if (Array.isArray(v.sections) && v.sections.length)
                setSections(v.sections);
        }
        catch { /* ignore bad local template */ }
    }, []);
    const persistSchedules = (next) => {
        setSchedules(next);
        try {
            localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
        }
        catch { /* no-op */ }
    };
    const reportCsv = () => buildReportCsv(filters, scope, { methodology: settings.exportMethodology, comparison: settings.exportComparison });
    const doExport = () => {
        downloadCsv(reportCsv(), `veolia-digital-performance_${scope}_${generatedAt.toISOString().slice(0, 10)}.csv`);
        toast(t('rep.exportCsv') + ' ✓');
    };
    const doExcel = () => {
        downloadExcelCompatible(reportCsv(), `veolia-digital-performance_${scope}_${generatedAt.toISOString().slice(0, 10)}.xls`);
        toast((lang === 'fr' ? 'Export Excel' : 'Excel export') + ' ✓');
    };
    const doPdf = () => {
        if (!sections.length) {
            toast(lang === 'fr' ? 'Sélectionnez au moins une section.' : 'Select at least one report section.', 'error');
            return;
        }
        const bytes = createVeoliaPdfReport(filters, {
            title,
            subtitle,
            summary,
            notes,
            scope,
            sections,
            includeComparison: settings.exportComparison,
            language: lang,
            generatedBy: settings.profileName,
        });
        downloadVeoliaPdf(bytes, `veolia-digital-performance_${scope}_${generatedAt.toISOString().slice(0, 10)}.pdf`);
        toast((lang === 'fr' ? 'Rapport PDF téléchargé' : 'PDF report downloaded') + ' ✓');
    };
    const saveTemplate = () => {
        try {
            localStorage.setItem(TEMPLATE_KEY, JSON.stringify({ title, subtitle, summary, notes, scope, sections }));
        }
        catch { /* no-op */ }
        toast(lang === 'fr' ? 'Modèle de rapport enregistré' : 'Report template saved');
    };
    const resetTemplate = () => {
        setScope('all');
        setTitle(lang === 'fr' ? 'Rapport de performance digitale Veolia' : 'Veolia Digital Performance Report');
        setSubtitle(lang === 'fr' ? 'Vue consolidée des canaux digitaux' : 'Consolidated digital-channel performance');
        setSummary(lang === 'fr'
            ? 'Ce rapport synthétise les principaux signaux de performance sur la période sélectionnée et fournit une base claire pour les décisions de communication et de marketing digital.'
            : 'This report summarises the main performance signals for the selected period and provides a clear basis for digital communication and marketing decisions.');
        setNotes('');
        setSections(['executive', 'channels', 'web', 'social', 'advocacy', 'seo', 'campaigns', 'methodology']);
        try {
            localStorage.removeItem(TEMPLATE_KEY);
        }
        catch { /* no-op */ }
        toast(lang === 'fr' ? 'Modèle réinitialisé' : 'Template reset');
    };
    const toggleSection = (id) => setSections((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
    const activeFilterSummary = [];
    if (filters.markets.length)
        activeFilterSummary.push(`${t('filters.market')}: ${filters.markets.join(', ').toUpperCase()}`);
    if (filters.regions.length)
        activeFilterSummary.push(`${t('filters.region')}: ${filters.regions.join(', ')}`);
    if (filters.languages.length)
        activeFilterSummary.push(`${t('filters.language')}: ${filters.languages.join(', ').toUpperCase()}`);
    if (filters.channels.length)
        activeFilterSummary.push(`${t('filters.channel')}: ${filters.channels.join(', ')}`);
    if (filters.platforms.length)
        activeFilterSummary.push(`${t('filters.platform')}: ${filters.platforms.join(', ')}`);
    if (filters.devices.length)
        activeFilterSummary.push(`${t('filters.device')}: ${filters.devices.join(', ')}`);
    return (_jsxs("div", { className: "page-shell flex flex-col gap-[var(--gap-grid)]", children: [_jsxs("div", { className: "grid gap-[var(--gap-grid)] xl:grid-cols-[1.15fr_.85fr]", children: [_jsxs(Card, { title: lang === 'fr' ? 'Générateur de rapport PDF' : 'PDF report builder', subtitle: lang === 'fr' ? 'Modifiez le contenu du rapport, puis téléchargez un PDF Veolia prêt à partager.' : 'Edit the report content, then download a Veolia-branded PDF ready to share.', children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("label", { className: "block md:col-span-2", children: [_jsx("span", { className: "mb-1.5 block text-[12px] font-semibold text-t1", children: lang === 'fr' ? 'Titre du rapport' : 'Report title' }), _jsx("input", { value: title, onChange: (e) => setTitle(e.target.value), className: "h-11 w-full rounded-[6px] border border-brds bg-inset px-3 text-[13px] text-t1" })] }), _jsxs("label", { className: "block md:col-span-2", children: [_jsx("span", { className: "mb-1.5 block text-[12px] font-semibold text-t1", children: lang === 'fr' ? 'Sous-titre' : 'Subtitle' }), _jsx("input", { value: subtitle, onChange: (e) => setSubtitle(e.target.value), className: "h-11 w-full rounded-[6px] border border-brds bg-inset px-3 text-[13px] text-t1" })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "mb-1.5 block text-[12px] font-semibold text-t1", children: lang === 'fr' ? 'Périmètre' : 'Scope' }), _jsxs("select", { value: scope, onChange: (e) => { const next = e.target.value; setScope(next); setSections(sectionsForScope(next)); }, className: "h-11 w-full rounded-[6px] border border-brds bg-inset px-3 text-[13px] text-t1", children: [_jsx("option", { value: "all", children: lang === 'fr' ? 'Dashboard complet' : 'Entire dashboard' }), _jsx("option", { value: "overview", children: lang === 'fr' ? 'Vue exécutive' : 'Executive overview' }), _jsx("option", { value: "social", children: "Social Media" }), _jsx("option", { value: "advocacy", children: "Employee Advocacy" }), _jsx("option", { value: "web", children: "Web Performance" }), _jsx("option", { value: "seo", children: "SEO & Search" }), _jsx("option", { value: "ai-search", children: lang === 'fr' ? 'Recherche IA & AEO' : 'AI Search & AEO' }), _jsx("option", { value: "campaigns", children: lang === 'fr' ? 'Campagnes' : 'Campaign performance' }), _jsx("option", { value: "selection", children: lang === 'fr' ? 'Sélection filtrée' : 'Current filtered selection' })] })] }), _jsxs("div", { children: [_jsx("span", { className: "mb-1.5 block text-[12px] font-semibold text-t1", children: lang === 'fr' ? 'Période du dashboard' : 'Dashboard period' }), _jsx("div", { className: "flex h-11 items-center rounded-[6px] border border-brd bg-card2 px-3 text-[12px] text-t2", children: fmtRange(filters.from, filters.to, lang) })] }), _jsxs("label", { className: "block md:col-span-2", children: [_jsx("span", { className: "mb-1.5 block text-[12px] font-semibold text-t1", children: lang === 'fr' ? 'Résumé exécutif' : 'Executive summary' }), _jsx("textarea", { rows: 4, value: summary, onChange: (e) => setSummary(e.target.value), className: "w-full rounded-[6px] border border-brds bg-inset p-3 text-[13px] leading-6 text-t1" })] }), _jsxs("label", { className: "block md:col-span-2", children: [_jsx("span", { className: "mb-1.5 block text-[12px] font-semibold text-t1", children: lang === 'fr' ? 'Notes libres' : 'Free-form notes' }), _jsx("textarea", { rows: 3, value: notes, onChange: (e) => setNotes(e.target.value), placeholder: lang === 'fr' ? 'Ajoutez un commentaire, une décision ou un contexte...' : 'Add context, decisions or commentary...', className: "w-full rounded-[6px] border border-brds bg-inset p-3 text-[13px] leading-6 text-t1" })] })] }), _jsxs("fieldset", { className: "mt-5", children: [_jsx("legend", { className: "mb-2 text-[12px] font-semibold text-t1", children: lang === 'fr' ? 'Sections à inclure' : 'Sections to include' }), _jsx("div", { className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-3", children: ALL_SECTIONS.map((s) => (_jsxs("label", { className: "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[6px] border border-brd bg-card2 px-3 py-2 text-[12px] text-t2 hover:border-brds", children: [_jsx("input", { type: "checkbox", checked: sections.includes(s.id), onChange: () => toggleSection(s.id), className: "h-4 w-4 accent-[#ee0000]" }), _jsx("span", { children: s[lang] })] }, s.id))) })] }), _jsxs("div", { className: "mt-5 flex flex-wrap gap-2 border-t border-brd pt-4", children: [_jsxs(Btn, { variant: settings.exportFormat === 'pdf' ? 'primary' : 'default', onClick: doPdf, children: [_jsx(FileText, { size: 14, "aria-hidden": true }), lang === 'fr' ? 'Télécharger le PDF' : 'Download PDF', settings.exportFormat === 'pdf' ? ` · ${lang === 'fr' ? 'préféré' : 'preferred'}` : ''] }), _jsxs(Btn, { variant: settings.exportFormat === 'csv' ? 'primary' : 'default', onClick: doExport, children: [_jsx(Download, { size: 14, "aria-hidden": true }), "CSV", settings.exportFormat === 'csv' ? ` · ${lang === 'fr' ? 'préféré' : 'preferred'}` : ''] }), _jsxs(Btn, { variant: settings.exportFormat === 'xlsx' ? 'primary' : 'default', onClick: doExcel, children: [_jsx(FileSpreadsheet, { size: 14, "aria-hidden": true }), "Excel", settings.exportFormat === 'xlsx' ? ` · ${lang === 'fr' ? 'préféré' : 'preferred'}` : ''] }), _jsxs(Btn, { onClick: saveTemplate, children: [_jsx(Save, { size: 14, "aria-hidden": true }), lang === 'fr' ? 'Enregistrer le modèle' : 'Save template'] }), _jsxs(Btn, { variant: "ghost", onClick: resetTemplate, children: [_jsx(RotateCcw, { size: 14, "aria-hidden": true }), lang === 'fr' ? 'Réinitialiser' : 'Reset'] })] })] }), _jsxs(Card, { title: lang === 'fr' ? 'Aperçu du rapport' : 'Report preview', subtitle: lang === 'fr' ? 'Ce qui sera utilisé dans le fichier téléchargé.' : 'What will be used in the downloaded file.', children: [_jsxs("div", { className: "overflow-hidden rounded-[6px] border border-brds bg-white text-[#1c1c1f] shadow-[0_4px_12px_rgba(9,8,22,.08)]", children: [_jsx("div", { className: "h-2 bg-[#ee0000]" }), _jsxs("div", { className: "p-5", children: [_jsxs("div", { className: "flex items-center gap-3 border-b border-[#e9e6f4] pb-4", children: [_jsx("img", { src: "/veolia-logo.webp", alt: "Veolia", className: "h-7 w-auto" }), _jsx("div", { className: "text-[12px] font-bold text-[#002d62]", children: "DIGITAL PERFORMANCE" })] }), _jsx("h3", { className: "mb-1 mt-5 text-[20px] font-bold text-[#002d62]", children: title || (lang === 'fr' ? 'Rapport sans titre' : 'Untitled report') }), _jsx("p", { className: "m-0 text-[11.5px] text-[#75748b]", children: subtitle }), _jsxs("dl", { className: "mt-5 grid grid-cols-[110px_1fr] gap-y-2 text-[11px]", children: [_jsx("dt", { className: "font-semibold text-[#55555a]", children: lang === 'fr' ? 'Période' : 'Period' }), _jsx("dd", { className: "m-0", children: fmtRange(filters.from, filters.to, lang) }), _jsx("dt", { className: "font-semibold text-[#55555a]", children: lang === 'fr' ? 'Filtres' : 'Filters' }), _jsx("dd", { className: "m-0", children: activeFilterSummary.length ? activeFilterSummary.join(' · ') : (lang === 'fr' ? 'Tous' : 'All') }), _jsx("dt", { className: "font-semibold text-[#55555a]", children: lang === 'fr' ? 'Sections' : 'Sections' }), _jsx("dd", { className: "m-0", children: sections.length })] }), _jsxs("div", { className: "mt-5 rounded-[6px] bg-[#f2f1f9] p-4", children: [_jsx("div", { className: "mb-1 text-[11px] font-bold text-[#002d62]", children: lang === 'fr' ? 'Résumé exécutif' : 'Executive summary' }), _jsx("p", { className: "m-0 text-[11px] leading-5 text-[#55555a]", children: summary || '—' })] }), _jsx("div", { className: "mt-4 flex flex-wrap gap-1.5", children: sections.map((id) => _jsx(Badge, { tone: "neutral", children: ALL_SECTIONS.find((x) => x.id === id)?.[lang] ?? id }, id)) })] })] }), _jsxs("div", { className: "mt-4 rounded-[6px] border border-brd bg-card2 p-3 text-[11.5px] leading-5 text-t2", children: [_jsx("strong", { className: "text-t1", children: lang === 'fr' ? 'Astuce :' : 'Tip:' }), " ", lang === 'fr' ? 'Modifiez les filtres globaux en haut de la page avant de générer le rapport. Le PDF utilise exactement la période et les filtres actifs.' : 'Change the global filters at the top of the page before generating the report. The PDF uses the exact active period and filters.'] })] })] }), _jsxs("div", { className: "grid gap-[var(--gap-grid)] lg:grid-cols-2", children: [_jsx(Card, { title: t('rep.saved'), subtitle: t('rep.savedSub'), children: savedViews.length === 0 ? (_jsx(EmptyState, { title: t('header.noViews'), body: t('header.saveView'), icon: _jsx(SlidersHorizontal, { size: 20, "aria-hidden": true }) })) : (_jsx("ul", { className: "m-0 flex list-none flex-col gap-2 p-0", children: savedViews.map((v) => (_jsxs("li", { className: "flex items-center gap-3 rounded-[6px] border border-brd bg-card2 px-3 py-2.5", children: [_jsx(FileText, { size: 14, className: "shrink-0 text-t3", "aria-hidden": true }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate text-[12.5px] font-medium text-t1", children: v.name }), _jsx("div", { className: "text-[10.5px] text-t3", children: fmtRange(v.filters.from, v.filters.to, lang) })] }), _jsx(Btn, { size: "sm", onClick: () => applyView(v.id), children: t('rep.open') })] }, v.id))) })) }), _jsx(Card, { title: lang === 'fr' ? 'Rapports programmés' : 'Scheduled reports', subtitle: lang === 'fr' ? 'Activez ou désactivez les livraisons du prototype.' : 'Enable or disable prototype deliveries.', children: _jsx("div", { className: "space-y-2", children: schedules.map((s) => (_jsxs("div", { className: "flex flex-wrap items-center gap-3 rounded-[6px] border border-brd bg-card2 p-3", children: [_jsx(Calendar, { size: 15, className: "text-t3", "aria-hidden": true }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "text-[12.5px] font-semibold text-t1", children: s.name }), _jsxs("div", { className: "mt-0.5 text-[10.5px] text-t3", children: [s.frequency, " \u00B7 ", s.recipients, " \u00B7 ", lang === 'fr' ? 'Prochain' : 'Next', ": ", s.next] })] }), _jsxs("button", { type: "button", role: "switch", "aria-checked": s.active, onClick: () => persistSchedules(schedules.map((x) => x.id === s.id ? { ...x, active: !x.active } : x)), className: `relative h-7 w-12 rounded-full border transition ${s.active ? 'border-[#ee0000] bg-[#ee0000]' : 'border-brds bg-inset'}`, children: [_jsx("span", { className: `absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${s.active ? 'left-6' : 'left-1'}` }), _jsxs("span", { className: "sr-only", children: [s.active ? 'Disable' : 'Enable', " ", s.name] })] })] }, s.id))) }) })] })] }));
}
