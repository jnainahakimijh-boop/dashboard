import { expect, test } from '@playwright/test';
import { USERS, settle, signIn, watchErrors } from './helpers';

const PAGES = ['/', '/web', '/social', '/seo', '/geo', '/ads', '/content', '/insights', '/reports', '/admin', '/settings'];
const H = { 'x-vdi-request': '1', 'content-type': 'application/json' };

// With demo data switched off and no source connected, every view must still render: unavailable states, never a crash.
test('every page and tab renders without any data', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await signIn(page, USERS.admin);
  const setDemo = (demoMode: boolean) => page.request.patch('/api/admin/org', { headers: H, data: { demoMode } });
  expect((await setDemo(false)).status()).toBe(200);
  try {
    for (const path of PAGES) {
      await page.goto(path);
      await settle(page);
      const tablists = await page.getByRole('tablist').count();
      const tabs = page.getByRole('tablist').first().getByRole('tab');
      const n = tablists ? await tabs.count() : 0;
      for (let i = 0; i < n; i++) {
        await tabs.nth(i).click();
        await settle(page);
        await expect(page.getByText('Something went wrong'), `${path} tab ${i}`).toHaveCount(0);
      }
      await expect(page.getByText('Something went wrong'), path).toHaveCount(0);
    }
    await expect(page.getByText('No data yet')).toBeVisible();
  } finally {
    await setDemo(true);
  }
  expect(errors).toEqual([]);
});
