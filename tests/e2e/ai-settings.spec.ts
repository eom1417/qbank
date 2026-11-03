import { expect, test, type Page } from '@playwright/test';
import { FAKE_KEYS, FAKE_MODELS, startFakeAiServer } from '../support/fake-ai-server.js';
import { AR, newLearner, signUp } from './support.js';

// A stand-in for the user's own provider, reached through the "custom compatible API" preset.
// The API under test allows this private address only because QBANK_AI_ALLOW_PRIVATE_URLS=true.
const FAKE_AI_PORT = 3199;
let fake: Awaited<ReturnType<typeof startFakeAiServer>>;
test.beforeAll(async () => {
  fake = await startFakeAiServer(FAKE_AI_PORT);
});
test.afterAll(() => fake.close());

async function openSettings(page: Page, tag: string) {
  await signUp(page, newLearner(tag), AR);
  await page.getByRole('link', { name: 'الإعدادات' }).click();
}

const connections = (page: Page) => page.getByRole('list', { name: 'اتصالات AI الخاصة بك' });

/** Fills the connection form for the fake provider with `key`; the model is picked from the list. */
async function connectCustom(page: Page, key: string) {
  await page.getByLabel('المزوّد', { exact: true }).selectOption('custom');
  await page.getByLabel('اسم لهذا الاتصال').fill('مزوّدي');
  await page.getByLabel(/^عنوان الـ API/).fill(fake.url);
  await page.getByLabel('مفتاح API').fill(key);
}

test('connect your own AI: load your models, add, check and run a sample task', async ({
  page,
}) => {
  await openSettings(page, 'ai-byok');
  await expect(page.getByText('لا يوجد ذكاء اصطناعي مربوط')).toBeVisible();
  await connectCustom(page, FAKE_KEYS.valid);
  await page.getByRole('button', { name: 'حمّل نماذجي' }).click();
  await expect(page.getByText('مفتاحك يعمل. اختر نموذجاً من القائمة.')).toBeVisible();
  await page.getByLabel('النموذج', { exact: true }).selectOption(FAKE_MODELS.good);
  await page.getByRole('button', { name: 'أضف الاتصال' }).click();
  await expect(page.getByText('هذا الحقل مطلوب.')).toBeVisible();

  await page.getByLabel('أفهم أن محتوى ملفاتي سيُرسل').check();
  await page.getByRole('button', { name: 'أضف الاتصال' }).click();
  const list = connections(page);
  await expect(list.getByText('الافتراضي')).toBeVisible();
  await expect(list.getByText('••••0001')).toBeVisible();
  await expect(page.getByText(FAKE_KEYS.valid)).toHaveCount(0);
  await list.getByRole('button', { name: 'افحص الجاهزية' }).click();
  await expect(list.getByText(/^جاهز/)).toBeVisible();
  await list.getByRole('button', { name: 'جرّب مهمة تجريبية' }).click();
  await expect(list.getByText('قرأ النموذج سؤال التجربة:')).toBeVisible();
  await expect(list.getByText('Hyperkalemia')).toBeVisible();
  await expect(page.getByText('لا يوجد ذكاء اصطناعي مربوط')).toBeHidden();
});

test('a wrong key is explained before saving, and can be replaced after', async ({ page }) => {
  await openSettings(page, 'ai-badkey');
  await connectCustom(page, 'sk-wrong-key-123456789');
  await page.getByRole('button', { name: 'حمّل نماذجي' }).click();
  await expect(page.getByText('رُفض المفتاح. تحقق منه أو أضف مفتاحاً جديداً.')).toBeVisible();
  await page.getByLabel('النموذج', { exact: true }).fill(FAKE_MODELS.good);
  await page.getByLabel('أفهم أن محتوى ملفاتي سيُرسل').check();
  await page.getByRole('button', { name: 'أضف الاتصال' }).click();
  const list = connections(page);
  await expect(list.getByText('••••6789')).toBeVisible();
  await list.getByRole('button', { name: 'غيّر المفتاح' }).click();
  await list.getByLabel('المفتاح الجديد').fill(FAKE_KEYS.valid);
  await list.getByRole('button', { name: 'حفظ' }).click();
  await expect(list.getByText('••••0001')).toBeVisible();
  await list.getByRole('button', { name: 'افحص الجاهزية' }).click();
  await expect(list.getByText(/^جاهز/)).toBeVisible();
  await list.getByRole('button', { name: 'احذف الاتصال' }).click();
  await list.getByRole('button', { name: 'تأكيد الحذف' }).click();
  await expect(page.getByText('لا يوجد لديك أي اتصال AI بعد.')).toBeVisible();
});

test('presets show where the key goes; limits ask before large tasks (English UI)', async ({
  page,
}) => {
  await openSettings(page, 'ai-limits');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByLabel('Provider', { exact: true }).selectOption('anthropic');
  await expect(page.getByText('https://api.anthropic.com')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get a key from this provider' })).toHaveAttribute(
    'href',
    'https://console.anthropic.com/settings/keys',
  );
  await page.getByRole('button', { name: 'Estimate' }).click();
  await expect(
    page.getByText('No AI is connected, so this task would run without AI.'),
  ).toBeVisible();
  await page.getByLabel('Ask before AI tasks on files with more pages than').fill('100');
  await page.getByRole('button', { name: 'Save' }).last().click();
  await expect(page.getByText('Saved.')).toBeVisible();
});
