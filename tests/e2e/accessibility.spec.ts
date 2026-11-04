import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { studyableBank, usePdfFixtures } from './support.js';

// WCAG 2.2 A/AA by axe-core on every main screen (FR-21-009); keyboard and reading checks follow.
const fixtures = usePdfFixtures();
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectAccessible(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const found = violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(' ')}`));
  expect([url, found]).toEqual([url, []]);
}

/** A Tutor session of two questions, the first one answered, sent from the page like the app. */
async function answeredTutor(page: Page, bankId: string) {
  return page.evaluate(async (id) => {
    const post = (url: string, body: object) =>
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    const scope = { bankIds: [id] };
    const started = await post('/api/study/sessions', {
      scope,
      kind: 'random',
      size: 2,
      mode: 'tutor',
    });
    const { id: sessionId } = (await started.json()) as { id: string };
    await post(`/api/study/sessions/${sessionId}/items/0/answer`, { chosen: ['A'], seconds: 5 });
    return sessionId;
  }, bankId);
}

/** Language and theme as the owner sets them, in Settings. */
async function choose(page: Page, locale: string, theme: string) {
  await page.goto('/settings');
  await page.getByLabel('المظهر', { exact: true }).selectOption(theme);
  await page.getByLabel('لغة الواجهة').selectOption(locale);
  await page.getByRole('button', { name: 'حفظ' }).nth(1).click();
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}

async function auditEverything(page: Page, locale: string, theme: string) {
  await studyableBank(page, 'a11y', fixtures().english);
  const bank = new URL(page.url()).pathname;
  await choose(page, locale, theme);
  const bankId = bank.split('/').pop() ?? '';
  await page.goto(`${bank}/review`);
  const question =
    (await page.locator('a[href^="/questions/"]').first().getAttribute('href')) ?? '';
  const session = `/study/sessions/${await answeredTutor(page, bankId)}`;
  const screens = ['/', bank, `${bank}/review`, `${bank}/import`, `${bank}/export`];
  screens.push(`${bank}/duplicates`, question, '/study', '/study/plan', session);
  screens.push(`${session}/summary`, '/analytics', '/search', '/settings', '/help', '/privacy');
  for (const url of screens) await expectAccessible(page, url);
  // The answered question says right and wrong in symbols and words, not colour alone.
  await page.goto(session);
  await expect(page.getByText('✓')).toBeVisible();
}

test('every main screen passes WCAG 2.2 AA checks in Arabic, light theme', async ({ page }) => {
  await auditEverything(page, 'ar', 'light');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('and in English, dark theme', async ({ page }) => {
  await auditEverything(page, 'en', 'dark');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});
