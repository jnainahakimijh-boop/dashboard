import { Activity, BarChart3, BookOpenCheck, Bot, FileText, Filter, Globe2, LayoutDashboard, ListChecks, Megaphone, Settings, Share2, SearchCheck, UsersRound, Sparkles, } from 'lucide-react';
/** Navigation is grouped by the question each area answers, so a first-time user
 *  can find a page by the decision they are making rather than by scanning a
 *  single long list. */
export const NAV_SECTIONS = [
    {
        labelKey: 'nav.executive',
        items: [
            { path: '/', labelKey: 'nav.overview', icon: LayoutDashboard },
            { path: '/global', labelKey: 'nav.global', icon: Globe2 },
        ],
    },
    {
        labelKey: 'nav.channels',
        items: [
            { path: '/web', labelKey: 'nav.web', icon: Activity },
            { path: '/social', labelKey: 'nav.social', icon: Share2 },
            { path: '/advocacy', labelKey: 'nav.advocacy', icon: UsersRound },
            { path: '/content', labelKey: 'nav.content', icon: FileText },
            { path: '/seo', labelKey: 'nav.seo', icon: SearchCheck },
            { path: '/ai-search', labelKey: 'nav.aiSearch', icon: Bot },
            { path: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone },
        ],
    },
    {
        labelKey: 'nav.conversion',
        items: [
            { path: '/journey', labelKey: 'nav.journey', icon: Filter },
            { path: '/audience', labelKey: 'nav.audience', icon: Globe2 },
        ],
    },
    {
        labelKey: 'nav.intelligence',
        items: [
            { path: '/insights', labelKey: 'nav.insights', icon: Sparkles },
            { path: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
        ],
    },
    {
        labelKey: 'nav.governance',
        items: [
            { path: '/data-quality', labelKey: 'nav.dq', icon: ListChecks },
            { path: '/kpi-catalogue', labelKey: 'nav.catalogue', icon: BookOpenCheck },
        ],
    },
    {
        labelKey: 'nav.system',
        items: [
            { path: '/settings', labelKey: 'nav.settings', icon: Settings },
        ],
    },
];
export const PAGE_META = {
    '/global': { eyebrowKey: 'global.eyebrow', titleKey: 'global.title', subtitleKey: 'global.subtitle', filterDims: ['markets', 'regions', 'languages', 'channels', 'platforms', 'devices', 'campaigns', 'themes', 'formats', 'advocacyPrograms', 'advocateGroups'] },
    '/advocacy': { eyebrowKey: 'adv.eyebrow', titleKey: 'adv.title', subtitleKey: 'adv.subtitle', filterDims: ['markets', 'regions', 'languages', 'advocacyPrograms', 'advocateGroups'] },
    '/seo': { eyebrowKey: 'seo.eyebrow', titleKey: 'seo.title', subtitleKey: 'seo.subtitle', filterDims: ['markets', 'regions', 'languages'] },
    '/ai-search': { eyebrowKey: 'aeo.eyebrow', titleKey: 'aeo.title', subtitleKey: 'aeo.subtitle', filterDims: ['markets', 'regions', 'languages'] },
    '/': { eyebrowKey: 'ov.eyebrow', titleKey: 'ov.title', subtitleKey: 'ov.subtitle', filterDims: ['markets', 'regions', 'languages', 'channels', 'platforms', 'devices', 'campaigns', 'themes', 'formats', 'advocacyPrograms', 'advocateGroups'] },
    '/web': { eyebrowKey: 'web.eyebrow', titleKey: 'web.title', subtitleKey: 'web.subtitle', filterDims: ['markets', 'regions', 'languages', 'channels', 'devices'] },
    '/social': { eyebrowKey: 'soc.eyebrow', titleKey: 'soc.title', subtitleKey: 'soc.subtitle', filterDims: ['markets', 'regions', 'languages', 'platforms'] },
    '/content': { eyebrowKey: 'cnt.eyebrow', titleKey: 'cnt.title', subtitleKey: 'cnt.subtitle', filterDims: ['markets', 'regions', 'languages', 'platforms', 'themes', 'formats'] },
    '/campaigns': { eyebrowKey: 'cmp.eyebrow', titleKey: 'cmp.title', subtitleKey: 'cmp.subtitle', filterDims: ['markets', 'regions', 'languages', 'campaigns', 'themes'] },
    '/journey': { eyebrowKey: 'jny.eyebrow', titleKey: 'jny.title', subtitleKey: 'jny.subtitle', filterDims: ['markets', 'regions', 'languages', 'channels', 'platforms', 'devices', 'campaigns', 'themes'] },
    '/audience': { eyebrowKey: 'aud.eyebrow', titleKey: 'aud.title', subtitleKey: 'aud.subtitle', filterDims: ['markets', 'regions', 'languages', 'channels', 'devices'] },
    '/insights': { eyebrowKey: 'ins.eyebrow', titleKey: 'ins.title', subtitleKey: 'ins.subtitle', filterDims: ['markets', 'regions', 'languages', 'channels', 'platforms', 'devices', 'campaigns', 'themes', 'formats', 'advocacyPrograms', 'advocateGroups'] },
    '/recommendations': { eyebrowKey: 'rec.eyebrow', titleKey: 'rec.title', subtitleKey: 'rec.subtitle', filterDims: ['markets', 'regions', 'languages', 'channels', 'platforms', 'devices', 'campaigns', 'themes', 'formats', 'advocacyPrograms', 'advocateGroups'] },
    '/reports': { eyebrowKey: 'rep.eyebrow', titleKey: 'rep.title', subtitleKey: 'rep.subtitle', filterDims: [] },
    '/data-quality': { eyebrowKey: 'dq.eyebrow', titleKey: 'dq.title', subtitleKey: 'dq.subtitle', filterDims: ['markets', 'regions', 'languages'] },
    '/kpi-catalogue': { eyebrowKey: 'cat.eyebrow', titleKey: 'cat.title', subtitleKey: 'cat.subtitle', filterDims: [] },
    '/settings': { eyebrowKey: 'set.eyebrow', titleKey: 'set.title', subtitleKey: 'set.subtitle', filterDims: [] },
    '/admin': { eyebrowKey: 'adm.eyebrow', titleKey: 'adm.title', subtitleKey: 'adm.subtitle', filterDims: [] },
};
/** Pages where the global filter bar is shown at all */
export const FILTERED_PAGES = new Set(['/', '/global', '/advocacy', '/seo', '/ai-search', '/web', '/social', '/content', '/campaigns', '/journey', '/audience', '/insights', '/data-quality']);
