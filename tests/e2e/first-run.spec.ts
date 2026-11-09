import { expect, test } from '@playwright/test';
import { AR, newLearner, signUp } from './support.js';

test('a new owner studies the sample bank within two minutes, with no file and no AI (M28.1)', async ({
  page,
}) => {
  await signUp(page, newLearner('first-run'), AR);
  await expect(page.getByText('مكتبتك فارغة')).toBeVisible();
  await page.getByRole('button', { name: 'جهّز البنك التجريبي' }).click();
  await expect(page.getByText('اكتمل')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('الأسئلة: 10', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
  await expect(page.getByRole('heading', { name: 'بنك تجريبي' })).toBeVisible();
  await page.getByRole('link', { name: 'ذاكر' }).first().click();
  await expect(page.getByRole('heading', { name: 'ابدأ جلسة Tutor' })).toBeVisible();
  await expect(page.getByText('الجاهز هو هذا العدد فقط: 10', { exact: false })).toBeVisible();
});
