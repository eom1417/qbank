import { describe, expect, it } from 'vitest';
import type {
  FileLines,
  Line,
  LineRole,
} from '../../../../src/server/capabilities/sources/detection/contract.js';
import { classifyLines } from '../../../../src/server/capabilities/sources/detection/roles/classify-lines.js';
import type { PageWord } from '../../../../src/server/capabilities/sources/domain/page.js';

// M39 step 3 with synthetic lines: one role per line, from general rules and the file's spacing.

interface Spec {
  text: string;
  y: number;
  page?: number;
  x?: number;
  note?: boolean;
  /** Read by OCR in a picture (a pasted screenshot); the pictures' unit. */
  picture?: string;
  /** A table row: the first word alone, then the cells `cellGap` points further on. */
  cellGap?: number;
}

const at = (text: string, y: number, more: Omit<Spec, 'text' | 'y'> = {}): Spec => ({
  text,
  y,
  ...more,
});

function wordsOf(spec: Spec, scale: number): PageWord[] {
  const x = (spec.x ?? 36) * scale;
  const [y0, y1] = [spec.y * scale, (spec.y + 12) * scale];
  let left = x;
  return spec.text.split(' ').map((text, index) => {
    if (index === 1 && spec.cellGap) left += spec.cellGap * scale;
    const box = { x0: left, y0, x1: left + 25 * scale, y1 };
    left += 30 * scale;
    return { text, box, font: null };
  });
}

/** A file of `specs` in reading order; every distance (and the layout) times `scale`. */
function fileOf(specs: Spec[], scale = 1): FileLines {
  const lines: Line[] = specs.map((spec, id) => {
    const words = wordsOf(spec, scale);
    const box = {
      x0: words[0]?.box.x0 ?? 0,
      y0: spec.y * scale,
      x1: (words.at(-1)?.box.x1 ?? 0) + 0,
      y1: (spec.y + 12) * scale,
    };
    const unitId = spec.picture ?? `u${id}`;
    const base = { id, page: spec.page ?? 1, box, text: spec.text, words, unitId };
    const source = spec.picture ? ('picture' as const) : ('text' as const);
    const rest = { rtl: false, source, confidence: null };
    return { ...base, ...rest, deviceNote: spec.note ?? false };
  });
  const pageCount = Math.max(1, ...lines.map((line) => line.page));
  const pages = Array.from({ length: pageCount }, (_, index) => ({
    page: index + 1,
    width: 612 * scale,
    height: 792 * scale,
    words: [],
  }));
  const margins = new Map(pages.map((page) => [page.page, 36 * scale]));
  const layout = { lineHeight: 12 * scale, lineGap: 2 * scale, paragraphGap: 36 * scale, margins };
  return { lines, units: new Map() as never, pages, layout };
}

const rolesOf = (roles: LineRole[]) => roles.map((role) => role.role);
const doubts = (roles: LineRole[]) =>
  roles.filter((role) => role.confidence < 0.5).map((role) => role.line);

const bankBook = [
  at('Question: 5', 100),
  at('Which mutation is the MOST likely cause?', 148),
  at('A.ABCG5 mutation', 196),
  at('B.PCSK9 mutation', 210),
  at('Correct Answer: A', 224),
  at('Plant sterols are absorbed in two steps:', 238),
  at('1. LDL receptor is not synthesized', 252),
  at('2. LDL receptor is not transported', 266),
  at('Question: 6', 300),
  at('A boy has a cough.', 348),
];

describe('a bank book: label, stem, options, answer, explanation', () => {
  it('gives every line one role, in order, with the label number and option letters', () => {
    const roles = classifyLines(fileOf(bankBook));
    expect(roles.map((role) => role.line)).toEqual(bankBook.map((_, id) => id));
    expect(rolesOf(roles)).toEqual([
      'label',
      'stem',
      'option',
      'option',
      'answer',
      'explanation',
      'explanation',
      'explanation',
      'label',
      'stem',
    ]);
    expect([roles[0]?.number, roles[8]?.number]).toEqual([5, 6]);
    expect([roles[2]?.letter, roles[3]?.letter]).toEqual(['A', 'B']);
    expect(roles[4]?.letters).toEqual(['A']);
    expect(doubts(roles)).toEqual([]);
  });

  it('reads a bare number inside an explanation as a label only when it is the next one', () => {
    const roles = classifyLines(
      fileOf([...bankBook.slice(0, 7), at('6. A girl has a fever.', 300), at('A. rest', 314)]),
    );
    expect(rolesOf(roles).slice(6)).toEqual(['explanation', 'label', 'option']);
    expect(roles[7]?.number).toBe(6);
  });

  it('measures from the file: the same page at twice the size reads the same', () => {
    const small = classifyLines(fileOf(bankBook));
    const large = classifyLines(fileOf(bankBook, 2));
    expect(rolesOf(large)).toEqual(rolesOf(small));
  });

  it('keeps an option wrapped onto the next line in its option', () => {
    const roles = classifyLines(
      fileOf([at('1. Which drug?', 100), at('A. aspirin given', 114), at('daily', 128)]),
    );
    expect(roles.map((role) => [role.role, role.letter])).toEqual([
      ['label', undefined],
      ['option', 'A'],
      ['option', 'A'],
    ]);
  });
});

describe('option letters continue the sequence', () => {
  it('takes a letter one out of turn as the next option (one was lost), and flags it', () => {
    const roles = classifyLines(
      fileOf([at('1. Which drug?', 100), at('A. aspirin', 114), at('C. heparin', 128)]),
    );
    expect([roles[2]?.role, roles[2]?.letter]).toEqual(['option', 'B']);
    expect(doubts(roles)).toEqual([2]);
  });

  it('does not take a letter two out of turn as an option, and flags it', () => {
    const roles = classifyLines(
      fileOf([at('1. Which drug?', 100), at('A. aspirin', 114), at('D. heparin', 128)]),
    );
    expect(roles[2]?.role).not.toBe('option');
    expect(doubts(roles)).toEqual([2]);
  });

  it('reads a table row that starts with the next letter alone as that option', () => {
    const roles = classifyLines(
      fileOf([
        at('Question: 1', 100),
        at('Of the following, the MOST likely profile is', 148),
        at('Response Choice Glucose Cholesterol', 196),
        at('A 95 (5.3) 200 (5.2)', 210, { cellGap: 70 }),
        at('B 105 (5.8) 150 (3.9)', 224, { cellGap: 70 }),
        at('C 3-year-old girl is not a row', 268),
      ]),
    );
    expect(roles.map((role) => role.letter ?? role.role)).toEqual([
      'label',
      'stem',
      'stem',
      'A',
      'B',
      'explanation',
    ]);
  });
});

describe('questions the book printed with no label', () => {
  it('starts one at the text before "A." inside an explanation, with no printed number', () => {
    const roles = classifyLines(
      fileOf([
        at('Question: 4', 100),
        at('Which finding is MOST likely?', 148),
        at('A.low calcium', 196),
        at('B.high thyrotropin', 210),
        at('Correct Answer: B', 224),
        at('Thyroid disease is the most common.', 238),
        at('A student presents a patient on the wards.', 40, { page: 2 }),
        at('Of the following, the BEST next step is to', 54, { page: 2 }),
        at('A.discuss concerns with the director', 68, { page: 2 }),
        at('B.model the presentation', 82, { page: 2 }),
        at('Correct Answer: B', 96, { page: 2 }),
      ]),
    );
    expect(rolesOf(roles).slice(5)).toEqual([
      'explanation',
      'label',
      'stem',
      'option',
      'option',
      'answer',
    ]);
    expect([roles[6]?.number, roles[6]?.confidence]).toEqual([undefined, 0.4]);
  });

  it('starts one at a second full set of options after the first', () => {
    const roles = classifyLines(
      fileOf([
        at('7. Which drug?', 100),
        at('A. aspirin', 114),
        at('B. heparin', 128),
        at('A boy has a rash. Which test?', 176),
        at('A. biopsy', 190),
        at('B. culture', 204),
      ]),
    );
    expect(rolesOf(roles)).toEqual(['label', 'option', 'option', 'label', 'option', 'option']);
    expect([roles[3]?.number, roles[3]?.confidence]).toEqual([undefined, 0.4]);
  });
});

describe('lines that are not part of a question', () => {
  it('reads running lines, device notes, tags, headings and answer keys', () => {
    const roles = classifyLines(
      fileOf([
        at('Cardiology Review', 10, { page: 1 }),
        at('Heart Murmurs (2 Questions)', 60, { page: 1 }),
        at('1. Which murmur?', 100, { page: 1 }),
        at('Part II 2019', 114, { page: 1 }),
        at('my own reminder', 128, { page: 1, note: true }),
        at('A. systolic', 142, { page: 1 }),
        at('Cardiology Review', 10, { page: 2 }),
        at('Answer key', 100, { page: 2 }),
        at('1. A 2-C', 114, { page: 2 }),
        at('Cardiology Review', 10, { page: 3 }),
      ]),
    );
    expect(rolesOf(roles)).toEqual([
      'filler',
      'heading',
      'label',
      'tag',
      'note',
      'option',
      'filler',
      'key_table',
      'key_table',
      'filler',
    ]);
    expect(roles[8]?.entries).toEqual([
      { number: 1, letters: ['A'] },
      { number: 2, letters: ['C'] },
    ]);
  });
});

describe('answers in doubt and shared cases', () => {
  it('marks a key its writer left in doubt as an answer to check', () => {
    const roles = classifyLines(
      fileOf([at('1. Which drug?', 100), at('A. aspirin', 114), at('Answer: D?', 128)]),
    );
    expect(roles[2]).toMatchObject({ role: 'answer', letters: [] });
    expect(doubts(roles)).toEqual([2]);
  });

  it('reads a block before two questions that refer to it as their case', () => {
    const roles = classifyLines(
      fileOf([
        at('Read the following case for questions 3-4.', 100),
        at('A man of 60 has chest pain.', 114),
        at('3. What is the diagnosis for this patient?', 160),
        at('A. angina', 174),
        at('B. reflux', 188),
        at('4. What should this patient take?', 230),
        at('A. aspirin', 244),
        at('B. antacid', 258),
      ]),
    );
    expect(rolesOf(roles).slice(0, 3)).toEqual(['case', 'case', 'label']);
  });
});

// A screenshot of another bank pasted under a typed question is its explanation (M34 D6.1).
describe('questions read in pictures', () => {
  const typed = [
    at('Q1) Which drug is first line?', 100),
    at('A. aspirin', 114),
    at('B. heparin', 128),
    at('Answer: B', 142),
  ];
  const screenshot = (page: number) => [
    at('A boy of six has a fever. Which test is first?', 40, { page, picture: 'p' }),
    at('A. blood count', 54, { page, picture: 'p' }),
    at('B. chest film', 68, { page, picture: 'p' }),
  ];

  it('reads an unlabelled picture question near a typed one as its explanation', () => {
    const roles = classifyLines(fileOf([...typed, ...screenshot(2)]));
    expect(rolesOf(roles).slice(4)).toEqual(['explanation', 'explanation', 'explanation']);
  });

  it('keeps picture questions in a file whose questions are all pictures', () => {
    const roles = classifyLines(fileOf([...screenshot(1)]));
    expect(rolesOf(roles)).toEqual(['label', 'option', 'option']);
  });
});

// Option letters as OCR and hurried typing leave them, and options a reading lost.
describe('options read with their letter damaged or lost', () => {
  const letters = (roles: LineRole[]) => roles.map((role) => role.letter ?? '-').join('');

  it('takes the next letter with no dot, or with a comma, as the next option', () => {
    const roles = classifyLines(
      fileOf([
        at('Q4) What should he do next?', 100),
        at('A. Stop resuscitation', 114),
        at('B Call the consultant', 128),
        at('C. Give epinephrine', 142),
        at('D, Give steroid', 156),
      ]),
    );
    expect(rolesOf(roles)).toEqual(['label', 'option', 'option', 'option', 'option']);
    expect(letters(roles)).toEqual('-ABCD');
  });

  it('never reads a stem sentence starting with a capital letter as an option', () => {
    const roles = classifyLines(
      fileOf([at('Q4) Which is true?', 100), at('A 15-year-old girl has a rash.', 114)]),
    );
    expect(rolesOf(roles)).toEqual(['label', 'stem']);
  });

  it('reads options whose first letter was lost, in their order', () => {
    const roles = classifyLines(
      fileOf([
        at('Q21) What would you do next?', 100),
        at('B. CT abdomen', 114),
        at('C. Surgery', 128),
      ]),
    );
    expect(rolesOf(roles)).toEqual(['label', 'option', 'option']);
    expect(letters(roles)).toEqual('-AB');
  });

  it('recovers an option whose letter was lost from the line before the next letter', () => {
    const roles = classifyLines(
      fileOf([
        at('Q2) Which salt?', 100),
        at('A. sodium', 114),
        at('B. potassium', 128),
        at('yperkalemia', 142),
        at('D. calcium', 156),
      ]),
    );
    expect(letters(roles)).toEqual('-ABCD');
  });
});

// A label is the start of a new question only when it can be one.
describe('labels that do not start a question', () => {
  it('reads "Q0)" (no question is numbered 0) as text', () => {
    const roles = classifyLines(fileOf([at('Q0) TABLE 3. Topical steroids', 100)]));
    expect(rolesOf(roles)).not.toContain('label');
  });

  it('reads the number of the question being read, printed again before its options, as stem', () => {
    const roles = classifyLines(
      fileOf([
        at('Question 184', 100),
        at('A boy has ear pain and fever.', 114),
        at('Q184) The rest of the examination is normal.', 128),
        at('A. amoxicillin', 142),
        at('B. cefdinir', 156),
      ]),
    );
    expect(rolesOf(roles)).toEqual(['label', 'stem', 'stem', 'option', 'option']);
  });
});

it('keeps a sequential numbered explanation list inside its answer', () => {
  const roles = classifyLines(
    fileOf([
      at('1. Which mechanism?', 100),
      at('A. transport', 114),
      at('B. synthesis', 128),
      at('Answer: A', 142),
      at('Explanation: mechanisms include:', 156),
      at('1. Receptor production fails.', 170),
      at('2. Receptor transport fails.', 184),
      at('3. Receptor binding fails.', 198),
      at('2. Which treatment?', 240),
      at('A. replacement', 254),
      at('B. observation', 268),
    ]),
  );
  expect(rolesOf(roles).slice(5)).toEqual([
    'explanation',
    'explanation',
    'explanation',
    'label',
    'option',
    'option',
  ]);
});
