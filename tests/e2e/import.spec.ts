import { expect, test, type Page } from '@playwright/test';
import { buildPdfFixtures, type PdfFixtures } from '../support/pdf-fixtures.js';
import { AR, newLearner, signUp } from './support.js';

let fx: PdfFixtures;
test.beforeAll(async () => {
  fx = await buildPdfFixtures();
});
test.afterAll(() => fx.cleanup());

async function newBank(page: Page, tag: string) {
  await signUp(page, newLearner(tag), AR);
  await page.getByLabel('اسم البنك').fill('طب الأطفال');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('link', { name: 'استورد ملفات' }).click();
  await expect(page.getByRole('heading', { name: 'استورد ملفات إلى هذا البنك' })).toBeVisible();
}

test('import a PDF: choose, confirm rights, follow progress, read the report', async ({ page }) => {
  await newBank(page, 'import');
  await page.getByLabel('ملفات PDF').setInputFiles(fx.english);
  await expect(page.getByText('english.pdf')).toBeVisible();
  const start = page.getByRole('button', { name: 'ارفع وابدأ' });
  await expect(start).toBeDisabled();
  await page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.').check();
  await start.click();
  const row = page.getByRole('listitem').filter({ hasText: 'english.pdf' });
  await expect(row.getByText('يحتاج مراجعتك')).toBeVisible({ timeout: 60_000 });
  await expect(
    row.getByText('الصفحات المقروءة: 3 / 3 · الأسئلة: 8 · تحتاج مراجعة: 7'),
  ).toBeVisible();
  await row.getByRole('link', { name: 'english.pdf' }).click();
  await expect(page.getByRole('heading', { name: 'تقرير الاستيراد' })).toBeVisible();
  await expect(page.getByText('كل الصفحات قُرئت من نصها.')).toBeVisible();
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
  await expect(page.getByText('الصفحات: 1–3 · الأسئلة: 8 · تحتاج مراجعة: 7')).toBeVisible();
});

test('a damaged file is refused with a clear reason and nothing is imported', async ({ page }) => {
  await newBank(page, 'import-bad');
  await page.getByLabel('ملفات PDF').setInputFiles([fx.damaged, fx.arabic]);
  await page.getByRole('button', { name: 'احذف هذا الملف' }).last().click();
  await page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.').check();
  await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
  await expect(page.getByText('ملف PDF تالف ولا يمكن قراءته.')).toBeVisible();
  await expect(page.getByText('arabic.pdf')).toHaveCount(0);
});
