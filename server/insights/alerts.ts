/** ------------------------------------------------------------------
 *  Alert rule evaluation: thresholds, relative/absolute changes,
 *  missing data and ad pacing. Events are de-duplicated by
 *  fingerprint, re-alerting is suppressed during the cooldown after
 *  resolution, and events auto-resolve when the condition clears.
 *  ------------------------------------------------------------------ */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { addDays } from '@shared/calendar';
import { analyticsQuerySchema, type MetricResult } from '@shared/filters';
import { getMetric } from '@shared/metrics';
import { can, ROLES } from '@shared/rbac';
import type { AppContext } from '../context';
import { adCampaigns, alertEvents, alertRules, notifications, users } from '../db/schema';
import { runQuery, type EngineContext } from '../analytics/engine';
import { zonedToUtc } from '../jobs/schedule';
import { sendMail } from '../mail';
import { campaignPacing } from './ads';
import { fmt, fmtDelta, fmtPct, fmtRange } from './format';

type Rule = typeof alertRules.$inferSelect;

interface Outcome {
  fingerprint: string;
  triggered: boolean;
  title: string;
  titleFr: string;
  evidence: Record<string, unknown>;
}

function metricOutcome(rule: Rule, r: MetricResult): Outcome {
  const def = getMetric(rule.metricId)!;
  const fp = `rule:${rule.id}`;
  const base = {
    metric: rule.metricId,
    value: r.value,
    compare: r.compare,
    delta: r.delta,
    deltaPct: r.deltaPct,
    range: r.meta.range,
    compareRange: r.meta.compareRange,
    threshold: rule.threshold,
    condition: rule.condition,
    filters: rule.filters,
    mode: r.meta.mode,
    ignoredFilters: r.meta.ignoredFilters,
    notes: r.meta.notes,
    sources: def.sources,
  };
  const t = rule.threshold ?? 0;
  let triggered = false;
  switch (rule.condition) {
    case 'above':
      triggered = r.value !== null && r.value > t;
      break;
    case 'below':
      triggered = r.value !== null && r.value < t;
      break;
    case 'change_up_pct':
      triggered = r.deltaPct !== null && r.deltaPct * 100 >= t;
      break;
    case 'change_down_pct':
      triggered = r.deltaPct !== null && r.deltaPct * 100 <= -t;
      break;
    case 'change_up_abs':
      triggered = r.delta !== null && r.delta >= t;
      break;
    case 'change_down_abs':
      triggered = r.delta !== null && r.delta <= -t;
      break;
    case 'missing_data':
      triggered = r.meta.notes.some((n) => n.code === 'missing_days') || r.meta.mode === 'unavailable';
      break;
  }
  const label = def.label;
  const period = (lang: 'en' | 'fr') => fmtRange(r.meta.range, lang);
  let title = rule.name;
  let titleFr = rule.name;
  if (rule.condition === 'missing_data') {
    const n = r.meta.notes.find((x) => x.code === 'missing_days');
    title = `Missing data — ${label.en}: ${n?.params?.entities ?? 'source'} (${n?.params?.days ?? '?'} day(s), ${n?.params?.from ?? ''} → ${n?.params?.to ?? ''})`;
    titleFr = `Données manquantes — ${label.fr} : ${n?.params?.entities ?? 'source'} (${n?.params?.days ?? '?'} jour(s), ${n?.params?.from ?? ''} → ${n?.params?.to ?? ''})`;
  } else if (rule.condition.startsWith('change')) {
    const change = (lang: 'en' | 'fr') => (rule.condition.endsWith('pct') ? fmtPct(r.deltaPct, lang) : fmtDelta(r.delta, def.unit, lang));
    title = `${label.en}: ${change('en')} (${fmt(r.value, def.unit, 'en')} vs ${fmt(r.compare, def.unit, 'en')}, ${period('en')})`;
    titleFr = `${label.fr} : ${change('fr')} (${fmt(r.value, def.unit, 'fr')} vs ${fmt(r.compare, def.unit, 'fr')}, ${period('fr')})`;
  } else {
    title = `${label.en} ${rule.condition === 'above' ? 'above' : 'below'} ${fmt(t, def.unit, 'en')}: ${fmt(r.value, def.unit, 'en')} (${period('en')})`;
    titleFr = `${label.fr} ${rule.condition === 'above' ? 'au-dessus de' : 'sous'} ${fmt(t, def.unit, 'fr')} : ${fmt(r.value, def.unit, 'fr')} (${period('fr')})`;
  }
  return { fingerprint: fp, triggered, title, titleFr, evidence: base };
}

export async function evaluateRule(app: AppContext, ctx: EngineContext, rule: Rule, asOf: string): Promise<Outcome[]> {
  if (rule.condition === 'pacing_above') {
    const budgets = (await app.db.select().from(adCampaigns)).map((c) => ({ key: c.key, name: c.name, category: c.category, monthlyBudget: c.monthlyBudget }));
    return campaignPacing(ctx, asOf, budgets).map((p) => ({
      fingerprint: `rule:${rule.id}:${p.campaign}`,
      triggered: p.pacing !== null && p.pacing > (rule.threshold ?? 1.1) && p.daysElapsed >= 3,
      title: `ChatGPT Ads — ${p.name}: spend pacing ${fmtPct(p.pacing, 'en', false)} of budget (${fmt(p.spendMtd, 'currency', 'en')} vs ${fmt(p.expectedMtd, 'currency', 'en')} expected month-to-date)`,
      titleFr: `ChatGPT Ads — ${p.name} : rythme de dépense à ${fmtPct(p.pacing, 'fr', false)} du budget (${fmt(p.spendMtd, 'currency', 'fr')} vs ${fmt(p.expectedMtd, 'currency', 'fr')} attendus depuis le début du mois)`,
      evidence: { ...p, threshold: rule.threshold, condition: rule.condition, metric: 'ads_spend', sources: ['chatgpt_ads'], note: 'Budget is the monthly budget recorded in Administration → Advertising; spend is platform-reported.' },
    }));
  }
  const def = getMetric(rule.metricId);
  if (!def) return [];
  const from = addDays(asOf, -(rule.windowDays - 1));
  const q = analyticsQuerySchema.parse({ metrics: [rule.metricId], from, to: asOf, compare: rule.compare === 'yoy' ? 'yoy' : 'previous', filters: rule.filters ?? {} });
  const r = runQuery(ctx, q).results[0];
  if (r.meta.mode === 'unavailable' && rule.condition !== 'missing_data') return [];
  return [metricOutcome(rule, r)];
}

async function notifyNewEvent(app: AppContext, rule: Rule | null, title: string, titleFr: string, severity: string, eventId: string, at: Date): Promise<void> {
  const recipients = await app.db
    .select({ id: users.id, language: users.language, role: users.role })
    .from(users)
    .where(and(eq(users.status, 'active'), inArray(users.role, ROLES.filter((r) => can(r, 'alerts.ack')))));
  if (recipients.length) {
    await app.db.insert(notifications).values(
      recipients.map((u) => ({ userId: u.id, kind: 'alert', title: u.language === 'fr' ? titleFr : title, body: severity, link: `/insights?tab=alerts&event=${eventId}`, createdAt: at })),
    );
  }
  if (rule?.channels.includes('email') && rule.recipients.length) {
    const res = await sendMail(app, { to: rule.recipients, subject: `[Veolia Digital Intelligence] ${title}`, text: `${title}\n\n${titleFr}` });
    const [ev] = await app.db.select().from(alertEvents).where(eq(alertEvents.id, eventId));
    await app.db
      .update(alertEvents)
      .set({ evidence: { ...ev.evidence, emailDelivery: res.status, emailError: res.error ?? null } })
      .where(eq(alertEvents.id, eventId));
  }
}

export async function applyOutcome(app: AppContext, rule: Rule | null, source: string, severity: string, cooldownHours: number, o: Outcome, now: Date): Promise<'created' | 'updated' | 'resolved' | 'suppressed' | 'none'> {
  const [last] = await app.db.select().from(alertEvents).where(eq(alertEvents.fingerprint, o.fingerprint)).orderBy(desc(alertEvents.lastTriggeredAt)).limit(1);
  const active = last && (last.status === 'open' || last.status === 'acknowledged');
  if (o.triggered) {
    if (active) {
      await app.db
        .update(alertEvents)
        .set({ lastTriggeredAt: now, occurrences: last.occurrences + 1, evidence: o.evidence, title: o.title, titleFr: o.titleFr })
        .where(eq(alertEvents.id, last.id));
      return 'updated';
    }
    if (last?.resolvedAt && now.getTime() - last.resolvedAt.getTime() < cooldownHours * 3600_000) return 'suppressed';
    const [ev] = await app.db
      .insert(alertEvents)
      .values({ orgId: app.orgId, ruleId: rule?.id ?? null, fingerprint: o.fingerprint, source, severity, title: o.title, titleFr: o.titleFr, evidence: o.evidence, firstTriggeredAt: now, lastTriggeredAt: now })
      .returning();
    await notifyNewEvent(app, rule, o.title, o.titleFr, severity, ev.id, now);
    return 'created';
  }
  if (active) {
    await app.db.update(alertEvents).set({ status: 'resolved', resolvedAt: now, evidence: { ...last.evidence, resolution: 'Condition no longer met', resolvedValue: o.evidence.value ?? null } }).where(eq(alertEvents.id, last.id));
    return 'resolved';
  }
  return 'none';
}

/** Evaluate all enabled rules as of a given day (default: latest complete day of the dataset). */
export async function evaluateAlertRules(app: AppContext, opts: { asOf?: string; now?: Date } = {}): Promise<Record<string, number>> {
  const ctx = await app.analytics.engineContext(null);
  const asOf = opts.asOf ?? ctx.dataset.asOf;
  const [y, m, d] = asOf.split('-').map(Number);
  const now = opts.now ?? (opts.asOf ? zonedToUtc(y, m, d + 1, 7, 0, 'Europe/Paris') : new Date());
  const rules = await app.db.select().from(alertRules).where(eq(alertRules.enabled, true));
  const counts: Record<string, number> = { created: 0, updated: 0, resolved: 0, suppressed: 0, none: 0 };
  for (const rule of rules) {
    const outcomes = await evaluateRule(app, ctx, rule, asOf);
    for (const o of outcomes) counts[await applyOutcome(app, rule, `rule:${rule.metricId}`, rule.severity, rule.cooldownHours, o, now)]++;
    await app.db.update(alertRules).set({ lastEvaluatedAt: now }).where(eq(alertRules.id, rule.id));
  }
  return counts;
}

/** Demo history: evaluate rules day by day over the recent past so the alert log has realistic history. */
export async function backfillAlerts(app: AppContext, days = 60): Promise<void> {
  const asOf = (await app.analytics.dataset()).asOf;
  for (let i = days; i >= 0; i--) await evaluateAlertRules(app, { asOf: addDays(asOf, -i) });
}
