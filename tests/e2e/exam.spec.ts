import { expect, test } from '@playwright/test';
import { studyableBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

test('Exam: rules before start, no solution until submitted, check, then score and accuracy (UI-16…19, JY-08)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await studyableBank(page, 'exam', fixtures().english);
  await page.getByRole('link', { name: 'ذاكر' }).click();
  await page.getByLabel('النمط').selectOption('exam');
  await page.getByLabel('الوقت', { exact: true }).selectOption('total');
  await expect(page.getByText('يبدأ المؤقت عند الضغط على «ابدأ».', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'استخدمها كلها' }).click();
  await page.getByRole('button', { name: 'ابدأ الامتحان' }).click();
  await expect(page.getByText('السؤال 1 من 2')).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.locator('.qb-choice').first().click();
  await expect(page.getByText('حُفظ')).toBeVisible();
  await expect(page.locator('.qb-choice--right, .qb-choice--wrong')).toHaveCount(0);
  await expect(page.getByText('الإجابة الصحيحة:')).toHaveCount(0);
  await page.getByRole('button', { name: 'علِّمه للعودة إليه' }).click();
  await expect(page.getByRole('button', { name: /1: ✓ مُجاب · ⚑ معلَّم/ })).toBeVisible();
  await page.getByRole('link', { name: 'راجع ثم سلّم' }).click();
  await expect(page.getByText('المُجاب: 1 · بلا إجابة: 1 · المعلَّم: 1')).toBeVisible();
  await expect(page.getByText('بعض الأسئلة بلا إجابة، وستُحسب متروكة.')).toBeVisible();
  await page.getByRole('button', { name: 'سلّم الامتحان' }).click();
  await page.getByRole('button', { name: 'نعم، سلّم الآن' }).click();
  await expect(page.getByRole('heading', { name: 'ملخص الجلسة' })).toBeVisible();
  await expect(page.getByText(/الدرجة \(الصحيح من كل الأسئلة\): \d \/ 2/)).toBeVisible();
  await expect(page.getByText(/الدقة \(الصحيح من المُجاب\): \d \/ 1/)).toBeVisible();
});
