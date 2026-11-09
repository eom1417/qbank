import { expect, test, type Page } from '@playwright/test';
import { studyableBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();
const RIGHTS = 'أؤكد أن لي حق مشاركة هذه الأسئلة مع من سيستلمها، شخصاً كان أو برنامجاً.';

/** The bank's sharing: a new 🔌 share, refused until the rights are confirmed; its key once. */
async function publishApiShare(page: Page, bank: string) {
  await page.goto(`${bank}/channels`);
  await expect(page.getByRole('heading', { name: 'المشاركات' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'مشاركة جديدة' }).click();
  await page.getByRole('button', { name: /ربط API أو MCP/ }).click();
  await page.getByLabel('الاسم', { exact: true }).fill('بوت المذاكرة');
  // Publishing without the rights confirmation is refused on the spot.
  await page.getByRole('button', { name: 'انشر' }).click();
  await expect(page.getByText('أكّد أولاً حقك في مشاركة هذه الأسئلة.')).toBeVisible();
  await page.getByLabel(RIGHTS).check();
  await page.getByRole('button', { name: 'انشر' }).click();
  await expect(page.getByText('المفتاح: انسخه الآن')).toBeVisible();
  const key = (await page.getByText(/^qbc_/).first().textContent()) ?? '';
  expect(key).toMatch(/^qbc_[A-Za-z0-9_-]{43}$/);
  return key;
}

/** The hub: every share of every bank, with its bank, a quick pause and the way to manage it. */
async function checkHub(page: Page, bank: string) {
  await page.goto('/sharing');
  await expect(page.getByRole('heading', { name: 'كل المشاركات' })).toBeVisible();
  await expect(page.getByText('بوت المذاكرة')).toBeVisible();
  await expect(page.getByText('Medicine')).toBeVisible();
  await page.getByRole('button', { name: 'أوقفها مؤقتاً' }).click();
  await expect(page.getByText('موقوفة')).toBeVisible();
  await page.getByRole('link', { name: 'إدارة' }).click();
  await expect(page).toHaveURL(`${bank}/channels`);
}

test('an API share: its key shown once, used by an agent, paused and resumed, listed in the hub (M30)', async ({
  page,
  request,
}) => {
  await studyableBank(page, 'channels', fixtures().english);
  const bank = new URL(page.url()).pathname;
  const key = await publishApiShare(page, bank);
  // The agent: no browser, no cookie, only the key.
  const batch = await request.post('/api/channel/v1/batches', {
    headers: { authorization: `Bearer ${key}` },
    data: { key: 'today' },
  });
  expect(batch.ok()).toBe(true);
  expect((await batch.json()).questions).toHaveLength(2);
  // Shown once: after a reload only its first characters remain.
  await page.reload();
  await expect(page.getByText('المفتاح: انسخه الآن')).toHaveCount(0);
  await expect(page.getByText(key)).toHaveCount(0);
  await expect(page.getByText(key.slice(0, 10), { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'افتح', exact: true }).click();
  await page.getByRole('button', { name: 'الأرقام' }).click();
  await expect(page.getByText('أُرسل في هذه الدورة: 2/2', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'أوقفها مؤقتاً' }).click();
  await expect(page.getByText('موقوفة')).toBeVisible();
  const paused = await request.post('/api/channel/v1/batches', {
    headers: { authorization: `Bearer ${key}` },
    data: { key: 'paused' },
  });
  expect(paused.ok()).toBe(false);
  await page.getByRole('button', { name: 'شغّلها' }).click();
  await expect(page.getByText('تعمل', { exact: true })).toBeVisible();
  await checkHub(page, bank);
});
