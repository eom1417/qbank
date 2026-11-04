import { expect, test, type Page } from '@playwright/test';
import { buildPdfFixtures, type PdfFixtures } from '../support/pdf-fixtures.js';

/** A unique learner per test run, so tests never depend on database cleanup. */
export function newLearner(tag: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `Learner ${tag}`,
    email: `${tag}-${id}@example.test`,
    password: 'e2e password long',
  };
}

type Learner = ReturnType<typeof newLearner>;

/** Signs up through the real UI in the current UI language; labels come from the screen. */
export async function signUp(page: Page, learner: Learner, labels: Record<string, string>) {
  await page.goto('/sign-up');
  await page.getByLabel(labels['name'] ?? '').fill(learner.name);
  await page.getByLabel(labels['email'] ?? '').fill(learner.email);
  await page.getByLabel(labels['password'] ?? '').fill(learner.password);
  await page.getByLabel(labels['terms'] ?? '').check();
  await page.getByRole('button', { name: labels['submit'] ?? '' }).click();
  await expect(page).toHaveURL('/');
}

export const AR = {
  name: 'اسمك',
  email: 'البريد الإلكتروني',
  password: 'كلمة المرور',
  terms: 'أوافق على الشروط، ولن أرفع إلا مواد يحق لي استخدامها.',
  submit: 'إنشاء الحساب',
};

/** The test PDFs, built once for the spec file; call the getter inside tests. */
export function usePdfFixtures() {
  let fx: PdfFixtures | undefined;
  test.beforeAll(async () => {
    fx = await buildPdfFixtures();
  });
  test.afterAll(() => fx?.cleanup());
  return () => {
    if (!fx) throw new Error('PDF fixtures not built');
    return fx;
  };
}
