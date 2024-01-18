import { test, expect } from '@playwright/test';

test('pages', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', {name: /Matches/}).click();
  await expect(page.locator('.match-wrapper')).toBeVisible();
  await page.getByText('Train').click();
  await expect(page.locator('.train-wrapper')).toBeVisible();
  await page.getByText('Config').click();
  await expect(page.locator('.ace_content')).toBeVisible({ timeout: 15000 });
  await page.getByText('Logs').click();
  await expect(page.locator('pre')).toBeVisible();
});
test('right-menu', async ({ page }) => {
  const { version } = require('../package.json');
  await page.goto('./');
  await page.getByText('Double Take').click();
  await expect(page.getByLabel(`v${version}`).locator('a')).toBeVisible();
  await page.locator('#pv_id_1_0_2 a').click();
  await page.getByText('Double Take').click();
  await expect(page.locator('#pv_id_1_0_2 a')).toBeVisible();
});
