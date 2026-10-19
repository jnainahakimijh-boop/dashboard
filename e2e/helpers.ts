import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const USERS = {
  admin: 'demo.admin@veolia.example',
  analyst: 'demo.analyst@veolia.example',
  editor: 'demo.editor@veolia.example',
  executive: 'demo.executive@veolia.example',
} as const;

/** Signs in through the demo endpoint (same as the login page buttons) with the interface in English. */
export async function signIn(page: Page, email: string, lang: 'en' | 'fr' = 'en') {
  await page.addInitScript((l) => {
    try {
      const cur = JSON.parse(localStorage.getItem('vdi.prefs') ?? '{}');
      if (!cur.language) localStorage.setItem('vdi.prefs', JSON.stringify({ ...cur, language: l }));
      localStorage.setItem('vdi.langInit', '1');
    } catch {
      /* storage unavailable */
    }
  }, lang);
  const res = await page.request.post('/api/auth/demo-login', { headers: { 'x-vdi-request': '1', 'content-type': 'application/json' }, data: { email } });
  expect(res.status()).toBe(200);
}

/** Collects uncaught page errors and console errors (ignoring expected 4xx resource messages). */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/Failed to load resource: the server responded with a status of (401|403|404|409|422)/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

/** WCAG 2.2 AA scan; returns serious and critical violations only. */
export async function axeSerious(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return res.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

export async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 20_000 }).catch(() => {});
}
