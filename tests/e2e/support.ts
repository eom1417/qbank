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

/** A new learner's bank with the English fixture imported (8 questions, 7 to review). */
export async function importedEnglishBank(page: Page, tag: string, file: string) {
  await signUp(page, newLearner(tag), AR);
  await page.getByLabel('اسم البنك').fill('Medicine');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('link', { name: 'استورد ملفات' }).click();
  await page.getByLabel('ملفات PDF').setInputFiles(file);
  await page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.').check();
  await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'english.pdf' });
  await expect(row.getByText('يحتاج مراجعتك')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
}

/** In the open question: makes its first option the answer, saves, and approves if still needed. */
export async function answerAndApprove(page: Page) {
  const answers = page.getByLabel('الإجابة الصحيحة');
  for (let i = 0; i < (await answers.count()); i++) await answers.nth(i).uncheck();
  await answers.first().check();
  await page.getByRole('button', { name: 'احفظ' }).click();
  await expect(page.getByText('مصدر الإجابة: أنت')).toBeVisible();
  // Choosing the answer settles a missing key; anything else still needs the approval.
  const approve = page.getByRole('button', { name: 'اعتمد', exact: true });
  if (await approve.isVisible()) await approve.click();
  await expect(page.getByText('الحالة: جاهز للدراسة')).toBeVisible();
}
