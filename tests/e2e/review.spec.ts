import { expect, test, type Page } from '@playwright/test';
import { AR, newLearner, signUp, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

/** A new learner's bank with the English fixture imported (8 questions, 7 to review). */
async function importedBank(page: Page, tag: string) {
  await signUp(page, newLearner(tag), AR);
  await page.getByLabel('اسم البنك').fill('Medicine');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('link', { name: 'استورد ملفات' }).click();
  await page.getByLabel('ملفات PDF').setInputFiles(fixtures().english);
  await page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.').check();
  await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'english.pdf' });
  await expect(row.getByText('يحتاج مراجعتك')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
}

test('review: open a question from the queue, set its answer, see the change, approve it (UI-10, UI-11)', async ({
  page,
}) => {
  await importedBank(page, 'review');
  await page.getByRole('link', { name: 'راجع الأسئلة' }).click();
  await expect(page.getByRole('heading', { name: 'المراجعة' })).toBeVisible();
  await expect(page.getByText('ينتظرك: 7')).toBeVisible();
  await page.getByRole('link', { name: 'افتح' }).first().click();
  await expect(page.getByRole('heading', { name: /^السؤال/ })).toBeVisible();
  const answers = page.getByLabel('الإجابة الصحيحة');
  for (let i = 0; i < (await answers.count()); i++) await answers.nth(i).uncheck();
  await answers.first().check();
  await page.getByRole('button', { name: 'احفظ' }).click();
  await expect(page.getByText('مصدر الإجابة: أنت')).toBeVisible();
  await expect(page.getByText('تعديلك').first()).toBeVisible();
  await expect(page.locator('.qb-diff ins').first()).toBeVisible();
  // Choosing the answer settles a missing key; anything else still needs the approval.
  const approve = page.getByRole('button', { name: 'اعتمد', exact: true });
  if (await approve.isVisible()) await approve.click();
  await expect(page.getByText('الحالة: جاهز للدراسة')).toBeVisible();
  await page.getByRole('link', { name: 'المراجعة' }).click();
  await expect(page.getByText('ينتظرك: 6')).toBeVisible();
});

test('review: hide a question, bring it back, write a private note, and bulk-approve only safe ones', async ({
  page,
}) => {
  await importedBank(page, 'review-hide');
  await page.getByRole('link', { name: 'راجع الأسئلة' }).click();
  await page.getByRole('link', { name: 'افتح' }).first().click();
  await expect(page.getByRole('heading', { name: /^السؤال/ })).toBeVisible();
  await page.getByRole('button', { name: 'أخفِ عن الدراسة' }).click();
  await expect(page.getByText('الحالة: مخفي عن الدراسة')).toBeVisible();
  await page.getByRole('button', { name: 'أعده إلى المراجعة' }).click();
  await expect(page.getByText('أُعيد: اعتمده من جديد').first()).toBeVisible();
  await page.getByLabel('ملاحظة').fill('راجع المصدر');
  await page.getByRole('button', { name: 'أضف الملاحظة' }).click();
  await expect(page.getByText('راجع المصدر', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'المراجعة' }).click();
  await page.getByRole('button', { name: 'اعتمد كل الأسئلة الآمنة' }).click();
  await expect(page.getByText(/اعتُمد: \d+ · ما زال يحتاجك: \d+/)).toBeVisible();
});
