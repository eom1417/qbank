import type { PageText, PageWord } from './page.js';

/** A glyph the PDF cannot map to a character: the text layer is unreliable there. */
const UNREADABLE = '�';

export const hasUnreadableText = (page: PageText): boolean =>
  page.words.some((word) => word.text.includes(UNREADABLE));

const overlapsVertically = (a: PageWord, b: PageWord) =>
  Math.min(a.box.y1, b.box.y1) - Math.max(a.box.y0, b.box.y0) > 0.5 * (a.box.y1 - a.box.y0);

/**
 * Replaces unreadable text-layer words with what OCR read on the same line. OCR words keep no
 * font, so they are treated as printed body text by the line builder.
 */
export function repairWithOcr(page: PageText, ocr: PageText): PageText {
  const broken = page.words.filter((word) => word.text.includes(UNREADABLE));
  const kept = page.words.filter((word) => !word.text.includes(UNREADABLE));
  const replacements = ocr.words.filter(
    (candidate) =>
      broken.some((word) => overlapsVertically(word, candidate)) &&
      !kept.some(
        (word) =>
          overlapsVertically(word, candidate) &&
          word.box.x0 <= candidate.box.x1 &&
          candidate.box.x0 <= word.box.x1,
      ),
  );
  return { ...page, words: [...kept, ...replacements] };
}
