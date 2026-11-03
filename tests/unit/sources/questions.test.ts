import { describe, expect, it } from 'vitest';
import type { TextLine } from '../../../src/server/capabilities/sources/domain/lines.js';
import { parseQuestions } from '../../../src/server/capabilities/sources/domain/questions.js';

let y = 0;
function line(text: string, x = 44, page = 1): TextLine {
  y += 15;
  const box = { x0: x, y0: y, x1: x + 300, y1: y + 12 };
  const words = text.split(' ').map((word, i) => ({
    text: word,
    box: { ...box, x0: x + i * 30, x1: x + i * 30 + 25 },
    font: null,
  }));
  return { page, text, box, words, rtl: false, start: x };
}

const letters = (questions: ReturnType<typeof parseQuestions>) =>
  questions.map((q) => q.options.map((o) => `${o.letter}${o.circledGlyph ? '*' : ''}`).join(''));

describe('pages that could not be read', () => {
  it('does not join text across a page that could not be read (FR-23-004)', () => {
    y = 0;
    const questions = parseQuestions([
      line('6. Last question of page one?'),
      line('A. Yes'),
      line('B. No'),
      line('the end of question 7, whose page failed', 44, 3),
      line('8. A question after it?', 44, 3),
      line('A. Yes', 44, 3),
    ]);
    expect(questions.map((q) => [q.number, q.page, q.stem])).toEqual([
      [6, 1, 'Last question of page one?'],
      [8, 3, 'A question after it?'],
    ]);
    expect(questions[0]?.options.map((o) => o.text)).toEqual(['Yes', 'No']);
  });
});

describe('question parser', () => {
  it('joins wrapped stems and options, and keeps page numbers', () => {
    y = 0;
    const questions = parseQuestions([
      line('Q7) A child with'),
      line('fever and rash?'),
      line('A. Measles'),
      line('B. Rubella with'),
      line('arthralgia'),
      line('Q8) Next question?', 44, 2),
      line('A. Only option', 44, 2),
    ]);
    expect(questions.map((q) => [q.number, q.page, q.stem])).toEqual([
      [7, 1, 'A child with fever and rash?'],
      [8, 2, 'Next question?'],
    ]);
    expect(questions[0]?.options.map((o) => o.text)).toEqual([
      'Measles',
      'Rubella with arthralgia',
    ]);
  });

  it('accepts options only in sequence and near the question indent', () => {
    y = 0;
    const questions = parseQuestions([
      line('Q1) Stem?'),
      line('A. One'),
      line('C. Out of sequence (a pasted screenshot)'),
      line('B. Two'),
      line('B. Far right note', 300),
    ]);
    expect(letters(questions)).toEqual(['AB']);
  });
});

describe('question parser: OCR and boundaries', () => {
  it('reads OCR circle symbols as the circled option in its place', () => {
    y = 0;
    const questions = parseQuestions([
      line('Q2) Stem?'),
      line('A. One'),
      line('@)Two'),
      line('C. Three'),
    ]);
    expect(letters(questions)).toEqual(['AB*C']);
    expect(questions[0]?.options[1]?.text).toBe('Two');
  });

  it('ends a question at section rules and headings, and after a wide gap', () => {
    y = 0;
    const questions = parseQuestions([
      line('Q3) Stem'),
      line('~*~*~*~*~*~*~*'),
      line('stray text'),
    ]);
    expect(questions[0]?.stem).toBe('Stem');
    y = 0;
    const gap = parseQuestions([
      line('Q4) Stem'),
      { ...line('far below'), box: { x0: 44, y0: 400, x1: 300, y1: 412 } },
    ]);
    expect(gap[0]?.stem).toBe('Stem');
  });
});
