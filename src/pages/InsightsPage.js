import React, { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Flag, Info, Sparkles } from 'lucide-react';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { toQ } from '/src/lib/aggregate.js';
import { computeInsights } from '/src/lib/insights.js';
import { buildRecommendations, saveStatus } from '/src/lib/recommendations.js';
import { useToast } from '/src/state/ToastContext.js';
import { Badge, Card, EmptyState, PageSection, Segmented } from '/src/components/ui/primitives.js';

const h = React.createElement;

const CAT_TONE = { growth: 'pos', risk: 'neg', opportunity: 'accent', anomaly: 'warn', dataQuality: 'info', content: 'accent', conversion: 'neg' };
const CAT_KEY = {
  growth: 'ins.cat.growth', risk: 'ins.cat.risk', opportunity: 'ins.cat.opportunity',
  anomaly: 'ins.cat.anomaly', dataQuality: 'ins.cat.dataQuality', content: 'ins.cat.content', conversion: 'ins.cat.conversion',
};
const LEVEL_KEY = { low: 'rec.low', medium: 'rec.medium', high: 'rec.high' };
const STATUS_KEYS = {
  new: 'rec.st.new', accepted: 'rec.st.accepted', inprogress: 'rec.st.inprogress',
  completed: 'rec.st.completed', dismissed: 'rec.st.dismissed',
};
const STATUS_TONE = { new: 'info', accepted: 'accent', inprogress: 'warn', completed: 'pos', dismissed: 'neutral' };

function FilterChip({ id, active, count, label, onClick }) {
  return h('button', {
    type: 'button', 'aria-pressed': active, onClick: () => onClick(id),
    className: `inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[12px] font-semibold transition-colors ${active ? 'border-acc bg-acc text-white' : 'border-brd bg-card text-t2 hover:border-acc hover:text-acctext'}`,
  }, label, h('span', {
    className: `min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-card2 text-t3'}`,
  }, count));
}

/* ================= signals ================= */

function SignalsView({ insights, t, lang, fr }) {
  const [category, setCategory] = useState('all');
  const [impact, setImpact] = useState('all');
  const categories = useMemo(() => [...new Set(insights.map((i) => i.category))], [insights]);
  const counts = {
    all: insights.length,
    high: insights.filter((i) => i.impact === 'high').length,
    medium: insights.filter((i) => i.impact === 'medium').length,
    low: insights.filter((i) => i.impact === 'low').length,
  };
  const visible = insights.filter((i) => (category === 'all' || i.category === category) && (impact === 'all' || i.impact === impact));

  return h(Fragment, null,
    h(Card, {
      title: fr ? 'Filtrer les signaux' : 'Filter the signals',
      subtitle: fr
        ? 'Chaque signal suit la même structure : ce qui s’est passé, la preuve chiffrée, pourquoi c’est important, et l’action recommandée.'
        : 'Every signal follows the same structure: what happened, the numeric evidence, why it matters, and the recommended action.',
    },
      h('div', { className: 'grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,.75fr)] lg:items-end' },
        h('fieldset', { className: 'm-0 min-w-0 border-0 p-0' },
          h('legend', { className: 'mb-2 text-[12px] font-semibold text-t1' }, fr ? 'Niveau d’impact' : 'Impact level'),
          h('div', { className: 'flex flex-wrap gap-2', 'aria-label': fr ? 'Filtrer par impact' : 'Filter by impact' },
            [['all', fr ? 'Tous' : 'All'], ['high', fr ? 'Élevé' : 'High'], ['medium', fr ? 'Moyen' : 'Medium'], ['low', fr ? 'Faible' : 'Low']]
              .map(([id, label]) => h(FilterChip, { key: id, id, label, count: counts[id], active: impact === id, onClick: setImpact })))),
        h('label', { className: 'block min-w-0 text-[12px] font-semibold text-t1' },
          h('span', { className: 'mb-2 block' }, fr ? 'Catégorie' : 'Category'),
          h('select', {
            value: category, onChange: (e) => setCategory(e.target.value),
            className: 'h-10 w-full rounded-[6px] border border-brd bg-card px-3 text-[13px] text-t1',
          },
            h('option', { value: 'all' }, `${t('ins.all')} (${insights.length})`),
            categories.map((c) => h('option', { key: c, value: c }, `${t(CAT_KEY[c])} (${insights.filter((i) => i.category === c).length})`)))))),

    h('div', { className: 'flex flex-wrap items-center justify-between gap-2 px-0.5' },
      h('p', { className: 'm-0 text-[12.5px] font-medium text-t2' },
        fr ? `${visible.length} signal${visible.length > 1 ? 'ux' : ''} affiché${visible.length > 1 ? 's' : ''}` : `${visible.length} signal${visible.length === 1 ? '' : 's'} shown`),
      (category !== 'all' || impact !== 'all')
        ? h('button', {
          type: 'button', onClick: () => { setCategory('all'); setImpact('all'); },
          className: 'min-h-9 rounded-[6px] px-3 text-[12px] font-semibold text-acctext hover:bg-accsoft',
        }, fr ? 'Réinitialiser ces filtres' : 'Reset these filters')
        : null),

    visible.length === 0
      ? h(Card, null, h(EmptyState, { title: t('state.empty.title'), body: fr ? 'Aucun signal ne correspond à ces filtres.' : 'No signal matches these filters.' }))
      : h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-2' }, visible.map((ins) => h('article', {
        key: ins.id, className: 'fade-up min-w-0 overflow-hidden rounded-[6px] border border-brds bg-card',
      },
        h('div', { className: `h-1 w-full ${ins.impact === 'high' ? 'bg-neg' : ins.impact === 'medium' ? 'bg-warn' : 'bg-info'}`, 'aria-hidden': true }),
        h('div', { className: 'p-5' },
          h('div', { className: 'flex flex-wrap items-center justify-between gap-2.5' },
            h('div', { className: 'flex flex-wrap items-center gap-2' },
              h(Badge, { tone: CAT_TONE[ins.category] }, t(CAT_KEY[ins.category]).toUpperCase()),
              h(Badge, { tone: ins.impact === 'high' ? 'neg' : ins.impact === 'medium' ? 'warn' : 'info' }, `${fr ? 'IMPACT ' : 'IMPACT '}${t(LEVEL_KEY[ins.impact]).toUpperCase()}`)),
            h('span', { className: 'text-[11.5px] font-medium text-t3' },
              `${t('ins.confidence')}: `, h('strong', { className: 'text-t2' }, t(LEVEL_KEY[ins.confidence])))),

          h('div', { className: 'mt-4 flex items-start gap-3' },
            h('span', { className: 'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card2', 'aria-hidden': true },
              ins.direction === 1
                ? h(ArrowUpRight, { size: 18, className: 'text-pos' })
                : ins.direction === -1
                  ? h(ArrowDownRight, { size: 18, className: 'text-neg' })
                  : h(Flag, { size: 16, className: 'text-warn' })),
            h('div', { className: 'min-w-0' },
              h('div', { className: 'text-[10.5px] font-bold uppercase tracking-[.08em] text-t3' }, fr ? 'Ce qui s’est passé' : 'What happened'),
              h('h3', { className: 'm-0 mt-1 text-[16px] font-semibold leading-[1.45] text-t1' }, ins.signal[lang]))),

          h('dl', { className: 'm-0 mt-4 grid gap-2.5 border-t border-brd pt-4' },
            h('div', { className: 'rounded-[6px] bg-card2 p-3.5' },
              h('dt', { className: 'text-[10.5px] font-bold uppercase tracking-[.07em] text-t3' }, t('ins.evidence')),
              h('dd', { className: 'm-0 mt-1.5 text-[12.5px] leading-5 text-t2 tnum' }, ins.evidence[lang])),
            h('div', { className: 'grid gap-2.5 md:grid-cols-2' },
              h('div', { className: 'rounded-[6px] border border-brd p-3.5' },
                h('dt', { className: 'text-[10.5px] font-bold uppercase tracking-[.07em] text-t3' }, fr ? 'Pourquoi c’est important' : 'Why it matters'),
                h('dd', { className: 'm-0 mt-1.5 text-[12.5px] leading-5 text-t2' }, ins.interpretation[lang])),
              h('div', { className: 'rounded-[6px] border border-accbrd bg-accsoft p-3.5' },
                h('dt', { className: 'text-[10.5px] font-bold uppercase tracking-[.07em] text-acctext' }, fr ? 'Action recommandée' : 'Recommended action'),
                h('dd', { className: 'm-0 mt-1.5 text-[12.5px] font-medium leading-5 text-t1' }, ins.action[lang]))))))))
  );
}

/* ================= action queue ================= */

function ActionsView({ q, filters, t, lang, fr, toast }) {
  const [version, setVersion] = useState(0);
  const recs = useMemo(
    () => buildRecommendations(q, { advocacyPrograms: filters.advocacyPrograms, advocateGroups: filters.advocateGroups }),
    [q, filters.advocacyPrograms, filters.advocateGroups, version],
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const visible = recs.filter((r) => (statusFilter === 'all' || r.status === statusFilter) && (priorityFilter === 'all' || r.priority === priorityFilter));
  const changeStatus = (r, status) => {
    saveStatus(r.id, status);
    setVersion((v) => v + 1);
    toast(`${t(STATUS_KEYS[status])} ✓`);
  };
  const IMPACTS = ['high', 'medium', 'low'];
  const EFFORTS = ['low', 'medium', 'high'];
  const cellItems = (impact, effort) => visible.filter((r) => r.impact === impact && r.effort === effort);
  const priorityLabel = (p) => (p === 'all' ? (fr ? 'Toutes' : 'All') : t(LEVEL_KEY[p]));

  return h(Fragment, null,
    h(Card, {
      title: fr ? 'Organiser la file d’actions' : 'Organise the action queue',
      subtitle: fr
        ? 'Chaque action porte une priorité, un impact, un effort, un responsable et un statut opérationnel.'
        : 'Every action carries a priority, an impact, an effort, an owner and an operational status.',
      right: h('span', { className: 'text-[12px] font-semibold text-t2 tnum' }, `${visible.length} / ${recs.length}`),
    },
      h('div', { className: 'grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end' },
        h('fieldset', { className: 'm-0 min-w-0 border-0 p-0' },
          h('legend', { className: 'mb-2 text-[12px] font-semibold text-t1' }, t('rec.priority')),
          h('div', { className: 'flex flex-wrap gap-2' },
            ['all', 'high', 'medium', 'low'].map((p) => h(FilterChip, {
              key: p, id: p, label: priorityLabel(p), active: priorityFilter === p,
              count: p === 'all' ? recs.length : recs.filter((r) => r.priority === p).length,
              onClick: setPriorityFilter,
            })))),
        h('label', { className: 'block min-w-[220px]' },
          h('span', { className: 'mb-2 block text-[12px] font-semibold text-t1' }, t('rec.status')),
          h('select', {
            value: statusFilter, onChange: (e) => setStatusFilter(e.target.value),
            className: 'h-10 w-full rounded-[6px] border border-brd bg-card px-3 text-[12px] font-semibold text-t1',
          },
            h('option', { value: 'all' }, fr ? 'Tous les statuts' : 'All statuses'),
            Object.keys(STATUS_KEYS).map((s) => h('option', { key: s, value: s }, t(STATUS_KEYS[s]))))))),

    visible.length === 0
      ? h(Card, null, h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }))
      : h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-2' }, visible.map((r) => h('article', {
        key: r.id, className: 'fade-up relative overflow-hidden rounded-[6px] border border-brds bg-card p-5',
      },
        h('span', { className: `absolute inset-y-0 left-0 w-1 ${r.priority === 'high' ? 'bg-neg' : r.priority === 'medium' ? 'bg-warn' : 'bg-info'}`, 'aria-hidden': true }),
        h('div', { className: 'flex flex-wrap items-center gap-2' },
          h(Badge, { tone: r.priority === 'high' ? 'neg' : r.priority === 'medium' ? 'warn' : 'info' },
            `${t(LEVEL_KEY[r.priority]).toUpperCase()} · ${t('rec.priority').toUpperCase()}`),
          h(Badge, { tone: STATUS_TONE[r.status] }, t(STATUS_KEYS[r.status]).toUpperCase()),
          h('label', { className: 'ml-auto' },
            h('span', { className: 'sr-only' }, t('rec.status')),
            h('select', {
              value: r.status, onChange: (e) => changeStatus(r, e.target.value),
              'aria-label': `${t('rec.status')}: ${r.signal[lang]}`,
              className: 'h-9 rounded-[6px] border border-brd bg-card2 px-2 text-[12px] font-medium text-t2',
            }, Object.keys(STATUS_KEYS).map((s) => h('option', { key: s, value: s }, t(STATUS_KEYS[s])))))),

        h('h3', { className: 'mb-0 mt-4 text-[15px] font-semibold leading-6 text-t1' }, r.signal[lang]),

        h('div', { className: 'mt-3.5 rounded-[6px] border border-accbrd bg-accsoft p-3.5' },
          h('div', { className: 'text-[10.5px] font-bold uppercase tracking-[.06em] text-acctext' }, fr ? 'Action recommandée' : 'Recommended action'),
          h('p', { className: 'mb-0 mt-1.5 text-[13px] leading-6 text-t1' }, r.action[lang])),

        h('div', { className: 'mt-2.5 rounded-[6px] border border-brd bg-card2 p-3.5' },
          h('div', { className: 'text-[10.5px] font-bold uppercase tracking-[.06em] text-t3' }, t('rec.evidence')),
          h('p', { className: 'm-0 mt-1.5 text-[12px] leading-5 text-t2 tnum' }, r.evidence[lang])),

        h('dl', { className: 'm-0 mt-4 grid grid-cols-2 gap-3 border-t border-brd pt-3 sm:grid-cols-4' },
          h('div', null,
            h('dt', { className: 'text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, t('rec.impact')),
            h('dd', { className: 'm-0 mt-1 text-[12.5px] font-semibold text-t1' }, t(LEVEL_KEY[r.impact]))),
          h('div', null,
            h('dt', { className: 'text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, t('rec.effort')),
            h('dd', { className: 'm-0 mt-1 text-[12.5px] font-semibold text-t1' }, t(LEVEL_KEY[r.effort]))),
          h('div', null,
            h('dt', { className: 'text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Responsable' : 'Owner'),
            h('dd', { className: 'm-0 mt-1 text-[12.5px] font-semibold text-t1' }, r.owner)),
          h('div', null,
            h('dt', { className: 'text-[10px] font-bold uppercase tracking-[.06em] text-t3' }, fr ? 'Échéance' : 'Timeline'),
            h('dd', { className: 'm-0 mt-1 text-[12.5px] font-semibold text-t1' }, r.timeline)))))),

    h(Card, {
      id: 'recommendation-matrix', title: t('rec.matrix'),
      subtitle: fr
        ? 'L’impact augmente vers le haut, l’effort vers la droite. Impact élevé et effort faible est la zone à traiter en premier.'
        : 'Impact increases upward, effort increases to the right. High impact with low effort is the zone to clear first.',
      right: h('span', { className: 'inline-flex items-center gap-1.5 rounded-[6px] bg-accsoft px-2.5 py-1.5 text-[11px] font-semibold text-acctext' },
        h(Sparkles, { size: 13, 'aria-hidden': true }),
        fr ? 'Priorité = impact fort + effort faible' : 'Priority = high impact + low effort'),
    },
      h('div', { className: 'overflow-x-auto pb-1' },
        h('div', { className: 'grid min-w-[820px] grid-cols-[110px_repeat(3,minmax(210px,1fr))] gap-2', 'aria-label': t('rec.matrix') },
          h('div', { className: 'flex items-end pb-2 text-[10.5px] font-bold uppercase tracking-[.06em] text-t3' }, `${t('rec.impact')} ↓ / ${t('rec.effort')} →`),
          EFFORTS.map((e) => h('div', { key: e, className: 'rounded-[6px] bg-inset px-3 py-2 text-center text-[12px] font-semibold text-t2' }, `${t(LEVEL_KEY[e])} ${t('rec.effort').toLowerCase()}`)),
          IMPACTS.map((imp) => h(Fragment, { key: imp },
            h('div', { className: 'flex items-center rounded-[6px] bg-inset px-3 py-3 text-[12px] font-semibold text-t2' }, `${t(LEVEL_KEY[imp])} ${t('rec.impact').toLowerCase()}`),
            EFFORTS.map((eff) => {
              const items = cellItems(imp, eff);
              const prime = imp === 'high' && eff === 'low';
              return h('div', {
                key: `${imp}-${eff}`,
                className: `min-h-[110px] rounded-[6px] border p-2.5 ${prime ? 'border-acc bg-accsoft' : 'border-brd bg-card2'}`,
              },
                h('div', { className: 'mb-2 flex items-center justify-between gap-2' },
                  h('span', { className: `text-[10.5px] font-bold uppercase tracking-[.06em] ${prime ? 'text-acctext' : 'text-t3'}` },
                    prime ? (fr ? 'Actions prioritaires' : 'Priority actions') : `${items.length} ${fr ? 'élément(s)' : 'item(s)'}`),
                  h('span', { className: 'rounded-full bg-card px-1.5 text-[10px] font-semibold text-t3' }, items.length)),
                h('div', { className: 'grid gap-1.5' },
                  items.slice(0, 3).map((r) => h('div', {
                    key: r.id, title: r.signal[lang],
                    className: 'rounded-[5px] border border-brd bg-card px-2.5 py-2 text-[11.5px] font-medium leading-4 text-t1',
                  },
                    h('span', { 'aria-hidden': true, className: `mr-1.5 inline-block h-2 w-2 rounded-full ${r.priority === 'high' ? 'bg-neg' : r.priority === 'medium' ? 'bg-warn' : 'bg-info'}` }),
                    r.signal[lang])),
                  items.length > 3
                    ? h('div', { className: 'px-1 text-[10.5px] font-medium text-t3' }, `+${items.length - 3} ${fr ? 'autres' : 'more'}`)
                    : null));
            })))))));
}

/* ================================================================ */

export default function InsightsPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const fr = lang === 'fr';
  const [params, setParams] = useSearchParams();
  const q = useMemo(() => toQ(filters), [filters]);
  const insights = useMemo(
    () => computeInsights(q, { advocacyPrograms: filters.advocacyPrograms, advocateGroups: filters.advocateGroups }),
    [q, filters.advocacyPrograms, filters.advocateGroups],
  );
  const recommendationCount = useMemo(
    () => buildRecommendations(q, { advocacyPrograms: filters.advocacyPrograms, advocateGroups: filters.advocateGroups }).length,
    [q, filters.advocacyPrograms, filters.advocateGroups],
  );
  const view = params.get('view') === 'actions' ? 'actions' : 'signals';
  const setView = (next) => setParams((prev) => {
    const p2 = new URLSearchParams(prev);
    if (next === 'actions') p2.set('view', 'actions'); else p2.delete('view');
    return p2;
  }, { replace: true });

  return h('div', { className: 'page-shell flex flex-col gap-[var(--gap-grid)]' },
    h(PageSection, {
      title: fr ? 'Signaux et file d’actions' : 'Signals and action queue',
      description: fr
        ? 'Les signaux expliquent ce qui bouge et pourquoi. La file d’actions suit ce que les équipes en font, du statut « nouveau » à « terminé ».'
        : 'Signals explain what moved and why. The action queue tracks what teams do about it, from new through to completed.',
      right: h(Segmented, {
        ariaLabel: fr ? 'Vue' : 'View', value: view, onChange: setView,
        options: [
          { id: 'signals', label: `${fr ? 'Signaux' : 'Signals'} (${insights.length})` },
          { id: 'actions', label: `${fr ? 'Actions' : 'Actions'} (${recommendationCount})` },
        ],
      }),
    },
      view === 'signals'
        ? h(SignalsView, { insights, t, lang, fr })
        : h(ActionsView, { q, filters, t, lang, fr, toast })),

    h('p', { className: 'm-0 flex items-center justify-center gap-1.5 text-center text-[11.5px] leading-5 text-t3' },
      h(Info, { size: 13, 'aria-hidden': true }), t('ins.disclaimer'))
  );
}
