import { expect, test } from '@playwright/test';
import { answerAndApprove, importedEnglishBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

test('review: open a question from the queue, set its answer, see the change, approve it (UI-10, UI-11)', async ({
  page,
}) => {
  const keyWarnings: string[] = [];
  page.on('console', (m) => {
    if (m.text().includes('same key')) keyWarnings.push(m.text());
  });
  await importedEnglishBank(page, 'review', fixtures().english);
  await page.getByRole('link', { name: 'راجع الأسئلة' }).click();
  await expect(page.getByRole('heading', { name: 'المراجعة' })).toBeVisible();
  await expect(page.getByText('ينتظرك: 7')).toBeVisible();
  await page.getByRole('link', { name: 'افتح' }).first().click();
  await expect(page.getByRole('heading', { name: /^السؤال/ })).toBeVisible();
  await answerAndApprove(page);
  await expect(page.getByText('تعديلك').first()).toBeVisible();
  await expect(page.locator('.qb-diff ins').first()).toBeVisible();
  await page.getByRole('link', { name: 'المراجعة' }).click();
  await expect(page.getByText('ينتظرك: 6')).toBeVisible();
  expect(keyWarnings).toEqual([]);
});

test('review: hide a question, bring it back, write a private note, and bulk-approve only safe ones', async ({
  page,
}) => {
  await importedEnglishBank(page, 'review-hide', fixtures().english);
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
