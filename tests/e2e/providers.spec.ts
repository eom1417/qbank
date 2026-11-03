import { expect, test } from '@playwright/test';
import { AR, newLearner, signUp } from './support.js';

// The real providers kit behind the screen, with an empty home: every provider is signed out.
test('the providers screen lists the kit providers and says what AI sends (UI-24, FR-20-003)', async ({
  page,
}) => {
  await signUp(page, newLearner('providers'), AR);
  await page.getByRole('link', { name: 'الإعدادات' }).click();
  await page.getByRole('link', { name: 'مزودو الذكاء الاصطناعي' }).click();
  await expect(page).toHaveURL('/settings/providers');
  await expect(page.getByRole('heading', { name: 'مزودو الذكاء الاصطناعي' })).toBeVisible();
  await expect(page.getByText('تسري شروط ذلك المزوّد وسياسة خصوصيته')).toBeVisible();
  for (const provider of ['Codex', 'Claude']) {
    await expect(page.getByRole('heading', { name: provider, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'افحص الكل من جديد' })).toBeEnabled();
});
