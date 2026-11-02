import { expect, test, type Page } from '@playwright/test';
import { AR, newLearner, signUp } from './support.js';

async function resetLinkFor(page: Page, email: string): Promise<string> {
  const outbox = await (await page.request.get('/api/dev/outbox')).json();
  const mail = outbox.messages.find((message: { to: string }) => message.to === email);
  return /(\/reset-password#token=[\w-]+)/.exec(mail.text)?.[1] ?? '';
}

test('forgotten password: e-mailed link sets a new password that works', async ({ page }) => {
  const learner = newLearner('reset');
  await signUp(page, learner, AR);
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();

  await page.goto('/forgot-password');
  await page.getByLabel('البريد الإلكتروني').fill(learner.email);
  await page.getByRole('button', { name: 'إرسال رابط إعادة التعيين' }).click();
  await expect(page.getByText('إن كان لهذا البريد حساب')).toBeVisible();

  await page.goto(await resetLinkFor(page, learner.email));
  await page.getByLabel('كلمة المرور الجديدة').fill('the new password 1');
  await page.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }).click();
  await expect(page.getByText('تغيّرت كلمة المرور')).toBeVisible();

  await page.goto('/sign-in');
  await page.getByLabel('البريد الإلكتروني').fill(learner.email);
  await page.getByLabel('كلمة المرور').fill('the new password 1');
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByRole('heading', { name: 'مكتبتك فارغة' })).toBeVisible();
});

test('language and theme chosen in settings follow the account to another browser', async ({
  page,
  browser,
}) => {
  const learner = newLearner('prefs');
  await signUp(page, learner, AR);
  await page.getByRole('link', { name: 'الإعدادات' }).click();
  await page.getByLabel('لغة الواجهة').selectOption('en');
  await page.getByLabel('المظهر', { exact: true }).selectOption('dark');
  await page.getByRole('button', { name: 'حفظ' }).nth(1).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const other = await (await browser.newContext({ locale: 'ar-SA' })).newPage();
  await other.goto('/sign-in');
  await other.getByLabel('البريد الإلكتروني').fill(learner.email);
  await other.getByLabel('كلمة المرور').fill(learner.password);
  await other.getByRole('button', { name: 'دخول' }).click();
  await expect(other.locator('html')).toHaveAttribute('lang', 'en');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(other.getByRole('heading', { name: 'Your library is empty' })).toBeVisible();
});
