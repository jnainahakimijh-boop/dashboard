/** ------------------------------------------------------------------
 *  Permission-controlled technical SEO crawler.
 *  Safeguards (all enforced here, not only in the UI):
 *   - runs only for scopes an administrator has authorised;
 *   - only hosts listed in the scope AND registered as a monitored
 *     website (or explicitly allowed for tests) are ever requested;
 *   - robots.txt is fetched first and respected (incl. crawl-delay);
 *   - fixed delay between requests, page and depth budgets, timeouts,
 *     response size cap, HTML only, no cookies or credentials;
 *   - redirects are recorded, never followed off the allowed hosts.
 *  ------------------------------------------------------------------ */
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import robotsParser from 'robots-parser';
import { parse } from 'node-html-parser';
import type { AppContext } from '../context';
import { seoCrawlPages, seoCrawlScopes, seoCrawls, seoIssueHistory, seoIssues, websites } from '../db/schema';
import { safeErrorMessage } from '../security/redact';
import { auditPages, type CrawledPage } from './rules';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

export interface CrawlOptions {
  allowedHosts: string[];
  startUrls: string[];
  includePatterns: string[];
  excludePatterns: string[];
  maxPages: number;
  maxDepth: number;
  delayMs: number;
  userAgent: string;
  shouldStop?: () => boolean;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

function normalise(u: URL): string {
  const x = new URL(u.toString());
  x.hash = '';
  return x.toString();
}

export function allowedUrl(u: URL, opts: Pick<CrawlOptions, 'allowedHosts' | 'includePatterns' | 'excludePatterns'>): boolean {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password) return false;
  if (!opts.allowedHosts.includes(u.host)) return false;
  const pathq = u.pathname + u.search;
  if (opts.excludePatterns.some((p) => p && pathq.includes(p))) return false;
  if (opts.includePatterns.length && !opts.includePatterns.some((p) => pathq.startsWith(p) || pathq === p.replace(/\/$/, ''))) return false;
  return true;
}

async function fetchLimited(url: string, opts: CrawlOptions): Promise<{ status: number; type: string; body: string; location: string | null; ms: number }> {
  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await f(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': opts.userAgent, accept: 'text/html,application/xhtml+xml' }, credentials: 'omit' });
    const type = res.headers.get('content-type') ?? '';
    let body = '';
    if (res.status === 200 && type.includes('html') && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      body = Buffer.concat(chunks).toString('utf8');
    } else await res.body?.cancel();
    return { status: res.status, type, body, location: res.headers.get('location'), ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

export function extractPage(url: string, html: string, depth: number, ms: number, status: number, type: string): CrawledPage & { found: string[] } {
  const root = parse(html, { comment: false });
  const base = new URL(url);
  const links = root
    .querySelectorAll('a[href]')
    .map((a) => {
      try {
        return normalise(new URL(a.getAttribute('href')!, base));
      } catch {
        return null;
      }
    })
    .filter((x): x is string => !!x);
  const text = root.querySelector('body')?.structuredText ?? '';
  const sameHost = links.filter((l) => new URL(l).host === base.host);
  return {
    url,
    statusCode: status,
    contentType: type,
    title: root.querySelector('title')?.text?.trim() ?? null,
    metaDescription: root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? null,
    h1Count: root.querySelectorAll('h1').length,
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href') ? new URL(root.querySelector('link[rel="canonical"]')!.getAttribute('href')!, base).toString() : null,
    robotsMeta: root.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
    hreflang: root.querySelectorAll('link[rel="alternate"][hreflang]').map((l) => ({ lang: l.getAttribute('hreflang') ?? '', href: l.getAttribute('href') ?? '' })),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    imagesMissingAlt: root.querySelectorAll('img').filter((i) => !i.hasAttribute('alt')).length,
    internalLinks: sameHost.length,
    responseMs: ms,
    depth,
    links: sameHost,
    found: sameHost,
  };
}

/** Breadth-first crawl within the scope. Returns the crawled pages (including errors, redirects and robots-blocked URLs). */
export async function crawl(opts: CrawlOptions): Promise<CrawledPage[]> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const robotsByHost = new Map<string, ReturnType<typeof robotsParser> | null>();
  const getRobots = async (u: URL) => {
    if (robotsByHost.has(u.host)) return robotsByHost.get(u.host)!;
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    let robots: ReturnType<typeof robotsParser> | null = null;
    try {
      const r = await fetchLimited(robotsUrl, opts);
      if (r.status === 200) robots = robotsParser(robotsUrl, r.body || '');
      else if (r.status >= 500) robots = robotsParser(robotsUrl, 'User-agent: *\nDisallow: /'); // server error → assume full disallow
    } catch {
      robots = robotsParser(robotsUrl, 'User-agent: *\nDisallow: /');
    }
    robotsByHost.set(u.host, robots);
    return robots;
  };
  const queue: Array<{ url: string; depth: number }> = [];
  const seen = new Set<string>();
  for (const s of opts.startUrls) {
    try {
      const u = new URL(s);
      if (allowedUrl(u, opts)) {
        queue.push({ url: normalise(u), depth: 0 });
        seen.add(normalise(u));
      }
    } catch {
      /* ignore invalid start URL */
    }
  }
  const out: CrawledPage[] = [];
  while (queue.length && out.length < opts.maxPages) {
    if (opts.shouldStop?.()) break;
    const { url, depth } = queue.shift()!;
    const u = new URL(url);
    const robots = await getRobots(u);
    if (robots && robots.isAllowed(url, opts.userAgent) === false) {
      out.push({ url, statusCode: null, depth, blockedByRobots: true });
      continue;
    }
    const delay = Math.max(opts.delayMs, ((robots?.getCrawlDelay(opts.userAgent) ?? 0) as number) * 1000);
    if (out.length) await sleep(delay);
    try {
      const r = await fetchLimited(url, opts);
      if (r.status >= 300 && r.status < 400 && r.location) {
        const target = normalise(new URL(r.location, u));
        out.push({ url, statusCode: r.status, depth, redirectedTo: target, responseMs: r.ms });
        const tu = new URL(target);
        if (!seen.has(target) && allowedUrl(tu, opts) && depth < opts.maxDepth) {
          seen.add(target);
          queue.push({ url: target, depth });
        }
        continue;
      }
      if (r.status !== 200 || !r.type.includes('html')) {
        out.push({ url, statusCode: r.status, contentType: r.type, depth, responseMs: r.ms });
        continue;
      }
      const page = extractPage(url, r.body, depth, r.ms, r.status, r.type);
      const { found, ...rest } = page;
      out.push(rest);
      if (depth < opts.maxDepth) {
        for (const l of found) {
          if (seen.has(l)) continue;
          const lu = new URL(l);
          if (!allowedUrl(lu, opts)) continue;
          seen.add(l);
          queue.push({ url: l, depth: depth + 1 });
        }
      }
    } catch (err) {
      out.push({ url, statusCode: null, depth, contentType: `error: ${safeErrorMessage(err)}` });
    }
  }
  return out;
}

/** Job: run an authorised crawl, store pages and reconcile issues (new / still open / no longer detected). */
export async function runCrawlJob(app: AppContext, crawlId: string): Promise<Record<string, unknown>> {
  const [crawlRow] = await app.db.select().from(seoCrawls).where(eq(seoCrawls.id, crawlId));
  if (!crawlRow) throw new Error('Crawl not found');
  const [scope] = await app.db.select().from(seoCrawlScopes).where(eq(seoCrawlScopes.id, crawlRow.scopeId));
  if (!scope?.authorized || !scope.enabled) {
    await app.db.update(seoCrawls).set({ status: 'failed', error: 'Scope not authorised', finishedAt: new Date() }).where(eq(seoCrawls.id, crawlId));
    throw new Error('Crawl scope is not authorised');
  }
  const monitored = (await app.db.select({ domain: websites.domain }).from(websites)).map((w) => w.domain);
  const extra = app.env.CRAWLER_EXTRA_ALLOWED_HOSTS.split(',').map((s) => s.trim()).filter(Boolean);
  const allowedHosts = scope.allowedHosts.filter((h) => monitored.includes(h) || extra.includes(h));
  if (!allowedHosts.length) {
    await app.db.update(seoCrawls).set({ status: 'failed', error: 'No allowed host is a monitored website', finishedAt: new Date() }).where(eq(seoCrawls.id, crawlId));
    throw new Error('No allowed host is a monitored website');
  }
  await app.db.update(seoCrawls).set({ status: 'running', startedAt: new Date() }).where(eq(seoCrawls.id, crawlId));
  try {
    const pages = await crawl({ allowedHosts, startUrls: scope.startUrls, includePatterns: scope.includePatterns, excludePatterns: scope.excludePatterns, maxPages: Math.min(scope.maxPages, 2000), maxDepth: Math.min(scope.maxDepth, 8), delayMs: Math.max(scope.delayMs, 500), userAgent: app.env.CRAWLER_USER_AGENT });
    if (pages.length) {
      await app.db.insert(seoCrawlPages).values(
        pages.map((p) => ({ crawlId, url: p.url.slice(0, 2000), statusCode: p.statusCode, contentType: p.contentType?.slice(0, 200) ?? null, title: p.title?.slice(0, 500) ?? null, metaDescription: p.metaDescription?.slice(0, 1000) ?? null, h1Count: p.h1Count ?? null, canonical: p.canonical ?? null, robotsMeta: p.robotsMeta ?? null, hreflang: p.hreflang ?? [], wordCount: p.wordCount ?? null, imagesMissingAlt: p.imagesMissingAlt ?? null, internalLinks: p.internalLinks ?? null, responseMs: p.responseMs ?? null, depth: p.depth, redirectedTo: p.redirectedTo ?? null, blockedByRobots: !!p.blockedByRobots })),
      );
    }
    const detected = auditPages(pages);
    const now = new Date();
    const seenIds: string[] = [];
    for (const d of detected) {
      const [existing] = await app.db.select().from(seoIssues).where(and(eq(seoIssues.rule, d.rule), eq(seoIssues.url, d.url)));
      if (existing) {
        const reopen = existing.status === 'resolved';
        await app.db.update(seoIssues).set({ lastSeenAt: now, lastCrawlId: crawlId, details: d.details, ...(reopen ? { status: 'open', resolvedAt: null } : {}) }).where(eq(seoIssues.id, existing.id));
        if (reopen) await app.db.insert(seoIssueHistory).values({ issueId: existing.id, action: 'status', fromValue: 'resolved', toValue: 'open', comment: 'Detected again by crawl' });
        seenIds.push(existing.id);
      } else {
        const [row] = await app.db.insert(seoIssues).values({ orgId: app.orgId, websiteKey: scope.websiteKey, rule: d.rule, severity: d.severity, url: d.url, details: d.details, firstSeenAt: now, lastSeenAt: now, lastCrawlId: crawlId }).returning();
        await app.db.insert(seoIssueHistory).values({ issueId: row.id, action: 'detected', toValue: 'open', comment: 'Detected by crawl' });
        seenIds.push(row.id);
      }
    }
    // open issues on this website that this crawl no longer detects → resolved automatically (only if the URL was crawled)
    const crawledUrls = pages.map((p) => p.url);
    if (crawledUrls.length) {
      const stale = await app.db
        .select()
        .from(seoIssues)
        .where(and(eq(seoIssues.websiteKey, scope.websiteKey), inArray(seoIssues.status, ['open', 'in_progress']), inArray(seoIssues.url, crawledUrls), seenIds.length ? notInArray(seoIssues.id, seenIds) : undefined));
      for (const s of stale) {
        await app.db.update(seoIssues).set({ status: 'resolved', resolvedAt: now }).where(eq(seoIssues.id, s.id));
        await app.db.insert(seoIssueHistory).values({ issueId: s.id, action: 'status', fromValue: s.status, toValue: 'resolved', comment: 'Not detected in the latest crawl' });
      }
    }
    const stats = { pages: pages.length, errors: pages.filter((p) => (p.statusCode ?? 0) >= 400).length, redirects: pages.filter((p) => p.redirectedTo).length, blockedByRobots: pages.filter((p) => p.blockedByRobots).length, issues: detected.length };
    await app.db.update(seoCrawls).set({ status: 'completed', finishedAt: new Date(), pagesCrawled: pages.length, issuesFound: detected.length, stats }).where(eq(seoCrawls.id, crawlId));
    return stats;
  } catch (err) {
    await app.db.update(seoCrawls).set({ status: 'failed', finishedAt: new Date(), error: safeErrorMessage(err) }).where(eq(seoCrawls.id, crawlId));
    throw err;
  }
}
