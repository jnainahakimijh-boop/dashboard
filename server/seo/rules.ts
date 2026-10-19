/** Technical SEO rules applied to crawled pages (real crawls and the demo snapshot alike). */

export interface CrawledPage {
  url: string;
  statusCode: number | null;
  contentType?: string | null;
  title?: string | null;
  metaDescription?: string | null;
  h1Count?: number | null;
  canonical?: string | null;
  robotsMeta?: string | null;
  hreflang?: Array<{ lang: string; href: string }>;
  wordCount?: number | null;
  imagesMissingAlt?: number | null;
  internalLinks?: number | null;
  responseMs?: number | null;
  depth: number;
  redirectedTo?: string | null;
  blockedByRobots?: boolean;
  /** internal links found on this page (for broken-link detection) */
  links?: string[];
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DetectedIssue {
  rule: string;
  severity: Severity;
  url: string;
  details: Record<string, unknown>;
}

export const RULES: Record<string, { severity: Severity; label: { en: string; fr: string }; help: { en: string; fr: string } }> = {
  http_5xx: { severity: 'critical', label: { en: 'Server error (5xx)', fr: 'Erreur serveur (5xx)' }, help: { en: 'The page returned a server error to the crawler.', fr: 'La page a renvoyé une erreur serveur.' } },
  http_4xx: { severity: 'high', label: { en: 'Page not found / client error (4xx)', fr: 'Page introuvable / erreur client (4xx)' }, help: { en: 'Linked internally but returns a 4xx status.', fr: 'Liée en interne mais renvoie un statut 4xx.' } },
  broken_internal_link: { severity: 'high', label: { en: 'Broken internal link', fr: 'Lien interne cassé' }, help: { en: 'The page links to an internal URL that returns 4xx/5xx.', fr: 'La page pointe vers une URL interne en erreur.' } },
  redirect_internal_link: { severity: 'low', label: { en: 'Internal link to a redirect', fr: 'Lien interne vers une redirection' }, help: { en: 'Update the link to the final URL to save a hop.', fr: "Mettre à jour le lien vers l'URL finale." } },
  missing_title: { severity: 'high', label: { en: 'Missing title', fr: 'Balise title manquante' }, help: { en: 'Every indexable page needs a unique <title>.', fr: 'Chaque page indexable doit avoir un <title> unique.' } },
  duplicate_title: { severity: 'medium', label: { en: 'Duplicate title', fr: 'Title dupliqué' }, help: { en: 'Several pages share the same title.', fr: 'Plusieurs pages partagent le même title.' } },
  title_length: { severity: 'low', label: { en: 'Title length outside 15–65 characters', fr: 'Longueur du title hors 15–65 caractères' }, help: { en: 'Very short or long titles are rewritten or truncated in results.', fr: 'Les titles trop courts ou longs sont réécrits ou tronqués.' } },
  missing_meta_description: { severity: 'medium', label: { en: 'Missing meta description', fr: 'Meta description manquante' }, help: { en: 'Add a description summarising the page.', fr: 'Ajouter une description résumant la page.' } },
  duplicate_meta_description: { severity: 'low', label: { en: 'Duplicate meta description', fr: 'Meta description dupliquée' }, help: { en: 'Several pages share the same description.', fr: 'Plusieurs pages partagent la même description.' } },
  missing_h1: { severity: 'medium', label: { en: 'Missing H1', fr: 'H1 manquant' }, help: { en: 'Pages should have one main heading.', fr: 'Les pages doivent avoir un titre principal.' } },
  multiple_h1: { severity: 'low', label: { en: 'Multiple H1', fr: 'Plusieurs H1' }, help: { en: 'Use a single H1 per page.', fr: 'Utiliser un seul H1 par page.' } },
  canonical_missing: { severity: 'low', label: { en: 'Missing canonical', fr: 'Canonical manquante' }, help: { en: 'Declare a self-referencing canonical URL.', fr: 'Déclarer une URL canonique auto-référente.' } },
  canonical_other: { severity: 'medium', label: { en: 'Canonical points to another URL', fr: 'Canonical vers une autre URL' }, help: { en: 'Check the page is meant to be consolidated.', fr: 'Vérifier que la consolidation est voulue.' } },
  noindex: { severity: 'high', label: { en: 'Page set to noindex', fr: 'Page en noindex' }, help: { en: 'The page asks search engines not to index it.', fr: "La page demande aux moteurs de ne pas l'indexer." } },
  hreflang_missing: { severity: 'medium', label: { en: 'Missing FR/EN hreflang', fr: 'hreflang FR/EN manquant' }, help: { en: 'Language versions should reference each other.', fr: 'Les versions linguistiques doivent se référencer.' } },
  thin_content: { severity: 'low', label: { en: 'Thin content (< 250 words)', fr: 'Contenu pauvre (< 250 mots)' }, help: { en: 'Consider expanding or consolidating the page.', fr: 'Envisager d’enrichir ou de fusionner la page.' } },
  images_missing_alt: { severity: 'low', label: { en: 'Images without alt text', fr: 'Images sans texte alternatif' }, help: { en: 'Alt text helps accessibility and image search.', fr: "Le texte alternatif aide l'accessibilité et la recherche d'images." } },
  slow_response: { severity: 'medium', label: { en: 'Slow server response (> 1.5 s)', fr: 'Réponse serveur lente (> 1,5 s)' }, help: { en: 'Time to first byte measured by the crawler.', fr: 'Temps de réponse mesuré par le robot.' } },
  blocked_by_robots: { severity: 'info', label: { en: 'Blocked by robots.txt', fr: 'Bloquée par robots.txt' }, help: { en: 'The crawler respected robots.txt and skipped this URL.', fr: 'Le robot a respecté robots.txt et ignoré cette URL.' } },
};

const norm = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '');

export function auditPages(pages: CrawledPage[]): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const push = (rule: string, url: string, details: Record<string, unknown> = {}) => issues.push({ rule, severity: RULES[rule].severity, url, details });
  const byUrl = new Map(pages.map((p) => [norm(p.url), p]));
  const html = pages.filter((p) => !p.blockedByRobots && p.statusCode === 200 && (p.contentType ?? 'text/html').includes('html') && !p.redirectedTo);

  for (const p of pages) {
    if (p.blockedByRobots) {
      push('blocked_by_robots', p.url);
      continue;
    }
    if (p.statusCode && p.statusCode >= 500) push('http_5xx', p.url, { status: p.statusCode });
    else if (p.statusCode && p.statusCode >= 400) push('http_4xx', p.url, { status: p.statusCode });
  }

  const titles = new Map<string, string[]>();
  const descs = new Map<string, string[]>();
  for (const p of html) {
    const title = p.title?.trim() ?? '';
    const indexable = !(p.robotsMeta ?? '').toLowerCase().includes('noindex');
    if (!title) push('missing_title', p.url);
    else {
      if (title.length < 15 || title.length > 65) push('title_length', p.url, { length: title.length, title });
      if (indexable) titles.set(title, [...(titles.get(title) ?? []), p.url]);
    }
    const desc = p.metaDescription?.trim() ?? '';
    if (!desc) push('missing_meta_description', p.url);
    else if (indexable) descs.set(desc, [...(descs.get(desc) ?? []), p.url]);
    if ((p.h1Count ?? 0) === 0) push('missing_h1', p.url);
    else if ((p.h1Count ?? 0) > 1) push('multiple_h1', p.url, { count: p.h1Count });
    if (!p.canonical) push('canonical_missing', p.url);
    else if (norm(p.canonical) !== norm(p.url)) push('canonical_other', p.url, { canonical: p.canonical });
    if (!indexable) push('noindex', p.url, { robots: p.robotsMeta });
    const langs = new Set((p.hreflang ?? []).map((h) => h.lang.toLowerCase().slice(0, 2)));
    if (!(langs.has('fr') && langs.has('en'))) push('hreflang_missing', p.url, { present: [...langs] });
    if ((p.wordCount ?? 0) < 250) push('thin_content', p.url, { words: p.wordCount ?? 0 });
    if ((p.imagesMissingAlt ?? 0) > 0) push('images_missing_alt', p.url, { images: p.imagesMissingAlt });
    if ((p.responseMs ?? 0) > 1500) push('slow_response', p.url, { ms: p.responseMs });
    for (const link of p.links ?? []) {
      const target = byUrl.get(norm(link));
      if (!target) continue;
      if (target.statusCode && target.statusCode >= 400) push('broken_internal_link', p.url, { target: link, status: target.statusCode });
      else if (target.redirectedTo) push('redirect_internal_link', p.url, { target: link, finalUrl: target.redirectedTo });
    }
  }
  for (const [title, urls] of titles) if (urls.length > 1) for (const u of urls) push('duplicate_title', u, { title, pages: urls.length });
  for (const [desc, urls] of descs) if (urls.length > 1) for (const u of urls) push('duplicate_meta_description', u, { description: desc.slice(0, 120), pages: urls.length });

  // one issue per (rule, url): keep the first occurrence
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.rule}|${i.url}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
