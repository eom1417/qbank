import { expect, test } from '@playwright/test';
import { studyableBank, usePdfFixtures } from './support.js';

const fixtures = usePdfFixtures();

test('a publishing channel: created with its key shown once, used by an agent, its own numbers (DEC-36)', async ({
  page,
  request,
}) => {
  await studyableBank(page, 'channels', fixtures().english);
  await page.getByRole('link', { name: 'قنوات النشر' }).click();
  await expect(page.getByRole('heading', { name: 'قنوات النشر' }).first()).toBeVisible();
  await page.getByLabel('اسم القناة').fill('واتساب يومي');
  await page.getByRole('button', { name: 'أنشئ القناة' }).click();
  await expect(page.getByText('مفتاح القناة: انسخه الآن')).toBeVisible();
  const key = (await page.getByText(/^qbc_/).first().textContent()) ?? '';
  expect(key).toMatch(/^qbc_[A-Za-z0-9_-]{43}$/);
  // The agent: no browser, no cookie, only the key.
  const batch = await request.post('/api/channel/v1/batches', {
    headers: { authorization: `Bearer ${key}` },
    data: { key: 'today' },
  });
  expect((await batch.json()).questions).toHaveLength(2);
  await page.reload();
  await expect(page.getByText('مفتاح القناة: انسخه الآن')).toHaveCount(0);
  await expect(page.getByText(key)).toHaveCount(0);
  await expect(page.getByText(key.slice(0, 10), { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'اعرض الأرقام' }).click();
  await expect(page.getByText('أُرسل في هذه الدورة: 2/2', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'أوقفها مؤقتاً' }).click();
  await expect(page.getByText('موقوفة')).toBeVisible();
});
