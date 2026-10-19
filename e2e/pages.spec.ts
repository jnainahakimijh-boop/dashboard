/** Every primary page loads without errors and passes a WCAG 2.2 AA scan (serious/critical rules). */
import { expect, test } from '@playwright/test';
import { USERS, axeSerious, settle, signIn, watchErrors } from './helpers';

const PAGES: Array<[string, RegExp]> = [
  ['/', /Executive overview/],
  ['/web', /Website analytics/],
  ['/social', /Social media/],
  ['/seo', /SEO intelligence/],
  ['/geo', /GEO & AI visibility/],
  ['/ads', /ChatGPT Ads/],
  ['/content', /Content intelligence/],
  ['/insights', /Insights & recommendations/],
  ['/reports', /Reporting center/],
  ['/admin', /Administration/],
  ['/settings', /Settings/],
];

test.describe('primary pages', () => {
  test('redirects to the sign-in page when not signed in', async ({ page }) => {
    await page.goto('/web');
    await expect(page).toHaveURL(/\/login/);
    expect(await axeSerious(page)).toEqual([]);
  });

  for (const [path, heading] of PAGES) {
    test(`${path} loads, shows demo labelling and is accessible`, async ({ page }) => {
      const errors = watchErrors(page);
      await signIn(page, USERS.admin);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await settle(page);
      // demo data is always labelled as such
      await expect(page.getByText(/Demo mode — figures are synthetic/)).toBeVisible();
      expect(await axeSerious(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test('dark theme and French interface stay accessible', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vdi.prefs', JSON.stringify({ language: 'fr', theme: 'dark' })));
    await signIn(page, USERS.analyst, 'fr');
    for (const path of ['/', '/seo', '/insights?tab=recommendations', '/reports']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.getByText(/Mode démonstration/)).toBeVisible();
      await settle(page);
      expect(await axeSerious(page), path).toEqual([]);
    }
  });

  test('administration sections all render', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, USERS.admin);
    for (const s of ['organization', 'users', 'roles', 'integrations', 'websites', 'social', 'advertising', 'seo_geo', 'kpis', 'dashboard', 'alerts', 'data', 'targets', 'reporting', 'ai', 'audit', 'system']) {
      await page.goto(`/admin?section=${s}`);
      await expect(page.locator('#admin-section-title')).toBeVisible();
      await settle(page);
    }
    expect(errors).toEqual([]);
  });

  test('phone width has no horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, USERS.analyst);
    for (const path of ['/', '/web', '/reports', '/insights']) {
      await page.goto(path);
      await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});
