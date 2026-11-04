import { expect, test } from '@playwright/test';
import {
  AR,
  approveFirstTwo,
  importedEnglishBank,
  mockReadyProvider,
  newLearner,
  signUp,
  studyableBank,
  usePdfFixtures,
} from './support.js';

// Screens the final acceptance found untested (M18.1): sorting, the full editor, study
// preferences, a report from study, the AI disclosure at import, and a scanned book.
const fixtures = usePdfFixtures();
const DELETE_ORIGINAL = 'احذف الملف الأصلي';
const DELETE_ORIGINAL_CONFIRM = 'تأكيد حذف الأصل (الأسئلة تبقى)';
const ORIGINAL_GONE = 'الملف الأصلي محذوف؛ الأسئلة ومصدرها وصفحاتها باقية.';

test('sorts and searches the library (UI-04, FR-03-007)', async ({ page }) => {
  await signUp(page, newLearner('sort'), AR);
  for (const name of ['Beta', 'Alpha']) {
    await page.getByLabel('اسم البنك').fill(name);
    await page.getByRole('button', { name: 'إنشاء البنك' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
  await page.getByLabel('الترتيب حسب').selectOption('name');
  const names = page.locator('h2, h3').filter({ hasText: /^(Alpha|Beta)$/ });
  await expect(names).toHaveText(['Alpha', 'Beta']);
  await page.getByLabel('ابحث في البنوك بالاسم').fill('Gamma');
  await expect(page.getByText('لا يوجد بنك يطابق هذا البحث.')).toBeVisible();
  await page.getByRole('button', { name: 'مسح البحث' }).click();
  await expect(names).toHaveCount(2);
});

test('edits a question in full and keeps every field (UI-11)', async ({ page }) => {
  test.setTimeout(90_000);
  await importedEnglishBank(page, 'editor', fixtures().english);
  await page.getByRole('link', { name: 'راجع الأسئلة' }).click();
  await page.getByRole('link', { name: 'افتح' }).first().click();
  await page.getByLabel('نص السؤال').fill('An edited stem?');
  await page.getByRole('button', { name: 'أضف خياراً' }).click();
  await page.getByLabel('الشرح (كما في الكتاب)').fill('Because of the book.');
  await page.getByLabel('معلومة أحدث (منفصلة عن إجابة الكتاب)').fill('Newer guideline.');
  await page.getByLabel('الصعوبة (تحددها أنت)').selectOption('4');
  await page.getByRole('button', { name: 'احفظ' }).click();
  await expect(page.getByText('مصدر الإجابة:', { exact: false }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('نص السؤال')).toHaveValue('An edited stem?');
  await expect(page.getByLabel('الشرح (كما في الكتاب)')).toHaveValue('Because of the book.');
  await expect(page.getByLabel('معلومة أحدث (منفصلة عن إجابة الكتاب)')).toHaveValue(
    'Newer guideline.',
  );
  await expect(page.getByLabel('الصعوبة (تحددها أنت)')).toHaveValue('4');
});

test('study uses the saved session size, and a problem can be reported mid-study (UI-25, UAT-036)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await studyableBank(page, 'prefs', fixtures().english);
  await page.goto('/settings');
  await page.getByLabel('عدد الأسئلة الافتراضي في الجلسة').fill('30');
  await page.getByRole('button', { name: 'حفظ' }).nth(2).click();
  await expect(page.getByText('تم الحفظ.').first()).toBeVisible();
  await page.goto('/');
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('link', { name: 'ذاكر' }).click();
  await expect(page.getByLabel('كم سؤالاً')).toHaveValue('30');
  await page.getByRole('button', { name: 'استخدمها كلها' }).click();
  await page.getByRole('button', { name: 'ابدأ' }).click();
  await page.getByRole('button', { name: 'أبلغ عن مشكلة' }).click();
  await page.getByLabel('ما المشكلة؟').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'أرسل البلاغ' }).click();
  await expect(page.getByText('شكراً: البلاغ ينتظر في المراجعة، ولم يتغير شيء.')).toBeVisible();
});

test('choosing an AI for an import says what it sends first (FR-20-003, UAT-077)', async ({
  page,
}) => {
  // One signed-in provider, as the kit would report it.
  await mockReadyProvider(page, { models: [{ slug: 'm1', name: 'Model One' }] });
  await signUp(page, newLearner('disclose'), AR);
  await page.getByLabel('اسم البنك').fill('Medicine');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('link', { name: 'استورد ملفات' }).click();
  const ai = page.getByLabel('استخدم الذكاء الاصطناعي الخاص بي', { exact: false });
  await expect(page.getByText('تسري شروط ذلك المزوّد', { exact: false })).toHaveCount(0);
  await ai.selectOption({ label: 'Claude · Model One' });
  await expect(page.getByText('تسري شروط ذلك المزوّد', { exact: false })).toBeVisible();
  await expect(page.getByLabel('دع الذكاء الاصطناعي يقرأ الصفحات كاملة')).toBeVisible();
});

test('a scanned book: read by OCR, reviewed, studied, original deleted (JY-01)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await importedEnglishBank(page, 'scan', fixtures().scanned);
  await page.getByRole('link', { name: 'راجع الأسئلة' }).click();
  // The filter's options hold the same words, hidden: the reasons are the badges.
  await expect(
    page.locator('.qb-badge', { hasText: 'مقروء من صفحة ممسوحة' }).first(),
  ).toBeVisible();
  await page.getByRole('link', { name: 'العودة إلى البنك' }).click();
  await approveFirstTwo(page);
  await page.getByRole('link', { name: 'ذاكر' }).click();
  await page.getByRole('button', { name: 'استخدمها كلها' }).click();
  await page.getByRole('button', { name: 'ابدأ' }).click();
  await expect(page.getByText('السؤال 1 من 2')).toBeVisible();
  await page.getByRole('link', { name: 'المكتبة' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('button', { name: DELETE_ORIGINAL }).click();
  await page.getByRole('button', { name: DELETE_ORIGINAL_CONFIRM }).click();
  await expect(page.getByText(ORIGINAL_GONE)).toBeVisible();
});

test('the providers screen says AI is optional, and shows the provider’s own limits (FR-08-013, FR-22-008)', async ({
  page,
}) => {
  await mockReadyProvider(page, {
    usageLimits: { windows: [{ id: 'week', label: 'Weekly', usedPercent: 42 }] },
  });
  await signUp(page, newLearner('limits'), AR);
  await page.goto('/settings/providers');
  await expect(page.getByText('الذكاء الاصطناعي اختياري', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'حدود الاستخدام' })).toBeVisible();
  await expect(page.getByText('Weekly: 42%')).toBeVisible();
});
