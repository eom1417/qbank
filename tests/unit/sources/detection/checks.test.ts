import { describe, expect, it } from 'vitest';
import type {
  CheckId,
  DraftQuestion,
  FileLines,
  Line,
  LineRole,
} from '../../../../src/server/capabilities/sources/detection/contract.js';
import { runChecks } from '../../../../src/server/capabilities/sources/detection/checks/run-checks.js';

const line = (id: number, text: string, y = id * 10, page = 1): Line => ({
  id,
  page,
  box: { x0: 0, y0: y, x1: 100, y1: y + 8 },
  text,
  words: [],
  source: 'text',
  unitId: `u${id}`,
  rtl: false,
  confidence: null,
  deviceNote: false,
});
const fileOf = (texts: string[]): FileLines =>
  ({
    lines: texts.map((t, i) => line(i, t)),
    units: { pages: [] },
    pages: [],
    layout: {},
  }) as unknown as FileLines;
const opt = (letter: string, lines: number[]) => ({ letter, label: letter, lines });
const question = (over: Partial<DraftQuestion> = {}): DraftQuestion => ({
  number: 1,
  numberInferred: false,
  labelLine: 0,
  stem: [1],
  options: [opt('A', [2]), opt('B', [3])],
  answer: null,
  conflicts: [],
  explanation: [],
  caseLines: [],
  pictures: [],
  tags: { exam: null, year: null },
  ...over,
});
const TEXTS = ['Q1.', 'What is it', 'A. one', 'B. two', 'Q2.', 'Next', 'A. x', 'B. y'];
const role = (
  l: number,
  r: LineRole['role'],
  confidence = 1,
  more: Partial<LineRole> = {},
): LineRole => ({ line: l, role: r, confidence, ...more });
const checks = (q: DraftQuestion[], texts = TEXTS, roles: LineRole[] = []) =>
  runChecks(fileOf(texts), roles, q).map((d) => d.check);
const has = (id: CheckId, q: DraftQuestion[], texts = TEXTS, roles: LineRole[] = []) =>
  checks(q, texts, roles).includes(id);

describe('runChecks', () => {
  it('is clean on a sound question', () => {
    expect(checks([question()])).toEqual([]);
  });
  it('number', () => {
    expect(has('number', [question({ numberInferred: true })])).toBe(true);
  });
  it('stem', () => {
    expect(has('stem', [question({ stem: [] })])).toBe(true);
    expect(has('stem', [question()])).toBe(false);
  });
  it('stem: the text after the printed label is the stem', () => {
    const texts = ['3) Which colour is the flag?', 'A. red', 'B. blue'];
    const onLabel = question({ stem: [], options: [opt('A', [1]), opt('B', [2])] });
    expect(has('stem', [onLabel], texts)).toBe(false);
  });
  it('option_sequence', () => {
    const skip = question({ options: [opt('A', [2]), opt('C', [3])] });
    expect(has('option_sequence', [skip], ['Q1.', 'S', 'A. one', 'C. two'])).toBe(true);
    expect(has('option_sequence', [question()])).toBe(false);
  });
  it('option_sequence: an option whose letter the roles read in doubt (a lost letter)', () => {
    const texts = ['Q1.', 'S', 'A. one', 'two, its letter lost'];
    const sure = [role(2, 'option', 0.9), role(3, 'option', 0.9)];
    const lost = [role(2, 'option', 0.9), role(3, 'option', 0.45)];
    expect(has('option_sequence', [question()], texts, sure)).toBe(false);
    expect(has('option_sequence', [question()], texts, lost)).toBe(true);
  });
  it('option_holds_other: an option owns a line whose role is in doubt', () => {
    const q = question({ options: [opt('A', [2]), opt('B', [3, 4])] });
    const texts = ['Q1.', 'S', 'A. one', 'B. two', 'B. three'];
    const sure = [role(4, 'option', 0.8)];
    expect(has('option_holds_other', [q], texts, sure)).toBe(false);
    expect(has('option_holds_other', [q], texts, [role(4, 'unknown', 0.3)])).toBe(true);
  });
  it('option_holds_other', () => {
    const texts = ['Q1.', 'S', 'A. one', 'B. Correct Answer: A'];
    expect(has('option_holds_other', [question()], texts)).toBe(true);
    expect(has('option_holds_other', [question()])).toBe(false);
  });
  it('option_holds_other by length', () => {
    const long = 'word '.repeat(40);
    const texts = [...TEXTS.slice(0, 3), `B. ${long}`, 'Q2.', 'n', 'A. x', 'B. y', 'C. z'];
    const q2 = question({ options: [opt('A', [6]), opt('B', [7]), opt('C', [8])] });
    expect(has('option_holds_other', [question(), q2], texts)).toBe(true);
  });
});

describe('runChecks, answers and file level', () => {
  it('answer_in_options', () => {
    const bad = question({ answer: { letters: ['E'], lines: [3], from: 'inline' } });
    const good = question({ answer: { letters: ['B'], lines: [3], from: 'inline' } });
    expect(has('answer_in_options', [bad])).toBe(true);
    expect(has('answer_in_options', [good])).toBe(false);
  });
  it('explanation_holds_question', () => {
    const texts = [...TEXTS, 'Q3. text', 'because'];
    expect(has('explanation_holds_question', [question({ explanation: [8] })], texts)).toBe(true);
    expect(has('explanation_holds_question', [question({ explanation: [9] })], texts)).toBe(false);
    const run = ['Q1.', 'S', 'A. one', 'B. two', 'A. x', 'B. y'];
    expect(has('explanation_holds_question', [question({ explanation: [4, 5] })], run)).toBe(true);
  });
  it('parts_in_order', () => {
    expect(has('parts_in_order', [question({ stem: [3] })])).toBe(true);
    expect(has('parts_in_order', [question()])).toBe(false);
  });
});

describe('runChecks, pictures and the file as a whole', () => {
  it('picture_place', () => {
    const pic = {
      unitId: 'p',
      spot: { page: 1, box: { x0: 0, y0: 31, x1: 9, y1: 38 } },
      placement: 'question',
      optionLetter: null,
      imageClass: 'diagram',
    } as unknown as DraftQuestion['pictures'][number];
    const second = question({
      number: 2,
      labelLine: 4,
      stem: [5],
      options: [opt('A', [6]), opt('B', [7])],
      pictures: [pic],
    });
    expect(has('picture_place', [question(), second])).toBe(true);
    expect(has('picture_place', [question({ pictures: [pic] })])).toBe(false);
  });
  it('case_link', () => {
    const texts = [...TEXTS, ' '];
    expect(has('case_link', [question({ caseLines: [8] })], texts)).toBe(true);
    expect(has('case_link', [question({ caseLines: [1] })])).toBe(false);
  });
  it('coverage groups contiguous runs', () => {
    const roles = [
      role(4, 'unknown'),
      role(5, 'stem', 0.3),
      role(7, 'unknown'),
      role(6, 'filler', 0.1),
      role(1, 'unknown'),
    ];
    const found = runChecks(fileOf(TEXTS), roles, [question()]).filter(
      (d) => d.check === 'coverage',
    );
    expect(found.map((d) => d.lines)).toEqual([[4, 5], [7]]);
    expect(found[0]?.question).toBeNull();
  });
});

describe('runChecks, numbering and keys', () => {
  it('numbering', () => {
    const q = (n: number) => question({ number: n });
    expect(has('numbering', [q(1), q(2), q(4)])).toBe(true);
    expect(has('numbering', [q(1), q(2), q(1), q(2)])).toBe(false);
  });
  it('key_use', () => {
    const entries = (n: number) => ({ entries: [{ number: n, letters: ['A'] }] });
    const twice = [role(0, 'key_table', 1, entries(1)), role(1, 'key_table', 1, entries(1))];
    const once = [role(0, 'key_table', 1, entries(1)), role(1, 'key_table', 1, entries(2))];
    expect(has('key_use', [question()], TEXTS, twice)).toBe(true);
    expect(has('key_use', [question()], TEXTS, once)).toBe(false);
    expect(has('key_use', [question({ conflicts: ['key B vs pen A'] })])).toBe(true);
  });
});
