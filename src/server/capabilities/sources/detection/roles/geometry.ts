import type { TextLine } from '../../domain/lines.js';
import type { FileLines, Line } from '../contract.js';

// M39 step 3: every distance the role rules use, measured from the file's own layout (plan §2.4).

export interface Measure {
  /** Two lines this close or closer belong to one paragraph. */
  paragraph: number;
  /** A gap wider than this lies between blocks that may still belong together (a stem's options). */
  block: number;
  /** A gap wider than this leaves the text it follows (a note pasted lower on the page). */
  far: number;
  /** A gap between two words of one line this wide is a table's cell gap. */
  cell: number;
  /** A line starting this close to its page's margin starts at the margin. */
  margin: number;
}

export function measureOf(file: FileLines): Measure {
  const { lineHeight, lineGap, paragraphGap } = file.layout;
  const paragraph = Math.max((lineGap + paragraphGap) / 2, lineGap + lineHeight / 2);
  const block = Math.max(paragraphGap * 1.5, paragraph);
  return { paragraph, block, far: block * 1.5, cell: lineHeight * 1.5, margin: lineHeight * 2 };
}

/** The vertical gap from `above` to `line`; endless across pages or with nothing above. */
export function gapBetween(above: Line | undefined, line: Line): number {
  if (!above || above.page !== line.page) return Number.POSITIVE_INFINITY;
  return line.box.y0 - above.box.y1;
}

export const sameParagraph = (measure: Measure, above: Line | undefined, line: Line) =>
  gapBetween(above, line) <= measure.paragraph;

/** Where reading starts: the left edge, or the right edge of a right-to-left line. */
export const startOf = (line: Line) => (line.rtl ? line.box.x1 : line.box.x0);

/** The line starts at its page's measured margin. */
export function atMargin(file: FileLines, measure: Measure, line: Line): boolean {
  const margin = file.layout.margins.get(line.page);
  return margin === undefined || Math.abs(startOf(line) - margin) <= measure.margin;
}

/** The gap after the line's first word, in reading direction (0 for a one-word line). */
export function firstWordGap(line: Line): number {
  const [first, second] = line.words;
  if (!first || !second) return 0;
  return line.rtl ? first.box.x0 - second.box.x1 : second.box.x0 - first.box.x1;
}

/** The line as the page-reading rules take it. */
export const toTextLine = (line: Line): TextLine => ({
  page: line.page,
  text: line.text,
  box: line.box,
  words: line.words,
  rtl: line.rtl,
  start: startOf(line),
});
