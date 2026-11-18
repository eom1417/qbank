// M34 P4, level 3 in code (D3.1, D3.2): every picture belongs to the nearest question anchor
// before it in reading order, and its place follows from where it sits in that question.
import { inkBlobs } from '../ink-regions.js';
import { overlaps, unionBox, type Box } from '../page.js';
import type { PicturePlacement, PipelinePicture, Spot } from './question.js';
import { pixelAt } from './image-class.js';
import type { RgbImage } from './rgb-image.js';
import type { Unit } from './units.js';
import { besideLine, type VirtualText } from './virtual-text.js';

interface FrameOption {
  letter: string;
  /** Order of the option's first line, and where that line is. */
  at: number;
  page: number;
  box: Box;
}

/** A parsed question as places in the reading order. */
export interface QuestionFrame {
  number: number;
  stem: string;
  /** Order of its first stem line, and of its last line (an option or a continuation). */
  stemAt: number;
  endAt: number;
  options: FrameOption[];
  /** Its lines, page by page. */
  spans: Spot[];
}

/** The closed word list of D3.2: the stem says a picture goes with it. */
const PICTURE_CUE =
  /\b(?:image|images|x-?ray|radiograph|ct|mri|ecg|ekg|photo|photograph|shown|picture|figure)\b/i;
export const stemPointsToPicture = (stem: string) => PICTURE_CUE.test(stem);

/** The question whose anchor is the last one at or before `at` (D3.1); -1 before the first. */
export const ownerAt = (frames: readonly QuestionFrame[], at: number) =>
  frames.findLastIndex((frame) => frame.stemAt >= 0 && frame.stemAt <= at);

const sameRow = (a: Box, b: Box) => Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;

/**
 * The option an image between options goes with: the one on its row, else the one above.
 * None when it lies over the rows of two or more options: a note pasted over them (M35).
 */
function optionOf(frame: QuestionFrame, unit: Unit, at: number): string | null {
  const rows = frame.options.filter((o) => o.page === unit.page && sameRow(o.box, unit.box));
  if (rows.length > 1) return null;
  return rows[0]?.letter ?? frame.options.findLast((option) => option.at <= at)?.letter ?? null;
}

export interface Placed {
  placement: PicturePlacement;
  optionLetter: string | null;
  /** Q85: not certain where it belongs: hidden as explanation, the question held for review. */
  unsure?: boolean;
}

export const PLACE_UNSURE = 'picture_place_unsure';

/** Lines' heights of blank space allowed between a question and the picture right after it. */
const ADJACENT_LINES = 4;

/** Nothing but pictures between the question's last line and this one, and close below it. */
function rightAfter(frame: QuestionFrame, unit: Unit, at: number): boolean {
  const last = frame.spans.at(-1);
  if (!last || Math.ceil(at) !== frame.endAt + 1 || last.page !== unit.page) return false;
  const gap = unit.box.y0 - last.box.y1;
  return gap <= (last.box.y1 - last.box.y0) * ADJACENT_LINES;
}

/**
 * The picture sits beside the question's own lines (same rows, to one side) rather than in
 * their flow: a note pasted next to the stem or the options, not a part of them.
 */
const besideQuestion = (frame: QuestionFrame, unit: Unit): boolean =>
  frame.spans.some((span) => span.page === unit.page && besideLine(unit.box, span.box));

/** How a picture lies in its question: its order, beside its lines, first figure after it. */
export interface PictureSpot {
  at: number;
  beside: boolean;
  firstAfter: boolean;
}

/**
 * Where a picture owned by `frame` sits (D3.1): in the flow before the first option it is the
 * question's, between options an option's; after them, or beside the question's lines, the
 * explanation's (shown only after the reveal); except the first figure right after or beside
 * a stem that says a picture goes with it (D3.2).
 */
export function placeIn(frame: QuestionFrame, unit: Unit, spot: PictureSpot): Placed {
  const { at, beside } = spot;
  // Without options, the question's own area ends with its last line.
  const firstOption = frame.options[0]?.at ?? frame.endAt;
  if (!beside && at < firstOption) return { placement: 'question', optionLetter: null };
  const amongOptions = !beside && at <= frame.endAt;
  const letter = amongOptions ? optionOf(frame, unit, at) : null;
  if (letter) return { placement: 'option', optionLetter: letter };
  return hidden(amongOptions || attachedToStem(frame, unit, spot));
}

/**
 * The explanation's place, shown only after the reveal. Between options without a letter, or a
 * figure the stem points to after the options, the place is a guess: it stays hidden and the
 * question goes to review (Q85).
 */
const hidden = (unsure: boolean): Placed => ({
  placement: 'explanation',
  optionLetter: null,
  ...(unsure ? { unsure } : {}),
});

/** D3.2: the first lone figure right after (or beside) a stem that says a picture goes with it. */
function attachedToStem(frame: QuestionFrame, unit: Unit, spot: PictureSpot): boolean {
  // Only a picture without words: a labelled one may name the answer (D3.4).
  if (unit.imageClass !== 'figure' || !spot.firstAfter) return false;
  const near = spot.beside || rightAfter(frame, unit, spot.at);
  return near && stemPointsToPicture(frame.stem);
}

export interface Owned {
  /** Q85: a picture here was placed without certainty. */
  unsure: boolean;
  pictures: PipelinePicture[];
  /** Pictures of printed words in the explanation zone, as the explanation's text (Z5). */
  texts: string[];
}

export interface PlaceInput {
  frames: readonly QuestionFrame[];
  text: VirtualText;
  /** Pictures whose lines the parser or the key pass already used. */
  consumed: ReadonlySet<string>;
  /** Case texts shared by several questions: their pictures go to each (D6.3). */
  cases: readonly { questions: number[]; from: number; to: number }[];
  /** A picture that names its question by number (a key with its explanation). */
  namedOwner: (unit: Unit) => number | null;
}

const spotOf = (unit: Unit): Spot => ({ page: unit.page, box: unit.box });
const isTextual = (unit: Unit) => unit.imageClass === 'text_picture' || unit.imageClass === 'table';

/** A picture's words as OCR read them, column by column (verbatim, Z2). */
const pictureText = (unit: Unit) => (unit.text ?? '').replace(/\s+/g, ' ').trim();

/** An unsure picture OCR reads well and at length: its words join the explanation too. */
const MANY_WORDS = 30;
const GOOD_CONFIDENCE = 80;
const wordy = (unit: Unit) =>
  unit.imageClass === 'unsure' &&
  (unit.ocr?.words ?? 0) >= MANY_WORDS &&
  (unit.ocr?.confidence ?? 0) >= GOOD_CONFIDENCE;

/** No other image shares its rows: a single picture, not one panel of several. */
const alone = (text: VirtualText, unit: Unit) =>
  ![...text.units.values()].some(
    (other) =>
      other !== unit &&
      other.kind === 'image' &&
      other.page === unit.page &&
      besideLine(other.box, unit.box),
  );

/** A case's pictures go with each question of the case (D6.3); true when `at` is in one. */
function placeInCase(input: PlaceInput, result: Owned[], unit: Unit, at: number): boolean {
  const group = input.cases.find((c) => at >= c.from && at < c.to);
  for (const index of group?.questions ?? [])
    result[index]?.pictures.push(picture(unit, { placement: 'case', optionLetter: null }));
  return group !== undefined;
}

/** Puts a placed picture in its question: explanation text, a picture, or nothing (a mark). */
function keep(slot: Owned, unit: Unit, placed: Placed) {
  const explanation = placed.placement === 'explanation';
  if (placed.unsure) slot.unsure = true;
  // Until the vision lesson decides an unsure picture, its words and the picture both stay.
  if (explanation && (isTextual(unit) || wordy(unit))) slot.texts.push(pictureText(unit));
  if (explanation ? !isTextual(unit) : unit.imageClass !== 'handwriting')
    slot.pictures.push(picture(unit, placed));
}

/** The first non-text picture after (or beside) its question: claimed once per question. */
function firstFigure(claimed: Set<number>, owner: number, unit: Unit, after: boolean): boolean {
  if (!after || isTextual(unit) || claimed.has(owner)) return false;
  claimed.add(owner);
  return true;
}

/** One owned picture in its place: a picture, explanation text, or nothing (a pen mark). */
function placeOne(input: PlaceInput, result: Owned[], unit: Unit, firstAfter: Set<number>) {
  const at = input.text.order.get(unit.id) ?? -1;
  if (input.text.covers.has(unit.id) || placeInCase(input, result, unit, at)) return;
  const owner = input.namedOwner(unit) ?? ownerAt(input.frames, at);
  const frame = input.frames[owner];
  const slot = result[owner];
  if (!frame || !slot) return;
  const beside = besideQuestion(frame, unit);
  const first = firstFigure(firstAfter, owner, unit, at > frame.endAt || beside);
  const spot = { at, beside, firstAfter: first && alone(input.text, unit) };
  keep(slot, unit, placeIn(frame, unit, spot));
}

const picture = (unit: Unit, placed: Placed): PipelinePicture => ({
  unitId: unit.id,
  spot: spotOf(unit),
  placement: placed.placement,
  optionLetter: placed.optionLetter,
  imageClass: unit.imageClass ?? 'unsure',
});

/** Every picture not read into a question, placed with the question that owns it. */
export function placePictures(input: PlaceInput): Owned[] {
  const result: Owned[] = input.frames.map(() => ({ unsure: false, pictures: [], texts: [] }));
  const firstAfter = new Set<number>();
  const pictures = [...input.text.units.values()]
    .filter((unit) => unit.kind === 'image' && !input.consumed.has(unit.id))
    .sort((a, b) => (input.text.order.get(a.id) ?? 0) - (input.text.order.get(b.id) ?? 0));
  for (const unit of pictures) placeOne(input, result, unit, firstAfter);
  return result;
}

/** One page stretch where a question's notes may sit: below its options, above the next. */
export interface NoteZone {
  question: number;
  page: number;
  y0: number;
  y1: number;
}

/** The first line of the stretch: the first option's, or the stem's last line without options. */
function zoneStart(frame: QuestionFrame): Spot | null {
  const option = frame.options[0];
  if (option) return { page: option.page, box: option.box };
  return frame.spans.at(-1) ?? null;
}

/**
 * Where each question's handwritten notes may be: from its first option down to the next
 * question's first line, across pages (`heights` by page). Notes beside the stem are marks.
 */
export function noteZones(
  frames: readonly QuestionFrame[],
  heights: ReadonlyMap<number, number>,
): NoteZone[] {
  const zones: NoteZone[] = [];
  const last = Math.max(...heights.keys());
  frames.forEach((frame, index) => {
    const start = zoneStart(frame);
    if (!start) return;
    const end = { page: last, box: { y0: heights.get(last) ?? 0 } as Box };
    const next = frames[index + 1]?.spans[0] ?? end;
    for (let page = start.page; page <= next.page; page++) {
      const y0 = page === start.page ? start.box.y0 : 0;
      const y1 = page === next.page ? next.box.y0 : (heights.get(page) ?? 0);
      if (y1 > y0) zones.push({ question: index, page, y0, y1 });
    }
  });
  return zones;
}

/** The region a hand circle around an option letter takes: not a note. */
const letterMarkBox = (letter: Box): Box => {
  const h = letter.y1 - letter.y0;
  return { x0: letter.x0 - h * 1.2, y0: letter.y0 - h, x1: letter.x1 + h, y1: letter.y1 + h };
};

/**
 * Strokes of one note: words of a written line lie side by side with wide gaps, its lines
 * close above each other; a clear blank band between strokes starts another note.
 */
const NOTE_JOIN_ACROSS = 36;
const NOTE_JOIN_DOWN = 14;
const grow = (box: Box): Box => ({
  x0: box.x0 - NOTE_JOIN_ACROSS,
  y0: box.y0 - NOTE_JOIN_DOWN,
  x1: box.x1 + NOTE_JOIN_ACROSS,
  y1: box.y1 + NOTE_JOIN_DOWN,
});

/** Joins boxes that lie close together into one box each. */
export function joinNear(boxes: readonly Box[]): Box[] {
  const joined: Box[] = [];
  for (const box of boxes) {
    let current = box;
    for (let index = joined.length - 1; index >= 0; index--) {
      const other = joined[index] as Box;
      if (!overlaps(grow(other), current)) continue;
      current = unionBox([other, current]);
      joined.splice(index, 1);
    }
    joined.push(current);
  }
  return joined.length === boxes.length ? joined : joinNear(joined);
}

/** Pen ink: clearly coloured and dark enough (highlighter is bright, print is grey). */
const PEN_SATURATION = 70;
const PEN_MAX_LUMA = 170;
/** A note is at least this wide and tall (points): ticks, dots and underlines are marks. */
const NOTE_MIN_WIDTH = 16;
const NOTE_MIN_HEIGHT = 10;
/** Printed words and pictures are cleared this far around (points) before ink is grouped. */
const MASK_MARGIN = 1.5;

function penMask(image: RgbImage): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const [r, g, b] = pixelAt(image, pixel);
    const luma = (299 * r + 587 * g + 114 * b) / 1000;
    if (Math.max(r, g, b) - Math.min(r, g, b) >= PEN_SATURATION && luma < PEN_MAX_LUMA)
      mask[pixel] = 1;
  }
  return mask;
}

function clear(mask: Uint8Array, image: RgbImage, box: Box, scale: number) {
  const px = (points: number, size: number) =>
    Math.max(0, Math.min(size, Math.round(points * scale)));
  const [x0, x1] = [px(box.x0 - MASK_MARGIN, image.width), px(box.x1 + MASK_MARGIN, image.width)];
  const [y0, y1] = [px(box.y0 - MASK_MARGIN, image.height), px(box.y1 + MASK_MARGIN, image.height)];
  for (let y = y0; y < y1; y++) mask.fill(0, y * image.width + x0, y * image.width + x1);
}

export interface InkPage {
  page: number;
  /** The whole page rendered at `dpi`. */
  image: RgbImage;
  dpi: number;
  /** Printed words and pictures on the page: ink over them is a mark, not a note. */
  printed: readonly Box[];
  /** Option letters on the page: a circle around one is an answer mark. */
  letters: readonly Box[];
}

const centreIn = (box: Box, zone: NoteZone) => {
  const y = (box.y0 + box.y1) / 2;
  return y >= zone.y0 && y < zone.y1;
};

/**
 * Handwritten notes on a rendered page: coloured pen ink that is not over printed words or
 * pictures, not around an option letter, inside a question's note zone; near strokes join.
 */
export function inkNotes(
  ink: InkPage,
  zones: readonly NoteZone[],
): { question: number; box: Box }[] {
  const scale = ink.dpi / 72;
  const mask = penMask(ink.image);
  for (const box of ink.printed) clear(mask, ink.image, box, scale);
  const raster = {
    width: ink.image.width,
    height: ink.image.height,
    scale,
    pixels: new Uint8Array(0),
  };
  const marks = ink.letters.map(letterMarkBox);
  const blobs = inkBlobs(mask, raster)
    .map((blob) => blob.box)
    .filter((box) => !marks.some((mark) => overlaps(mark, box)));
  const own = zones.filter((zone) => zone.page === ink.page);
  return own.flatMap((zone) =>
    joinNear(blobs.filter((box) => centreIn(box, zone)))
      .filter((box) => box.x1 - box.x0 >= NOTE_MIN_WIDTH && box.y1 - box.y0 >= NOTE_MIN_HEIGHT)
      .map((box) => ({ question: zone.question, box })),
  );
}
