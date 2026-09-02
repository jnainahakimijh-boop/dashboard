import React, { useMemo } from 'react';
import { CHANNELS } from '/src/data/dimensions.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { acquisitionFunnel, comparisonQ, toQ, webBy } from '/src/lib/aggregate.js';
import { ratio, relChange } from '/src/lib/metrics.js';
import { fmtCompact, fmtInt, fmtPct, fmtRelDelta } from '/src/lib/format.js';
import { RankedList } from '/src/components/charts/RankedList.js';
import { Badge, Card, EmptyState, InfoTip, PageSection, StatTile } from '/src/components/ui/primitives.js';
import { JourneyAssistedContribution } from '/src/components/analysis/diagnostics.js';

const h = React.createElement;

/** The five stages of the paid + social acquisition journey. Every stage is a
 *  strict subset of the one above it, so the step rates are real conversion
 *  rates rather than ratios between unrelated event types. */
const STAGES = [
  { id: 'impressions', labelKey: 'jny.awareness', descKey: 'jny.awarenessDesc', attribution: 'deterministic' },
  { id: 'clicks', labelEn: 'Clicks', labelFr: 'Clics', descEn: 'Interactions that left the platform', descFr: 'Interactions qui quittent la plateforme', attribution: 'deterministic' },
  { id: 'sessions', labelKey: 'jny.website', descKey: 'jny.websiteDesc', attribution: 'modelled' },
  { id: 'engaged', labelKey: 'jny.engagement', descKey: 'jny.engagementDesc', attribution: 'deterministic' },
  { id: 'conversions', labelKey: 'jny.conversion', descKey: 'jny.conversionDesc', attribution: 'deterministic' },
];

const RATE_LABELS = [
  { en: 'Click-through rate', fr: 'Taux de clic', formulaEn: 'clicks ÷ impressions', formulaFr: 'clics ÷ impressions' },
  { en: 'Click-to-session rate', fr: 'Taux clic → session', formulaEn: 'sessions ÷ clicks', formulaFr: 'sessions ÷ clics' },
  { en: 'Engagement rate', fr: 'Taux d’engagement', formulaEn: 'engaged sessions ÷ sessions', formulaFr: 'sessions engagées ÷ sessions' },
  { en: 'Engaged-to-conversion rate', fr: 'Taux engagé → conversion', formulaEn: 'conversions ÷ engaged sessions', formulaFr: 'conversions ÷ sessions engagées' },
];

export default function JourneyPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const showCompare = filters.compare !== 'none';

  const stages = acquisitionFunnel(q);
  const prevStages = acquisitionFunnel(p);
  const value = (id, list) => list.find((s) => s.id === id)?.value ?? 0;
  const first = stages[0].value;
  const empty = first === 0;

  const sessionCvr = value('sessions', stages) > 0 ? (value('conversions', stages) / value('sessions', stages)) * 100 : null;
  const prevSessionCvr = value('sessions', prevStages) > 0 ? (value('conversions', prevStages) / value('sessions', prevStages)) * 100 : null;

  const stageLabel = (def) => (def.labelKey ? t(def.labelKey) : fr ? def.labelFr : def.labelEn);
  const stageDesc = (def) => (def.descKey ? t(def.descKey) : fr ? def.descFr : def.descEn);

  /* ---- source contribution: sessions entering the journey ---- */
  const scopedChannels = q.channels.length ? q.channels.filter((c) => c === 'social' || c === 'paid') : ['social', 'paid'];
  const byChannel = webBy({ ...q, channels: scopedChannels }, 'channel');
  const totalSourceSessions = [...byChannel.values()].reduce((s, v) => s + v.sessions, 0);
  const sourceRows = CHANNELS.filter((c) => byChannel.has(c.id)).map((c) => {
    const v = byChannel.get(c.id);
    const share = ratio(v.sessions, totalSourceSessions);
    return {
      id: c.id, label: fr ? c.nameFr : c.name,
      sub: `${fmtPct(ratio(v.engaged, v.sessions) === null ? null : ratio(v.engaged, v.sessions) * 100, lang)} ${fr ? 'engagement' : 'engagement'} · ${fmtInt(v.conversions, lang)} conv.`,
      value: v.sessions, valueLabel: fmtCompact(v.sessions, lang),
      share: share === null ? null : share * 100,
    };
  }).sort((a, b) => b.value - a.value);

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    /* ---------- 1 · the journey in five numbers ---------- */
    h(PageSection, {
      step: 1,
      title: fr ? 'Le parcours en cinq chiffres' : 'The journey in five numbers',
      description: fr
        ? 'Chaque étape est un sous-ensemble strict de la précédente : les taux entre étapes sont donc de vrais taux de passage.'
        : 'Each stage is a strict subset of the one before it, so the rates between stages are true step-conversion rates.',
    },
      h('div', { className: 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6' },
        STAGES.map((def) => h(StatTile, {
          key: def.id,
          label: stageLabel(def),
          value: fmtCompact(value(def.id, stages), lang),
          hint: first > 0 ? `${fmtPct((value(def.id, stages) / first) * 100, lang, (value(def.id, stages) / first) * 100 < 1 ? 2 : 1)} ${fr ? 'des impressions' : 'of impressions'}` : undefined,
        })),
        h(StatTile, {
          label: fr ? 'Taux de conversion des sessions' : 'Session conversion rate',
          value: fmtPct(sessionCvr, lang),
          tone: 'pos',
          hint: fr ? 'conversions ÷ sessions' : 'conversions ÷ sessions',
        }))),

    /* ---------- 2 · stage by stage ---------- */
    h(PageSection, {
      step: 2,
      title: fr ? 'Étape par étape' : 'Stage by stage',
      description: fr
        ? 'La largeur des barres est strictement proportionnelle aux valeurs réelles — aucune largeur minimale n’est appliquée.'
        : 'Bar widths are strictly proportional to the real values — no minimum width is applied.',
      right: showCompare && prevSessionCvr !== null
        ? h('span', { className: 'rounded-[6px] border border-brd bg-card2 px-2.5 py-1.5 text-[11px] font-semibold text-t2 tnum' },
          `${fr ? 'CVR session vs période précédente' : 'Session CVR vs previous period'} ${fmtRelDelta(relChange(sessionCvr, prevSessionCvr), lang)}`)
        : null,
    },
      h(Card, {
        id: 'journey-funnel', title: t('jny.stages'), subtitle: t('ov.funnelSub'),
        right: h(InfoTip, { text: t('jny.attributionNote') }),
      },
        empty
          ? h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })
          : h('div', { className: 'flex flex-col' }, STAGES.map((def, i) => {
            const current = value(def.id, stages);
            const previousStage = i > 0 ? value(STAGES[i - 1].id, stages) : null;
            const stageRate = previousStage ? ratio(current, previousStage) : null;
            const dropOff = stageRate === null ? null : (1 - stageRate) * 100;
            const prevVal = value(def.id, prevStages);
            const change = prevVal > 0 ? relChange(current, prevVal) : null;
            const widthPct = first > 0 ? Math.max(0, Math.min(100, (current / first) * 100)) : 0;
            const rate = i > 0 ? RATE_LABELS[i - 1] : null;
            return h('div', { key: def.id },
              rate
                ? h('div', { className: 'flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 pl-2' },
                  h('span', { className: 'text-[12px] font-bold text-t1 tnum' }, stageRate === null ? '—' : fmtPct(stageRate * 100, lang)),
                  h('span', { className: 'text-[10.5px] font-semibold text-t2' }, fr ? rate.fr : rate.en),
                  h('span', { className: 'text-[10px] text-t3' }, `(${fr ? rate.formulaFr : rate.formulaEn})`),
                  dropOff !== null
                    ? h('span', { className: 'text-[10px] text-t3 tnum' }, `· ${t('jny.dropOff')} ${fmtPct(dropOff, lang)}`)
                    : null)
                : null,
              h('div', { className: 'grid grid-cols-[minmax(130px,210px)_1fr_auto] items-center gap-3 rounded-[6px] border border-brd bg-card2 px-3.5 py-3' },
                h('div', { className: 'min-w-0' },
                  h('div', { className: 'flex flex-wrap items-center gap-1.5' },
                    h('span', { className: 'truncate text-[12.5px] font-semibold text-t1' }, stageLabel(def)),
                    h(Badge, { tone: def.attribution === 'modelled' ? 'warn' : 'neutral', title: t('jny.attributionNote') },
                      t(def.attribution === 'modelled' ? 'jny.modelled' : 'jny.deterministic').toUpperCase())),
                  h('div', { className: 'truncate text-[10.5px] text-t3' }, stageDesc(def))),
                h('div', { className: 'hidden h-[18px] overflow-hidden rounded-[4px] bg-hov sm:block' },
                  h('div', { className: 'h-full rounded-[4px]', style: { width: `${widthPct}%`, background: 'var(--ch-1)', opacity: 0.3 + 0.7 * (i / (STAGES.length - 1)) } })),
                h('div', { className: 'text-right' },
                  h('div', { className: 'text-[16px] font-bold text-t1 tnum' }, fmtInt(current, lang)),
                  showCompare && change !== null
                    ? h('div', { className: `text-[11px] tnum ${change >= 0 ? 'text-pos' : 'text-neg'}` }, `${fmtRelDelta(change, lang)} ${t('misc.vs')} ${t('compare.prevShort').toLowerCase()}`)
                    : null)));
          })))),

    /* ---------- 3 · where the journey starts ---------- */
    h(PageSection, {
      step: 3,
      title: fr ? 'Où commence le parcours' : 'Where the journey starts',
      description: fr
        ? 'Les sources qui alimentent réellement le parcours, avec la qualité du trafic qu’elles apportent.'
        : 'The sources actually feeding the journey, with the quality of the traffic they bring.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' },
        h(Card, {
          title: t('jny.sources'), subtitle: t('jny.sourcesSub'),
        },
          sourceRows.length
            ? h(RankedList, { rows: sourceRows, lang, ariaLabel: t('jny.sources') })
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),
        h(JourneyAssistedContribution, { q, lang }))),

    /* ---------- 4 · how the numbers are produced ---------- */
    h(PageSection, {
      step: 4,
      title: fr ? 'Comment ces chiffres sont produits' : 'How these numbers are produced',
      description: fr
        ? 'Savoir ce qui est mesuré et ce qui est modélisé évite de sur-interpréter le parcours.'
        : 'Knowing what is measured and what is modelled prevents the journey from being over-interpreted.',
    },
      h(Card, { title: t('jny.attribution') },
        h('p', { className: 'm-0 text-[12px] leading-6 text-t2' }, t('jny.attributionNote')),
        h('div', { className: 'mt-4 grid gap-2 lg:grid-cols-2' },
          h('div', { className: 'rounded-[6px] border border-brd bg-card2 p-3.5' },
            h(Badge, { tone: 'neutral' }, t('jny.deterministic').toUpperCase()),
            h('p', { className: 'm-0 mt-2 text-[11.5px] leading-5 text-t3' }, fr
              ? 'Comptages directs depuis la source : impressions, clics, sessions engagées et conversions.'
              : 'Direct counts from the source system: impressions, clicks, engaged sessions and conversions.')),
          h('div', { className: 'rounded-[6px] border border-brd bg-card2 p-3.5' },
            h(Badge, { tone: 'warn' }, t('jny.modelled').toUpperCase()),
            h('p', { className: 'm-0 mt-2 text-[11.5px] leading-5 text-t3' }, fr
              ? 'Rapprochement agrégé clic → session. Il n’existe pas de suivi individuel inter-plateformes, donc cette étape est une estimation, pas un comptage.'
              : 'Aggregate click → session matching. There is no individual cross-platform tracking, so this stage is an estimate rather than a count.'))))));
}
