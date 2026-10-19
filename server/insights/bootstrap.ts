/** First-run derived data: demo alert history and recommendations (plus a little demo workflow activity). */
import { asc, eq } from 'drizzle-orm';
import type { AppContext } from '../context';
import { recommendationComments, recommendationHistory, recommendations, users } from '../db/schema';
import { backfillAlerts, evaluateAlertRules } from './alerts';
import { generateRecommendations } from './recommendations';

export async function initialiseDerivedData(app: AppContext): Promise<void> {
  const t0 = Date.now();
  const ds = await app.analytics.dataset();
  if (ds.demoEnabled) await backfillAlerts(app, 60);
  else await evaluateAlertRules(app);
  await generateRecommendations(app);
  if (ds.demoEnabled) await demoWorkflow(app);
  app.log.info('derived data initialised', { ms: Date.now() - t0 });
}

/** Gives a few demo recommendations a realistic workflow state so the module is not empty of history. */
async function demoWorkflow(app: AppContext): Promise<void> {
  const people = await app.db.select().from(users).where(eq(users.isDemo, true));
  const analyst = people.find((u) => u.role === 'analyst');
  const editor = people.find((u) => u.role === 'editor');
  const admin = people.find((u) => u.role === 'admin');
  if (!analyst || !editor || !admin) return;
  const recs = await app.db.select().from(recommendations).orderBy(asc(recommendations.createdAt));
  const pick = (key: string) => recs.find((r) => r.ruleKey === key);
  const steps: Array<{ key: string; status: string; owner: string; comment?: { by: string; body: string } }> = [
    { key: 'tracking_gap', status: 'in_progress', owner: analyst.id, comment: { by: analyst.id, body: 'Web team confirmed a consent-banner release on 14 Sep; fix deployed 17 Sep. Adding a post-release tag check. (demo comment)' } },
    { key: 'ads_overpacing', status: 'under_review', owner: admin.id, comment: { by: admin.id, body: 'Paid media agency asked to review the daily cap. (demo comment)' } },
    { key: 'declining_pages', status: 'approved', owner: editor.id },
    { key: 'social_format', status: 'dismissed', owner: editor.id, comment: { by: editor.id, body: 'Carousel production capacity is limited this quarter. (demo comment)' } },
  ];
  for (const s of steps) {
    const r = pick(s.key);
    if (!r) continue;
    await app.db.update(recommendations).set({ status: s.status, ownerId: s.owner, statusChangedAt: new Date(), dueDate: s.status === 'dismissed' ? null : '2026-11-15' }).where(eq(recommendations.id, r.id));
    await app.db.insert(recommendationHistory).values([
      { recommendationId: r.id, userId: s.owner, field: 'owner', toValue: s.owner },
      { recommendationId: r.id, userId: s.owner, field: 'status', fromValue: 'new', toValue: s.status },
    ]);
    if (s.comment) await app.db.insert(recommendationComments).values({ recommendationId: r.id, userId: s.comment.by, body: s.comment.body });
  }
}
