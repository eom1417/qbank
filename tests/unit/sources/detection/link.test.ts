import { describe, expect, it } from 'vitest';
import type {
  Detection,
  FileLines,
  Line,
  LineRole,
  Role,
} from '../../../../src/server/capabilities/sources/detection/contract.js';
import { assemble } from '../../../../src/server/capabilities/sources/detection/link/assemble.js';
import { toDetectedQuestions } from '../../../../src/server/capabilities/sources/detection/link/to-detected.js';

type Row = [page: number, text: string, role: Role, extra?: Partial<LineRole>];

/** A synthetic file: one line per row, stacked down each page, with its role. */
function fileOf(rows: Row[]): { file: FileLines; roles: LineRole[] } {
  const lines: Line[] = rows.map(([page, text], id) => {
    const box = { x0: 10, y0: id * 20, x1: 300, y1: id * 20 + 12 };
    const words = text.split(' ').map((word, at) => ({
      text: word,
      box: { x0: 10 + at * 30, y0: box.y0, x1: 35 + at * 30, y1: box.y1 },
      font: 'Body',
    }));
    const base = { id, page, box, text, words, unitId: `u${id}`, rtl: false };
    return { ...base, source: 'text', confidence: null, deviceNote: false };
  });
  const roles = rows.map(([, , role, extra], line) => ({ line, role, confidence: 1, ...extra }));
  const layout = { lineHeight: 12, lineGap: 8, paragraphGap: 16, margins: new Map() };
  return { file: { lines, units: new Map() as never, pages: [], layout }, roles };
}

const label = (page: number, text: string, number: number): Row => [
  page,
  text,
  'label',
  { number },
];
const option = (page: number, text: string, letter: string): Row => [
  page,
  text,
  'option',
  { letter },
];
const keys = (text: string, entries: [number, string][]): Row => [
  9,
  text,
  'key_table',
  { entries: entries.map(([number, letter]) => ({ number, letters: [letter] })) },
];

describe('M39 step 4: linking questions from line roles', () => {
  it('builds a question with an inline answer and its explanation', () => {
    const { file, roles } = fileOf([
      label(1, '1. Which drug', 1),
      [1, 'is first line?', 'stem'],
      option(1, 'A. Aspirin', 'A'),
      option(1, 'B. Heparin', 'B'),
      [1, 'Answer: B', 'answer', { letters: ['B'] }],
      [1, 'Because it acts fast.', 'explanation'],
    ]);
    const [question] = assemble(file, roles);
    expect(question).toMatchObject({ number: 1, numberInferred: false, labelLine: 0, stem: [1] });
    expect(question?.options.map((o) => [o.letter, o.label, o.lines])).toEqual([
      ['A', 'A', [2]],
      ['B', 'B', [3]],
    ]);
    expect(question?.answer).toEqual({ letters: ['B'], lines: [4], from: 'inline' });
    expect(question?.explanation).toEqual([5]);
  });
});

describe('M39 step 4: answer keys printed later in the file', () => {
  it('matches a key at each chapter end, numbering restarting per chapter', () => {
    const { file, roles } = fileOf([
      label(1, '1. One', 1),
      option(1, 'A. x', 'A'),
      label(1, '2. Two', 2),
      option(1, 'A. x', 'A'),
      [2, 'Answers', 'key_table'],
      keys('1-C', [[1, 'C']]),
      keys('2-D', [[2, 'D']]),
      [3, 'Chapter 2', 'heading'],
      label(3, '1. Three', 1),
      option(3, 'A. x', 'A'),
      keys('1-B', [[1, 'B']]),
    ]);
    const answers = assemble(file, roles).map((q) => q.answer);
    expect(answers).toEqual([
      { letters: ['C'], lines: [5], from: 'key_table' },
      { letters: ['D'], lines: [6], from: 'key_table' },
      { letters: ['B'], lines: [10], from: 'key_table' },
    ]);
  });

  it('answers from one key at the end of the book, after every chapter', () => {
    const { file, roles } = fileOf([
      label(1, '1. One', 1),
      label(2, '1. Two', 1),
      label(3, '2. Three', 2),
      [3, 'Answer key', 'key_table'],
      keys('1-A', [[1, 'A']]),
      keys('1-B 2-C', [
        [1, 'B'],
        [2, 'C'],
      ]),
    ]);
    const letters = assemble(file, roles).map((q) => q.answer?.letters);
    expect(letters).toEqual([['A'], ['B'], ['C']]);
  });
});

describe('M39 step 4: inline answers against keys', () => {
  it('keeps an inline answer over a later key, and leaves unmatched numbers unanswered', () => {
    const { file, roles } = fileOf([
      label(1, '1. One', 1),
      [1, 'Ans: A', 'answer', { letters: ['A'] }],
      label(1, '2. Two', 2),
      keys('1-D 7-B', [
        [1, 'D'],
        [7, 'B'],
      ]),
    ]);
    const [first, second] = assemble(file, roles);
    expect(first?.answer?.from).toBe('inline');
    expect(second?.answer).toBeNull();
  });
});

describe('M39 step 4: questions across pages and without numbers', () => {
  it('follows a question across a page break and option continuation lines', () => {
    const { file, roles } = fileOf([
      label(1, '4. A long', 4),
      [1, 'Page 1 of 9', 'filler'],
      [2, 'stem goes on', 'stem'],
      option(2, 'A. first', 'A'),
      [2, 'still first', 'unknown'],
      option(2, 'B. second', 'B'),
      [2, 'second goes on', 'stem'],
    ]);
    const [question] = assemble(file, roles);
    expect(question?.stem).toEqual([2]);
    expect(question?.options.map((o) => o.lines)).toEqual([
      [3, 4],
      [5, 6],
    ]);
    const [detected] = toDetectedQuestions(detectionOf(file, roles));
    expect(detected).toMatchObject({ key: '1-4-0', page: 1, pages: [1, 2] });
    expect(detected?.stem).toBe('A long stem goes on');
    expect(detected?.options.map((o) => o.text)).toEqual([
      'first still first',
      'second second goes on',
    ]);
    expect(detected?.area.map((spot) => spot.page)).toEqual([1, 2]);
  });

  it('infers the number of an unnumbered question from the one before', () => {
    const { file, roles } = fileOf([
      label(1, '5. Five', 5),
      option(1, 'A. x', 'A'),
      [1, 'Answer: A', 'answer', { letters: ['A'] }],
      [1, 'An unnumbered question', 'stem'],
      option(1, 'A. y', 'A'),
    ]);
    const questions = assemble(file, roles);
    expect(questions.map((q) => [q.number, q.numberInferred])).toEqual([
      [5, false],
      [6, true],
    ]);
  });
});

function detectionOf(
  file: FileLines,
  roles: LineRole[],
  extra: Partial<Detection> = {},
): Detection {
  const questions = assemble(file, roles);
  return { file, roles, questions, doubts: [], corrections: new Map(), ...extra };
}

describe('M39 step 4: questions as the answers layer takes them', () => {
  const { file, roles } = fileOf([
    label(1, '1. Wht is it?', 1),
    option(1, 'A. one', 'A'),
    option(1, 'B. two', 'B'),
    [1, 'Correct Answer: B', 'answer', { letters: ['B'] }],
    [1, 'Two is right.', 'explanation'],
    label(1, '1. Again', 1),
  ]);

  it('joins corrected text, answers with their evidence, spots and keys', () => {
    const detection = detectionOf(file, roles, { corrections: new Map([[0, '1. What is it?']]) });
    const [first, second] = toDetectedQuestions(detection);
    expect(first).toMatchObject({
      key: '1-1-0',
      stem: 'What is it?',
      explanation: 'Two is right.',
      answers: ['B'],
      evidence: ['printed_key'],
      fromPicture: false,
      caseText: null,
      reviewReasons: [],
    });
    expect(first?.options[1]?.spot).toEqual({ page: 1, box: file.lines[2]?.words[0]?.box });
    expect(second?.key).toBe('1-1-1');
  });

  it('sends doubts, missing options and missing answers to review', () => {
    const doubt = { check: 'stem' as const, question: 1, lines: [5], detail: 'short' };
    const [first, second] = toDetectedQuestions(detectionOf(file, roles, { doubts: [doubt] }));
    expect(first?.reviewReasons).toEqual([]);
    expect(second?.reviewReasons).toEqual(['detection_doubt', 'incomplete_options', 'no_answer']);
    expect(second?.evidence).toEqual(['none']);
  });

  it('reads a question from a picture and a pen-mark answer', () => {
    const picture = fileOf([label(1, '3. Pictured', 3), option(1, 'A. x', 'A')]);
    const lines = picture.file.lines.map((line) => ({ ...line, source: 'picture' as const }));
    const detection = detectionOf({ ...picture.file, lines }, picture.roles);
    const draft = detection.questions[0];
    if (draft) draft.answer = { letters: ['A'], lines: [], from: 'pen_mark' };
    const [question] = toDetectedQuestions(detection);
    expect(question).toMatchObject({ fromPicture: true, answers: ['A'], evidence: ['pen_mark'] });
  });
});
