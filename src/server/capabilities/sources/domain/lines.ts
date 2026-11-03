import { boxHeight, fontFamily, unionBox, type Box, type PageText, type PageWord } from './page.js';

export interface TextLine {
  page: number;
  text: string;
  box: Box;
  words: PageWord[];
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

/**
 * Groups a page's words into reading lines (top to bottom, then left to right). With a known body
 * family, words in other fonts (device handwriting, pasted screenshots) are left out.
 */
export function pageLines(page: PageText, bodyFamily: string | null): TextLine[] {
  const words = page.words
    .filter((word) => !bodyFamily || !word.font || fontFamily(word.font) === bodyFamily)
    .sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0);
  const lines: PageWord[][] = [];
  for (const word of words) {
    const line = lines.find((candidate) => sameLine(candidate, word));
    if (line) line.push(word);
    else lines.push([word]);
  }
  return lines.map((line) => {
    const ordered = line.sort((a, b) => a.box.x0 - b.box.x0);
    return {
      page: page.page,
      text: ordered.map((word) => word.text).join(' '),
      box: unionBox(ordered.map((word) => word.box)),
      words: ordered,
    };
  });
}
