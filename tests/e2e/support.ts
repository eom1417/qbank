import { basename } from 'node:path';
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
  await importIntoNewBank(page, file);
}

/** From the library: a new bank "Medicine" with `file` imported, back on the bank page. */
export async function importIntoNewBank(page: Page, file: string) {
  await page.getByLabel('اسم البنك').fill('Medicine');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('link', { name: 'استورد ملفات' }).click();
  await page.getByLabel('ملفات PDF').setInputFiles(file);
  await page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.').check();
  await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
  const row = page.getByRole('listitem').filter({ hasText: basename(file) });
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
  await expect(page.getByText('الحالة: جاهز للمذاكرة')).toBeVisible();
}

/** A bank with the English fixture imported and its first two questions answered. */
export async function studyableBank(page: Page, tag: string, file: string) {
  await importedEnglishBank(page, tag, file);
  await approveFirstTwo(page);
}

/** From the bank page: its first two questions in review get an answer and are approved. */
export async function approveFirstTwo(page: Page) {
  await page.getByRole('link', { name: 'راجع الأسئلة' }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('link', { name: 'افتح' }).first().click();
    await answerAndApprove(page);
    await page.getByRole('link', { name: 'المراجعة' }).click();
  }
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
}

/** Settings of a local install: restores the newest backup, and waits for the app to reload. */
export async function restoreNewestBackup(page: Page, webUrl: string) {
  await page.goto(`${webUrl}/settings`);
  await page.getByRole('button', { name: 'استرجاع…' }).first().click();
  await page.getByRole('button', { name: 'استرجع هذه النسخة' }).click();
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'استبدل كل شيء بهذه النسخة' }).click();
  await reloaded;
}

/** The providers state as the kit reports it, with one signed-in provider (`extra` adds to it). */
export async function mockReadyProvider(page: Page, extra: Record<string, unknown> = {}) {
  const provider = {
    ...{ instanceId: 'claudeAgent', driver: 'claudeAgent', displayName: 'Claude' },
    ...{ enabled: true, installed: true, version: '2', status: 'ready' },
    ...{ auth: { status: 'authenticated' }, models: [] },
    ...extra,
  };
  // The screens that list models ask with `?peek=1` (DEC-35): the same state, any query.
  await page.route(
    (url) => url.pathname === '/api/providers/state',
    (route) => route.fulfill({ json: { providers: [provider], settings: {} } }),
  );
}
