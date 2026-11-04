import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LOCAL_DATA_DIR, LOCAL_WEB_URL } from '../../playwright.config.js';

// Local mode (DEC-31): no account to create; a browser pairs with the install's code.
const code = () => readFileSync(join(LOCAL_DATA_DIR, 'pairing-token'), 'utf8').trim();

test('a pairing link opens the local QBank, with no sign-up anywhere', async ({ page }) => {
  await page.goto(`${LOCAL_WEB_URL}/#pair=${code()}`);
  await expect(page.getByRole('heading', { name: 'مكتبتك فارغة' })).toBeVisible();
  await expect(page).toHaveURL(`${LOCAL_WEB_URL}/`);
  await expect(page.getByRole('link', { name: 'تسجيل الدخول' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'تسجيل الخروج' })).toHaveCount(0);
  await page.getByRole('link', { name: 'الإعدادات' }).click();
  await expect(page.getByText(`#pair=${code()}`)).toBeVisible();
  // From this computer the phone needs the network address: QBank says how to share it.
  await expect(page.getByText('npm run qbank -- --lan')).toBeVisible();
  for (const file of ['/manifest.json', '/sw.js', '/icon-192.png'])
    expect((await page.request.get(`${LOCAL_WEB_URL}${file}`)).status()).toBe(200);
  await page.goto(`${LOCAL_WEB_URL}/sign-up`);
  await expect(page).toHaveURL(`${LOCAL_WEB_URL}/`);
});

test('another browser is asked for the code, and a wrong one is refused', async ({ page }) => {
  await page.goto(LOCAL_WEB_URL);
  await expect(page.getByRole('heading', { name: 'افتح QBank الخاص بك هنا' })).toBeVisible();
  await page.getByLabel('رمز الربط').fill('not-the-code');
  await page.getByRole('button', { name: 'اربط هذا المتصفح' }).click();
  await expect(page.getByText('رمز الربط غير صحيح')).toBeVisible();
  await page.getByLabel('رمز الربط').fill(code());
  await page.getByRole('button', { name: 'اربط هذا المتصفح' }).click();
  await expect(page.getByRole('heading', { name: 'مكتبتك فارغة' })).toBeVisible();
});

test('backs up now, and previews a restore before anything changes (M17.2)', async ({ page }) => {
  await page.goto(`${LOCAL_WEB_URL}/#pair=${code()}`);
  await page.getByRole('link', { name: 'الإعدادات' }).click();
  await page.getByRole('button', { name: 'انسخ الآن' }).click();
  await expect(page.getByText('صنعتها أنت').first()).toBeVisible();
  await page.getByRole('button', { name: 'استرجاع…' }).first().click();
  await expect(page.getByText('في هذه النسخة')).toBeVisible();
  await expect(page.getByText('الموجود الآن')).toBeVisible();
  // A bank made after the backup is gone once the backup is restored (PGlite, as installed).
  await page.goto(`${LOCAL_WEB_URL}/`);
  await page.getByLabel('اسم البنك').fill('Made after the backup');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await expect(page.getByText('Made after the backup')).toBeVisible();
  await page.goto(`${LOCAL_WEB_URL}/settings`);
  // Newest first: the backup this test made before the bank.
  await page.getByRole('button', { name: 'استرجاع…' }).first().click();
  await page.getByRole('button', { name: 'استرجع هذه النسخة' }).click();
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'استبدل كل شيء بهذه النسخة' }).click();
  await reloaded;
  await page.getByRole('link', { name: 'المكتبة' }).click();
  await expect(page.getByRole('heading', { name: 'مكتبتك فارغة' })).toBeVisible();
});
