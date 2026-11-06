import { expect, test } from '@playwright/test';
import { importedEnglishBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

test('export a bank, then delete it after seeing what goes (UI-26, UI-27, JY-16)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await importedEnglishBank(page, 'portable', fixtures().english);
  await page.getByRole('link', { name: 'صدِّر' }).click();
  await expect(page.getByRole('heading', { name: 'صدِّر هذا البنك' })).toBeVisible();
  await expect(page.getByText('سيحوي الملف: 8 سؤال', { exact: false })).toBeVisible();
  await expect(
    page.getByText('تسجيلات دخولك ومفاتيحك لدى مزوّدي الذكاء الاصطناعي', { exact: false }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'نزّل الملف' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
  await expect(page.getByText('سيُحذف: 8 سؤال', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'احذف البنك' }).click();
  await page.getByRole('button', { name: 'نعم، احذفه نهائياً' }).click();
  await expect(page.getByRole('heading', { name: 'مكتبتك فارغة' })).toBeVisible();
});
