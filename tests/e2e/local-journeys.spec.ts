import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LOCAL_DATA_DIR, LOCAL_WEB_URL } from '../../playwright.config.js';
import {
  approveFirstTwo,
  importIntoNewBank,
  restoreNewestBackup,
  usePdfFixtures,
} from './support.js';

// The product as installed (local mode, PGlite), end to end (FR-25-002…005, M18.1): import,
// review, study, the plan, export, then erase everything and bring it back from a backup.
const fixtures = usePdfFixtures();
const code = () => readFileSync(join(LOCAL_DATA_DIR, 'pairing-token'), 'utf8').trim();
/** A fresh load: from `/` a link that only adds `#pair=` would not reload the page. */
async function pair(page: Page) {
  await page.goto('about:blank');
  await page.goto(`${LOCAL_WEB_URL}/#pair=${code()}`);
}

async function tutorSession(page: Page) {
  await page.getByRole('link', { name: 'ذاكر' }).click();
  await page.getByRole('button', { name: 'استخدمها كلها' }).click();
  await page.getByRole('button', { name: 'ابدأ' }).click();
  await page.locator('.qb-choice').first().click();
  await page.getByRole('button', { name: 'أرسل إجابتي' }).click();
  await expect(page.getByText('الإجابة الصحيحة:')).toBeVisible();
  await page.getByRole('button', { name: 'أنهِ الجلسة' }).click();
  await expect(page.getByRole('heading', { name: 'ملخص الجلسة' })).toBeVisible();
}

async function exportBank(page: Page) {
  await page.getByRole('link', { name: 'المكتبة' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).first().click();
  await page.getByRole('link', { name: 'صدِّر' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'نزّل الملف' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
}

async function eraseEverything(page: Page) {
  await page.goto(`${LOCAL_WEB_URL}/settings`);
  await page.getByRole('button', { name: 'انسخ الآن' }).click();
  await expect(page.getByText('صنعتها أنت').first()).toBeVisible();
  await page.getByRole('button', { name: 'احذف كل بياناتي' }).click();
  await page.getByRole('button', { name: 'نعم، امحُ كل شيء' }).click();
  await page.waitForURL(`${LOCAL_WEB_URL}/`);
}

async function restoreNewest(page: Page) {
  await pair(page);
  await expect(page.getByRole('heading', { name: 'مكتبتك فارغة' })).toBeVisible();
  await restoreNewestBackup(page, LOCAL_WEB_URL);
}

test('the whole journey on the installed QBank: import to restore', async ({ page }) => {
  test.setTimeout(240_000);
  await pair(page);
  await importIntoNewBank(page, fixtures().english);
  await approveFirstTwo(page);
  await tutorSession(page);
  await page.goto(`${LOCAL_WEB_URL}/study/plan`);
  await expect(page.getByRole('heading', { name: 'مراجعات اليوم' })).toBeVisible();
  await exportBank(page);
  await eraseEverything(page);
  await restoreNewest(page);
  // The restore replaced every session too: this browser pairs again and finds it all back.
  await pair(page);
  await expect(page.getByRole('heading', { name: 'Medicine' }).first()).toBeVisible();
  // Leave the install empty again: the other local specs share it.
  await eraseEverything(page);
});
