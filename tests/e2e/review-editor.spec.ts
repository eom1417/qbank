import { expect, test, type Page } from '@playwright/test';
import { NO_ENHANCEMENTS } from '../../src/contracts/sources.js';
import {
  AR,
  importedEnglishBank,
  mockReadyProvider,
  newLearner,
  signUp,
  usePdfFixtures,
} from './support.js';

// M34 P6 in the browser: the page as read in review (Q26), the light / strong choice (Q14) and
// the pipeline's report (Q59). What only a pipeline import with a real AI produces (its units,
// its report) is answered by the test, in the contract's shape; everything else is the real app.

const fixtures = usePdfFixtures();

const box = (y: number) => ({ x0: 60, y0: y, x1: 400, y1: y + 14 });

/** The roles the pickers offer for a question with options A and B. */
const CHOICES = {
  text: ['stem', 'option:A', 'option:B', 'option:C', 'explanation', 'case', 'filler', 'dropped'],
  picture: [
    'picture:question',
    'picture:option:A',
    'picture:option:B',
    'picture:explanation',
    'case',
    'filler',
    'dropped',
  ],
};

/** One page read into units: this question's, a picture, and another question's line. */
function reading(questionId: string, version: number) {
  const unit = (n: number, role: string, text: string | null, extra = {}) => ({
    unitId: `p1-u${n}`,
    kind: text === null ? 'image' : 'text_line',
    box: box(80 + n * 30),
    text,
    imageClass: text === null ? 'figure' : null,
    role,
    editable: true,
    ...extra,
  });
  return {
    questionId,
    version,
    available: true,
    pages: [
      {
        page: 1,
        width: 595,
        height: 842,
        imageUrl: null,
        units: [
          unit(0, 'stem', '1) Which synthetic test comes first?'),
          unit(1, 'option:A', 'A. Chest film'),
          unit(2, 'option:B', 'B. Blood count'),
          unit(3, 'dropped', 'A blood count is quick in this example.'),
          unit(4, 'picture:question', null),
          unit(5, 'stem', '2) Another question', { editable: false }),
        ],
      },
    ],
    choices: CHOICES,
  };
}

async function openFirstQuestion(page: Page) {
  await importedEnglishBank(page, 'page-reading', fixtures().english);
  await page.getByRole('link', { name: 'راجع الأسئلة' }).click();
  await page.getByRole('link', { name: 'افتح' }).first().click();
  await expect(page.getByRole('heading', { name: /^السؤال/ })).toBeVisible();
  return /\/questions\/([^/]+)$/.exec(page.url())?.[1] ?? '';
}

test('review: the page as read, a unit given a new role, the question re-assembled (Q26)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const id = await openFirstQuestion(page);
  const question = await (await page.request.get(`/api/questions/${id}`)).json();
  await page.route(`**/api/questions/${id}/page-reading`, (route) =>
    route.fulfill({ json: reading(id, question.version) }),
  );
  let sent: unknown = null;
  await page.route(`**/api/questions/${id}/reassemble`, async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { ...question, version: question.version + 1 } });
  });
  await page.getByRole('button', { name: 'اعرض الصفحة كما قُرئت' }).click();
  await expect(page.getByRole('img', { name: 'صفحة 1' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'الألوان' })).toContainText('نص السؤال');
  await expect(page.getByText('اختر مقطعاً محدداً على الصفحة لتغيير دوره.')).toBeVisible();
  // Another question's line is drawn but cannot be chosen.
  await expect(page.locator('rect[data-unit="p1-u5"]')).not.toHaveAttribute('role', 'button');
  const reassemble = page.getByRole('button', { name: 'أعد التجميع' });
  await expect(reassemble).toBeDisabled();
  await page.locator('rect[data-unit="p1-u3"]').click();
  await expect(page.getByText('A blood count is quick in this example.')).toBeVisible();
  await page.getByLabel('دوره').selectOption({ label: 'الشرح' });
  await expect(page.locator('rect[data-unit="p1-u3"]')).toHaveAttribute('data-role', 'explanation');
  await page.locator('rect[data-unit="p1-u4"]').press('Enter');
  await page.getByLabel('دوره').selectOption({ label: 'صورة الخيار B' });
  await expect(page.getByText('مقاطع غُيّرت: 2')).toBeVisible();
  await reassemble.click();
  await expect(page.getByText('أُعيد بناء السؤال من مقاطعه وحُفظ نسخةً جديدة.')).toBeVisible();
  expect(sent).toEqual({
    expectedVersion: question.version,
    roles: [
      { unitId: 'p1-u3', role: 'explanation' },
      { unitId: 'p1-u4', role: 'picture:option:B' },
    ],
  });
});

test('review: a question without a kept reading says why (Q23)', async ({ page }) => {
  test.setTimeout(120_000);
  await openFirstQuestion(page);
  // Every import keeps its reading since M39; one past its 7 days is no longer there.
  await page.route('**/api/questions/*/page-reading', async (route) => {
    const response = await route.fetch();
    const json = { ...(await response.json()), available: false, pages: [] };
    await route.fulfill({ response, json });
  });
  await page.getByRole('button', { name: 'اعرض الصفحة كما قُرئت' }).click();
  await expect(
    page.getByText('تبقى الصفحة كما قُرئت 7 أيام بعد الاستيراد بخط الإنتاج', { exact: false }),
  ).toBeVisible();
});

test('import: light or strong among the approved models, and the pipeline report (Q14, Q59)', async ({
  page,
}) => {
  await mockReadyProvider(page, {
    models: [
      { slug: 'claude-haiku-5-5', name: 'Haiku' },
      { slug: 'claude-opus-5-5', name: 'Opus' },
    ],
  });
  await signUp(page, newLearner('tier'), AR);
  await page.getByLabel('اسم البنك').fill('Medicine');
  await page.getByRole('button', { name: 'إنشاء البنك' }).click();
  await page.getByRole('link', { name: 'فتح البنك' }).click();
  await page.getByRole('link', { name: 'استورد ملفات' }).click();
  await expect(page.getByText('دقة قراءة الذكاء الاصطناعي')).toHaveCount(0);
  await page.getByLabel('استخدم الذكاء الاصطناعي الخاص بي', { exact: false }).selectOption({
    label: 'Claude',
  });
  await expect(page.getByLabel('خفيف (أسرع وأوفر)')).toBeChecked();
  await page.getByLabel('قوي (الأكثر دقة)').check();
  await expect(page.getByLabel('قوي (الأكثر دقة)')).toBeChecked();
  const job = pipelineJob();
  let upload = '';
  await page.route('**/api/banks/*/imports', async (route) => {
    upload = route.request().postDataBuffer()?.toString('latin1') ?? '';
    await route.fulfill({ status: 201, json: job });
  });
  await page.getByLabel('ملفات PDF').setInputFiles(fixtures().english);
  await page.getByLabel('سيُرسل نص الملف وصور الصفحات', { exact: false }).check();
  await page.getByLabel('أؤكد أنه يحق لي استخدام هذه الملفات لمذاكرتي الشخصية.').check();
  await page.getByRole('button', { name: 'ارفع وابدأ' }).click();
  await expect.poll(() => upload).toMatch(/name="aiTier"\r\n\r\nstrong/);
  await expect.poll(() => upload).toMatch(/name="aiMode"\r\n\r\npipeline/);

  await page.route(`**/api/imports/${job.id}`, (route) => route.fulfill({ json: job }));
  await page.goto(`/imports/${job.id}`);
  await expect(page.getByText('بدأ بـ: قوي (الأكثر دقة)')).toBeVisible();
  await expect(page.getByText('نوع المستند: أسئلة بمفتاح مطبوع')).toBeVisible();
  await expect(
    page.getByText('هذا النوع من المستندات لم يُقس بعد', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('صفحات بشكل مجهول: 3')).toBeVisible();
  await expect(page.getByRole('list', { name: 'ما ذهب للمراجعة حسب السبب' })).toContainText(
    'تعذّرت قراءة الخيار المعلَّم: 2',
  );
});

/** A finished pipeline import's report, as the server would send it (contract shape). */
function pipelineJob() {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    sourceId: '00000000-0000-4000-8000-0000000000a2',
    bankId: '00000000-0000-4000-8000-0000000000a3',
    fileName: 'synthetic.pdf',
    stage: 'needs_review',
    pagesTotal: 3,
    pagesDone: 3,
    queuePosition: null,
    questionsFound: 4,
    questionsReview: 2,
    aiOutcome: 'done',
    // The steps the import ran (M39): none shown for a mocked job.
    steps: [],
    aiDetail: null,
    detectionIssues: [],
    errorCode: null,
    ai: {
      instanceId: 'claudeAgent',
      model: null,
      enhance: NO_ENHANCEMENTS,
      models: {},
      mode: 'pipeline',
      usage: [],
      resumesAt: null,
      tier: 'strong',
      pipeline: {
        family: 'printed_key',
        measured: false,
        unknownPages: [3],
        reviewReasons: [{ reason: 'mark_unclear', count: 2 }],
      },
    },
    createdAt: '2026-11-17T10:00:00.000Z',
    finishedAt: '2026-11-17T10:05:00.000Z',
    pages: [],
  };
}
