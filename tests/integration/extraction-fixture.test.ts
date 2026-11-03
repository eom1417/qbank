import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runTool } from '../../src/server/capabilities/sources/adapters/run-tool.js';
import { extractQuestions } from '../../src/server/capabilities/sources/index.js';

// A synthetic page built from tests/fixtures/extraction/sample-page.txt with MuPDF, so this
// check needs no private sample: printed questions, a pen circle around Q1-C, a single-option
// question, an unmarked question and a note in another font.
let dir = '';
let pdf = '';
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'qbank-fixture-'));
  pdf = join(dir, 'sample.pdf');
  await runTool('mutool', ['create', '-o', pdf, 'tests/fixtures/extraction/sample-page.txt']);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

type Extracted = Awaited<ReturnType<typeof extractQuestions>>;

/** Number, page, option letters, answer and evidence: one comparable row per question. */
const rows = (questions: Extracted) =>
  questions.map((q) => [
    q.number,
    q.page,
    q.options.map((o) => o.letter).join(''),
    q.answer,
    q.evidence,
  ]);

describe.each(['text', 'ocr'] as const)('rules-first extraction, %s reading (M3.3)', (mode) => {
  it('reads questions, options, page numbers and the circled answer', async () => {
    const questions = await extractQuestions(pdf, mode);
    // A lone option is the answer only in the text layer: OCR may have lost the other options.
    const lone = mode === 'text' ? ['A', 'single_option'] : [null, null];
    expect(rows(questions)).toEqual([
      [1, 1, 'ABCD', 'C', 'pen_mark'],
      [2, 1, 'A', ...lone],
      // Nothing marked: no guessed key, the question goes to review.
      [3, 1, 'AB', null, null],
    ]);
  });

  it('keeps the printed stem and option text', async () => {
    const [first] = await extractQuestions(pdf, mode);
    expect(first?.stem).toBe(
      'A child has peaked T waves on the ECG. Which electrolyte disturbance is the most likely cause?',
    );
    // OCR can lose the glyphs under a pen circle; the text layer cannot.
    expect(first?.options[2]?.text).toMatch(mode === 'text' ? /^Hyperkalemia$/ : /perkalemia$/);
  });
});
