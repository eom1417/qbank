import { expect, test } from '@playwright/test';
import { importedEnglishBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

test('notices an ended import, warns about patients, and answers from Help (M14)', async ({
  page,
}) => {
  await page.goto('/');
  await importedEnglishBank(page, 'help', fixtures().english);
  await page.getByRole('link', { name: 'استورد ملفات' }).click();
  await expect(page.getByText('لا ترفع صفحات تكشف هوية مريض')).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('مؤخراً')).toBeVisible();
  await expect(page.getByText('english.pdf')).toBeVisible();
  await page.getByRole('link', { name: 'افتح التقرير' }).click();
  await expect(page).toHaveURL(/\/imports\//);

  await page.getByRole('link', { name: 'المساعدة' }).click();
  await expect(page.getByRole('heading', { name: 'أين بياناتي؟' })).toBeVisible();
  await page.getByRole('button', { name: 'أنشئ التقرير' }).click();
  await expect(page.getByText('"banks": 1')).toBeVisible();
  await expect(page.getByText('english.pdf')).toHaveCount(0);

  await page.goto('/settings');
  const reminders = page.getByLabel('تذكير بالمراجعات المستحقة');
  await reminders.selectOption('weekly');
  const study = page.locator('form').filter({ has: reminders });
  await study.getByRole('button', { name: 'حفظ' }).click();
  await expect(study.getByText('تم الحفظ.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('تذكير بالمراجعات المستحقة')).toHaveValue('weekly');
});
