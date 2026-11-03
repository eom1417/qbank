import { isRtlText, toLogical } from './bidi.js';
import { splitColumns } from './columns.js';
import {
  boxHeight,
  fontFamily,
  overlaps,
  unionBox,
  type Box,
  type PageText,
  type PageWord,
} from './page.js';

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

/** Body fonts are counted per script, so a second script set in its own font is kept. */
const SCRIPTS: readonly RegExp[] = [/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/u, /[A-Za-z]/];
/** A script with less than this share of the letters is not body text (a stray note). */
const MIN_SCRIPT_SHARE = 0.1;

/** The fonts typed body text is set in: the leading family of each script the document uses. */
export function bodyFontFamilies(pages: readonly PageText[]): ReadonlySet<string> | null {
  const counts = SCRIPTS.map(() => new Map<string, number>());
  for (const word of pages.flatMap((page) => page.words)) {
    if (!word.font) continue;
    const family = fontFamily(word.font);
    SCRIPTS.forEach((script, index) => {
      const letters = [...word.text].filter((char) => script.test(char)).length;
      const count = counts[index];
      if (letters > 0 && count) count.set(family, (count.get(family) ?? 0) + letters);
    });
  }
  const total = (count: Map<string, number>) => [...count.values()].reduce((a, b) => a + b, 0);
  const all = counts.reduce((sum, count) => sum + total(count), 0);
  const leading = counts
    .filter((count) => total(count) >= all * MIN_SCRIPT_SHARE && total(count) > 0)
    .map((count) => [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '');
  return leading.length > 0 ? new Set(leading) : null;
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

/** Short labels and numbers a PDF maker set in a fallback font ("(1س", "(أ", "12"). */
const FALLBACK_MAX_CHARS = 4;

function keepBodyWords(line: PageWord[], body: ReadonlySet<string>): PageWord[] {
  const isBody = (word: PageWord) => !word.font || body.has(fontFamily(word.font));
  const bodyWords = line.filter(isBody);
  if (bodyWords.length === 0) return [];
  const height = Math.max(...bodyWords.map((word) => boxHeight(word.box)));
  const nearBody = (word: PageWord) =>
    bodyWords.some(
      (other) =>
        Math.min(Math.abs(word.box.x0 - other.box.x1), Math.abs(other.box.x0 - word.box.x1)) <=
        height * 1.5,
    );
  // Ink drawn over printed text (a circle the device read as "0") overlaps it: not a label.
  const overBody = (word: PageWord) => bodyWords.some((other) => overlaps(word.box, other.box));
  const isLabel = (word: PageWord) =>
    word.text.length <= FALLBACK_MAX_CHARS && nearBody(word) && !overBody(word);
  return line.filter((word) => isBody(word) || isLabel(word));
}

/**
 * Groups a page's words into reading lines, column by column (FR-05-004). With a known body
 * fonts, words in other fonts (device handwriting, pasted screenshots) are left out, except
 * short labels set in a fallback font right beside body text on the same line.
 */
export function pageLines(page: PageText, body: ReadonlySet<string> | null): TextLine[] {
  const kept = body
    ? groupLines(page.words).flatMap((line) => keepBodyWords(line, body))
    : page.words;
  return splitColumns(page, kept).flatMap((column) =>
    groupLines(column).map((line) => toLine(page, line)),
  );
}
