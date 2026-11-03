import { latinDigits } from './bidi.js';
import type { TextLine } from './lines.js';

/** The top and bottom share of a page where running headers and footers sit. */
const MARGIN_SHARE = 0.08;
/** A margin line on at least this share of pages (and 3 pages) is a running header or footer. */
const REPEAT_SHARE = 0.4;
const MIN_PAGES = 3;

/** Same header on every page, with its page number: "Cardiology — 12" ≈ "Cardiology — 13". */
const shapeOf = (text: string) =>
  latinDigits(text).replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

const inMargin = (line: TextLine, height: number) =>
  line.box.y1 <= height * MARGIN_SHARE || line.box.y0 >= height * (1 - MARGIN_SHARE);

/**
 * Removes running headers, footers and bare page numbers (FR-05-006), so they never join a
 * question's text. `heights` maps page numbers to page heights in points.
 */
export function dropRunningLines(
  lines: readonly TextLine[],
  heights: ReadonlyMap<number, number>,
): TextLine[] {
  const margin = (line: TextLine) =>
    inMargin(line, heights.get(line.page) ?? Number.POSITIVE_INFINITY);
  const pagesByShape = new Map<string, Set<number>>();
  for (const line of lines.filter(margin)) {
    const shape = shapeOf(line.text);
    pagesByShape.set(shape, (pagesByShape.get(shape) ?? new Set()).add(line.page));
  }
  const pages = new Set(lines.map((line) => line.page)).size;
  const running = (line: TextLine) => {
    const seen = pagesByShape.get(shapeOf(line.text))?.size ?? 0;
    return seen >= MIN_PAGES && seen >= pages * REPEAT_SHARE;
  };
  const pageNumber = (line: TextLine) => /^[\s\-–—|]*#[\s\-–—|]*$/.test(shapeOf(line.text));
  return lines.filter((line) => !(margin(line) && (running(line) || pageNumber(line))));
}
