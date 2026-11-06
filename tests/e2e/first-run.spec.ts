import { expect, test } from '@playwright/test';
import { AR, newLearner, signUp } from './support.js';

test('a new owner studies the sample bank within two minutes, with no file and no AI (M28.1)', async ({
  page,
}) => {
  await signUp(page, newLearner('first-run'), AR);
  await expect(page.getByText('مكتبتك فارغة')).toBeVisible();
  await page.getByRole('button', { name: 'جهّز البنك التجريبي' }).click();
  await expect(page.getByText('اكتمل')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('الأسئلة: 10', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
  await expect(page.getByRole('heading', { name: 'بنك تجريبي' })).toBeVisible();
  await page.getByRole('link', { name: 'ذاكر' }).first().click();
  await expect(page.getByRole('heading', { name: 'ابدأ جلسة Tutor' })).toBeVisible();
  await expect(page.getByText('الجاهز هو هذا العدد فقط: 10', { exact: false })).toBeVisible();
});

test('feedback opens a GitHub issue filled in by the owner, with the report (M28.2)', async ({
  page,
  context,
}) => {
  await context.route('https://github.com/**', (route) => route.fulfill({ body: 'issue form' }));
  await signUp(page, newLearner('feedback'), AR);
  await page.goto('/help');
  await page.getByLabel('النوع').selectOption({ label: 'قراءة سيئة لملف' });
  await page.getByLabel('ماذا كنت تحاول أن تفعل؟').fill('استيراد ملف القلب');
  await page.getByLabel('ماذا حدث بدلاً من ذلك؟').fill('قرأ 3 من 40');
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'افتح البلاغ على GitHub' }).click();
  const issue = new URL((await popup).url());
  expect(issue.pathname).toBe('/eom1417/qbank/issues/new');
  expect(issue.searchParams.get('title')).toBe('[reading] استيراد ملف القلب');
  expect(issue.searchParams.get('body')).toContain('قرأ 3 من 40');
  expect(issue.searchParams.get('body')).toContain('System report');
});
