/** ChatGPT Ads budget pacing (platform-reported spend vs. the monthly budget recorded in this platform). */
import { addDays, daysInclusive } from '@shared/calendar';
import { AD_CAMPAIGNS } from '@shared/catalog';
import { analyticsQuerySchema } from '@shared/filters';
import { runQuery, type EngineContext } from '../analytics/engine';

export interface CampaignPacing {
  campaign: string;
  name: string;
  category: string;
  monthStart: string;
  asOf: string;
  monthlyBudget: number;
  spendMtd: number;
  expectedMtd: number;
  pacing: number | null;
  projectedMonth: number | null;
  daysElapsed: number;
  daysInMonth: number;
  mode: string;
}

export function campaignPacing(ctx: EngineContext, asOf: string, budgets?: Array<{ key: string; name: string; category: string; monthlyBudget: number | null }>): CampaignPacing[] {
  const monthStart = `${asOf.slice(0, 7)}-01`;
  const [y, m] = asOf.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const daysElapsed = daysInclusive(monthStart, asOf);
  const res = runQuery(ctx, analyticsQuerySchema.parse({ metrics: ['ads_spend'], from: monthStart, to: asOf, compare: 'none', groupBy: 'adCampaign' })).results[0];
  const list = budgets ?? AD_CAMPAIGNS.map((c) => ({ key: c.id, name: c.name, category: c.category, monthlyBudget: c.monthlyBudget }));
  return list.map((c) => {
    const spend = res.rows?.find((r) => r.key === c.key)?.value ?? 0;
    const budget = c.monthlyBudget ?? 0;
    const expected = (budget * daysElapsed) / daysInMonth;
    return {
      campaign: c.key,
      name: c.name,
      category: c.category,
      monthStart,
      asOf,
      monthlyBudget: budget,
      spendMtd: spend,
      expectedMtd: expected,
      pacing: expected > 0 ? spend / expected : null,
      projectedMonth: daysElapsed > 0 ? (spend / daysElapsed) * daysInMonth : null,
      daysElapsed,
      daysInMonth,
      mode: res.meta.mode,
    };
  });
}

export { addDays };
