import { expect, test } from '@playwright/test';
import { AR, mockReadyProvider, newLearner, signUp } from './support.js';

const ID = '00000000-0000-4000-8000-000000000001';

/** A finished import whose AI stopped at the subscription limit (M27). */
const stopped = {
  id: ID,
  sourceId: ID,
  bankId: ID,
  fileName: 'pediatrics.pdf',
  stage: 'needs_review',
  pagesTotal: 2,
  pagesDone: 2,
  queuePosition: null,
  questionsFound: 8,
  questionsReview: 8,
  aiOutcome: 'no_quota',
  errorCode: null,
  ai: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  finishedAt: '2026-11-06T10:01:00.000Z',
  pages: [],
};

test('an AI stop says what to do, with the way to the providers screen (M27)', async ({ page }) => {
  await signUp(page, newLearner('guidance'), AR);
  await page.route(`**/api/imports/${ID}`, (route) => route.fulfill({ json: stopped }));
  await page.route(`**/api/imports/${ID}/media`, (route) => route.fulfill({ json: { media: [] } }));
  await page.goto(`/imports/${ID}`);
  await expect(page.getByText('حد الاشتراك يتجدد تلقائياً', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'افتح مزوّدي الذكاء الاصطناعي' }).click();
  await expect(page).toHaveURL(/\/settings\/providers$/);
});

test('choosing an AI says roughly what it uses of the subscription (M27)', async ({ page }) => {
  await mockReadyProvider(page, { models: [{ slug: 'm1', name: 'Model One' }] });
  await signUp(page, newLearner('usage'), AR);
  await page.getByLabel('اسم البنك').fill('Medicine');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('link', { name: 'استورد ملفات' }).click();
  await page
    .getByLabel('استخدم الذكاء الاصطناعي الخاص بي', { exact: false })
    .selectOption({ label: 'Claude' });
  await expect(page.getByText('3 إلى 4 طلبات لكل 8 أسئلة', { exact: false })).toBeVisible();
  await expect(page.getByText('طلب لكل صفحة من اشتراكك', { exact: false })).toBeVisible();
});
