// M34 P6 (Q15): the built-in reference set the weekly measurement asks every approved model.
// Every picture is drawn here, deterministically: letters from a 5×7 bitmap font with a drawn
// circle (the marked answer) or ✗ (struck out) for D4.mark, and printed lines, a ruled table or a
// shaded film for D1.2. No file of anyone's is used.
import type { ImageKindInput, ImageKindOutput } from './lessons/image-kind.js';
import { markedLetters, type MarkInput, type MarkOutput } from './lessons/mark.js';
import type { RgbImage } from './rgb-image.js';

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
};
const SCALE = 4;
const ROW_HEIGHT = 56;
const WIDTH = 360;
const WHITE = 255;
/** Pen colours: a blue circle, a red ✗, black print. */
const PEN = [30, 60, 200] as const;
const STRIKE = [200, 30, 30] as const;
const PRINT = [0, 0, 0] as const;

type Rgb = readonly [number, number, number];

function canvas(width: number, height: number): RgbImage {
  return { width, height, data: Buffer.alloc(width * height * 3, WHITE) };
}

function dot(image: RgbImage, x: number, y: number, color: Rgb) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const at = (Math.round(y) * image.width + Math.round(x)) * 3;
  image.data[at] = color[0];
  image.data[at + 1] = color[1];
  image.data[at + 2] = color[2];
}

function rect(image: RgbImage, box: { x: number; y: number; w: number; h: number }, color: Rgb) {
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) dot(image, x, y, color);
}

function glyph(image: RgbImage, letter: string, x: number, y: number) {
  (GLYPHS[letter] ?? []).forEach((row, dy) =>
    [...row].forEach((ink, dx) => {
      if (ink === '#')
        rect(image, { x: x + dx * SCALE, y: y + dy * SCALE, w: SCALE, h: SCALE }, PRINT);
    }),
  );
}

/** A ring two pixels thick around (cx, cy). */
function circle(image: RgbImage, cx: number, cy: number, radius: number) {
  for (let step = 0; step < 720; step++) {
    const angle = (step / 720) * 2 * Math.PI;
    for (const r of [radius, radius + 1])
      dot(image, cx + r * Math.cos(angle), cy + r * Math.sin(angle), PEN);
  }
}

/** Two crossing strokes over (cx, cy). */
function cross(image: RgbImage, cx: number, cy: number, half: number) {
  for (let d = -half; d <= half; d++)
    for (const t of [0, 1]) {
      dot(image, cx + d + t, cy + d, STRIKE);
      dot(image, cx + d + t, cy - d, STRIKE);
    }
}

interface MarkCase {
  letters: string;
  circled: string | null;
  crossed: readonly string[];
}

/** One question's options: a letter and a grey line of "text" per row, marked by pen. */
function drawMark(item: MarkCase): RgbImage {
  const rows = [...item.letters];
  const image = canvas(WIDTH, rows.length * ROW_HEIGHT);
  rows.forEach((letter, row) => {
    const top = row * ROW_HEIGHT + 14;
    glyph(image, letter, 24, top);
    rect(image, { x: 70, y: top + 10, w: 240, h: 8 }, [150, 150, 150]);
    const cx = 24 + 2.5 * SCALE;
    const cy = top + 3.5 * SCALE;
    if (item.circled === letter) circle(image, cx, cy, 22);
    if (item.crossed.includes(letter)) cross(image, cx, cy, 16);
  });
  return image;
}

const MARK_CASES: readonly MarkCase[] = [
  { letters: 'ABCD', circled: 'A', crossed: [] },
  { letters: 'ABCD', circled: 'C', crossed: [] },
  { letters: 'ABCD', circled: 'D', crossed: ['A'] },
  { letters: 'ABC', circled: 'B', crossed: ['C'] },
  { letters: 'ABCD', circled: null, crossed: [] },
  { letters: 'ABCD', circled: null, crossed: ['B'] },
];

type ImageKindCase = ImageKindOutput['kind'];

function drawPrinted(): RgbImage {
  const image = canvas(WIDTH, 200);
  for (let line = 0; line < 6; line++)
    for (let word = 0; word < 6; word++)
      glyph(image, 'ABCD'[(line + word) % 4] ?? 'A', 16 + word * 56, 12 + line * 30);
  return image;
}

function drawTable(): RgbImage {
  const image = canvas(WIDTH, 200);
  for (let y = 10; y <= 190; y += 45) rect(image, { x: 10, y, w: 340, h: 2 }, PRINT);
  for (let x = 10; x <= 350; x += 85) rect(image, { x, y: 10, w: 2, h: 182 }, PRINT);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++)
      glyph(image, 'ABCD'[col] ?? 'A', 40 + col * 85, 20 + row * 45);
  return image;
}

/** A shaded oval on dark ground, as a film looks: no letters at all. */
function drawFilm(): RgbImage {
  const image = canvas(WIDTH, 240);
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const d = Math.hypot((x - 180) / 140, (y - 120) / 90);
      const shade = Math.max(10, Math.round(220 - 200 * d));
      dot(image, x, y, [shade, shade, shade]);
    }
  return image;
}

const KIND_CASES: readonly [ImageKindCase, () => RgbImage][] = [
  ['printed_words', drawPrinted],
  ['table', drawTable],
  ['picture', drawFilm],
];

export interface ReferenceItem<I, O> {
  input: I;
  image: RgbImage;
  fingerprint: string;
  expected: O;
}

export interface ReferenceSet {
  'D4.mark': ReferenceItem<MarkInput, MarkOutput>[];
  'D1.2': ReferenceItem<ImageKindInput, ImageKindOutput>[];
}

/** The reference set's version: a changed drawing is a new set (its replies are not compared). */
export const REFERENCE_VERSION = 1;

/** The whole reference set, drawn afresh (the same pixels every time). */
export function referenceSet(): ReferenceSet {
  const fingerprint = (lesson: string, n: number) =>
    `reference:${REFERENCE_VERSION}:${lesson}:${n}`;
  return {
    'D4.mark': MARK_CASES.map((item, n) => ({
      input: { options: [...item.letters].map((letter) => ({ letter, label: letter })) },
      image: drawMark(item),
      fingerprint: fingerprint('D4.mark', n),
      expected: { letter: item.circled, eliminated: [...item.crossed] },
    })),
    'D1.2': KIND_CASES.map(([kind, draw], n) => ({
      input: { unitId: `reference-${n}` },
      image: draw(),
      fingerprint: fingerprint('D1.2', n),
      expected: { kind },
    })),
  };
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Whether a mark reply says what the drawing shows (letters compared by position). */
export function markMatches(item: ReferenceItem<MarkInput, MarkOutput>, output: MarkOutput) {
  const read = markedLetters(item.input, output);
  return read.letter === item.expected.letter && sameSet(read.eliminated, item.expected.eliminated);
}

export const kindMatches = (
  item: ReferenceItem<ImageKindInput, ImageKindOutput>,
  output: ImageKindOutput,
) => output.kind === item.expected.kind;
