import { describe, expect, it } from 'vitest';
import type { Raster } from '../../../../src/server/capabilities/sources/domain/answer-marks.js';
import type { Box } from '../../../../src/server/capabilities/sources/domain/page.js';
import { familyOf } from '../../../../src/server/capabilities/sources/domain/pipeline/family.js';
import type { Unit } from '../../../../src/server/capabilities/sources/domain/pipeline/units.js';
import type {
  DraftQuestion,
  FileLines,
  Line,
  LineRole,
  Role,
} from '../../../../src/server/capabilities/sources/detection/contract.js';
import {
  attachMedia,
  type MediaRender,
} from '../../../../src/server/capabilities/sources/detection/link/media.js';
import { paint } from '../../../support/pipeline-fixtures.js';

// Synthetic pages only: lines and pictures stacked down one 600×800 page, pages drawn by fakes.

type Row =
  | { text: string; role: Role; letter?: string }
  | { image: string; height: number; cls: Unit['imageClass']; read?: Role[] };

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 });
const LINE = 10;
const GAP = 10;

function unit(id: string, b: Box, kind: Unit['kind'], cls: Unit['imageClass'], words = 0): Unit {
  const ocr = kind === 'image' ? { words, confidence: 90 } : null;
  const source = kind === 'image' ? 'image' : 'text_layer';
  return {
    id,
    page: 1,
    box: b,
    kind,
    text: null,
    ocr,
    imageClass: cls,
    fingerprint: null,
    order: 0,
    filler: null,
    source,
  };
}

function line(id: number, unitId: string, text: string, b: Box, picture: boolean): Line {
  const first = text.split(' ')[0] ?? '';
  const words = [{ text: first, box: box(b.x0, b.y0, b.x0 + 12, b.y1), font: null }];
  return {
    id,
    page: 1,
    box: b,
    text,
    words,
    source: picture ? 'picture' : 'text',
    unitId,
    rtl: false,
    confidence: picture ? 90 : null,
    deviceNote: false,
  };
}

/** A page from rows, top to bottom: its file lines, units and roles. */
function page(rows: Row[]): { file: FileLines; roles: LineRole[] } {
  const units: Unit[] = [];
  const lines: Line[] = [];
  const roles: LineRole[] = [];
  let y = 60;
  for (const row of rows) {
    if ('text' in row) {
      const b = box(40, y, 300, y + LINE);
      units.push(unit(`t${lines.length}`, b, 'text_line', null));
      lines.push(line(lines.length, `t${lines.length}`, row.text, b, false));
      roles.push({ line: lines.length - 1, role: row.role, confidence: 1 });
      y += LINE + GAP;
      continue;
    }
    const b = box(60, y, 260, y + row.height);
    units.push(unit(row.image, b, 'image', row.cls, (row.read?.length ?? 0) * 4));
    (row.read ?? []).forEach((role, i) => {
      const at = box(60, y + i * 12, 260, y + i * 12 + LINE);
      lines.push(line(lines.length, row.image, `read line ${i}`, at, true));
      roles.push({ line: lines.length - 1, role, confidence: 1 });
    });
    y += row.height + GAP;
  }
  const ordered = units.map((u, order) => ({ ...u, order }));
  const size = { page: 1, width: 600, height: 800 };
  const file: FileLines = {
    lines,
    units: { pages: [{ size, scanned: false, units: ordered }], family: familyOf([size], ordered) },
    pages: [{ page: 1, width: 600, height: 800, words: lines.flatMap((l) => l.words) }],
    layout: { lineHeight: LINE, lineGap: GAP, paragraphGap: GAP * 2, margins: new Map() },
  };
  return { file, roles };
}

/** A draft question from its lines: label, stem, options A… and an inline answer. */
function draft(number: number, label: number, stem: number[], options: number[][]): DraftQuestion {
  return {
    number,
    numberInferred: false,
    labelLine: label,
    stem,
    options: options.map((lines, i) => {
      const letter = String.fromCharCode(65 + i);
      return { letter, label: letter, lines };
    }),
    answer: null,
    conflicts: [],
    explanation: [],
    caseLines: [],
    pictures: [],
    tags: { exam: null, year: null },
  };
}

const white = (width: number, height: number): Raster => ({
  width,
  height,
  scale: 1,
  pixels: new Uint8Array(width * height).fill(255),
});

/** Pages drawn white (grey at 72 dpi), with dark ink in `inked` boxes; colour all white. */
function fakeRender(inked: Box[] = [], colourInk: Box[] = []): MediaRender {
  return {
    grey: async () => {
      const raster = white(600, 800);
      for (const b of inked)
        for (let y = b.y0; y < b.y1; y++) raster.pixels.fill(0, y * 600 + b.x0, y * 600 + b.x1);
      return raster;
    },
    colour: async (_file, _page, dpi) => {
      const s = dpi / 72;
      const inside = (x: number, y: number) =>
        colourInk.some((b) => x >= b.x0 * s && x < b.x1 * s && y >= b.y0 * s && y < b.y1 * s);
      return paint(Math.round(600 * s), Math.round(800 * s), (x, y) =>
        inside(x, y) ? [200, 20, 20] : [255, 255, 255],
      );
    },
  };
}

const failing: MediaRender = {
  grey: () => Promise.reject(new Error('no renderer')),
  colour: () => Promise.reject(new Error('no renderer')),
};

/** Q1: label, stem, figure, A, B, figure, C, answer, figure; then Q2 with A, B. */
const twoQuestions: Row[] = [
  { text: '1.', role: 'label' },
  { text: 'Which one is right?', role: 'stem' },
  { image: 'fig-stem', height: 60, cls: 'figure' },
  { text: 'A. one', role: 'option', letter: 'A' },
  { text: 'B. two', role: 'option', letter: 'B' },
  { image: 'fig-b', height: 40, cls: 'figure' },
  { text: 'C. three', role: 'option', letter: 'C' },
  { text: 'Answer: C', role: 'answer' },
  { image: 'fig-after', height: 60, cls: 'figure' },
  { text: '2.', role: 'label' },
  { text: 'And this one?', role: 'stem' },
  { text: 'A. yes', role: 'option' },
  { text: 'B. no', role: 'option' },
];

function twoDrafts(answer: string[] | null = null): DraftQuestion[] {
  const first = draft(1, 0, [1], [[2], [3], [4]]);
  const second = draft(2, 6, [7], [[8], [9]]);
  if (answer) first.answer = { letters: answer, lines: [5], from: 'inline' };
  return [first, second];
}

describe('attachMedia: pictures', () => {
  it('places pictures with the question, an option, or after the reveal', async () => {
    const { file, roles } = page(twoQuestions);
    const [q1, q2] = await attachMedia('x.pdf', file, roles, twoDrafts(), fakeRender());
    const places = q1?.pictures.map((p) => [p.unitId, p.placement, p.optionLetter]);
    expect(places).toEqual([
      ['fig-stem', 'question', null],
      ['fig-b', 'option', 'B'],
      ['fig-after', 'explanation', null],
    ]);
    expect(q2?.pictures).toEqual([]);
  });

  it('leaves a picture whose words a question read as text out of its pictures', async () => {
    const { file, roles } = page([
      { text: '1.', role: 'label' },
      { image: 'words', height: 30, cls: 'text_picture', read: ['stem', 'stem'] },
      { text: 'A. one', role: 'option' },
      { text: 'B. two', role: 'option' },
    ]);
    const [q] = await attachMedia('x.pdf', file, roles, [draft(1, 0, [1, 2], [[3], [4]])]);
    expect(q?.pictures).toEqual([]);
  });

  it('does not change the questions it was given', async () => {
    const { file, roles } = page(twoQuestions);
    const given = twoDrafts();
    await attachMedia('x.pdf', file, roles, given, fakeRender());
    expect(given[0]?.pictures).toEqual([]);
  });
});

describe('attachMedia: cases and tags', () => {
  const rows: Row[] = [
    { text: 'The following case refers to questions 1-2:', role: 'case' },
    { text: 'A man of 50 has chest pain.', role: 'unknown' },
    { image: 'case-fig', height: 40, cls: 'figure' },
    { text: '1.', role: 'label' },
    { text: 'What is the diagnosis?', role: 'stem' },
    { text: 'Part II 2019', role: 'tag' },
    { text: '2.', role: 'label' },
    { text: 'What is the treatment?', role: 'stem' },
  ];

  it('shares a case block and its picture with each question it covers', async () => {
    const { file, roles } = page(rows);
    const drafts = [draft(1, 2, [3], []), draft(2, 5, [6], [])];
    const [q1, q2] = await attachMedia('x.pdf', file, roles, drafts, fakeRender());
    expect(q1?.caseLines).toEqual([0, 1]);
    expect(q2?.caseLines).toEqual([0, 1]);
    expect(q1?.pictures.map((p) => [p.unitId, p.placement])).toEqual([['case-fig', 'case']]);
    expect(q2?.pictures.map((p) => [p.unitId, p.placement])).toEqual([['case-fig', 'case']]);
  });

  it('reads exam tags from tag lines into the question before them only', async () => {
    const { file, roles } = page(rows);
    const drafts = [draft(1, 2, [3], []), draft(2, 5, [6], [])];
    const [q1, q2] = await attachMedia('x.pdf', file, roles, drafts, fakeRender());
    expect(q1?.tags).toEqual({ exam: 'Part II', year: '2019' });
    expect(q2?.tags).toEqual({ exam: null, year: null });
  });
});

describe('attachMedia: matching sets and plain blocks', () => {
  it("gives a matching set's one option list to the members printed without one", async () => {
    const { file, roles } = page([
      { text: 'Match questions 1-2 with the following:', role: 'case' },
      { text: '1.', role: 'label' },
      { text: 'This patient has fever', role: 'stem' },
      { text: '2.', role: 'label' },
      { text: 'This patient has cough', role: 'stem' },
      { text: 'A. one', role: 'option' },
      { text: 'B. two', role: 'option' },
    ]);
    const drafts = [draft(1, 1, [2], []), draft(2, 3, [4], [[5], [6]])];
    const [q1, q2] = await attachMedia('x.pdf', file, roles, drafts, fakeRender());
    expect(q1?.caseLines).toEqual([0]);
    expect(q1?.options).toEqual(q2?.options);
  });

  it('keeps a block with no case cue out of the questions', async () => {
    const { file, roles } = page([
      { text: 'Some heading words', role: 'unknown' },
      { text: '1.', role: 'label' },
      { text: 'Q?', role: 'stem' },
    ]);
    const [q] = await attachMedia('x.pdf', file, roles, [draft(1, 1, [2], [])], fakeRender());
    expect(q?.caseLines).toEqual([]);
  });
});

/** A dark ring just left of the letter on line `lineId`. */
const ringAt = (file: FileLines, lineId: number): Box => {
  const b = file.lines[lineId]?.box ?? box(0, 0, 0, 0);
  return box(b.x0 - 8, b.y0 - 3, b.x0 - 2, b.y1 + 3);
};

describe('attachMedia: pen marks', () => {
  it('takes a pen mark at a letter as the answer when none is printed', async () => {
    const { file, roles } = page(twoQuestions);
    const [q1, q2] = await attachMedia(
      'x.pdf',
      file,
      roles,
      twoDrafts(),
      fakeRender([ringAt(file, 4)]),
    );
    expect(q1?.answer).toEqual({ letters: ['C'], lines: [], from: 'pen_mark' });
    expect(q1?.conflicts).toEqual([]);
    expect(q2?.answer).toBeNull();
  });

  it('records a conflict when the pen names another letter than the printed answer', async () => {
    const { file, roles } = page(twoQuestions);
    const render = fakeRender([ringAt(file, 2)]);
    const [q1] = await attachMedia('x.pdf', file, roles, twoDrafts(['C']), render);
    expect(q1?.answer).toEqual({ letters: ['C'], lines: [5], from: 'inline' });
    expect(q1?.conflicts).toEqual(['key_conflict']);
  });

  it('keeps an agreeing printed answer without a conflict', async () => {
    const { file, roles } = page(twoQuestions);
    const render = fakeRender([ringAt(file, 4)]);
    const [q1] = await attachMedia('x.pdf', file, roles, twoDrafts(['C']), render);
    expect(q1?.conflicts).toEqual([]);
  });

  it('decides nothing when no letter stands out or the page cannot be drawn', async () => {
    const { file, roles } = page(twoQuestions);
    const [clean] = await attachMedia('x.pdf', file, roles, twoDrafts(), fakeRender());
    expect(clean?.answer).toBeNull();
    const [failed] = await attachMedia('x.pdf', file, roles, twoDrafts(), failing);
    expect(failed?.answer).toBeNull();
    expect(failed?.pictures).toHaveLength(3);
  });
});

describe('attachMedia: handwritten notes', () => {
  it('turns coloured ink in a question zone into a hidden explanation picture', async () => {
    const { file, roles } = page(twoQuestions);
    const render = fakeRender([], [box(400, 200, 480, 240)]);
    const [q1, q2] = await attachMedia('x.pdf', file, roles, twoDrafts(), render);
    const notes = q1?.pictures.filter((p) => p.imageClass === 'handwriting_ink');
    expect(notes?.map((p) => [p.unitId, p.placement])).toEqual([['ink:1:0', 'explanation']]);
    expect(q2?.pictures).toEqual([]);
  });
});
