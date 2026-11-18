// M34 P4, levels 2 and 6 in code: one virtual text layer. The page's own lines and the OCR
// lines of every picture of printed words, in reading order, each picture read as a page
// inside the page (D6.1). The detection (M39) reads its roles from these lines. No AI.
import { optionLabel, questionLabel } from '../labels.js';
import type { TextLine } from '../lines.js';
import type { Box, PageWord } from '../page.js';
import { pictureKey, pictureLines } from './picture-lines.js';
import type { PageSize, Unit } from './units.js';

/** The OCR words of one picture, in page points. */
export interface PictureWords {
  unitId: string;
  words: PageWord[];
}

interface VirtualLine {
  line: TextLine;
  /** The unit it came from: a text line, or the picture it was read in. */
  unitId: string;
  fromPicture: boolean;
}

export interface VirtualText {
  /** Every line in reading order across the file. */
  lines: VirtualLine[];
  /** Each content unit's place in that order: its first line, or between two lines. */
  order: Map<string, number>;
  /** Content units by id (no filler). */
  units: Map<string, Unit>;
  /** Images lying over the page's printed lines: a background or a mark, never content. */
  covers: Set<string>;
}

export interface VirtualPage {
  size: PageSize;
  units: readonly Unit[];
}

/** Pictures read as text: printed words, tables, and unsure images OCR found words in. */
const TEXT_CLASSES = new Set(['text_picture', 'table', 'unsure']);
const MIN_PICTURE_WORDS = 3;

/** An image whose OCR words are worth reading into the virtual text. */
export const readsAsText = (unit: Unit): boolean =>
  unit.kind === 'image' &&
  TEXT_CLASSES.has(unit.imageClass ?? '') &&
  (unit.ocr?.words ?? 0) >= MIN_PICTURE_WORDS;

const boxKey = (page: number, box: Box) => `${page}:${box.x0}:${box.y0}:${box.x1}:${box.y1}`;

/** A box beside another may still overlap its end by this share of its own width. */
const SIDE_OVERLAP = 0.1;

/** `box` sits beside `line`: on the same rows, to one side of it. */
export function besideLine(box: Box, line: Box): boolean {
  const rows = Math.min(box.y1, line.y1) - Math.max(box.y0, line.y0) > 0;
  const across = Math.min(box.x1, line.x1) - Math.max(box.x0, line.x0);
  return rows && across <= (box.x1 - box.x0) * SIDE_OVERLAP;
}

const printedLine = (unit: Unit) => unit.kind === 'text_line' && unit.source !== 'off_body_font';

const centreInside = (inner: Box, outer: Box) => {
  const [x, y] = [(inner.x0 + inner.x1) / 2, (inner.y0 + inner.y1) / 2];
  return x >= outer.x0 && x <= outer.x1 && y >= outer.y0 && y <= outer.y1;
};

/**
 * A page's content units in reading order, except that a picture pasted beside printed lines
 * (a note next to the options) follows the last of those lines: it never splits them.
 */
export function pageFlow(units: readonly Unit[]): Unit[] {
  const flow = units.filter((unit) => unit.kind !== 'filler');
  for (const image of flow.filter((unit) => unit.kind === 'image')) {
    const from = flow.indexOf(image);
    const beside = flow.findLastIndex(
      (unit, index) => index > from && printedLine(unit) && besideLine(image.box, unit.box),
    );
    if (beside < 0) continue;
    flow.splice(from, 1);
    flow.splice(beside, 0, image);
  }
  return flow;
}

/** A line along an image's edge (this share of its height) touches it; it is not under it. */
const EDGE_SHARE = 0.1;

const inner = (box: Box): Box => {
  const edge = (box.y1 - box.y0) * EDGE_SHARE;
  return { ...box, y0: box.y0 + edge, y1: box.y1 - edge };
};

/** Images over the page's printed lines (the centre of one lies well inside, off its edges). */
const coversOf = (units: readonly Unit[]) =>
  units
    .filter((unit) => unit.kind === 'image')
    .filter((image) => units.some((u) => printedLine(u) && centreInside(u.box, inner(image.box))))
    .map((image) => image.id);

/** A question, option or key line: what makes an unsure picture worth reading as text. */
const questionShaped = (text: string) =>
  questionLabel(text) !== null || optionLabel(text) !== null || pictureKey(text) !== null;

interface Builder {
  lines: VirtualLine[];
  order: Map<string, number>;
  units: Map<string, Unit>;
  covers: Set<string>;
}

function addUnit(
  builder: Builder,
  unit: Unit,
  layer: ReadonlyMap<string, TextLine>,
  pictures: ReadonlyMap<string, TextLine[]>,
) {
  builder.units.set(unit.id, unit);
  const own = layer.get(boxKey(unit.page, unit.box));
  const read = unit.kind === 'text_line' && unit.source !== 'off_body_font' && own ? [own] : [];
  const picture = builder.covers.has(unit.id) ? [] : (pictures.get(unit.id) ?? []);
  const lines = unit.kind === 'image' ? picture : read;
  builder.order.set(unit.id, lines.length > 0 ? builder.lines.length : builder.lines.length - 0.5);
  const fromPicture = unit.kind === 'image';
  for (const line of lines) builder.lines.push({ line, unitId: unit.id, fromPicture });
}

/**
 * The virtual text of a file: `layer` holds the page's own reading lines (text layer or a
 * scan's OCR, as `pageLines` reads them); `words` the OCR words of pictures read as text.
 * Text lines and pictures take the units' reading order (`pageFlow`); device handwriting
 * is left out, and so is the text of an image over printed lines.
 */
export function virtualText(
  pages: readonly VirtualPage[],
  layer: readonly TextLine[],
  words: readonly PictureWords[],
): VirtualText {
  const byBox = new Map(layer.map((line) => [boxKey(line.page, line.box), line]));
  const sizes = new Map(pages.map((page) => [page.size.page, page.size]));
  const unitPage = new Map(pages.flatMap((p) => p.units.map((unit) => [unit.id, p.size.page])));
  const unsure = new Set(
    pages.flatMap((page) => page.units.filter((u) => u.imageClass === 'unsure').map((u) => u.id)),
  );
  const pictures = new Map(
    words.flatMap(({ unitId, words: own }) => {
      const size = sizes.get(unitPage.get(unitId) ?? -1);
      const lines = size ? pictureLines(size.page, own) : [];
      const keep = !unsure.has(unitId) || lines.some((line) => questionShaped(line.text));
      return keep && lines.length > 0 ? [[unitId, lines] as const] : [];
    }),
  );
  const covers = new Set(pages.flatMap((page) => coversOf(page.units)));
  const builder: Builder = { lines: [], order: new Map(), units: new Map(), covers };
  for (const page of pages)
    for (const unit of pageFlow(page.units)) addUnit(builder, unit, byBox, pictures);
  return builder;
}

/** A line that only closes the open stem or option (the parser's section rule). */
