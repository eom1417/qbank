import { expect, test, type Page } from '@playwright/test';
import { AR, newLearner, signUp } from './support.js';

async function createBank(page: Page, name: string) {
  await page.getByLabel('اسم البنك').fill(name);
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('edit, archive, find and restore a bank', async ({ page }) => {
  await signUp(page, newLearner('banks'), AR);
  await createBank(page, 'فارماكولوجي');
  await createBank(page, 'Cardiology');
  await page.getByLabel('ابحث في البنوك بالاسم').fill('cardio');
  await expect(page.getByRole('heading', { name: 'فارماكولوجي' })).toHaveCount(0);
  await page.getByRole('link', { name: 'فتح البنك' }).click();

  await page.getByRole('button', { name: 'تعديل البيانات' }).click();
  await page.getByLabel('اسم البنك').fill('Cardiology II');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cardiology II' })).toBeVisible();
  await page.getByRole('button', { name: 'أرشفة البنك' }).click();
  await expect(page.getByText('هذا البنك مؤرشف')).toBeVisible();

  await page.getByRole('link', { name: 'العودة إلى المكتبة' }).click();
  await expect(page.getByRole('heading', { name: 'Cardiology II' })).toHaveCount(0);
  await page.getByLabel('عرض').selectOption('only');
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('button', { name: 'استرجاع البنك' }).click();
  await expect(page.getByText('هذا البنك مؤرشف')).toHaveCount(0);
});

test('chapters and topics: add, rename and delete with confirmation', async ({ page }) => {
  await signUp(page, newLearner('taxonomy'), AR);
  await createBank(page, 'Medicine');
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByLabel('فصل جديد').fill('Endocrine');
  await page.getByRole('button', { name: 'إضافة فصل' }).click();
  await page.getByLabel('موضوع جديد في هذا الفصل').fill('Thyroid');
  await page.getByRole('button', { name: 'إضافة موضوع' }).click();
  await expect(page.getByText('Thyroid')).toBeVisible();

  await page.getByRole('button', { name: 'إعادة تسمية' }).first().click();
  await page.getByLabel('إعادة تسمية').fill('Endocrinology');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('Endocrinology')).toBeVisible();

  const remove = page.getByRole('button', { name: 'حذف' }).first();
  await remove.click();
  await page.getByRole('button', { name: 'تأكيد الحذف' }).click();
  await expect(page.getByText('لا توجد فصول بعد.')).toBeVisible();
});
