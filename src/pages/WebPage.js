import React, { useMemo, useState } from 'react';
import { CHANNELS, DEVICES, LANDING_PAGES } from '/src/data/dimensions.js';
import { useFilters } from '/src/state/FiltersContext.js';
import { useI18n } from '/src/i18n/index.js';
import { pageDaySeries, pagesBy, comparisonQ, toQ, webBy, webTotals } from '/src/lib/aggregate.js';
import { bounceRate, cvr, engagementRateWeb, ppChange, ratio } from '/src/lib/metrics.js';
import { WEB_KPIS, kpiDelta } from '/src/lib/kpis.js';
import { fmtCompact, fmtInt, fmtPct } from '/src/lib/format.js';
import { KpiCard } from '/src/components/kpi/KpiCard.js';
import { TrendChart } from '/src/components/charts/TrendChart.js';
import { Sparkline } from '/src/components/charts/Sparkline.js';
import { Badge, Card, EmptyState, MiniBar, PageSection, Segmented, StatTile, InfoTip } from '/src/components/ui/primitives.js';
import { DataTable, Num } from '/src/components/tables/DataTable.js';
import { WebCtaFunnel, WebConversionGoals } from '/src/components/analysis/diagnostics.js';
import { technicalHealth } from '/src/data/seo.js';

const h = React.createElement;

export default function WebPage() {
  const { filters } = useFilters();
  const { t, lang } = useI18n();
  const fr = lang === 'fr';
  const q = useMemo(() => toQ(filters), [filters]);
  const p = useMemo(() => comparisonQ(q, filters.compare), [q, filters.compare]);
  const showCompare = filters.compare !== 'none';
  const now = webTotals(q);
  const prev = webTotals(p);
  const [metric, setMetric] = useState('sessions');

  /* ---- level 2: one trend, one unit ---- */
  const dayMap = webBy(q, 'day');
  const prevDayMap = webBy(p, 'day');
  const isRate = metric === 'engagementRate' || metric === 'bounceRate';
  const seriesOf = (map, range) => {
    const out = [];
    for (let d = range.from; d <= range.to; d++) {
      const w = map.get(d);
      if (metric === 'engagementRate') out.push(w ? engagementRateWeb(w.engaged, w.sessions) : null);
      else if (metric === 'bounceRate') out.push(w ? bounceRate(w.engaged, w.sessions) : null);
      else out.push(w ? w[metric] : 0);
    }
    return out;
  };
  const cur = seriesOf(dayMap, q);
  const prv = seriesOf(prevDayMap, p);
  const points = cur.map((v, i) => ({ d: q.from + i, value: v, prev: prv[i] ?? null, prevD: p.from + i <= p.to ? p.from + i : null }));
  const metricLabel = metric === 'bounceRate'
    ? (fr ? 'Taux de rebond' : 'Bounce rate')
    : t(metric === 'engagementRate' ? 'kpi.engagementRate' : metric === 'sessions' ? 'kpi.sessions' : metric === 'users' ? 'kpi.users' : 'kpi.conversions');

  /* ---- level 3: acquisition ---- */
  const byChannel = webBy(q, 'channel');
  const byChannelPrev = webBy(p, 'channel');
  const chRows = CHANNELS.filter((c) => byChannel.has(c.id)).map((c) => ({
    id: c.id,
    name: fr ? c.nameFr : c.name,
    t: byChannel.get(c.id),
    prevSessions: byChannelPrev.get(c.id)?.sessions ?? null,
  }));
  const chCols = [
    { id: 'name', header: t('filters.channel'), cell: (r) => h('span', { className: 'text-[12px] font-medium text-t1' }, r.name), sortValue: (r) => r.name, searchText: (r) => r.name },
    { id: 'share', header: t('ov.share'), sortValue: (r) => r.t.sessions, cell: (r) => {
      const s = ratio(r.t.sessions, now.sessions);
      return h('span', { className: 'flex items-center gap-2' },
        h(MiniBar, { pct: s === null ? 0 : s * 100, className: 'max-w-24', color: 'var(--ch-2)' }),
        h(Num, { muted: true }, s === null ? '—' : fmtPct(s * 100, lang)));
    } },
    { id: 'sessions', header: t('kpi.sessions'), align: 'right', sortValue: (r) => r.t.sessions, cell: (r) => h(Num, { strong: true }, fmtInt(r.t.sessions, lang)) },
    { id: 'users', header: t('kpi.users'), align: 'right', sortValue: (r) => r.t.users, cell: (r) => h(Num, null, fmtInt(r.t.users, lang)) },
    { id: 'er', header: t('kpi.engagementRate'), align: 'right', sortValue: (r) => engagementRateWeb(r.t.engaged, r.t.sessions), cell: (r) => h(Num, null, fmtPct(engagementRateWeb(r.t.engaged, r.t.sessions), lang)) },
    { id: 'bounce', header: fr ? 'Taux de rebond' : 'Bounce rate', align: 'right', sortValue: (r) => bounceRate(r.t.engaged, r.t.sessions), cell: (r) => h(Num, null, fmtPct(bounceRate(r.t.engaged, r.t.sessions), lang)) },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.t.conversions, cell: (r) => h(Num, null, fmtInt(r.t.conversions, lang)) },
    { id: 'cvr', header: t('kpi.cvr'), align: 'right', sortValue: (r) => cvr(r.t.conversions, r.t.sessions), cell: (r) => h(Num, { strong: true }, fmtPct(cvr(r.t.conversions, r.t.sessions), lang)) },
  ];

  /* ---- level 3: landing pages ---- */
  const pageMap = pagesBy(q, 'page');
  const pgRows = LANDING_PAGES.filter((lp) => pageMap.has(lp.path)).map((lp) => ({
    path: lp.path,
    t: pageMap.get(lp.path),
    spark: pageDaySeries(q, lp.path),
  }));
  const pgCols = [
    { id: 'page', header: t('web.landing'), cell: (r) => h('span', { className: 'mono block max-w-56 truncate text-[11.5px] text-t1', title: r.path }, r.path), sortValue: (r) => r.path, searchText: (r) => r.path },
    { id: 'sessions', header: t('kpi.sessions'), align: 'right', sortValue: (r) => r.t.sessions, cell: (r) => h(Num, { strong: true }, fmtInt(r.t.sessions, lang)) },
    { id: 'users', header: t('kpi.users'), align: 'right', sortValue: (r) => r.t.users, cell: (r) => h(Num, null, fmtInt(r.t.users, lang)) },
    { id: 'er', header: t('kpi.engagementRate'), align: 'right', sortValue: (r) => engagementRateWeb(r.t.engaged, r.t.sessions), cell: (r) => h(Num, null, fmtPct(engagementRateWeb(r.t.engaged, r.t.sessions), lang)) },
    { id: 'bounce', header: fr ? 'Rebond' : 'Bounce', align: 'right', sortValue: (r) => bounceRate(r.t.engaged, r.t.sessions), cell: (r) => h(Num, null, fmtPct(bounceRate(r.t.engaged, r.t.sessions), lang)) },
    { id: 'conv', header: t('kpi.conversions'), align: 'right', sortValue: (r) => r.t.conversions, cell: (r) => h(Num, null, fmtInt(r.t.conversions, lang)) },
    { id: 'cvr', header: t('kpi.cvr'), align: 'right', sortValue: (r) => cvr(r.t.conversions, r.t.sessions), cell: (r) => h(Num, { strong: true }, fmtPct(cvr(r.t.conversions, r.t.sessions), lang)) },
    { id: 'trend', header: t('web.trendMetric'), align: 'right', cell: (r) => h(Sparkline, { values: r.spark, color: 'var(--text-3)', label: `${r.path}: ${t('kpi.sessions')}` }) },
  ];

  /* ---- level 3: devices ---- */
  const byDevice = webBy(q, 'device');
  const devices = DEVICES.filter((d) => byDevice.has(d.id)).map((d) => ({ id: d.id, name: fr ? d.nameFr : d.name, t: byDevice.get(d.id) }));
  const maxSessions = Math.max(...devices.map((d) => d.t.sessions), 1);
  const bestDeviceCvr = Math.max(...devices.map((d) => cvr(d.t.conversions, d.t.sessions) ?? 0), 0.0001);

  /* ---- level 4: bounce diagnosis + audience mix ---- */
  const newShare = ratio(now.newUsers, now.users);
  const bounceNow = bounceRate(now.engaged, now.sessions);
  const bouncePrev = bounceRate(prev.engaged, prev.sessions);
  const bounceDeltaValue = ppChange(bounceNow, bouncePrev);
  const bounceDelta = { value: bounceDeltaValue, kind: 'pp', sentiment: bounceDeltaValue === null || bounceDeltaValue === 0 ? 0 : bounceDeltaValue < 0 ? 1 : -1 };
  const bouncePriority = [...pgRows]
    .map((r) => ({ ...r, bounce: bounceRate(r.t.engaged, r.t.sessions) ?? 0 }))
    .sort((a, b) => b.t.sessions * b.bounce - a.t.sessions * a.bounce)
    .slice(0, 8);

  const webPrimaryKpis = WEB_KPIS.filter((k) => ['users', 'sessions', 'engagementRate', 'avgEngTime', 'conversions', 'cvr'].includes(k.id));

  return h('div', { className: 'page-shell flex flex-col gap-7' },

    /* ---------- 1 · what is happening ---------- */
    h(PageSection, {
      step: 1,
      title: fr ? 'Ce qui se passe' : 'What is happening',
      description: fr
        ? 'Les sept indicateurs de référence du site, comparés à la période précédente.'
        : 'The seven reference numbers for the website, each against the previous period.',
    },
      h('div', { id: 'web-bounce-rate', className: 'grid scroll-mt-28 gap-[var(--gap-grid)] sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7' },
        webPrimaryKpis.map((k) => h(KpiCard, {
          key: k.id, label: t(k.labelKey), definition: t(k.defKey),
          value: k.format(k.value(now), lang), prevValue: k.format(k.value(prev), lang),
          delta: showCompare ? kpiDelta(k, now, prev) : undefined,
          compareLabel: showCompare ? t('compare.short') : undefined,
          compareLabelFull: showCompare ? t('compare.label') : undefined,
          href: k.id === 'conversions' || k.id === 'cvr' ? '/web#web-conversion' : '/web#web-traffic-trend',
          lang,
        })),
        h(KpiCard, {
          key: 'bounceRate',
          label: fr ? 'Taux de rebond' : 'Bounce rate',
          definition: fr
            ? 'Part des sessions non engagées (100 % − taux d’engagement). À interpréter avec l’intention de la page et la conversion.'
            : 'Share of sessions that were not engaged (100% − engagement rate). Interpret with page intent and conversion.',
          value: fmtPct(bounceNow, lang), prevValue: fmtPct(bouncePrev, lang),
          delta: showCompare ? bounceDelta : undefined,
          compareLabel: showCompare ? t('compare.short') : undefined,
          compareLabelFull: showCompare ? t('compare.label') : undefined,
          href: '/web#web-bounce-analysis', lang,
        }))),

    /* ---------- 2 · how is it evolving ---------- */
    h(PageSection, {
      step: 2,
      title: fr ? 'Comment cela évolue' : 'How it is evolving',
      description: fr ? 'Sélectionnez une métrique ; la période de comparaison reste superposée.' : 'Pick one metric; the comparison period stays overlaid.',
      right: h(Segmented, {
        ariaLabel: t('ov.trend'), size: 'sm', value: metric, onChange: setMetric,
        options: [
          { id: 'sessions', label: t('kpi.sessions') },
          { id: 'users', label: t('kpi.users') },
          { id: 'engagementRate', label: t('kpi.engagementRate') },
          { id: 'bounceRate', label: fr ? 'Rebond' : 'Bounce' },
          { id: 'conversions', label: t('kpi.conversions') },
        ],
      }),
    },
      h(Card, { id: 'web-traffic-trend', title: t('ov.trend'), subtitle: `${metricLabel} · ${showCompare ? (fr ? 'avec période de comparaison' : 'with comparison period') : (fr ? 'sans comparaison' : 'no comparison')}` },
        now.sessions > 0
          ? h(TrendChart, {
            points, format: (v) => (isRate ? fmtPct(v, lang) : fmtInt(v, lang)),
            metricLabel, deltaKind: isRate ? 'pp' : 'rel', showCompare, lang, isRate,
            description: `${t('web.title')} — ${metricLabel}`, height: 262,
          })
          : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }))),

    /* ---------- 3 · where is it happening ---------- */
    h(PageSection, {
      step: 3,
      title: fr ? 'Où cela se passe' : 'Where it is happening',
      description: fr
        ? 'Canal d’acquisition, appareil et page d’entrée — les trois découpages qui expliquent un mouvement de trafic.'
        : 'Acquisition channel, device and entry page — the three cuts that explain a traffic movement.',
    },
      h(Card, {
        id: 'web-acquisition', title: t('web.acquisition'),
        subtitle: fr ? 'Volume et qualité par canal : la part de sessions est classée avant les taux.' : 'Volume and quality by channel: share of sessions is ranked before the rates.',
      },
        chRows.length
          ? h(DataTable, { columns: chCols, rows: chRows, rowKey: (r) => r.id, defaultSort: { id: 'sessions', dir: 'desc' }, ariaLabel: t('web.acquisition') })
          : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),

      h('div', { className: 'grid gap-[var(--gap-grid)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' },
        h(Card, {
          id: 'web-device', title: t('web.devices'),
          subtitle: fr ? 'Comparer les taux, pas seulement les volumes : c’est là qu’apparaît l’écart mobile.' : 'Compare the rates, not just the volumes — this is where a mobile gap shows up.',
        },
          devices.length
            ? h('div', { className: 'flex flex-col gap-2.5' }, devices.map((d) => {
              const er = engagementRateWeb(d.t.engaged, d.t.sessions);
              const cv = cvr(d.t.conversions, d.t.sessions);
              const gap = cv === null ? null : (cv / bestDeviceCvr) * 100;
              return h('div', { key: d.id, className: 'rounded-[6px] border border-brd bg-card2 p-3' },
                h('div', { className: 'mb-2 flex items-baseline justify-between gap-3' },
                  h('span', { className: 'text-[12.5px] font-semibold text-t1' }, d.name),
                  h('span', { className: 'text-[11px] text-t2 tnum' }, `${fmtCompact(d.t.sessions, lang)} ${t('kpi.sessions').toLowerCase()}`)),
                h(MiniBar, { pct: (d.t.sessions / maxSessions) * 100, color: 'var(--ch-2)' }),
                h('div', { className: 'mt-2.5 grid grid-cols-3 gap-2' },
                  h('div', null, h('div', { className: 'text-[10px] font-semibold text-t3' }, t('kpi.engagementRate')), h('div', { className: 'mt-0.5 text-[13px] font-semibold text-t1 tnum' }, fmtPct(er, lang))),
                  h('div', null, h('div', { className: 'text-[10px] font-semibold text-t3' }, fr ? 'Rebond' : 'Bounce'), h('div', { className: 'mt-0.5 text-[13px] font-semibold text-t1 tnum' }, fmtPct(bounceRate(d.t.engaged, d.t.sessions), lang))),
                  h('div', null, h('div', { className: 'text-[10px] font-semibold text-t3' }, t('kpi.cvr')), h('div', { className: `mt-0.5 text-[13px] font-semibold tnum ${gap !== null && gap < 80 ? 'text-neg' : 'text-t1'}` }, fmtPct(cv, lang)))));
            }))
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),

        h(Card, {
          title: t('web.newVsReturning'), subtitle: t('web.newVsReturningSub'),
          right: h(InfoTip, { text: t('def.newUsers') }),
        },
          now.users > 0 && newShare !== null
            ? h('div', { className: 'flex flex-col gap-3' },
              h('div', {
                className: 'flex h-7 w-full overflow-hidden rounded-[6px]', role: 'img',
                'aria-label': `${t('web.newUsers')}: ${fmtPct(newShare * 100, lang)} — ${t('web.returningUsers')}: ${fmtPct((1 - newShare) * 100, lang)}`,
              },
                h('div', { style: { width: `${newShare * 100}%`, background: 'var(--ch-3)' } }),
                h('div', { style: { width: `${(1 - newShare) * 100}%`, background: 'var(--ch-2)' } })),
              h('div', { className: 'grid grid-cols-2 gap-3' },
                h('div', { className: 'rounded-[6px] border border-brd bg-card2 p-3' },
                  h('div', { className: 'flex items-center gap-1.5' },
                    h('span', { className: 'h-2 w-2 rounded-sm', style: { background: 'var(--ch-3)' }, 'aria-hidden': true }),
                    h('span', { className: 'text-[10.5px] font-semibold text-t3' }, t('web.newUsers'))),
                  h('div', { className: 'mt-1 text-[19px] font-bold text-t1 tnum' }, fmtCompact(now.newUsers, lang)),
                  h('div', { className: 'text-[10.5px] text-t3 tnum' }, `${fmtPct(newShare * 100, lang)} ${t('misc.of')} ${fmtCompact(now.users, lang)}`)),
                h('div', { className: 'rounded-[6px] border border-brd bg-card2 p-3' },
                  h('div', { className: 'flex items-center gap-1.5' },
                    h('span', { className: 'h-2 w-2 rounded-sm', style: { background: 'var(--ch-2)' }, 'aria-hidden': true }),
                    h('span', { className: 'text-[10.5px] font-semibold text-t3' }, t('web.returningUsers'))),
                  h('div', { className: 'mt-1 text-[19px] font-bold text-t1 tnum' }, fmtCompact(now.users - now.newUsers, lang)),
                  h('div', { className: 'text-[10.5px] text-t3 tnum' }, `${fmtPct((1 - newShare) * 100, lang)} ${t('misc.of')} ${fmtCompact(now.users, lang)}`))),
              h('div', { className: 'grid grid-cols-3 gap-2' },
                h(StatTile, {
                  label: fr ? 'Sessions par utilisateur' : 'Sessions per user',
                  value: (ratio(now.sessions, now.users) ?? 0).toFixed(2),
                  hint: fr ? 'Fréquence de retour' : 'Return frequency',
                }),
                h(StatTile, {
                  label: fr ? 'Sessions engagées' : 'Engaged sessions',
                  value: fmtCompact(now.engaged, lang),
                  hint: `${fmtPct(engagementRateWeb(now.engaged, now.sessions), lang)} ${fr ? 'des sessions' : 'of sessions'}`,
                }),
                h(StatTile, {
                  label: fr ? 'Conversions / 1 000 sessions' : 'Conversions per 1,000 sessions',
                  value: fmtInt((ratio(now.conversions, now.sessions) ?? 0) * 1000, lang),
                  hint: `${fmtPct(cvr(now.conversions, now.sessions), lang)} CVR`,
                })))
            : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }))),

      h(Card, {
        id: 'web-landing-pages', title: t('web.landing'),
        subtitle: fr ? 'Toutes les pages d’entrée de la sélection, avec leur tendance de sessions.' : 'Every entry page in the selection, with its own sessions trend.',
      },
        pgRows.length
          ? h(DataTable, { columns: pgCols, rows: pgRows, rowKey: (r) => r.path, defaultSort: { id: 'sessions', dir: 'desc' }, searchable: true, pageSize: 8, ariaLabel: t('web.landing') })
          : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') }))),

    /* ---------- 4 · why is it happening ---------- */
    h(PageSection, {
      step: 4,
      title: fr ? 'Pourquoi cela se passe' : 'Why it is happening',
      description: fr
        ? 'Où l’audience décroche : pages à fort trafic et fort rebond, puis étape par étape jusqu’à la conversion.'
        : 'Where the audience is lost: high-traffic high-bounce pages, then step by step to the conversion.',
    },
      h(Card, {
        id: 'web-bounce-analysis',
        title: fr ? 'Pages à fort trafic et fort rebond' : 'High traffic, high bounce',
        subtitle: fr
          ? 'Classées par volume de sessions non engagées — c’est-à-dire par le nombre réel de visites perdues.'
          : 'Ranked by non-engaged session volume — that is, by the number of visits actually lost.',
        right: h(InfoTip, {
          text: fr
            ? 'Un rebond élevé n’est pas automatiquement négatif : une page de contact ou d’horaires peut répondre au besoin en une seule vue.'
            : 'High bounce is not automatically negative: a contact or opening-hours page can answer the need in a single view.',
        }),
      },
        bouncePriority.length
          ? h(DataTable, {
            columns: [
              { id: 'page', header: t('web.landing'), cell: (r) => h('span', { className: 'mono text-[11.5px] text-t1' }, r.path), sortValue: (r) => r.path, searchText: (r) => r.path },
              { id: 'sessions', header: t('kpi.sessions'), align: 'right', cell: (r) => h(Num, null, fmtInt(r.t.sessions, lang)), sortValue: (r) => r.t.sessions },
              { id: 'lost', header: fr ? 'Sessions non engagées' : 'Non-engaged sessions', align: 'right', cell: (r) => h(Num, { strong: true }, fmtInt(r.t.sessions - r.t.engaged, lang)), sortValue: (r) => r.t.sessions - r.t.engaged },
              { id: 'bounce', header: fr ? 'Rebond' : 'Bounce', align: 'right', cell: (r) => h(Num, null, fmtPct(r.bounce, lang)), sortValue: (r) => r.bounce },
              { id: 'er', header: t('kpi.engagementRate'), align: 'right', cell: (r) => h(Num, null, fmtPct(engagementRateWeb(r.t.engaged, r.t.sessions), lang)), sortValue: (r) => engagementRateWeb(r.t.engaged, r.t.sessions) },
              { id: 'conv', header: t('kpi.conversions'), align: 'right', cell: (r) => h(Num, null, fmtInt(r.t.conversions, lang)), sortValue: (r) => r.t.conversions },
            ],
            rows: bouncePriority, rowKey: (r) => r.path, searchable: false,
            ariaLabel: fr ? 'Pages à fort trafic et fort rebond' : 'High traffic high bounce pages',
          })
          : h(EmptyState, { title: t('state.empty.title'), body: t('state.empty.body') })),

      h('div', { id: 'web-conversion', className: 'grid scroll-mt-28 gap-[var(--gap-grid)] lg:grid-cols-2' },
        h(WebCtaFunnel, { q, lang }),
        h(WebConversionGoals, { q, lang }))),

    /* ---------- 5 · what to do ---------- */
    h(PageSection, {
      step: 5,
      title: fr ? 'Ce qu’il faut corriger' : 'What to fix',
      description: fr
        ? 'Les signaux techniques qui plafonnent la performance avant toute optimisation de contenu.'
        : 'The technical signals that cap performance before any content optimisation.',
    },
      h(Card, {
        title: fr ? 'Santé technique du site' : 'Website technical health',
        subtitle: fr
          ? 'Signaux webmaster essentiels — données exemple, prêtes à être remplacées par CrUX, crawler et logs serveur.'
          : 'Core webmaster signals — sample data, ready to be replaced by CrUX, crawler and server logs.',
      },
        h('div', { className: 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3' }, [
          ['LCP', `${technicalHealth.lcp.toFixed(1)}s`, technicalHealth.lcp <= 2.5 ? 'pos' : 'warn', fr ? 'Cible ≤ 2,5 s' : 'Target ≤ 2.5s'],
          ['INP', `${technicalHealth.inp}ms`, technicalHealth.inp <= 200 ? 'pos' : 'warn', fr ? 'Cible ≤ 200 ms' : 'Target ≤ 200ms'],
          ['CLS', technicalHealth.cls.toFixed(2), technicalHealth.cls <= 0.1 ? 'pos' : 'warn', fr ? 'Cible ≤ 0,10' : 'Target ≤ 0.10'],
          [fr ? 'Liens cassés' : 'Broken links', fmtInt(technicalHealth.brokenLinks, lang), technicalHealth.brokenLinks < 10 ? 'pos' : 'warn', fr ? 'Détectés au dernier crawl' : 'Found in the last crawl'],
          ['404', fmtInt(technicalHealth.errors404, lang), technicalHealth.errors404 < 30 ? 'pos' : 'warn', fr ? 'URLs introuvables' : 'Not-found URLs'],
          ['5xx', fmtInt(technicalHealth.errors5xx, lang), technicalHealth.errors5xx < 5 ? 'pos' : 'neg', fr ? 'Erreurs serveur' : 'Server errors'],
        ].map(([label, value, tone, hint]) => h('div', { key: String(label), className: 'rounded-[6px] border border-brd bg-card2 px-3 py-2.5' },
          h('div', { className: 'flex items-center justify-between gap-2' },
            h('span', { className: 'text-[12px] font-semibold text-t1' }, label),
            h(Badge, { tone }, tone === 'pos' ? (fr ? 'BON' : 'GOOD') : tone === 'warn' ? (fr ? 'À SURVEILLER' : 'WATCH') : (fr ? 'CRITIQUE' : 'CRITICAL'))),
          h('div', { className: 'mt-1.5 text-[18px] font-bold leading-none text-t1 tnum' }, value),
          h('div', { className: 'mt-1 text-[10px] text-t3' }, hint)))))));
}
