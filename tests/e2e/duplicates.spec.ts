import { expect, test } from '@playwright/test';
import { AR, newLearner, signUp, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

test('the same book twice: copies wait, the pair is compared, and keeping both settles it (UI-12, JY-06)', async ({
  page,
}) => {
  await signUp(page, newLearner('duplicates'), AR);
  await page.getByLabel('اسم البنك').fill('Medicine');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  for (let round = 0; round < 2; round++) {
    await page.getByRole('link', { name: 'استورد ملفات' }).click();
    await page.getByLabel('ملفات PDF').setInputFiles(fixtures().english);
    await page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.').check();
    await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: 'english.pdf' })
        .first()
        .getByText('يحتاج مراجعتك'),
    ).toBeVisible({ timeout: 60_000 });
    await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
  }
  await page.getByRole('link', { name: 'التكرارات' }).click();
  await expect(page.getByRole('heading', { name: 'الأسئلة المكررة والمتشابهة' })).toBeVisible();
  const first = page.locator('.qb-card').filter({ hasText: 'السؤال نفسه' }).first();
  await expect(first.getByText('english.pdf').first()).toBeVisible();
  await first.getByRole('button', { name: 'أبقِ الاثنين' }).click();
  await expect(page.getByText('أُبقي الاثنان').first()).toBeVisible();
});
