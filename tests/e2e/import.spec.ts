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
  await expect(page.getByRole('heading', { name: 'استيراد ملفات' })).toBeVisible();
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
  await expect(
    page.getByText('الصفحات: 1–3 · الأسئلة: 8 · تحتاج مراجعة: 7 · جاهزة للمذاكرة: 0'),
  ).toBeVisible();
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

test('import into a new bank, see it complete, then delete the original', async ({ page }) => {
  await newBank(page, 'import-new');
  await page.getByLabel('البنك الذي تذهب إليه الأسئلة').selectOption({ label: 'بنك جديد…' });
  await page.getByLabel('اسم البنك الجديد').fill('أسئلة مقالية');
  await page.getByLabel('ملفات PDF').setInputFiles(fx.essays);
  await page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.').check();
  await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
  await expect(page.getByText('اكتمل الاستيراد، والأسئلة في البنك.')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByLabel('البنك الذي تذهب إليه الأسئلة')).toHaveValue(/.+/);
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'أسئلة مقالية' })).toBeVisible();
  await page.getByRole('button', { name: 'احذف الملف الأصلي' }).click();
  await page.getByRole('button', { name: 'تأكيد حذف الأصل (الأسئلة تبقى)' }).click();
  await expect(page.getByText('الملف الأصلي محذوف؛ الأسئلة ومصدرها وصفحاتها باقية.')).toBeVisible();
  await expect(
    page.getByText('الصفحات: 1–1 · الأسئلة: 2 · تحتاج مراجعة: 0 · جاهزة للمذاكرة: 0'),
  ).toBeVisible();
});

test('see the pictures an import kept and enlarge one (M5.7)', async ({ page }) => {
  await newBank(page, 'import-media');
  await page.getByLabel('ملفات PDF').setInputFiles(fx.media);
  await page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.').check();
  await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'media.pdf' });
  await expect(row.getByText('يحتاج مراجعتك')).toBeVisible({ timeout: 60_000 });
  await row.getByRole('link', { name: 'media.pdf' }).click();
  await expect(page.getByRole('heading', { name: 'الصور والجداول' })).toBeVisible();
  await expect(page.getByText('ربط غير مؤكد — راجعه')).toBeVisible();
  await expect(page.getByText('جودة منخفضة')).toBeVisible();
  await page.getByRole('button', { name: 'كبّر الصورة: تخطيط قلب — السؤال 1' }).click();
  const viewer = page.getByRole('dialog', { name: 'تخطيط قلب — السؤال 1' });
  await expect(viewer.getByRole('img', { name: 'تخطيط قلب — السؤال 1' })).toBeVisible();
  const before = await viewer.getByRole('img').boundingBox();
  await viewer.getByRole('button', { name: 'تكبير' }).click();
  await viewer.getByRole('button', { name: 'تكبير' }).click();
  const after = await viewer.getByRole('img').boundingBox();
  if (!before || !after) throw new Error('the picture is not on screen');
  expect(after.width / before.width).toBeCloseTo(2, 1);
  expect(after.width / after.height).toBeCloseTo(before.width / before.height, 1);
  await viewer.getByRole('button', { name: 'إغلاق' }).click();
  await expect(viewer).toBeHidden();
});

test('a separate answer file makes the questions ready to study (M6.3)', async ({ page }) => {
  await newBank(page, 'import-key');
  const rights = page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.');
  await page.getByLabel('ملفات PDF').setInputFiles(fx.english);
  await rights.check();
  await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
  await expect(page.getByText('يحتاج مراجعتك')).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('ملفات PDF').setInputFiles(fx.answersOnly);
  await page.getByLabel('نوع الملف').selectOption({ label: 'ملف إجابات لمصدر آخر' });
  await page.getByLabel('هذه إجابات أسئلة الملف').selectOption({ label: 'english.pdf' });
  await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'answers-only.pdf' });
  await expect(row.getByText('يحتاج مراجعتك')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
  await expect(
    page.getByText('الصفحات: 1–3 · الأسئلة: 8 · تحتاج مراجعة: 1 · جاهزة للمذاكرة: 6'),
  ).toBeVisible();
  await expect(page.getByText('يُحذف الأصل تلقائياً في').first()).toBeVisible();
});
