import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LOCAL_DATA_DIR, LOCAL_WEB_URL } from '../../playwright.config.js';

// The real providers kit behind the screen, with an empty home: every provider is signed out.
// Providers belong to the person who runs the install, so the screen is tested in local mode.
const code = () => readFileSync(join(LOCAL_DATA_DIR, 'pairing-token'), 'utf8').trim();

async function openProviders(page: Page) {
  await page.goto(`${LOCAL_WEB_URL}/#pair=${code()}`);
  await page.getByRole('link', { name: 'الإعدادات' }).click();
  await page.getByRole('link', { name: 'مزودو الذكاء الاصطناعي' }).click();
  await expect(page).toHaveURL(`${LOCAL_WEB_URL}/settings/providers`);
}

test('the providers screen lists the kit providers and says what AI sends (UI-24, FR-20-003)', async ({
  page,
}) => {
  await openProviders(page);
  await expect(page.getByRole('heading', { name: 'مزودو الذكاء الاصطناعي' })).toBeVisible();
  await expect(page.getByText('تسري شروط ذلك المزوّد وسياسة خصوصيته')).toBeVisible();
  for (const provider of ['Codex', 'Claude']) {
    await expect(page.getByRole('heading', { name: provider, exact: true }).first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'افحص الكل من جديد' })).toBeEnabled();
});

test('Codex can sign in with ChatGPT from the screen, with no terminal (managed mode)', async ({
  page,
}) => {
  await openProviders(page);
  const setup = page.getByLabel('طريقة دخول Codex');
  await setup.selectOption('managed');
  await expect(setup).toHaveValue('managed');
  await expect(page.getByRole('button', { name: 'سجّل الدخول' }).first()).toBeVisible({
    timeout: 20_000,
  });
  // Back to the Codex on this computer, for the next run.
  await setup.selectOption('existing');
  await expect(setup).toHaveValue('existing');
});
