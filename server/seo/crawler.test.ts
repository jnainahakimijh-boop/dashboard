import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allowedUrl, crawl } from './crawler';
import { auditPages } from './rules';

let server: Server;
let host = '';
const requested: string[] = [];

const page = (title: string, body: string, extra = '') =>
  `<!doctype html><html><head><title>${title}</title><meta name="description" content="${title} description">${extra}</head><body><h1>${title}</h1>${body}</body></html>`;

beforeAll(async () => {
  server = createServer((req, res) => {
    requested.push(req.url ?? '');
    const send = (status: number, html: string, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
      res.end(html);
    };
    switch (req.url) {
      case '/robots.txt':
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('User-agent: *\nDisallow: /private\n');
        return;
      case '/':
        return send(200, page('Home page of the site', `<a href="/a">A</a><a href="/b">B</a><a href="/private/x">P</a><a href="/old">Old</a><a href="https://external.example/">Ext</a><a href="/missing">Missing</a>`, `<link rel="canonical" href="http://${host}/">`));
      case '/a':
        return send(200, page('Page A', '<p>short</p><img src="x.png"><a href="/">home</a>', '<meta name="robots" content="noindex">'));
      case '/b':
        return send(200, page('Page A', `<p>${'word '.repeat(300)}</p>`, `<link rel="canonical" href="http://${host}/b"><link rel="alternate" hreflang="fr" href="/fr/b"><link rel="alternate" hreflang="en" href="/b">`));
      case '/old':
        res.writeHead(301, { location: '/b' });
        res.end();
        return;
      case '/private/x':
        return send(200, page('Secret', 'should never be fetched'));
      default:
        return send(404, page('Not found', ''));
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address() as { port: number };
  host = `127.0.0.1:${addr.port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('crawler safeguards', () => {
  it('only allows listed hosts, http(s) and the include/exclude rules', () => {
    const o = { allowedHosts: ['www.veolia.com'], includePatterns: ['/fr/'], excludePatterns: ['?'] };
    expect(allowedUrl(new URL('https://www.veolia.com/fr/x'), o)).toBe(true);
    expect(allowedUrl(new URL('https://www.veolia.com/en/x'), o)).toBe(false);
    expect(allowedUrl(new URL('https://evil.example/fr/x'), o)).toBe(false);
    expect(allowedUrl(new URL('https://user:pw@www.veolia.com/fr/x'), o)).toBe(false);
    expect(allowedUrl(new URL('ftp://www.veolia.com/fr/x'), o)).toBe(false);
    expect(allowedUrl(new URL('https://www.veolia.com/fr/x?q=1'), o)).toBe(false);
  });

  it('crawls within budget, respects robots.txt, records redirects and never leaves the allowed host', async () => {
    const pages = await crawl({ allowedHosts: [host], startUrls: [`http://${host}/`], includePatterns: [], excludePatterns: [], maxPages: 20, maxDepth: 3, delayMs: 0, userAgent: 'TestAudit/1.0', sleep: async () => {} });
    const urls = pages.map((p) => new URL(p.url).pathname);
    expect(urls).toContain('/');
    expect(urls).toContain('/a');
    expect(requested).not.toContain('/private/x');
    expect(pages.find((p) => p.url.endsWith('/private/x'))?.blockedByRobots).toBe(true);
    expect(pages.find((p) => p.url.endsWith('/old'))?.redirectedTo).toMatch(/\/b$/);
    expect(pages.find((p) => p.url.endsWith('/missing'))?.statusCode).toBe(404);
    expect(pages.every((p) => new URL(p.url).host === host)).toBe(true);

    const issues = auditPages(pages);
    const rules = (u: string) => issues.filter((i) => i.url.endsWith(u)).map((i) => i.rule);
    expect(rules('/a')).toEqual(expect.arrayContaining(['noindex', 'thin_content', 'images_missing_alt', 'canonical_missing']));
    expect(rules('/missing')).toContain('http_4xx');
    expect(issues.some((i) => i.rule === 'broken_internal_link' && i.url.endsWith(`${host}/`))).toBe(true);
    expect(issues.some((i) => i.rule === 'redirect_internal_link')).toBe(true);
    expect(rules('/b')).not.toContain('hreflang_missing');
  });

  it('stops at the page budget', async () => {
    const pages = await crawl({ allowedHosts: [host], startUrls: [`http://${host}/`], includePatterns: [], excludePatterns: [], maxPages: 2, maxDepth: 3, delayMs: 0, userAgent: 'TestAudit/1.0', sleep: async () => {} });
    expect(pages.length).toBe(2);
  });
});
