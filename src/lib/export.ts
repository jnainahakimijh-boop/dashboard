import { CHANNELS, MARKETS, PLATFORMS, dayToDate } from '@/data/dimensions';
import type { Filters } from '@/types';
import { toQ, webBy, webTotals, socialTotals, campaignTotals, prevQ, type WebTotals } from './aggregate';
import { cvr, engagementRateWeb, ctr } from './metrics';

/** CSV export of the aggregates behind the current selection.
 *  Includes applied filters and a methodology note so exports are
 *  self-describing. Dataset is clearly labelled as synthetic. */

function csvEscape(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function iso(d: number): string {
  return dayToDate(d).toISOString().slice(0, 10);
}

export function buildOverviewCsv(filters: Filters, opts: { methodology: boolean; comparison: boolean }): string {
  const q = toQ(filters);
  const p = prevQ(q);
  const now = webTotals(q);
  const prev = webTotals(p);
  const soc = socialTotals(q);
  const cmp = campaignTotals(q);
  const lines: string[] = [];

  lines.push('# Digital Performance — export (SYNTHETIC DEMO DATA)');
  lines.push(`# Generated,${new Date().toISOString()}`);
  lines.push(`# Period,${iso(q.from)},${iso(q.to)}`);
  if (opts.comparison) lines.push(`# Comparison period,${iso(p.from)},${iso(p.to)}`);
  const fparts: string[] = [];
  if (filters.markets.length) fparts.push(`markets=${filters.markets.join('+')}`);
  if (filters.channels.length) fparts.push(`channels=${filters.channels.join('+')}`);
  if (filters.platforms.length) fparts.push(`platforms=${filters.platforms.join('+')}`);
  if (filters.devices.length) fparts.push(`devices=${filters.devices.join('+')}`);
  if (filters.campaigns.length) fparts.push(`campaigns=${filters.campaigns.join('+')}`);
  lines.push(`# Applied filters,${fparts.length ? fparts.join(' ') : 'none'}`);
  lines.push('');

  lines.push('metric,current' + (opts.comparison ? ',previous' : ''));
  const row = (name: string, cur: number | null, pv: number | null) =>
    lines.push([csvEscape(name), csvEscape(cur === null ? null : Math.round(cur * 100) / 100), ...(opts.comparison ? [csvEscape(pv === null ? null : Math.round(pv * 100) / 100)] : [])].join(','));
  row('web_sessions', now.sessions, prev.sessions);
  row('web_users', now.users, prev.users);
  row('web_engaged_sessions', now.engaged, prev.engaged);
  row('web_engagement_rate_pct', engagementRateWeb(now.engaged, now.sessions), engagementRateWeb(prev.engaged, prev.sessions));
  row('web_conversions', now.conversions, prev.conversions);
  row('web_cvr_pct', cvr(now.conversions, now.sessions), cvr(prev.conversions, prev.sessions));
  row('social_impressions', soc.impressions, null);
  row('social_engagements', soc.engagements, null);
  row('social_clicks', soc.clicks, null);
  row('social_ctr_pct', ctr(soc.clicks, soc.impressions), null);
  row('campaign_spend_eur', cmp.spend, null);
  row('campaign_conversions', cmp.conversions, null);
  lines.push('');

  lines.push('channel,sessions,users,engaged_sessions,conversions,cvr_pct');
  const byCh = webBy(q, 'channel') as Map<string, WebTotals>;
  for (const ch of CHANNELS) {
    const t = byCh.get(ch.id);
    if (!t) continue;
    lines.push([ch.name, t.sessions, t.users, t.engaged, t.conversions, csvEscape(cvr(t.conversions, t.sessions) === null ? null : Math.round(cvr(t.conversions, t.sessions)! * 100) / 100)].join(','));
  }

  if (opts.methodology) {
    lines.push('');
    lines.push('# Methodology: derived metrics are computed from source values.');
    lines.push('# engagement_rate = engaged_sessions / sessions * 100 ; cvr = conversions / sessions * 100 ; ctr = clicks / impressions * 100');
    lines.push('# Campaign traffic is a subset of the Paid Media channel. Social-channel web sessions are modelled from platform clicks.');
    lines.push(`# Dimensions: markets=${MARKETS.map((m) => m.id).join('+')} platforms=${PLATFORMS.map((p2) => p2.id).join('+')}`);
  }
  return lines.join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
