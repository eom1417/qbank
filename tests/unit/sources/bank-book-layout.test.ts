import { describe, expect, it } from 'vitest';
import type { TextLine } from '../../../src/server/capabilities/sources/domain/lines.js';
import { parseQuestions } from '../../../src/server/capabilities/sources/domain/questions.js';

// M36: a bank book (PREP) prints "Question: 1" alone, then a blank paragraph, then the stem
// and, after another blank paragraph, the options. Measured spacing: about 3 lines each.
function at(text: string, y: number): TextLine {
  const box = { x0: 36, y0: y, x1: 336, y1: y + 12 };
  const words = text.split(' ').map((word, i) => ({
    text: word,
    box: { ...box, x0: 36 + i * 30, x1: 36 + i * 30 + 25 },
    font: null,
  }));
  return { page: 1, text, box, words, rtl: false, start: 36 };
}

describe('a question number alone on its line (M36)', () => {
  it('takes the stem and options across the book paragraph spacing', () => {
    const questions = parseQuestions([
      at('Question: 1', 100),
      at('A 15-year-old girl is diagnosed with PCOS.', 148),
      at('Of the following, she is likely to show', 162),
      at('A.free fatty acid uptake', 210),
      at('B.glucose uptake', 224),
    ]);
    expect(questions.map((q) => [q.number, q.stem, q.options.length])).toEqual([
      [1, 'A 15-year-old girl is diagnosed with PCOS. Of the following, she is likely to show', 2],
    ]);
  });

  it('does not reach a line far below a numbered stem that already has text', () => {
    const questions = parseQuestions([
      at('Question: 2 Which drug?', 100),
      at('a note pasted lower on the page', 148),
    ]);
    expect(questions[0]?.stem).toBe('Which drug?');
  });
});
