/** ------------------------------------------------------------------
 *  Executive summary: what changed, what drove it (contributions, not
 *  causes), what needs attention, recommended actions and limitations.
 *  Built deterministically from the engine; an LLM may rephrase it
 *  when an administrator has enabled and approved one.
 *  ------------------------------------------------------------------ */
import { desc, inArray } from 'drizzle-orm';
import { CHANNELS, SITES, label, type L10n } from '@shared/catalog';
import { analyticsQuerySchema, type AnalyticsQuery, type Filters, type MetricResult } from '@shared/filters';
import { DEFAULT_EXECUTIVE_KPIS, getMetric } from '@shared/metrics';
import type { CompareMode } from '@shared/calendar';
import type { AppContext, SessionUser } from '../context';
import { alertEvents, recommendations } from '../db/schema';
import { runQuery } from '../analytics/engine';
import { fmt, fmtDelta, fmtPct, fmtRange, type Lang } from './format';

export interface SummaryItem {
  text: L10n;
  tone: 'positive' | 'negative' | 'neutral' | 'warning';
  metric?: string;
  link?: string;
}

export interface ExecutiveSummary {
  period: { from: string; to: string };
  comparePeriod: { from: string; to: string } | null;
  modes: string[];
  changed: SummaryItem[];
  drivers: SummaryItem[];
  attention: SummaryItem[];
  actions: SummaryItem[];
  limitations: SummaryItem[];
  method: 'deterministic';
  generatedAt: string;
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function changeText(r: MetricResult, lang: Lang): string {
  const def = getMetric(r.metric)!;
  const value = fmt(r.value, def.unit, lang);
  if (r.compare === null) return `${label(def.label, lang)}: ${value}`;
  const change = def.deltaPct ? fmtPct(r.deltaPct, lang) : fmtDelta(r.delta, def.unit, lang);
  return lang === 'fr' ? `${label(def.label, lang)} : ${value} (${change} vs période de comparaison)` : `${label(def.label, lang)}: ${value} (${change} vs comparison period)`;
}

function tone(r: MetricResult): SummaryItem['tone'] {
  const def = getMetric(r.metric)!;
  if (r.delta === null || r.delta === 0 || def.direction === 'neutral') return 'neutral';
  const up = r.delta > 0;
  return (def.direction === 'up') === up ? 'positive' : 'negative';
}

/** Magnitude used to rank changes: relative change for counts, scaled absolute change for rates. */
function magnitude(r: MetricResult): number {
  const def = getMetric(r.metric)!;
  if (r.delta === null) return 0;
  if (def.unit === 'percent') return Math.abs(r.delta) * 10;
  if (def.unit === 'position') return Math.abs(r.delta) / 5;
  return Math.abs(r.deltaPct ?? 0);
}

export async function buildExecutiveSummary(app: AppContext, user: SessionUser | null, input: { from: string; to: string; compare: CompareMode; filters: Filters; metrics?: string[] }): Promise<ExecutiveSummary> {
  const ctx = await app.analytics.engineContext(user);
  const Q = (x: Omit<AnalyticsQuery, 'from' | 'to' | 'compare' | 'filters'>) => runQuery(ctx, analyticsQuerySchema.parse({ ...x, from: input.from, to: input.to, compare: input.compare, filters: input.filters })).results;
  const metrics = (input.metrics?.length ? input.metrics : DEFAULT_EXECUTIVE_KPIS).filter((m) => getMetric(m));
  const results = Q({ metrics });
  const both = (f: (lang: Lang) => string): L10n => ({ en: f('en'), fr: f('fr') });

  /* what changed */
  const ranked = results.filter((r) => r.value !== null && r.compare !== null && magnitude(r) >= 0.03).sort((a, b) => magnitude(b) - magnitude(a));
  const changed: SummaryItem[] = ranked.slice(0, 5).map((r) => ({ text: both((l) => changeText(r, l)), tone: tone(r), metric: r.metric }));
  if (!changed.length)
    changed.push({ text: { en: 'No headline KPI moved by more than 3% against the comparison period.', fr: 'Aucun indicateur clé n’a varié de plus de 3 % par rapport à la période de comparaison.' }, tone: 'neutral' });

  /* drivers: decompose the change of key volume metrics into contributions */
  const drivers: SummaryItem[] = [];
  const decompose = (metric: string, dim: 'channel' | 'site', nameOf: (k: string, l: Lang) => string) => {
    const r = Q({ metrics: [metric], groupBy: dim })[0];
    if (r.delta === null || !r.rows?.length || Math.abs(r.deltaPct ?? 0) < 0.02) return;
    const def = getMetric(metric)!;
    const contribs = r.rows
      .filter((x) => x.compare !== null)
      .map((x) => ({ key: x.key, d: (x.value ?? 0) - (x.compare ?? 0) }))
      .filter((x) => Math.sign(x.d) === Math.sign(r.delta!))
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .slice(0, 2);
    for (const c of contribs) {
      const share = r.delta !== 0 ? c.d / r.delta! : 0;
      drivers.push({
        metric,
        tone: 'neutral',
        text: both((l) =>
          l === 'fr'
            ? `${nameOf(c.key, l)} représente ${fmtDelta(c.d, def.unit, l)} de la variation de « ${label(def.label, l)} » (${fmtDelta(r.delta, def.unit, l)}, soit ${fmtPct(share, l, false)} de l’écart).`
            : `${nameOf(c.key, l)} accounts for ${fmtDelta(c.d, def.unit, l)} of the change in ${label(def.label, l).toLowerCase()} (${fmtDelta(r.delta, def.unit, l)}, ${fmtPct(share, l, false)} of the difference).`,
        ),
      });
    }
  };
  const chName = (k: string, l: Lang) => label(CHANNELS.find((c) => c.id === k)?.name ?? { en: k, fr: k }, l);
  const siteName = (k: string) => SITES.find((s) => s.id === k)?.name ?? k;
  decompose('sessions', 'channel', chName);
  decompose('conversions', 'site', (k) => siteName(k));
  decompose('organic_clicks', 'site', (k) => siteName(k));
  if (drivers.length) drivers.push({ tone: 'neutral', text: { en: 'Contributions show where a change occurred, not why it occurred.', fr: 'Les contributions indiquent où la variation a eu lieu, pas pourquoi.' } });

  /* attention */
  const attention: SummaryItem[] = [];
  const events = await app.db.select().from(alertEvents).where(inArray(alertEvents.status, ['open', 'acknowledged'])).orderBy(desc(alertEvents.lastTriggeredAt)).limit(30);
  events
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
    .filter((e) => SEV_ORDER[e.severity] <= 2)
    .slice(0, 4)
    .forEach((e) => attention.push({ text: { en: e.title, fr: e.titleFr ?? e.title }, tone: e.severity === 'critical' || e.severity === 'high' ? 'negative' : 'warning', link: `/insights?tab=alerts&event=${e.id}` }));

  /* actions */
  const recs = await app.db.select().from(recommendations).where(inArray(recommendations.status, ['new', 'under_review', 'approved', 'in_progress']));
  const actions: SummaryItem[] = recs
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, 4)
    .map((r) => ({ text: { en: `${r.title} — ${r.action}`, fr: `${r.titleFr ?? r.title} — ${r.actionFr ?? r.action}` }, tone: 'neutral' as const, link: `/insights?rec=${r.id}` }));

  /* limitations */
  const limitations: SummaryItem[] = [];
  const modes = [...new Set(results.map((r) => r.meta.mode))];
  if (modes.includes('demo')) limitations.push({ tone: 'warning', text: { en: 'Some or all figures come from the DEMO dataset (synthetic data), not from connected Veolia sources.', fr: 'Tout ou partie des chiffres provient du jeu de DÉMONSTRATION (données synthétiques), pas des sources Veolia connectées.' } });
  if (modes.includes('unavailable')) limitations.push({ tone: 'warning', text: { en: `No data is available for: ${results.filter((r) => r.meta.mode === 'unavailable').map((r) => getMetric(r.metric)!.label.en).join(', ')}.`, fr: `Aucune donnée disponible pour : ${results.filter((r) => r.meta.mode === 'unavailable').map((r) => getMetric(r.metric)!.label.fr).join(', ')}.` } });
  const seen = new Set<string>();
  for (const r of results) {
    for (const n of r.meta.notes) {
      const key = `${n.code}:${JSON.stringify(n.params ?? {})}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (n.code === 'coverage_clipped') limitations.push({ tone: 'warning', metric: r.metric, text: both((l) => (l === 'fr' ? `${getMetric(r.metric)!.label.fr} : données disponibles jusqu’au ${n.params?.to} (délai de traitement de la source) ; comparaison sur une durée identique.` : `${getMetric(r.metric)!.label.en}: data available up to ${n.params?.to} (source processing delay); compared like for like.`)) });
      if (n.code === 'missing_days') limitations.push({ tone: 'warning', metric: r.metric, text: both((l) => (l === 'fr' ? `Données manquantes pour ${n.params?.entities} (${n.params?.days} jour(s), ${n.params?.from} → ${n.params?.to}) : les totaux sont sous-estimés.` : `Missing data for ${n.params?.entities} (${n.params?.days} day(s), ${n.params?.from} → ${n.params?.to}): totals are understated.`)) });
      if (n.code === 'compare_incomplete') limitations.push({ tone: 'warning', metric: r.metric, text: both((l) => (l === 'fr' ? `${getMetric(r.metric)!.label.fr} : pas de comparaison, la période de référence précède le début des données.` : `${getMetric(r.metric)!.label.en}: no comparison — the comparison period precedes the start of the data.`)) });
    }
    if (r.meta.ignoredFilters.length) {
      const key = `ignored:${r.metric}`;
      if (!seen.has(key)) {
        seen.add(key);
        limitations.push({ tone: 'neutral', metric: r.metric, text: both((l) => (l === 'fr' ? `${getMetric(r.metric)!.label.fr} : filtre(s) non applicable(s) à cette source (${r.meta.ignoredFilters.join(', ')}).` : `${getMetric(r.metric)!.label.en}: filter(s) not applicable to this source (${r.meta.ignoredFilters.join(', ')}).`)) });
      }
    }
  }
  if (results.some((r) => r.metric.startsWith('geo_')))
    limitations.push({ tone: 'neutral', text: { en: 'AI-visibility rates describe the monitored prompt sample and providers only.', fr: 'Les taux de visibilité IA ne décrivent que l’échantillon de prompts et de fournisseurs suivi.' } });
  if (results.some((r) => r.metric === 'ads_conversions'))
    limitations.push({ tone: 'neutral', text: { en: 'Ad-platform conversions use ChatGPT Ads attribution and are reported separately from GA4 conversions and Drupal submissions — they are never added together.', fr: 'Les conversions publicitaires suivent l’attribution ChatGPT Ads et restent distinctes des conversions GA4 et des soumissions Drupal — elles ne sont jamais additionnées.' } });

  const first = results.find((r) => r.meta.range)?.meta;
  return {
    period: { from: input.from, to: input.to },
    comparePeriod: first?.compareRange ?? null,
    modes,
    changed,
    drivers,
    attention,
    actions,
    limitations,
    method: 'deterministic',
    generatedAt: new Date().toISOString(),
  };
}

/** Plain-text rendering (used for LLM facts, PDF and e-mail). */
export function summaryToText(s: ExecutiveSummary, lang: Lang): string {
  const h = lang === 'fr' ? ['Ce qui a changé', 'Contributions', 'Points d’attention', 'Actions recommandées', 'Limites des données'] : ['What changed', 'Drivers', 'Needs attention', 'Recommended actions', 'Data limitations'];
  const block = (title: string, items: SummaryItem[]) => (items.length ? `${title}\n${items.map((i) => `• ${i.text[lang]}`).join('\n')}` : '');
  return [`${lang === 'fr' ? 'Période' : 'Period'}: ${fmtRange(s.period, lang)}`, block(h[0], s.changed), block(h[1], s.drivers), block(h[2], s.attention), block(h[3], s.actions), block(h[4], s.limitations)].filter(Boolean).join('\n\n');
}
