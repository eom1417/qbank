import { expect, test, type Browser, type Page } from '@playwright/test';
import { e2eDatabaseUrl } from '../../playwright.config.js';
import { createDb } from '../../src/server/platform/db/index.js';
import { AR, newLearner, signUp } from './support.js';

/** The server's declared operator in playwright.config.ts (QBANK_OPERATOR_EMAIL / _NAME). */
const OPERATOR = {
  name: 'أبو سالم',
  email: 'operator@example.test',
  password: 'e2e operator password',
};

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page).toHaveURL('/');
}

/** What scripts/confirm-operator.mjs does from the server's shell (DEC-40). */
async function confirmOperator() {
  const db = createDb(e2eDatabaseUrl());
  try {
    await db
      .updateTable('account')
      .set({ operator_confirmed_at: new Date() })
      .where('email', '=', OPERATOR.email)
      .execute();
  } finally {
    await db.destroy();
  }
}

/**
 * The operator's account outlives a run (one E2E database): created once, then signed in. Signing
 * up alone grants nothing: the shell confirms it, then the menu shows "Administration".
 */
async function operatorPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ locale: 'ar-SA' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();
  await page.goto('/sign-up');
  await page.getByLabel(AR.name).fill(OPERATOR.name);
  await page.getByLabel(AR.email).fill(OPERATOR.email);
  await page.getByLabel(AR.password).fill(OPERATOR.password);
  await page.getByLabel(AR.terms).check();
  await page.getByRole('button', { name: AR.submit }).click();
  const taken = page.getByText('هذه القيمة مستخدمة بالفعل.');
  await expect(page.getByRole('heading', { name: 'مكتبتك فارغة' }).or(taken)).toBeVisible();
  if (await taken.isVisible()) await signIn(page, OPERATOR.email, OPERATOR.password);
  await confirmOperator();
  await page.reload();
  await page.getByRole('link', { name: 'الإدارة' }).click();
  await expect(page.getByRole('heading', { name: 'إدارة الخادم' })).toBeVisible();
  return page;
}

test('a note sent from Help reaches the operator, who marks it handled (M31, B1)', async ({
  page,
  browser,
}) => {
  await signUp(page, newLearner('feedback-op'), AR);
  const note = `لا يفتح البنك ${Date.now()}`;
  await page.goto('/help');
  await expect(page.getByText(`تصل مباشرة إلى ${OPERATOR.name}`)).toBeVisible();
  await page.getByLabel('ماذا كنت تحاول أن تفعل؟').fill(note);
  await page.getByRole('button', { name: 'أرسل', exact: true }).click();
  await expect(page.getByText(`وصلت ملاحظتك إلى ${OPERATOR.name}`)).toBeVisible();

  const operator = await operatorPage(browser);
  const item = operator.getByRole('listitem').filter({ hasText: note });
  await expect(item.getByText('الشاشة: /help')).toBeVisible();
  await item.getByRole('button', { name: 'تمت المعالجة' }).click();
  await expect(item).toHaveCount(0);
});

test('a forgotten password: the operator passes the link on, the user signs in (M31, B4)', async ({
  page,
  browser,
}) => {
  const learner = newLearner('reset-op');
  await signUp(page, learner, AR);
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await page.goto('/forgot-password');
  await expect(page.getByText(`سيصل طلبك إلى ${OPERATOR.name}`)).toBeVisible();
  await page.getByLabel('البريد الإلكتروني').fill(learner.email);
  await page.getByRole('button', { name: 'إرسال رابط إعادة التعيين' }).click();
  await expect(page.getByText(`وصل طلبك إلى ${OPERATOR.name}`)).toBeVisible();
  await expect(page.getByText('صندوق الوارد')).toHaveCount(0);

  const operator = await operatorPage(browser);
  const request = operator.getByRole('listitem').filter({ hasText: learner.email });
  await request.getByRole('button', { name: 'انسخ الرابط' }).click();
  await expect(request.getByRole('button', { name: 'نُسخ الرابط' })).toBeVisible();
  const link = (await request.locator('code').textContent()) ?? '';
  expect(await operator.evaluate(() => navigator.clipboard.readText())).toBe(link);
  const whatsapp = request.getByRole('link', { name: 'أرسل بالواتساب' });
  expect(decodeURIComponent((await whatsapp.getAttribute('href')) ?? '')).toContain(link);

  await page.goto(link);
  await page.getByLabel('كلمة المرور الجديدة').fill('the new password 1');
  await page.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }).click();
  await expect(page.getByText('تغيّرت كلمة المرور')).toBeVisible();
  await signIn(page, learner.email, 'the new password 1');
});

test('anyone else has no administration link, and the server refuses the screen', async ({
  page,
}) => {
  await signUp(page, newLearner('not-op'), AR);
  await expect(page.getByRole('link', { name: 'المساعدة' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'الإدارة' })).toHaveCount(0);
  await page.goto('/operator');
  await expect(page.getByText('هذه الصفحة لمدير الخادم فقط.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الملاحظات' })).toHaveCount(0);
});
