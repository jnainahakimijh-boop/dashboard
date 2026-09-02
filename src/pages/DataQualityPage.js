import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCw, XCircle } from 'lucide-react';
import { useI18n } from '/src/i18n/index.js';
import { useToast } from '/src/state/ToastContext.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { toQ } from '/src/lib/aggregate.js';
import { CHECKS, SOURCES, healthScore } from '/src/lib/dataQuality.js';
import { fmtInt } from '/src/lib/format.js';
import { Badge, Btn, Card, MiniBar, PageSection } from '/src/components/ui/primitives.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';
import { MeasurementCoverage, AnomalyTimeline } from '/src/components/analysis/diagnostics.js';

const h = React.createElement;
const STATUS_TONE = { healthy: 'pos', degraded: 'warn', stale: 'neg' };
const STATUS_KEY = { healthy: 'dq.healthy', degraded: 'dq.degraded', stale: 'dq.stale' };

function refreshLabel(min, lang) {
  if (min < 60) return lang === 'fr' ? `il y a ${min} min` : `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 48) return lang === 'fr' ? `il y a ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return lang === 'fr' ? `il y a ${days} j` : `${days} d ago`;
}

export default function DataQualityPage() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { filters } = useFilters();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const [refreshing, setRefreshing] = useState(null);
  const score = healthScore();

  const doRefresh = (s) => {
    setRefreshing(s.id);
    window.setTimeout(() => {
      setRefreshing(null);
      toast(`${s.name}: ${t('adm.integration.testOk')}`, 'info');
    }, 900);
  };

  const cols = [
    {
      id: 'name', header: t('dq.source'),
      cell: (r) => h('span', { className: 'flex items-center gap-2 text-[12px] font-medium text-t1' },
        h(Database, { size: 13, className: 'text-t3', 'aria-hidden': true }), r.name),
      sortValue: (r) => r.name, searchText: (r) => r.name,
    },
    { id: 'status', header: t('dq.status'), cell: (r) => h(Badge, { tone: STATUS_TONE[r.status] }, t(STATUS_KEY[r.status]).toUpperCase()), sortValue: (r) => r.status },
    { id: 'refresh', header: t('dq.lastRefresh'), cell: (r) => h(Num, { muted: true }, refreshLabel(r.lastRefreshMin, lang)), sortValue: (r) => r.lastRefreshMin },
    { id: 'freq', header: t('dq.frequency'), cell: (r) => h(Num, { muted: true }, r.frequency), sortValue: (r) => r.frequency },
    { id: 'sla', header: t('dq.sla'), cell: (r) => h(Num, { muted: true }, `${r.slaHours} h`), sortValue: (r) => r.slaHours },
    { id: 'rows', header: t('dq.rows'), align: 'right', sortValue: (r) => r.rows, cell: (r) => h(Num, null, fmtInt(r.rows, lang)) },
    {
      id: 'score', header: t('dq.score'), align: 'right', sortValue: (r) => r.score,
      cell: (r) => h('span', { className: 'flex items-center justify-end gap-2' },
        h(MiniBar, { pct: r.score, className: 'max-w-16', color: r.score >= 90 ? 'var(--pos)' : r.score >= 75 ? 'var(--warn)' : 'var(--neg)' }),
        h(Num, { strong: true }, r.score)),
    },
    { id: 'issues', header: t('dq.issues'), align: 'right', sortValue: (r) => r.issues, cell: (r) => (r.issues > 0 ? h(Badge, { tone: 'warn' }, r.issues) : h(Num, { muted: true }, '0')) },
    {
      id: 'actions', header: t('adm.actions'), align: 'right',
      cell: (r) => h(Btn, {
        size: 'sm', onClick: () => doRefresh(r), disabled: refreshing === r.id,
        'aria-label': `${t('adm.integration.refresh')}: ${r.name}`,
      },
        h(RefreshCw, { size: 11, 'aria-hidden': true, className: refreshing === r.id ? 'animate-spin' : '' }),
        refreshing === r.id ? t('adm.integration.syncing') : t('adm.integration.refresh')),
    },
  ];

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    /* ---------- 1 · can we trust the numbers ---------- */
    h(PageSection, {
      step: 1,
      title: fr ? 'Peut-on se fier aux chiffres' : 'Can the numbers be trusted',
      description: fr
        ? 'Un score pondéré et documenté, plus les contrôles automatiques exécutés sur le jeu de données au chargement.'
        : 'A weighted, documented score, plus the automated checks run against the dataset on load.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' },
        h(Card, { title: t('dq.health'), subtitle: t('dq.healthSub') },
          h('div', { className: 'flex items-center gap-5' },
            h('div', {
              className: 'relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full',
              style: { background: `conic-gradient(${score.total >= 90 ? 'var(--pos)' : score.total >= 75 ? 'var(--warn)' : 'var(--neg)'} ${score.total * 3.6}deg, var(--bg-hover) 0deg)` },
              role: 'img', 'aria-label': `${t('dq.health')}: ${score.total}/100`,
            },
              h('div', { className: 'flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-card' },
                h('span', { className: 'text-[26px] font-bold leading-none text-t1 tnum' }, score.total),
                h('span', { className: 'text-[10.5px] text-t3' }, '/100'))),
            h('dl', { className: 'm-0 flex flex-1 flex-col gap-2' }, [
              { label: fr ? 'Fraîcheur (40 %)' : 'Freshness (40%)', v: score.freshness },
              { label: fr ? 'Complétude (40 %)' : 'Completeness (40%)', v: score.completeness },
              { label: fr ? 'Réconciliation (20 %)' : 'Reconciliation (20%)', v: score.reconciliation },
            ].map((row) => h('div', { key: row.label },
              h('div', { className: 'flex items-baseline justify-between' },
                h('dt', { className: 'text-[11px] text-t3' }, row.label),
                h('dd', { className: 'm-0 text-[11.5px] font-semibold text-t1 tnum' }, row.v)),
              h(MiniBar, { pct: row.v, color: 'var(--ch-2)', className: 'mt-1' })))))),

        h(Card, { title: t('dq.checks'), subtitle: t('dq.checksSub') },
          h('ul', { className: 'm-0 grid list-none gap-2 p-0 md:grid-cols-2' }, CHECKS.map((c) => h('li', {
            key: c.id, className: 'flex items-start gap-2.5 rounded-[6px] border border-brd bg-card2 px-3 py-2.5',
          },
            c.status === 'pass'
              ? h(CheckCircle2, { size: 14, className: 'mt-0.5 shrink-0 text-pos', 'aria-label': t('dq.check.pass') })
              : c.status === 'warn'
                ? h(AlertTriangle, { size: 14, className: 'mt-0.5 shrink-0 text-warn', 'aria-label': t('dq.check.warn') })
                : h(XCircle, { size: 14, className: 'mt-0.5 shrink-0 text-neg', 'aria-label': t('dq.check.fail') }),
            h('div', { className: 'min-w-0' },
              h('div', { className: 'text-[12px] font-medium leading-snug text-t1' }, c.label[lang]),
              h('div', { className: 'mt-0.5 text-[11px] leading-relaxed text-t3 tnum' }, c.detail[lang])))))))),

    /* ---------- 2 · what limits confidence ---------- */
    h(PageSection, {
      step: 2,
      title: fr ? 'Ce qui limite la confiance' : 'What limits confidence',
      description: fr
        ? 'Couverture du marquage et mouvements inhabituels sur la période sélectionnée dans les filtres.'
        : 'Tagging coverage and unusual movements over the period selected in the filters.',
    },
      h('div', { className: 'grid gap-[var(--gap-grid)] lg:grid-cols-2' },
        h(MeasurementCoverage, { q, lang }),
        h(AnomalyTimeline, { q, lang }))),

    /* ---------- 3 · source status ---------- */
    h(PageSection, {
      step: 3,
      title: fr ? 'État des sources' : 'Source status',
      description: fr
        ? 'Fraîcheur, volume et score de qualité pour chaque connecteur alimentant la plateforme.'
        : 'Freshness, volume and quality score for every connector feeding the platform.',
    },
      h(Card, { id: 'dq-sources' },
        h(DataTable, { columns: cols, rows: SOURCES, rowKey: (r) => r.id, defaultSort: { id: 'score', dir: 'asc' }, ariaLabel: t('dq.sources') })))
  );
}
