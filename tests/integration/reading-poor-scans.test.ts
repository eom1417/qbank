import { describe, expect, it } from 'vitest';
import { ownerWithBank } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';

const { app, fixtures } = useImportSuite();

/** Imports a file into a new bank and returns its report and saved questions. */
async function imported(file: string, language: string) {
  const { owner, bankId } = await ownerWithBank(app());
  const started = await uploadFile(app(), owner.cookie(), bankId, file, { language });
  await runImports(app());
  const report = (await owner.get(`/api/imports/${started.json().id}`)).json();
  const rows = await app
    .db()
    .selectFrom('question')
    .select(['stem', 'options'])
    .where('source_id', '=', report.sourceId)
    .orderBy('source_seq')
    .execute();
  return { report, rows };
}

// M26: a phone photo of a photocopy (blurred, washed out, a little crooked). At the usual 200 dpi
// Tesseract read nothing from the Arabic page, and the import said it was complete.
describe('poor scans (M26)', () => {
  it('reads a poor Arabic scan, its question and options', async () => {
    const { rows } = await imported(fixtures().arabicPoorScan, 'ar');
    expect(rows[0]?.stem).toBe('ما العضو المسؤول عن ضخ الدم؟');
    expect((rows[0]?.options as unknown[]).length).toBe(4);
  });

  it('reads as many questions from a poor English scan as from a clean one', async () => {
    const clean = await imported(fixtures().scanned, 'en');
    const poor = await imported(fixtures().poorScan, 'en');
    expect(poor.rows.length).toBeGreaterThanOrEqual(clean.rows.length);
  });
});

describe('a file with no questions (M26)', () => {
  it('says so instead of reporting a quiet success', async () => {
    const { report, rows } = await imported(fixtures().prose, 'en');
    expect(rows).toEqual([]);
    expect(report.errorCode).toBe('no_questions');
  });
});
