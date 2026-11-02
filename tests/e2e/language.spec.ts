import { expect, test } from '@playwright/test';
import { AR, newLearner, signUp } from './support.js';

test('switching to English flips direction and text, and the choice survives a reload', async ({
  page,
}) => {
  await signUp(page, newLearner('lang'), AR);
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'My library' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'My library' })).toBeVisible();
  await page.getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('dark theme is applied and remembered', async ({ page }) => {
  await signUp(page, newLearner('theme'), AR);
  const toggle = page.getByRole('button', { name: /^المظهر/ });
  await toggle.click();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
