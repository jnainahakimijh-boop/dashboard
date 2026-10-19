/** Deterministic demo crawl snapshot (no network access). Stored with source = 'demo_snapshot'. */
import { PAGES, SITES, type SiteId } from '@shared/catalog';
import { strHash, u01 } from '@shared/demo/rng';
import type { DB } from '../db/client';
import { seoCrawlPages, seoCrawls, seoIssueHistory, seoIssues } from '../db/schema';
import { auditPages, type CrawledPage } from './rules';

const PAIRS: Record<string, string> = {
  '/en': '/fr',
  '/en/our-solutions/water-treatment': '/fr/nos-solutions/traitement-de-l-eau',
  '/en/our-solutions/wastewater-reuse': '/fr/nos-solutions/reutilisation-des-eaux-usees',
  '/en/our-solutions/pfas-treatment': '/fr/nos-solutions/traitement-des-pfas',
  '/en/our-solutions/industrial-decarbonisation': '/fr/nos-solutions/decarbonation-industrielle',
  '/en/our-solutions/waste-management': '/fr/nos-solutions/gestion-des-dechets',
  '/en/our-solutions/energy-efficiency': '/fr/nos-solutions/efficacite-energetique',
  '/en/municipalities/water-services': '/fr/collectivites/services-de-l-eau',
  '/en/media/press-releases': '/fr/medias/communiques',
  '/en/media/annual-results-2025': '/fr/medias/resultats-annuels-2025',
  '/en/careers': '/fr/carrieres',
  '/en/contact': '/fr/contact',
  '/en/resources/brochures': '/fr/ressources/brochures',
  '/en/about-us': '/fr/qui-sommes-nous',
  '/en/sustainability-report-2025': '/fr/rapport-developpement-durable-2025',
};
const PAIR_REV = Object.fromEntries(Object.entries(PAIRS).map(([a, b]) => [b, a]));

export function demoCrawlPages(site: SiteId): CrawledPage[] {
  const def = SITES.find((s) => s.id === site)!;
  const base = `https://${def.domain}`;
  const pages = PAGES.filter((p) => p.site === site);
  const salt = strHash(`crawl:${site}`);
  const out: CrawledPage[] = pages.map((p, i) => {
    const r = (k: number) => u01(salt, i, k);
    const counterpart = PAIRS[p.path] ?? PAIR_REV[p.path];
    const hreflang = counterpart
      ? [
          { lang: def.language, href: `${base}${p.path}` },
          { lang: def.language === 'fr' ? 'en' : 'fr', href: `${base}${counterpart}` },
        ]
      : [{ lang: def.language, href: `${base}${p.path}` }];
    const isArticle = p.type === 'article' || p.type === 'case_study';
    return {
      url: `${base}${p.path}`,
      statusCode: 200,
      contentType: 'text/html; charset=utf-8',
      title: r(1) < 0.06 ? '' : p.type === 'press' && r(2) < 0.5 ? (def.language === 'fr' ? 'Communiqués | Veolia' : 'Press | Veolia') : `${p.title} | Veolia`,
      metaDescription: r(3) < 0.18 ? '' : `${p.title}. ${def.language === 'fr' ? 'Découvrez les solutions Veolia.' : 'Discover Veolia solutions.'}`,
      h1Count: r(4) < 0.05 ? 0 : r(4) > 0.95 ? 2 : 1,
      canonical: r(5) < 0.08 ? null : `${base}${p.path}`,
      robotsMeta: p.path.includes('alternance') ? 'noindex, follow' : 'index, follow',
      hreflang,
      wordCount: isArticle ? 900 + Math.round(r(6) * 900) : p.type === 'conversion' || p.type === 'careers' ? 120 + Math.round(r(6) * 200) : 300 + Math.round(r(6) * 700),
      imagesMissingAlt: r(7) < 0.3 ? 1 + Math.floor(r(8) * 6) : 0,
      internalLinks: 25 + Math.floor(r(9) * 40),
      responseMs: Math.round(220 + r(10) * 900 + (p.type === 'resource' ? 1100 : 0)),
      depth: p.path.split('/').length - 2,
      links: [`${base}${def.basePath}`, ...(r(11) < 0.15 ? [`${base}${def.basePath}/${def.language === 'fr' ? 'actualites/ancien-article-2019' : 'news/old-article-2019'}`] : []), ...(r(12) < 0.2 ? [`${base}${def.basePath}/${def.language === 'fr' ? 'solutions' : 'solutions'}`] : [])],
    };
  });
  out.push(
    { url: `${base}${def.basePath}/${def.language === 'fr' ? 'actualites/ancien-article-2019' : 'news/old-article-2019'}`, statusCode: 404, contentType: 'text/html', depth: 3 },
    { url: `${base}${def.basePath}/solutions`, statusCode: 301, redirectedTo: `${base}${def.basePath}/${def.language === 'fr' ? 'nos-solutions' : 'our-solutions'}`, depth: 2 },
    { url: `${base}${def.basePath}/${def.language === 'fr' ? 'espace-presse/archives' : 'press-centre/archive'}`, statusCode: null, blockedByRobots: true, depth: 3 },
  );
  return out;
}

export async function buildDemoCrawlSnapshot(db: DB, orgId: string, scopeId: string, site: SiteId): Promise<void> {
  const pages = demoCrawlPages(site);
  const issues = auditPages(pages);
  const started = new Date('2026-10-12T05:00:00Z');
  const [crawl] = await db
    .insert(seoCrawls)
    .values({
      scopeId,
      status: 'completed',
      source: 'demo_snapshot',
      startedAt: started,
      finishedAt: new Date(started.getTime() + 11 * 60_000),
      pagesCrawled: pages.length,
      issuesFound: issues.length,
      stats: { note: 'Synthetic snapshot for demonstration. No request was sent to the website.' },
    })
    .returning();
  await db.insert(seoCrawlPages).values(
    pages.map((p) => ({
      crawlId: crawl.id,
      url: p.url,
      statusCode: p.statusCode,
      contentType: p.contentType ?? null,
      title: p.title ?? null,
      metaDescription: p.metaDescription ?? null,
      h1Count: p.h1Count ?? null,
      canonical: p.canonical ?? null,
      robotsMeta: p.robotsMeta ?? null,
      hreflang: p.hreflang ?? [],
      wordCount: p.wordCount ?? null,
      imagesMissingAlt: p.imagesMissingAlt ?? null,
      internalLinks: p.internalLinks ?? null,
      responseMs: p.responseMs ?? null,
      depth: p.depth,
      redirectedTo: p.redirectedTo ?? null,
      blockedByRobots: !!p.blockedByRobots,
    })),
  );
  const firstSeen = new Date('2026-09-14T05:00:00Z');
  for (const [i, iss] of issues.entries()) {
    const status = i % 9 === 0 ? 'in_progress' : i % 13 === 0 ? 'resolved' : i % 17 === 0 ? 'ignored' : 'open';
    const [row] = await db
      .insert(seoIssues)
      .values({
        orgId,
        websiteKey: site,
        rule: iss.rule,
        severity: iss.severity,
        url: iss.url,
        details: iss.details,
        status,
        firstSeenAt: i % 3 === 0 ? firstSeen : started,
        lastSeenAt: started,
        resolvedAt: status === 'resolved' ? new Date('2026-10-14T10:00:00Z') : null,
        lastCrawlId: crawl.id,
      })
      .returning();
    await db.insert(seoIssueHistory).values({ issueId: row.id, action: 'detected', toValue: 'open', comment: 'Detected by demo crawl snapshot', createdAt: i % 3 === 0 ? firstSeen : started });
    if (status !== 'open') await db.insert(seoIssueHistory).values({ issueId: row.id, action: 'status', fromValue: 'open', toValue: status, comment: 'Demo workflow update', createdAt: new Date('2026-10-14T10:00:00Z') });
  }
}
