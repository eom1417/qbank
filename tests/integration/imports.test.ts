import { describe, expect, it } from 'vitest';
import { ownerWithBank } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';

const { app, fixtures } = useImportSuite();

/** The questions an import saved, in their source order. */
const savedQuestions = (sourceId: string) =>
  app
    .db()
    .selectFrom('question')
    .selectAll()
    .where('source_id', '=', sourceId)
    .orderBy('source_number')
    .execute();

async function imported(file: string, fields: Record<string, string> = {}) {
  const { owner, bankId } = await ownerWithBank(app());
  const started = await uploadFile(app(), owner.cookie(), bankId, file, fields);
  expect(started.statusCode).toBe(201);
  expect(started.json()).toMatchObject({ stage: 'queued', pagesDone: 0 });
  await runImports(app());
  const report = (await owner.get(`/api/imports/${started.json().id}`)).json();
  return { owner, bankId, report };
}

describe('import a text PDF (M4.3, M4.4, M4.6)', () => {
  it('reads two columns, 3 and 5 options, essays, units and a question across pages', async () => {
    const { owner, bankId, report } = await imported(fixtures().english);
    expect(report).toMatchObject({
      stage: 'needs_review',
      pagesTotal: 3,
      pagesDone: 3,
      questionsFound: 8,
      questionsReview: 7,
      aiOutcome: 'not_used',
      pages: [],
    });
    const rows = await savedQuestions(report.sourceId);
    expect(
      rows.map((q) => [q.source_number, q.source_page, q.kind, (q.options as unknown[]).length]),
    ).toEqual([
      [1, 1, 'mcq', 4],
      [2, 1, 'mcq', 3],
      [3, 1, 'mcq', 5],
      [4, 1, 'mcq', 2],
      [5, 1, 'essay', 0],
      [6, 1, 'mcq', 3],
      [7, 2, 'mcq', 3],
      [8, 3, 'mcq', 2],
    ]);
    expect(rows[3]?.stem).toContain('−4 mmol/L');
    expect(rows[0]).toMatchObject({
      status: 'needs_review',
      answer_provenance: 'missing',
      review_reasons: ['no_answer'],
    });
    expect(rows[4]).toMatchObject({ status: 'detected', review_reasons: ['essay'] });
    const { sources } = (await owner.get(`/api/banks/${bankId}/sources`)).json();
    expect(sources).toMatchObject([
      {
        fileName: 'english.pdf',
        pageCount: 3,
        questions: { total: 8, needsReview: 7 },
        latestImport: { stage: 'needs_review' },
      },
    ]);
  });
});

describe('retries and page ranges (M4.2, M4.7)', () => {
  it('retrying never duplicates questions (UAT-085)', async () => {
    const { owner, report } = await imported(fixtures().english);
    const retried = await owner.post(`/api/imports/${report.id}/retry`, {});
    expect(retried.json().stage).toBe('queued');
    await runImports(app());
    expect((await owner.get(`/api/imports/${report.id}`)).json()).toMatchObject({
      stage: 'needs_review',
      questionsFound: 8,
    });
    const count = await app
      .db()
      .selectFrom('question')
      .select((eb) => eb.fn.countAll().as('n'))
      .where('source_id', '=', report.sourceId)
      .executeTakeFirstOrThrow();
    expect(Number(count.n)).toBe(8);
  });

  it('reads only the chosen page range (UAT-021)', async () => {
    const { report } = await imported(fixtures().english, { pageFrom: '2', pageTo: '3' });
    expect(report).toMatchObject({ pagesTotal: 2, questionsFound: 2 });
  });
});

describe('import languages and scans (M4.4, M4.5)', () => {
  it('reads Arabic with Arabic letters and Arabic-Indic numbers (UAT-007)', async () => {
    const { report } = await imported(fixtures().arabic);
    const rows = await savedQuestions(report.sourceId);
    expect(rows.map((q) => q.source_number)).toEqual([1, 2, 3]);
    expect(rows[0]?.stem).toBe('ما العضو المسؤول عن ضخ الدم؟');
    expect(
      (rows[0]?.options as { label: string; text: string }[]).map((o) => `${o.label} ${o.text}`),
    ).toEqual(['أ الرئة', 'ب القلب', 'ج الكبد', 'د الكلية']);
    expect(rows[2]?.kind).toBe('essay');
  });

  it('reads a scanned page by OCR and says so (UAT-006)', async () => {
    const { report } = await imported(fixtures().scanned);
    expect(report.pages).toEqual([{ page: 1, status: 'done', reading: 'ocr', warning: 'ocr' }]);
    expect(report.questionsFound).toBeGreaterThanOrEqual(4);
    const rows = await app
      .db()
      .selectFrom('question')
      .select('review_reasons')
      .where('source_id', '=', report.sourceId)
      .execute();
    expect(rows.every((row) => row.review_reasons.includes('ocr_page'))).toBe(true);
  });
});
