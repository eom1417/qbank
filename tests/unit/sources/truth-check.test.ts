import { describe, expect, it } from 'vitest';
import { TruthFile, toReference, type TruthQuestion } from '../../../src/server/tools/extraction-bench/truth.js';
import { checkTruth } from '../../../src/server/tools/extraction-bench/truth-check.js';

function question(ordinal: number, overrides: Partial<TruthQuestion> = {}): TruthQuestion {
  return {
    ordinal,
    printed: ordinal,
    section: 'Burns',
    pages: [2],
    stem: `Stem ${ordinal}`,
    stemInImage: false,
    options: [
      { letter: 'A', text: 'one' },
      { letter: 'B', text: 'two' },
    ],
    answer: ['B'],
    evidence: ['pen_circle'],
    conflict: null,
    caseGroup: null,
    tags: { exam: null, year: null },
    images: [],
    kept: [],
    dropped: [],
    status: 'valid',
    statusReason: null,
    ...overrides,
  };
}

function file(questions: TruthQuestion[], count = questions.length) {
  return TruthFile.parse({
    file: 'sample.pdf',
    sha256: 'a'.repeat(64),
    pageCount: 3,
    family: 'annotated_notes',
    headings: [{ section: 'Burns', count }],
    printedTotal: count,
    filler: [],
    questions,
  });
}

describe('ground-truth check (M34 P0)', () => {
  it('accepts a consistent file and projects it to the old answer key', () => {
    const truth = file([question(1), question(2)]);
    expect(checkTruth(truth)).toEqual([]);
    expect(toReference(truth)[1]).toMatchObject({ number: 2, answer: 'B', evidence: 'circle' });
  });

});

describe('ground-truth check rejects (M34 P0)', () => {
  it('rejects counts that disagree with the printed contents table', () => {
    expect(checkTruth(file([question(1)], 2))).toEqual([
      'file prints 2 questions, truth has 1',
      'section "Burns" prints 2, truth has 1',
    ]);
  });

  it('rejects broken order, answers outside the options and valid questions without proof', () => {
    const problems = checkTruth(
      file([
        question(2, { answer: ['C'] }),
        question(3, { answer: [], evidence: ['none'] }),
      ]),
    );
    expect(problems).toContain('ordinal 2 at position 1');
    expect(problems).toContain('Q2: answer C is not an option');
    expect(problems).toContain('Q3: valid without an answer');
    expect(problems).toContain('Q3: valid with no evidence');
  });

  it('needs a reason for review, a letter for an option image and the explanation limits', () => {
    const image = { page: 2, optionLetter: null, isTextPicture: false, description: 'x' };
    const problems = checkTruth(
      file([
        question(1, {
          status: 'incomplete',
          answer: [],
          images: [
            { ...image, placement: 'option' },
            { ...image, page: 1, placement: 'explanation' },
          ],
          kept: [
            ...[1, 2, 3].map(() => ({ page: 2, kind: 'table' as const, anchor: 't' })),
            { page: 3, kind: 'handwriting_image' as const, anchor: 'note' },
          ],
        }),
        question(2, { pages: [9] }),
      ]),
    );
    expect(problems).toEqual([
      'Q1: incomplete without a reason',
      'Q1: option image letter mismatch',
      'Q1: 3 tables kept (max 2)',
      'Q1: kept handwriting_image on page 3 has no explanation image',
      'Q1: explanation image on page 1 is not kept',
      'Q2: page beyond the file',
    ]);
  });
});
