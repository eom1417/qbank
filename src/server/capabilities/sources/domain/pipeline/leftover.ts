// M34 P4a → P4b: pictures that look like a question but gave none, left for the vision
// structure lesson with their OCR lines numbered (no text leaves the pipeline otherwise).
import { optionLabel, questionLabel } from '../labels.js';
import { rowLines } from '../lines.js';
import type { Box, PageWord } from '../page.js';
import { pictureKey, pictureLines } from './picture-lines.js';
import { ownerAt, type QuestionFrame } from './placement.js';
import type { Unit } from './units.js';
import type { VirtualText } from './virtual-text.js';

export interface LeftoverLine {
  /** 1-based line number inside the picture, as the lesson cites it. */
  n: number;
  text: string;
  box: Box;
}

export interface Leftover {
  unitId: string;
  page: number;
  box: Box;
  /** The picture's OCR lines as read (empty when OCR could not read it). */
  lines: LeftoverLine[];
  /** The key of the question before it in reading order; null before the first. */
  before: string | null;
}

/** A numbered stem (not a key with its explanation), two options, or a question mark. */
export function looksLikeQuestion(page: number, words: readonly PageWord[]): boolean {
  const lines = pictureLines(page, words).map((line) => line.text);
  const numbered = lines.some((line) => questionLabel(line) !== null && !pictureKey(line));
  const options = lines.filter((line) => optionLabel(line) !== null).length;
  return numbered || options >= 2 || lines.some((line) => line.trim().endsWith('?'));
}

const rawLines = (unit: Unit): LeftoverLine[] =>
  rowLines({
    page: unit.page,
    width: 0,
    height: 0,
    words: (unit.words ?? []).map(({ text, box, font }) => ({ text, box, font })),
  }).map((line, index) => ({ n: index + 1, text: line.text, box: line.box }));

export interface LeftoverInput {
  text: VirtualText;
  frames: readonly QuestionFrame[];
  /** Each frame's question key, and whether its stem was read in a picture. */
  keys: readonly string[];
  fromPicture: ReadonlySet<number>;
  /** Pictures whose lines a question, key or explanation read. */
  consumed: ReadonlySet<string>;
}

/** The picture is a candidate: unread by any question or key, and readable or unreadable. */
function candidate(input: LeftoverInput, unit: Unit): boolean {
  if (unit.kind !== 'image' || input.consumed.has(unit.id)) return false;
  if (unit.ocr?.unreadable) return true;
  return unit.imageClass !== 'figure' && looksLikeQuestion(unit.page, unit.words ?? []);
}

/**
 * Pictures that look like a question and gave none. Pictures after a question read from the
 * page's own text are its explanation material (excerpts, level 5), not leftovers.
 */
export function findLeftovers(input: LeftoverInput): Leftover[] {
  const leftovers: Leftover[] = [];
  for (const unit of input.text.units.values()) {
    if (!candidate(input, unit)) continue;
    const owner = ownerAt(input.frames, input.text.order.get(unit.id) ?? -1);
    if (owner >= 0 && !input.fromPicture.has(owner)) continue;
    const lines = unit.ocr?.unreadable ? [] : rawLines(unit);
    const before = input.keys[owner] ?? null;
    leftovers.push({ unitId: unit.id, page: unit.page, box: unit.box, lines, before });
  }
  return leftovers;
}
