import { describe, expect, it } from 'vitest';
import type { Raster } from '../../../src/server/capabilities/sources/domain/answer-marks.js';
import type { PageText } from '../../../src/server/capabilities/sources/domain/page.js';
import { questionsFromPages } from '../../../src/server/capabilities/sources/use-cases/extract-questions.js';

// M38 (Q136): with no AI, the rules reader reads a bank book nobody wrote on as the pipeline
// does: the explanation after "Correct Answer" is never more of the last option.
const blank: Raster = {
  width: 600,
  height: 800,
  scale: 1,
  pixels: new Uint8Array(600 * 800).fill(255),
};

function page(lines: readonly string[], font = 'Calibri'): PageText {
  const words = lines.flatMap((line, row) =>
    line.split(' ').map((text, i) => ({
      text,
      box: { x0: 36 + i * 60, y0: 60 + row * 16, x1: 36 + i * 60 + 50, y1: 72 + row * 16 },
      font,
    })),
  );
  return { page: 1, width: 600, height: 800, visual: true, words };
}

describe('the rules reader on a bank book (M38)', () => {
  it('keeps the explanation out of the last option and the key as the answer', async () => {
    const book = page([
      'Question: 1',
      'Of the following, she shows',
      'A.free fatty acid uptake',
      'B.progesterone production',
      'Correct Answer: B',
      'Polycystic ovary syndrome is a symptom complex.',
      'Question: 2',
      'Which drug?',
      'A.adrenaline',
      'B.atropine',
      'Correct Answer: A',
      'Adrenaline reverses shock.',
    ]);
    const read = await questionsFromPages('book.pdf', [book], async () => blank);
    expect(read.map((question) => question.options.map((option) => option.text))).toEqual([
      ['free fatty acid uptake', 'progesterone production'],
      ['adrenaline', 'atropine'],
    ]);
    expect(read.map((question) => question.answer)).toEqual(['B', 'A']);
    expect(read[0]?.explanation).toBe('Polycystic ovary syndrome is a symptom complex.');
  });
});
