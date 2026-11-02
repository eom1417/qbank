import { expect, test, type Page } from '@playwright/test';
import { FAKE_KEYS, FAKE_MODELS, startFakeAiServer } from '../support/fake-ai-server.js';
import { AR, newLearner, signUp } from './support.js';

// The API under test points QBANK_LOCAL_AI_URL at this port (playwright.config.ts).
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

test('local AI: no key needed, readiness check, and a sample task read by the model', async ({
  page,
}) => {
  await openSettings(page, 'ai-local');
  await expect(page.getByText('لا يوجد ذكاء اصطناعي مربوط')).toBeVisible();
  await expect(page.getByText('المحتوى لا يخرج من هذا الخادم').first()).toBeVisible();

  await page.getByLabel('اسم لهذا الاتصال').fill('هذا الخادم');
  await page.getByLabel('النموذج', { exact: true }).fill(FAKE_MODELS.good);
  await page.getByRole('button', { name: 'أضف الاتصال' }).click();
  const list = connections(page);
  await expect(list.getByText('الافتراضي')).toBeVisible();
  await expect(list.getByText('لم يُفحص بعد')).toBeVisible();

  await list.getByRole('button', { name: 'افحص الجاهزية' }).click();
  await expect(list.getByText(/^جاهز/)).toBeVisible();
  await list.getByRole('button', { name: 'جرّب مهمة تجريبية' }).click();
  await expect(list.getByText('قرأ النموذج سؤال التجربة:')).toBeVisible();
  await expect(list.getByText('Hyperkalemia')).toBeVisible();
  await expect(page.getByText('لا يوجد ذكاء اصطناعي مربوط')).toBeHidden();
});

test('external provider: disclosure must be accepted, the key stays masked, a bad key is explained', async ({
  page,
}) => {
  await openSettings(page, 'ai-byok');
  await page.getByLabel('المزوّد').selectOption('openai_compatible');
  await page.getByLabel('اسم لهذا الاتصال').fill('Cloud');
  await page.getByLabel('النموذج', { exact: true }).fill(FAKE_MODELS.good);
  await page.getByLabel(/^عنوان الخادم/).fill(fake.url);
  await page.getByLabel(/^مفتاح API/).fill('sk-wrong-key-123456789');
  await page.getByRole('button', { name: 'أضف الاتصال' }).click();
  await expect(page.getByText('هذا الحقل مطلوب.')).toBeVisible();

  await page.getByLabel('أفهم أن محتوى ملفاتي سيُرسل').check();
  await page.getByRole('button', { name: 'أضف الاتصال' }).click();
  const list = connections(page);
  await expect(list.getByText('••••6789')).toBeVisible();
  await expect(page.getByText('sk-wrong-key-123456789')).toHaveCount(0);

  await list.getByRole('button', { name: 'افحص الجاهزية' }).click();
  await expect(list.getByText('رُفض المفتاح. تحقق منه أو أضف مفتاحاً جديداً.')).toBeVisible();
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

test('cost limits: a task above the page limit asks for approval (English UI)', async ({
  page,
}) => {
  await openSettings(page, 'ai-limits');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Estimate' }).click();
  await expect(
    page.getByText('No AI is connected, so this task would run without AI.'),
  ).toBeVisible();

  await page.getByLabel('Name for this connection').fill('Local');
  await page.getByLabel('Model', { exact: true }).fill(FAKE_MODELS.good);
  await page.getByRole('button', { name: 'Add connection' }).click();
  const list = page.getByRole('list', { name: 'Your AI connections' });
  await expect(list.getByText('Default')).toBeVisible();
  await page.getByLabel('Ask before AI tasks on files with more pages than').fill('100');
  await page.getByRole('button', { name: 'Save' }).last().click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Estimate' }).click();
  await expect(page.getByText('Free: runs on this server')).toBeVisible();
  await expect(page.getByText('more pages than your limit')).toBeVisible();
});
