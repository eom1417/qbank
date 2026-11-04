import { expect, test } from '@playwright/test';
import { studyableBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

test('Analytics and search: real figures, and reading a found question changes nothing (UI-21, UI-22, JY-18)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await studyableBank(page, 'analytics', fixtures().english);
  await page.getByRole('link', { name: 'ذاكر' }).click();
  await page.getByRole('button', { name: 'استخدمها كلها' }).click();
  await page.getByRole('button', { name: 'ابدأ', exact: true }).click();
  await page.locator('.qb-choice').first().click();
  await page.getByRole('button', { name: 'أرسل إجابتي' }).click();
  await expect(page.getByText('الإجابة الصحيحة:')).toBeVisible();
  await page.getByRole('link', { name: 'التحليلات' }).click();
  await expect(page.getByRole('heading', { name: 'تقدمك' })).toBeVisible();
  await expect(page.getByText('جاهزة للمذاكرة 2')).toBeVisible();
  const accuracy = page
    .locator('.qb-card')
    .filter({ hasText: 'الإجابات الصحيحة من الأسئلة المُجابة.' });
  await expect(accuracy.getByText(/من 1 \(/)).toBeVisible();
  await page.getByRole('link', { name: 'البحث' }).click();
  await page.getByRole('button', { name: 'ابحث' }).click();
  await expect(page.getByText(/وُجد: \d+/)).toBeVisible();
  await page.getByRole('link', { name: 'اقرأ' }).first().click();
  await expect(page.getByText('قراءة السؤال ليست محاولة')).toBeVisible();
  await page.getByLabel('ملاحظة').fill('my reading note');
  await page.getByRole('button', { name: 'أضف الملاحظة' }).click();
  await expect(page.getByText('my reading note')).toBeVisible();
  await page.getByRole('link', { name: 'التحليلات' }).click();
  await expect(accuracy.getByText(/من 1 \(/)).toBeVisible();
});
