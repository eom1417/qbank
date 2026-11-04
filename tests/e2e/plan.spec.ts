import { expect, test } from '@playwright/test';
import { studyableBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

test('Plan and Smart Mix: nothing due offers alternatives; the mix shows its groups and why each question (UI-20, JY-11)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await studyableBank(page, 'plan', fixtures().english);
  await page.goto('/');
  await page.getByRole('link', { name: 'مراجعات اليوم' }).click();
  await expect(page.getByRole('heading', { name: 'مراجعات اليوم' })).toBeVisible();
  await expect(page.getByText('لا شيء مستحق اليوم.', { exact: false })).toBeVisible();
  await expect(page.getByText('أسئلة لم تُجب عنها: 2', { exact: false })).toBeVisible();
  await expect(page.getByText('الفصول حسب الحاجة')).toBeVisible();
  await page.getByRole('link', { name: 'اختر جلسة' }).click();
  await page.getByText('Medicine').click();
  await page.getByLabel('أي الأسئلة').selectOption('smart_mix');
  await expect(
    page.getByText('الجاهز في كل مجموعة: جديد 2 · ضعيف أو خاطئ 0 · مستحق 0'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'استخدمها كلها' }).click();
  await page.getByRole('button', { name: 'ابدأ', exact: true }).click();
  await expect(page.getByText('اختير لأن: لم تُجب عنه بعد')).toBeVisible();
});
