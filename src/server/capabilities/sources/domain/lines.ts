import { isRtlText, toLogical } from './bidi.js';
import { splitColumns } from './columns.js';
import { boxHeight, fontFamily, unionBox, type Box, type PageText, type PageWord } from './page.js';

export interface TextLine {
  page: number;
  text: string;
  box: Box;
  words: PageWord[];
  /** Read right to left (Arabic): its start is the right edge. */
  rtl: boolean;
  /** Where reading starts: the left edge for LTR lines, the right edge for RTL ones. */
  start: number;
}

/** The family most of the document's characters are set in (typed body text). */
export function bodyFontFamily(pages: readonly PageText[]): string | null {
  const counts = new Map<string, number>();
  for (const word of pages.flatMap((page) => page.words)) {
    if (!word.font) continue;
    const family = fontFamily(word.font);
    counts.set(family, (counts.get(family) ?? 0) + word.text.length);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

const sameLine = (line: PageWord[], word: PageWord): boolean => {
  const last = line[line.length - 1];
  if (!last) return false;
  if (last.line !== undefined || word.line !== undefined) return last.line === word.line;
  const center = (word.box.y0 + word.box.y1) / 2;
  return Math.abs(center - (last.box.y0 + last.box.y1) / 2) < boxHeight(last.box) * 0.5;
};

function groupLines(words: readonly PageWord[]): PageWord[][] {
  const lines: PageWord[][] = [];
  for (const word of [...words].sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0)) {
    const line = lines.find((candidate) => sameLine(candidate, word));
    if (line) line.push(word);
    else lines.push([word]);
  }
  return lines;
}

/**
 * One reading line. A PDF text layer stores right-to-left words in visual order (`visual`), so
 * they are turned back into reading order; OCR already reads them in order.
 */
function toLine(page: PageText, words: PageWord[]): TextLine {
  const rtl = isRtlText(words.map((word) => word.text).join(' '));
  const ordered = [...words].sort((a, b) => (rtl ? b.box.x1 - a.box.x1 : a.box.x0 - b.box.x0));
  const text = ordered.map((word) => (rtl && page.visual ? toLogical(word.text) : word.text));
  const box = unionBox(ordered.map((word) => word.box));
  return {
    page: page.page,
    text: text.join(' '),
    box,
    words: ordered,
    rtl,
    start: rtl ? box.x1 : box.x0,
  };
}

const overlaps = (a: Box, b: Box) =>
  Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

/** Short labels and numbers a PDF maker set in a fallback font ("(1س", "(أ", "12"). */
const FALLBACK_MAX_CHARS = 4;

function keepBodyWords(line: PageWord[], bodyFamily: string): PageWord[] {
  const isBody = (word: PageWord) => !word.font || fontFamily(word.font) === bodyFamily;
  const body = line.filter(isBody);
  if (body.length === 0) return [];
  const height = Math.max(...body.map((word) => boxHeight(word.box)));
  const nearBody = (word: PageWord) =>
    body.some(
      (other) =>
        Math.min(Math.abs(word.box.x0 - other.box.x1), Math.abs(other.box.x0 - word.box.x1)) <=
        height * 1.5,
    );
  // Ink drawn over printed text (a circle the device read as "0") overlaps it: not a label.
  const overBody = (word: PageWord) => body.some((other) => overlaps(word.box, other.box));
  const isLabel = (word: PageWord) =>
    word.text.length <= FALLBACK_MAX_CHARS && nearBody(word) && !overBody(word);
  return line.filter((word) => isBody(word) || isLabel(word));
}

/**
 * Groups a page's words into reading lines, column by column (FR-05-004). With a known body
 * family, words in other fonts (device handwriting, pasted screenshots) are left out, except
 * short labels set in a fallback font right beside body text on the same line.
 */
export function pageLines(page: PageText, bodyFamily: string | null): TextLine[] {
  const kept = bodyFamily
    ? groupLines(page.words).flatMap((line) => keepBodyWords(line, bodyFamily))
    : page.words;
  return splitColumns(page, kept).flatMap((column) =>
    groupLines(column).map((line) => toLine(page, line)),
  );
}
