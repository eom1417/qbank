import { expect, it } from 'vitest';
import type {
  FileLines,
  Line,
} from '../../../../src/server/capabilities/sources/detection/contract.js';
import { classifyLines } from '../../../../src/server/capabilities/sources/detection/roles/classify-lines.js';

function pictured(blocks: string[][]): FileLines {
  const lines: Line[] = [];
  for (const [block, texts] of blocks.entries()) {
    for (const text of texts) {
      const id = lines.length;
      const box = { x0: 40, x1: 500, y0: 100 + id * 16, y1: 112 + id * 16 };
      const words = text.split(' ').map((word, index) => ({
        text: word,
        box: { ...box, x0: 40 + index * 25, x1: 60 + index * 25 },
        font: null,
      }));
      lines.push({
        id,
        text,
        box,
        words,
        page: 1,
        unitId: `image${block}`,
        source: 'picture',
        confidence: 95,
        deviceNote: false,
        rtl: false,
      });
    }
  }
  return {
    lines,
    units: new Map() as never,
    pages: [{ page: 1, width: 600, height: 800, words: [] }],
    layout: { lineHeight: 12, lineGap: 4, paragraphGap: 50, margins: new Map([[1, 40]]) },
  };
}

it('starts an unnumbered question inside its own image without swallowing a preceding excerpt', () => {
  const file = pictured([
    ['Q1) Which drug?', 'A. first drug', 'B. second drug', 'Answer: B'],
    ['An unrelated paragraph describes the properties of a compound.'],
    ['A new patient has a fever. Which test?', 'A. culture', 'B. scan'],
  ]);
  expect(classifyLines(file).map(({ role }) => role)).toEqual([
    'label',
    'option',
    'option',
    'answer',
    'explanation',
    'label',
    'option',
    'option',
  ]);
});

it('opens a new option set in a new image after an unfinished previous stem', () => {
  const file = pictured([
    ['Q1) This first question has no visible options.'],
    ['The next question has lost its number. Which treatment?', 'A. hydration', 'B. observation'],
  ]);
  expect(classifyLines(file).map(({ role }) => role)).toEqual([
    'label',
    'label',
    'option',
    'option',
  ]);
});

it('recognizes an essay prompt with independent printed numbering after another question', () => {
  const file = pictured([
    ['Q5) Which medicine?', 'A. first', 'B. second', 'Answer: B'],
    ['123. Which laboratory test evaluates immunity?', 'Measure antibody levels.'],
    ['124. Why does the condition vary?', 'The clinical features differ between patients.'],
  ]);
  expect(classifyLines(file).map(({ role }) => role)).toEqual([
    'label',
    'option',
    'option',
    'answer',
    'label',
    'stem',
    'label',
    'stem',
  ]);
});

it('starts standalone unnumbered essay prompts in separate images', () => {
  const file = pictured([
    ['Q5) Which medicine?', 'A. first', 'B. second', 'Answer: B'],
    ['What condition produces this finding?', 'This is a benign disorder of the skin.'],
    [
      'A new child presents with a rash.',
      'Which diagnosis explains the findings?',
      'A. allergy',
      'B. infection',
    ],
  ]);
  const roles = classifyLines(file);
  expect(roles.map(({ role }) => role)).toEqual([
    'label',
    'option',
    'option',
    'answer',
    'label',
    'stem',
    'label',
    'stem',
    'option',
    'option',
  ]);
  expect(roles[4]?.confidence).toBeLessThan(0.5);
});

it('recovers a lost option label at the preceding option body indent', () => {
  const file = pictured([
    ['Q2) Which electrolyte?', 'A. sodium', 'B. potassium', 'yperkalemia', 'D. calcium'],
  ]);
  const lost = file.lines[3];
  if (!lost) throw new Error('Missing synthetic option');
  lost.box.x0 = 70;
  lost.words = lost.words.map((word) => ({ ...word, box: { ...word.box, x0: 70, x1: 130 } }));
  expect(classifyLines(file).map(({ role, letter }) => letter ?? role)).toEqual([
    'label',
    'A',
    'B',
    'C',
    'D',
  ]);
});

it('keeps numbered rhetorical questions inside a printed explanation list', () => {
  const file = pictured([
    [
      'Q5) Which medicine?',
      'A. first',
      'B. second',
      'Answer: B',
      '1. Is it desirable?',
      '2. Is it feasible?',
      '3. Is it sustainable?',
    ],
  ]);
  for (const line of file.lines) {
    line.source = 'text';
    line.unitId = `text${line.id}`;
  }
  expect(
    classifyLines(file)
      .slice(4)
      .map(({ role }) => role),
  ).toEqual(['explanation', 'explanation', 'explanation']);
});

it('keeps OCR letters that repeat inside one option set in positional order and in doubt', () => {
  const file = pictured([
    ['Q82) Which finding?', 'a) first', 'b) second', 'A. third', 'B. fourth', 'e) fifth'],
  ]);
  const roles = classifyLines(file);
  expect(roles.map(({ role, letter }) => letter ?? role)).toEqual([
    'label',
    'A',
    'B',
    'C',
    'D',
    'E',
  ]);
  expect(roles[3]?.confidence).toBeLessThan(0.5);
  expect(roles[4]?.confidence).toBeLessThan(0.5);
});

it('does not extend a typed option set with letter-like words inside an explanation picture', () => {
  const file = pictured([
    ['Q1) Which medicine?', 'A. first', 'B. second'],
    ['c. This is explanatory prose.', 'd. Further explanatory prose.'],
  ]);
  for (const line of file.lines.slice(0, 3)) line.source = 'text';
  expect(
    classifyLines(file)
      .slice(3)
      .some(({ role }) => role === 'option'),
  ).toBe(false);
});

it('does not turn alphabetic textbook subsections into an unnumbered question', () => {
  const file = pictured([
    ['Q5) Which medicine?', 'A. first', 'B. second', 'Answer: B'],
    [
      'Pharmacotherapy',
      'A. This section describes the first treatment.',
      'B. This section describes another treatment.',
    ],
  ]);
  expect(
    classifyLines(file)
      .slice(4)
      .some(({ role }) => role === 'label'),
  ).toBe(false);
});

it('recognizes an unnumbered prompt with an Arabic question mark', () => {
  const file = pictured([['ما التشخيص الأرجح لهذا الطفل؟', 'هذه إجابة مكتوبة بعد السؤال.']]);
  expect(classifyLines(file).map(({ role }) => role)).toEqual(['label', 'stem']);
});
