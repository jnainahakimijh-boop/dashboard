/** ------------------------------------------------------------------
 *  LinkedIn (Community Management API), X API v2 and YouTube
 *  Analytics API. All read-only. Request builders and parsers are
 *  unit-tested with fixtures; live calls require approved access.
 *  ------------------------------------------------------------------ */
import { addDays, epochDay, fromEpochDay } from '@shared/calendar';
import { ConnectorError, httpJson, type ConnectorDef, type FactRowInput, type SyncResult } from './types';

/* ---------------- LinkedIn ---------------- */

export function linkedinShareStatsUrl(orgUrn: string, from: string, to: string): string {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${addDays(to, 1)}T00:00:00Z`);
  return `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals=(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`;
}

export function linkedinFollowerStatsUrl(orgUrn: string, from: string, to: string): string {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${addDays(to, 1)}T00:00:00Z`);
  return `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals=(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`;
}

export interface LinkedInShareStats {
  elements?: Array<{ timeRange: { start: number; end: number }; totalShareStatistics: { impressionCount?: number; clickCount?: number; likeCount?: number; commentCount?: number; shareCount?: number } }>;
}
export interface LinkedInFollowerStats {
  elements?: Array<{ timeRange: { start: number; end: number }; followerGains?: { organicFollowerGain?: number; paidFollowerGain?: number } }>;
}

export function linkedinToFacts(account: string, shares: LinkedInShareStats, followers: LinkedInFollowerStats, currentFollowers: number | null, to: string): FactRowInput[] {
  const byDay = new Map<string, FactRowInput>();
  const row = (day: string) => {
    let r = byDay.get(day);
    if (!r) {
      r = { dataset: 'social', day, dims: { account }, measures: {} };
      byDay.set(day, r);
    }
    return r;
  };
  for (const e of shares.elements ?? []) {
    const day = fromEpochDay(Math.floor(e.timeRange.start / 86_400_000));
    const s = e.totalShareStatistics;
    const r = row(day);
    r.measures.impressions = s.impressionCount ?? 0;
    r.measures.clicks = s.clickCount ?? 0;
    r.measures.reactions = s.likeCount ?? 0;
    r.measures.comments = s.commentCount ?? 0;
    r.measures.shares = s.shareCount ?? 0;
    r.measures.engagements = (s.likeCount ?? 0) + (s.commentCount ?? 0) + (s.shareCount ?? 0) + (s.clickCount ?? 0);
  }
  for (const e of followers.elements ?? []) {
    const day = fromEpochDay(Math.floor(e.timeRange.start / 86_400_000));
    row(day).measures.followersGained = (e.followerGains?.organicFollowerGain ?? 0) + (e.followerGains?.paidFollowerGain ?? 0);
  }
  // end-of-day follower counts reconstructed backwards from the current total and daily gains
  if (currentFollowers !== null) {
    const days = [...byDay.keys()].sort();
    let level = currentFollowers;
    for (let d = to; d >= (days[0] ?? to); d = addDays(d, -1)) {
      const r = byDay.get(d);
      if (r) r.measures.followers = level;
      level -= r?.measures.followersGained ?? 0;
      if (epochDay(d) < epochDay(days[0] ?? to)) break;
    }
  }
  return [...byDay.values()];
}

export const linkedinConnector: ConnectorDef = {
  provider: 'linkedin',
  label: 'LinkedIn Pages',
  modes: ['api', 'csv', 'demo'],
  configFields: [
    { key: 'organizationUrn', label: { en: 'Organization URN', fr: 'URN de l’organisation' }, required: true, placeholder: 'urn:li:organization:12345' },
    { key: 'account', label: { en: 'Account key', fr: 'Clé du compte' }, required: true, placeholder: 'li-group' },
    { key: 'apiVersion', label: { en: 'API version (YYYYMM)', fr: 'Version d’API (AAAAMM)' }, required: true, placeholder: '202409' },
  ],
  secretFields: [{ key: 'accessToken', label: { en: 'OAuth access token (r_organization_social, rw_organization_admin)', fr: 'Jeton OAuth (r_organization_social, rw_organization_admin)' } }],
  readiness: {
    implementation: 'implemented',
    verifiedLive: false,
    docs: ['https://learn.microsoft.com/linkedin/marketing/community-management/organizations/share-statistics', 'https://learn.microsoft.com/linkedin/marketing/community-management/organizations/follower-statistics'],
    credentials: 'LinkedIn app approved for the Community Management API; page admin OAuth token',
    prerequisites: { en: 'Request Community Management API access for the Veolia LinkedIn app; a page administrator authorises it. Tokens expire (60 days) and must be renewed.', fr: 'Demander l’accès à la Community Management API ; un administrateur de page l’autorise. Les jetons expirent (60 jours).' },
    limitations: { en: 'Organisation-level statistics do not separate link clicks from other clicks; post-level analytics need a separate posts sync (CSV import supported). Not tested live from this environment.', fr: 'Les statistiques d’organisation ne distinguent pas les clics sur liens ; l’analyse par publication passe par un import CSV. Non testé en réel.' },
  },
  sync: async (_app, conn, secret, range): Promise<SyncResult> => {
    const urn = String(conn.config.organizationUrn ?? '');
    const account = String(conn.config.account ?? '');
    if (!/^urn:li:organization:\d+$/.test(urn) || !account) throw new ConnectorError('Configure the organization URN and account key');
    const headers = { authorization: `Bearer ${secret.accessToken}`, 'LinkedIn-Version': String(conn.config.apiVersion ?? '202409'), 'X-Restli-Protocol-Version': '2.0.0' };
    const shares = await httpJson<LinkedInShareStats>(linkedinShareStatsUrl(urn, range.from, range.to), { headers });
    const followers = await httpJson<LinkedInFollowerStats>(linkedinFollowerStatsUrl(urn, range.from, range.to), { headers });
    const size = await httpJson<{ firstDegreeSize?: number }>(`https://api.linkedin.com/rest/networkSizes/${encodeURIComponent(urn)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`, { headers }).catch(() => ({ firstDegreeSize: undefined }));
    const rows = linkedinToFacts(account, shares, followers, size.firstDegreeSize ?? null, range.to);
    return { rows, replace: [{ dataset: 'social', from: range.from, to: range.to, dim: 'account', keys: [account] }] };
  },
};

/* ---------------- X (Twitter) API v2 ---------------- */

export interface XTweetsPage {
  data?: Array<{ id: string; created_at: string; public_metrics: { impression_count?: number; like_count?: number; reply_count?: number; retweet_count?: number; quote_count?: number } }>;
  meta?: { next_token?: string; result_count?: number };
}

/** X does not provide daily account statistics: rows aggregate tweets by publication day (lifetime metrics to date). */
export function xToFacts(account: string, tweets: XTweetsPage['data'], followers: number | null, today: string): FactRowInput[] {
  const byDay = new Map<string, FactRowInput>();
  for (const t of tweets ?? []) {
    const day = t.created_at.slice(0, 10);
    const r = byDay.get(day) ?? { dataset: 'social', day, dims: { account }, measures: { posts: 0, impressions: 0, reactions: 0, comments: 0, shares: 0, engagements: 0 } };
    const m = t.public_metrics;
    r.measures.posts += 1;
    r.measures.impressions += m.impression_count ?? 0;
    r.measures.reactions += m.like_count ?? 0;
    r.measures.comments += m.reply_count ?? 0;
    r.measures.shares += (m.retweet_count ?? 0) + (m.quote_count ?? 0);
    r.measures.engagements += (m.like_count ?? 0) + (m.reply_count ?? 0) + (m.retweet_count ?? 0) + (m.quote_count ?? 0);
    byDay.set(day, r);
  }
  if (followers !== null) {
    const r = byDay.get(today) ?? { dataset: 'social', day: today, dims: { account }, measures: {} };
    r.measures.followers = followers;
    byDay.set(today, r);
  }
  return [...byDay.values()];
}

export const xConnector: ConnectorDef = {
  provider: 'x',
  label: 'X (Twitter)',
  modes: ['api', 'csv', 'demo'],
  configFields: [
    { key: 'userId', label: { en: 'Numeric user id', fr: 'Identifiant numérique' }, required: true, placeholder: '123456789' },
    { key: 'account', label: { en: 'Account key', fr: 'Clé du compte' }, required: true, placeholder: 'x-group' },
  ],
  secretFields: [{ key: 'bearerToken', label: { en: 'Bearer token', fr: 'Jeton Bearer' } }],
  readiness: {
    implementation: 'implemented',
    verifiedLive: false,
    docs: ['https://docs.x.com/x-api/posts/get-posts', 'https://docs.x.com/x-api/users/get-user-by-id'],
    credentials: 'X developer project with a paid API tier that allows reading timelines (not purchased by this project)',
    prerequisites: { en: 'Reading post metrics requires a paid X API tier: purchasing it needs explicit authorisation.', fr: 'La lecture des métriques nécessite une offre X API payante : son achat requiert une autorisation explicite.' },
    limitations: { en: 'Metrics are lifetime totals of posts grouped by publication day; follower history starts on the first sync. Not tested live.', fr: 'Métriques cumulées des posts regroupées par jour de publication ; l’historique d’abonnés commence à la première synchronisation. Non testé en réel.' },
  },
  sync: async (_app, conn, secret, range): Promise<SyncResult> => {
    const id = String(conn.config.userId ?? '');
    const account = String(conn.config.account ?? '');
    if (!/^\d+$/.test(id) || !account) throw new ConnectorError('Configure the numeric user id and account key');
    const headers = { authorization: `Bearer ${secret.bearerToken}` };
    const tweets: NonNullable<XTweetsPage['data']> = [];
    let token: string | undefined;
    for (let page = 0; page < 30; page++) {
      const url = `https://api.x.com/2/users/${id}/tweets?max_results=100&start_time=${range.from}T00:00:00Z&end_time=${addDays(range.to, 1)}T00:00:00Z&tweet.fields=created_at,public_metrics${token ? `&pagination_token=${token}` : ''}`;
      const res = await httpJson<XTweetsPage>(url, { headers });
      tweets.push(...(res.data ?? []));
      token = res.meta?.next_token;
      if (!token) break;
    }
    const user = await httpJson<{ data?: { public_metrics?: { followers_count?: number } } }>(`https://api.x.com/2/users/${id}?user.fields=public_metrics`, { headers });
    const today = new Date().toISOString().slice(0, 10);
    const rows = xToFacts(account, tweets, user.data?.public_metrics?.followers_count ?? null, today);
    return { rows, replace: [{ dataset: 'social', from: range.from, to: range.to, dim: 'account', keys: [account] }] };
  },
};

/* ---------------- YouTube Analytics ---------------- */

export interface YtReport {
  columnHeaders?: Array<{ name: string }>;
  rows?: Array<Array<string | number>>;
}

export function youtubeReportUrl(from: string, to: string): string {
  const metrics = 'views,estimatedMinutesWatched,likes,comments,shares,subscribersGained,subscribersLost';
  return `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${from}&endDate=${to}&metrics=${metrics}&dimensions=day&sort=day`;
}

export function youtubeToFacts(account: string, rep: YtReport): FactRowInput[] {
  const h = rep.columnHeaders?.map((c) => c.name) ?? [];
  return (rep.rows ?? []).map((r) => {
    const o = Object.fromEntries(h.map((k, i) => [k, r[i]]));
    const n = (k: string) => Number(o[k] ?? 0);
    return {
      dataset: 'social',
      day: String(o.day),
      dims: { account },
      measures: { videoViews: n('views'), watchMinutes: n('estimatedMinutesWatched'), reactions: n('likes'), comments: n('comments'), shares: n('shares'), engagements: n('likes') + n('comments') + n('shares'), followersGained: n('subscribersGained'), followersLost: n('subscribersLost') },
    };
  });
}

export const youtubeConnector: ConnectorDef = {
  provider: 'youtube',
  label: 'YouTube',
  modes: ['api', 'csv', 'demo'],
  configFields: [{ key: 'account', label: { en: 'Account key', fr: 'Clé du compte' }, required: true, placeholder: 'yt-group' }],
  secretFields: [
    { key: 'clientId', label: { en: 'OAuth client id', fr: 'Identifiant client OAuth' } },
    { key: 'clientSecret', label: { en: 'OAuth client secret', fr: 'Secret client OAuth' } },
    { key: 'refreshToken', label: { en: 'Refresh token (yt-analytics.readonly)', fr: 'Jeton d’actualisation (yt-analytics.readonly)' } },
  ],
  readiness: {
    implementation: 'implemented',
    verifiedLive: false,
    docs: ['https://developers.google.com/youtube/analytics/reference/reports/query'],
    credentials: 'OAuth client in a Google Cloud project; refresh token granted by a channel manager',
    prerequisites: { en: 'A channel owner/manager authorises the yt-analytics.readonly scope once; store the refresh token here.', fr: 'Un responsable de la chaîne autorise le scope yt-analytics.readonly ; enregistrer le jeton ici.' },
    limitations: { en: 'Thumbnail impressions are not requested from the API; subscriber totals need a separate Data API call (not implemented). Not tested live.', fr: 'Les impressions de miniatures ne sont pas demandées à l’API ; le total d’abonnés nécessite un autre appel (non implémenté). Non testé en réel.' },
  },
  sync: async (_app, conn, secret, range): Promise<SyncResult> => {
    const account = String(conn.config.account ?? '');
    const tok = await httpJson<{ access_token: string }>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: secret.clientId ?? '', client_secret: secret.clientSecret ?? '', refresh_token: secret.refreshToken ?? '' }),
    });
    const rep = await httpJson<YtReport>(youtubeReportUrl(range.from, range.to), { headers: { authorization: `Bearer ${tok.access_token}` } });
    return { rows: youtubeToFacts(account, rep), replace: [{ dataset: 'social', from: range.from, to: range.to, dim: 'account', keys: [account] }] };
  },
};
