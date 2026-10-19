/** Key user flows: filters, permissions, reports, settings persistence and administration. */
import { expect, test } from '@playwright/test';
import { USERS, settle, signIn } from './helpers';

test('charts and KPIs respond to the global filters', async ({ page }) => {
  await signIn(page, USERS.analyst);
  await page.goto('/web');
  await settle(page);
  const card = page.getByRole('article', { name: /^Sessions/ }).first();
  const all = (await card.locator('p.tnum').first().textContent())?.trim();
  await page.goto('/web?site=veolia-fr');
  await settle(page);
  const fr = (await card.locator('p.tnum').first().textContent())?.trim();
  expect(all).toBeTruthy();
  expect(fr).toBeTruthy();
  expect(fr).not.toBe(all);
  // the filter is reflected in the toolbar and kept in the URL
  await expect(page).toHaveURL(/site=veolia-fr/);
});

test('executive viewers cannot reach administration or build reports', async ({ page }) => {
  await signIn(page, USERS.executive);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
  await page.goto('/reports');
  await expect(page.getByRole('tab', { name: 'Report builder' })).toHaveCount(0);
  await expect(page.getByText(/download published reports/)).toBeVisible();
  // the server refuses too, whatever the interface shows
  const res = await page.request.get('/api/admin/users', { headers: { 'x-vdi-request': '1' } });
  expect(res.status()).toBe(403);
});

test('editors can comment on a recommendation but not change its workflow', async ({ page }) => {
  await signIn(page, USERS.editor);
  await page.goto('/insights?tab=recommendations');
  await settle(page);
  await page.locator('ul li button').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByLabel('Status')).toBeDisabled();
  await drawer.getByLabel('Add a comment…').fill('Checked with the web team.');
  await drawer.getByRole('button', { name: 'Post comment' }).click();
  await expect(drawer.getByText('Checked with the web team.')).toBeVisible();
});

test('the executive report keeps its seven-part structure in the preview', async ({ page }) => {
  await signIn(page, USERS.analyst);
  await page.goto('/reports');
  await settle(page);
  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('article', { name: /Preview of/ });
  for (const h of ['1. Executive summary', '2. Performance highlights', '3. Significant changes', '4. Possible drivers', '5. Risks and opportunities', '6. Recommended actions', '7. Data limitations']) {
    await expect(preview.getByRole('heading', { name: h })).toBeVisible();
  }
});

test('a generated report can be downloaded and appears in the history', async ({ page }) => {
  await signIn(page, USERS.analyst);
  await page.goto('/reports');
  await settle(page);
  await page.getByLabel('Format').selectOption('csv');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate & download' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole('tab', { name: 'Generated reports' }).click();
  await expect(page.getByRole('cell', { name: /Executive digital performance report/ }).first()).toBeVisible();
});

test('settings persist after a reload', async ({ page }) => {
  await signIn(page, USERS.analyst);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('administrators can create, disable and delete an alert rule', async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.goto('/admin?section=alerts');
  await settle(page);
  await page.getByRole('button', { name: 'Add rule' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('E2E — sessions drop');
  await dialog.getByLabel('Threshold (%)').fill('30');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.getByRole('row', { name: /E2E — sessions drop/ });
  await expect(row).toBeVisible();
  await row.getByRole('switch').click();
  await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  page.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: /Delete/ }).click();
  await expect(page.getByRole('row', { name: /E2E — sessions drop/ })).toHaveCount(0);
});

test('the dashboard builder controls the executive overview', async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.goto('/admin?section=dashboard');
  await settle(page);
  await page.getByRole('switch', { name: 'Visible: Map & countries' }).click();
  await page.getByRole('button', { name: 'Save layout' }).click();
  await page.goto('/');
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Geography' })).toHaveCount(0);
  await page.goto('/admin?section=dashboard');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Reset to default' }).click();
  await page.goto('/');
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Geography' })).toBeVisible();
});

test('credentials are write-only in the integration manager', async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.goto('/admin?section=integrations');
  await settle(page);
  const card = page.locator('li', { has: page.getByText('ChatGPT Ads — Veolia advertiser account') }).first();
  await card.getByRole('button', { name: /Connect|Reauthorise/ }).click();
  const drawer = page.getByRole('dialog');
  const secret = drawer.locator('input[type="password"]').first();
  await secret.fill('test-token-not-real');
  await drawer.getByRole('button', { name: 'Save' }).click();
  await expect(drawer).toHaveCount(0);
  const res = await page.request.get('/api/admin/integrations');
  const text = await res.text();
  expect(text).not.toContain('test-token-not-real');
  // storing a credential never marks the source as connected
  const conn = (JSON.parse(text) as Array<{ provider: string; status: string; hasSecret: boolean }>).find((c) => c.provider === 'chatgpt_ads')!;
  expect(conn.hasSecret).toBe(true);
  expect(conn.status).not.toBe('connected');
});
