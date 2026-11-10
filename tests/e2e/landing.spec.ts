import { expect, test } from '@playwright/test';

test('visitor reads what the service does, its final terms and privacy, then starts sign-up', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('خاص افتراضياً: لا يرى أحد غيرك')).toBeVisible();
  await page.getByRole('link', { name: 'سياسة الخصوصية' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'سياسة الخصوصية' })).toBeVisible();
  await expect(page.getByText('التصدير والحذف متى شئت')).toBeVisible();
  await expect(page.getByText('مسودة')).toHaveCount(0);
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1, name: 'شروط الاستخدام' })).toBeVisible();
  await expect(page.getByText('لا صفحات تكشف هوية مريض')).toBeVisible();
  await page.goto('/');
  await page.getByRole('link', { name: 'أنشئ مكتبتك' }).click();
  await expect(page).toHaveURL('/sign-up');
});
