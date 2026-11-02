import { expect, test } from '@playwright/test';
import { AR, newLearner, signUp } from './support.js';

test('Arabic learner signs up, sees next steps, creates and opens a private bank', async ({
  page,
}) => {
  await signUp(page, newLearner('ar'), AR);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مكتبتك فارغة' })).toBeVisible();
  await expect(page.getByText('أنشئ بنكاً لمقرر أو امتحان أو مادة.')).toBeVisible();

  await page.getByLabel('اسم البنك').fill('بنك القلب');
  await page.getByLabel('المادة أو الامتحان (اختياري)').fill('Cardiology');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await expect(page.getByRole('heading', { name: 'بنك القلب' })).toBeVisible();

  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'بنك القلب' })).toBeVisible();
  await expect(page.getByText('لا توجد أسئلة في هذا البنك بعد')).toBeVisible();
});

test("another learner gets the neutral message for someone else's bank", async ({ browser }) => {
  const owner = await browser.newPage();
  await signUp(owner, newLearner('owner'), AR);
  await owner.getByLabel('اسم البنك').fill('خاص جداً');
  await owner.getByRole('button', { name: 'إنشاء البنك' }).click();
  await owner.getByRole('link', { name: 'فتح البنك' }).click();
  const bankUrl = owner.url();

  const stranger = await (await browser.newContext({ locale: 'ar-SA' })).newPage();
  await signUp(stranger, newLearner('stranger'), AR);
  await stranger.goto(bankUrl);
  await expect(stranger.getByRole('alert')).toHaveText(
    'هذه الصفحة غير موجودة أو غير متاحة لحسابك.',
  );
  await expect(stranger.getByText('خاص جداً')).toHaveCount(0);
});

test('a signed-out visitor is sent to sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/sign-in');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
});
