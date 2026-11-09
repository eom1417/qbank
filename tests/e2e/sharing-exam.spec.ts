import { expect, test, type Browser, type Page } from '@playwright/test';
import { approveFirstTwo, studyableBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();
const RIGHTS = 'أؤكد أن لي حق مشاركة هذه الأسئلة مع من سيستلمها، شخصاً كان أو برنامجاً.';
const SIZE = 5;

/** From the bank page: a 🎓 exam share of SIZE questions; returns the full link shown once. */
async function publishExam(page: Page) {
  const bank = new URL(page.url()).pathname;
  await page.goto(`${bank}/channels`);
  await page.getByRole('button', { name: 'مشاركة جديدة' }).click();
  await page.getByRole('button', { name: /اختبار رسمي/ }).click();
  await page.getByLabel('الاسم', { exact: true }).fill('اختبار الوحدة');
  await page.getByLabel('عدد الأسئلة في المحاولة').selectOption(String(SIZE));
  await page.getByLabel(RIGHTS).check();
  await page.getByRole('button', { name: 'انشر' }).click();
  await expect(page.getByText('الرابط: انسخه الآن')).toBeVisible();
  const link =
    (await page
      .getByText(/\/t\/qbt_/)
      .first()
      .textContent()) ?? '';
  expect(link).toMatch(/\/t\/qbt_[A-Za-z0-9_-]{43}$/);
  return link;
}

/** Every question answered with its first choice, nothing revealed on the way. */
async function answerAll(taker: Page) {
  for (let i = 1; i <= SIZE; i++) {
    await expect(taker.getByText(`السؤال ${i} من ${SIZE}`)).toBeVisible();
    await taker.locator('.qb-choice').first().click();
    await expect(taker.getByText('حُفظ')).toBeVisible();
    await expect(taker.locator('.qb-choice--right, .qb-choice--wrong')).toHaveCount(0);
    if (i < SIZE) await taker.getByRole('button', { name: 'التالي' }).click();
  }
}

/** The receiver: a fresh browser with none of the owner's cookies takes the exam as «سارة». */
async function takeAsStranger(browser: Browser, link: string) {
  const stranger = await browser.newContext({ locale: 'ar-SA' });
  const taker = await stranger.newPage();
  await taker.goto(link);
  await expect(taker.getByRole('heading', { level: 1, name: 'اختبار الوحدة' })).toBeVisible();
  const rules = taker.getByRole('list', { name: 'قواعد هذه المشاركة' });
  await expect(rules.getByText('محاولة واحدة', { exact: false })).toBeVisible();
  await expect(rules.getByText('الدرجة فقط', { exact: false })).toBeVisible();
  await taker.getByLabel('اسمك').fill('سارة');
  await taker.getByRole('button', { name: 'ابدأ' }).click();
  await expect(taker.getByRole('timer')).toBeVisible();
  await answerAll(taker);
  await taker.getByRole('button', { name: 'راجع ثم سلّم' }).click();
  await expect(taker.getByRole('heading', { name: 'قبل التسليم' })).toBeVisible();
  await taker.getByRole('button', { name: 'سلّم إجاباتي' }).click();
  await taker.getByRole('button', { name: 'نعم، سلّم الآن' }).click();
  await expect(taker.getByRole('heading', { name: 'نتيجتك' })).toBeVisible();
  await expect(taker.getByText(/الدرجة: \d+%/)).toBeVisible();
  // Score only: neither the answers nor the right ones.
  await expect(taker.getByText('إجاباتك', { exact: true })).toHaveCount(0);
  await expect(taker.getByText('الإجابة الصحيحة', { exact: false })).toHaveCount(0);
  await stranger.close();
}

test('an exam link: a stranger with no account takes it under its rules, the owner sees the attempt (M30)', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  // Six ready questions: an attempt of five needs at least five.
  await studyableBank(page, 'sharing-exam', fixtures().english);
  await approveFirstTwo(page);
  await approveFirstTwo(page);
  await takeAsStranger(browser, await publishExam(page));
  await page.reload();
  await page.getByRole('button', { name: 'افتح', exact: true }).click();
  await page.getByRole('button', { name: 'النتائج' }).click();
  await expect(page.getByText('سلّم: 1', { exact: false })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'سارة' })).toBeVisible();
  await expect(page.getByRole('cell', { name: `/${SIZE}` })).toBeVisible();
});
