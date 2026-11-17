import { expect, test } from '@playwright/test';
import { msToNext, throttle } from './next-latency.js';
import { studyableBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

test('Tutor: choose, send, see the solution, flag, finish, and read an honest summary (UI-13…15, JY-07)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await studyableBank(page, 'study', fixtures().english);
  await page.getByRole('link', { name: 'ذاكر' }).click();
  await expect(page.getByRole('heading', { name: 'ابدأ جلسة Tutor' })).toBeVisible();
  await expect(page.getByText('الجاهز هو هذا العدد فقط: 2')).toBeVisible();
  await page.getByRole('button', { name: 'استخدمها كلها' }).click();
  await throttle(page);
  await page.getByRole('button', { name: 'ابدأ' }).click();
  await expect(page.getByText('السؤال 1 من 2')).toBeVisible();
  await expect(page.getByText('الإجابة الصحيحة:')).toHaveCount(0);
  await page.locator('.qb-choice').first().click();
  await page.getByRole('button', { name: 'أرسل إجابتي' }).click();
  await expect(page.getByText('الإجابة الصحيحة:')).toBeVisible();
  await page.getByRole('button', { name: 'علِّمه' }).click();
  await expect(page.getByRole('button', { name: 'أزل العلامة' })).toBeVisible();
  // The next question was read ahead: on a slow connection it shows at once (M34 U3).
  const ms = await msToNext(page, 'السؤال 2 من 2');
  console.log(`tutor: Next shown in ${Math.round(ms)} ms (throttled)`);
  expect(ms).toBeLessThanOrEqual(200);
  await page.getByRole('button', { name: 'أنهِ الجلسة' }).click();
  await expect(page.getByRole('heading', { name: 'ملخص الجلسة' })).toBeVisible();
  await expect(page.getByText('1 من 2').first()).toBeVisible();
});
