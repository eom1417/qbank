import { describe, expect, it } from 'vitest';
import {
  buildStructure,
  numberedLines,
  structureLesson,
  type StructureOutput,
} from '../../../src/server/capabilities/sources/domain/pipeline/lessons/structure.js';
import type { LeftoverLine } from '../../../src/server/capabilities/sources/domain/pipeline/leftover.js';
import { buildPrompt } from '../../../src/server/capabilities/sources/domain/pipeline/prompt-standard.js';

// M34 P4b: lesson D6.1 on synthetic picture lines: the model points, the code copies.

const BOX = { x0: 0, y0: 0, x1: 100, y1: 10 };
const synthetic = (texts: readonly string[]): LeftoverLine[] =>
  texts.map((text, i) => ({ n: i + 1, text, box: BOX }));

const LINES = synthetic([
  '12. Which synthetic drug is first-line',
  'for condition X?',
  'A. Drug one',
  'B. Drug two that wraps',
  'onto a second line',
  'C. Drug three',
  'Answer: B',
]);
const yes = (part: Partial<StructureOutput> = {}): StructureOutput => ({
  question: true,
  stem: [1, 2],
  options: [3, 4, 6],
  explanation: [7],
  ...part,
});
const no: StructureOutput = { question: false, stem: [], options: [], explanation: [] };
const check = (output: StructureOutput, lineCount = 7) =>
  structureLesson.check({ lineCount }, output);

describe('lesson D6.1: the check (M34 P4b)', () => {
  it('accepts a whole question and a plain no', () => {
    expect(check(yes())).toBeNull();
    expect(check(no)).toBeNull();
  });

  it('rejects line numbers outside the picture', () => {
    expect(check(yes({ explanation: [8] }))).toBe('line 8 does not exist (lines are 1…7)');
    expect(check(yes({ stem: [0] }))).toContain('line 0 does not exist');
  });

  it('rejects a question without a stem or with fewer than two options', () => {
    expect(check(yes({ stem: [] }))).toBe('a question needs at least one stem line');
    expect(check(yes({ options: [3] }))).toBe('a question needs at least two option starts');
  });

  it('rejects options out of order, a stem after the options, and a line used twice', () => {
    expect(check(yes({ options: [4, 3] }))).toBe('option starts must be in increasing order');
    expect(check(yes({ stem: [1, 5], options: [3, 6] }))).toBe(
      'stem lines must come before the first option',
    );
    expect(check(yes({ explanation: [6] }))).toBe('line 6 is given twice; each line has one role');
  });

  it('rejects a "no" that still points at lines', () => {
    expect(check({ ...no, stem: [1] })).toContain('must be empty');
  });

  it('asks for line numbers only and shows the lines numbered', () => {
    const prompt = buildPrompt(structureLesson, { count: 1, texts: [numberedLines(LINES)] });
    expect(prompt.text).toContain('Give line numbers only, never text');
    expect(prompt.text).toContain('1: 12. Which synthetic drug is first-line');
    expect(structureLesson).toMatchObject({ id: 'D6.1', reviewReason: 'structure_unclear' });
  });
});

describe('lesson D6.1: building the question by code (M34 P4b)', () => {
  it('copies the stem, options and explanation verbatim from the pointed lines', () => {
    expect(buildStructure(LINES, yes())).toEqual({
      number: 12,
      stem: 'Which synthetic drug is first-line for condition X?',
      options: [
        { letter: 'A', label: 'A', text: 'Drug one' },
        { letter: 'B', label: 'B', text: 'Drug two that wraps onto a second line' },
        { letter: 'C', label: 'C', text: 'Drug three' },
      ],
      explanation: 'Answer: B',
      explanationLines: ['Answer: B'],
    });
  });

  it('gives positional letters when the printed labels do not run in sequence', () => {
    const boxes = synthetic(['Pick one', '□Drug one', 'C)Drug two', '■Drug three']);
    const built = buildStructure(boxes, yes({ stem: [1], options: [2, 3, 4], explanation: [] }));
    expect(built?.options).toEqual([
      { letter: 'A', label: 'A', text: '□Drug one' },
      { letter: 'B', label: 'B', text: 'C)Drug two' },
      { letter: 'C', label: 'C', text: '■Drug three' },
    ]);
    expect(built).toMatchObject({ number: null, stem: 'Pick one', explanation: null });
  });

  it('stops the last option at the first explanation line', () => {
    const built = buildStructure(LINES, yes({ options: [3, 4], explanation: [6, 7] }));
    expect(built?.options[1]?.text).toBe('Drug two that wraps onto a second line');
    expect(built?.explanation).toBe('C. Drug three Answer: B');
  });

  it('builds nothing for a "no"', () => {
    expect(buildStructure(LINES, no)).toBeNull();
  });
});
