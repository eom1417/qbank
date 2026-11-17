import { describe, expect, it } from 'vitest';
import type { Box } from '../../../src/server/capabilities/sources/domain/page.js';
import {
  inkNotes,
  joinNear,
  noteZones,
  ownerAt,
  placeIn,
  placePictures,
  stemPointsToPicture,
  type QuestionFrame,
} from '../../../src/server/capabilities/sources/domain/pipeline/placement.js';
import type { Unit } from '../../../src/server/capabilities/sources/domain/pipeline/units.js';
import type { VirtualText } from '../../../src/server/capabilities/sources/domain/pipeline/virtual-text.js';
import { paint } from '../../support/pipeline-fixtures.js';

// Synthetic frames and pictures only (D3.1, D3.2): no owner file content.
const at = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 });

/** A question whose stem is line `stemAt`, options the next lines, rows 20 points apart. */
function frame(stemAt: number, options: number, stem = 'Which one is right?'): QuestionFrame {
  const row = (index: number) => at(40, 100 + index * 20, 200, 110 + index * 20);
  const letters = Array.from({ length: options }, (_, i) => ({
    letter: String.fromCharCode(65 + i),
    at: stemAt + 1 + i,
    page: 1,
    box: row(stemAt + 1 + i),
  }));
  const spans = [stemAt, ...letters.map((o) => o.at)].map((i) => ({ page: 1, box: row(i) }));
  return { number: stemAt + 1, stem, stemAt, endAt: stemAt + options, options: letters, spans };
}

const image = (id: string, box: Box, imageClass: Unit['imageClass']): Unit => ({
  id,
  page: 1,
  box,
  kind: 'image',
  text: null,
  ocr: null,
  imageClass,
  fingerprint: null,
  order: 0,
  filler: null,
  source: 'image',
});

const spot = (position: number, firstAfter = true, beside = false) => ({
  at: position,
  beside,
  firstAfter,
});

describe('placement in a question (D3.1)', () => {
  const question = frame(0, 3);
  const figure = image('fig', at(40, 300, 200, 400), 'figure');

  it('places a picture before the first option with the question', () => {
    expect(placeIn(question, figure, spot(0.5)).placement).toBe('question');
  });

  it('places a picture between options with the option on its row, or the one above', () => {
    const onB = image('b', at(40, 140, 80, 150), 'figure');
    expect(placeIn(question, onB, spot(2.5))).toEqual({ placement: 'option', optionLetter: 'B' });
    expect(placeIn(question, figure, spot(2.5)).optionLetter).toBe('B');
  });

  it('hides a picture lying over the rows of two options (a pasted note) and holds it for review', () => {
    const over = image('note', at(40, 135, 200, 175), 'handwriting');
    expect(placeIn(question, over, spot(2.5))).toEqual({
      placement: 'explanation',
      optionLetter: null,
      unsure: true,
    });
  });

  it('places a picture after the options in the explanation, shown only after the reveal', () => {
    expect(placeIn(question, figure, spot(3.5, false)).placement).toBe('explanation');
  });

  it('places a picture beside the question’s lines in the explanation', () => {
    const side = image('side', at(300, 120, 500, 160), 'figure');
    expect(placeIn(question, side, spot(1.5, false, true)).placement).toBe('explanation');
  });
});

describe('a stem that says a picture goes with it (D3.2)', () => {
  const cued = frame(0, 2, 'The X-ray shown below belongs to which child?');
  const below = image('fig', at(40, 160, 200, 260), 'figure');

  it('reads the closed word list only', () => {
    expect(stemPointsToPicture('An ECG was done')).toBe(true);
    expect(stemPointsToPicture('Which treatment comes first?')).toBe(false);
  });

  it('hides the first figure right after the options and flags it (Q85: a guess is unsure)', () => {
    expect(placeIn(cued, below, spot(2.5))).toEqual({
      placement: 'explanation',
      optionLetter: null,
      unsure: true,
    });
  });

  it('sends a second figure, a far one, or a labelled one to the explanation', () => {
    expect(placeIn(cued, below, spot(2.5, false)).placement).toBe('explanation');
    const far = image('far', at(40, 700, 200, 760), 'figure');
    expect(placeIn(cued, far, spot(2.5)).placement).toBe('explanation');
    const labelled = image('lab', at(40, 160, 200, 260), 'unsure');
    expect(placeIn(cued, labelled, spot(2.5)).placement).toBe('explanation');
  });
});

/** A virtual text holding only these pictures, at these places in reading order. */
function textWith(pictures: [Unit, number][], lines: number): VirtualText {
  const filler = { line: null as never, unitId: 'x', fromPicture: false };
  return {
    lines: Array.from({ length: lines }, () => filler),
    order: new Map(pictures.map(([unit, position]) => [unit.id, position])),
    units: new Map(pictures.map(([unit]) => [unit.id, unit])),
    covers: new Set(),
  };
}

describe('ownership by reading order', () => {
  const frames = [frame(0, 2), frame(10, 2)];

  it('gives each picture to the nearest anchor before it', () => {
    expect(ownerAt(frames, 5)).toBe(0);
    expect(ownerAt(frames, 10.5)).toBe(1);
    expect(ownerAt(frames, -0.5)).toBe(-1);
  });

  it('turns printed words in the explanation into text and drops pen marks on options', () => {
    const table = { ...image('table', at(40, 300, 400, 400), 'table'), text: 'Dose | Route' };
    const mark = image('mark', at(40, 120, 60, 130), 'handwriting');
    const note = image('note', at(40, 400, 300, 440), 'handwriting');
    const owned = placePictures({
      frames,
      text: textWith(
        [
          [table, 4.5],
          [mark, 1.5],
          [note, 5.5],
        ],
        12,
      ),
      consumed: new Set(),
      cases: [],
      namedOwner: () => null,
    });
    expect(owned[0]?.texts).toEqual(['Dose | Route']);
    expect(owned[0]?.pictures.map((p) => [p.unitId, p.placement])).toEqual([
      ['note', 'explanation'],
    ]);
  });

  it('shares a case’s pictures with every question of the case (D6.3)', () => {
    const figure = image('case-fig', at(40, 300, 200, 400), 'figure');
    const owned = placePictures({
      frames,
      text: textWith([[figure, 8.5]], 12),
      consumed: new Set(),
      cases: [{ questions: [1], from: 8, to: 10 }],
      namedOwner: () => null,
    });
    expect(owned.map((o) => o.pictures.map((p) => p.placement))).toEqual([[], ['case']]);
  });
});

describe('handwritten notes as ink', () => {
  const frames = [frame(0, 2), frame(20, 2)];
  const heights = new Map([[1, 800]]);

  it('opens a note zone at the first option and closes it at the next question', () => {
    expect(noteZones(frames, heights)).toEqual([
      { question: 0, page: 1, y0: 120, y1: 500 },
      { question: 1, page: 1, y0: 520, y1: 800 },
    ]);
  });

  it('joins near strokes into one note', () => {
    expect(joinNear([at(0, 0, 10, 10), at(20, 0, 30, 10), at(200, 0, 210, 10)])).toEqual([
      at(0, 0, 30, 10),
      at(200, 0, 210, 10),
    ]);
  });

  it('finds red ink in the zone, but not over print or around an option letter', () => {
    // 72 dpi: one pixel per point. A red note at y 300, red over print at y 200, a red ring at
    // the letter A (y 120).
    const strokes = [at(300, 300, 380, 330), at(40, 200, 120, 206), at(30, 116, 52, 134)];
    const inside = (b: Box, x: number, y: number) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
    const red = (x: number, y: number) => strokes.some((stroke) => inside(stroke, x, y));
    const image = paint(600, 800, (x, y) => (red(x, y) ? [200, 20, 20] : [255, 255, 255]));
    const notes = inkNotes(
      {
        page: 1,
        image,
        dpi: 72,
        printed: [at(40, 198, 200, 208)],
        letters: [at(40, 120, 46, 130)],
      },
      noteZones(frames, heights),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]?.question).toBe(0);
    expect(notes[0]?.box.x0).toBeGreaterThanOrEqual(296);
  });
});
