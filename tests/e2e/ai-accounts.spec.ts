import { expect, test, type Page } from '@playwright/test';
import { AR, newLearner, signUp } from './support.js';

// Sign-in with subscription accounts; the API runs fake CLIs (tests/fixtures/fake-cli).
async function openAccounts(page: Page, tag: string) {
  await signUp(page, newLearner(tag), AR);
  await page.getByRole('link', { name: 'الإعدادات' }).click();
  await expect(page.getByRole('heading', { name: 'سجّل الدخول باشتراكك' })).toBeVisible();
  await expect(page.getByText('شروط Anthropic تسمح باشتراكات Claude')).toBeVisible();
}

const connections = (page: Page) => page.getByRole('list', { name: 'اتصالات AI الخاصة بك' });

test('sign in with Claude: open the page, paste the code, the account is added', async ({
  page,
}) => {
  await openAccounts(page, 'claude-account');
  const claude = page.getByRole('button', { name: 'سجّل الدخول بـ Claude' });
  await expect(claude).toBeDisabled();
  await page.getByLabel('أفهم ذلك، وأن محتوى ملفاتي سيُرسل').check();
  await claude.click();
  const link = page.getByRole('link', { name: '1. افتح صفحة دخول Claude ووافق' });
  await expect(link).toHaveAttribute('href', /^https:\/\/claude\.com\/cai\/oauth\/authorize\?/);
  await page.getByLabel('2. الصق الرمز الذي يظهره Claude بعد الموافقة').fill('good-code');
  await page.getByRole('button', { name: 'أكمل الدخول' }).click();
  await expect(page.getByText('تم الدخول، وأُضيف حسابك في الأسفل.')).toBeVisible();
  const list = connections(page);
  await expect(list.getByText(/اشتراك Claude · learner@example\.test/)).toBeVisible();
  await list.getByRole('button', { name: 'جرّب مهمة تجريبية' }).click();
  await expect(list.getByText('قرأ النموذج سؤال التجربة:')).toBeVisible();
  await expect(list.getByRole('button', { name: 'غيّر المفتاح' })).toHaveCount(0);
});

test('sign in with ChatGPT (Codex): the one-time code is shown and the account is added', async ({
  page,
}) => {
  await openAccounts(page, 'codex-account');
  await page.getByLabel('أفهم ذلك، وأن محتوى ملفاتي سيُرسل').check();
  await page.getByRole('button', { name: 'سجّل الدخول بـ ChatGPT (Codex)' }).click();
  await expect(
    page.getByRole('link', { name: '1. افتح صفحة الأجهزة في ChatGPT وسجّل الدخول' }),
  ).toHaveAttribute('href', 'https://auth.openai.com/codex/device');
  await expect(page.getByText('ABCD-EFGH1')).toBeVisible();
  await expect(page.getByText('تم الدخول، وأُضيف حسابك في الأسفل.')).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    connections(page).getByText(/اشتراك ChatGPT \(Codex\) · learner@example\.test/),
  ).toBeVisible();
});
