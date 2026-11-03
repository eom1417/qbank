/** Arabic script letters (base and presentation forms). */
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/u;
const LATIN = /[A-Za-z]/;
/** Runs that keep their own left-to-right order inside right-to-left text. */
const LTR_RUN = /[A-Za-z0-9٠-٩]+(?:[.,:/٫][A-Za-z0-9٠-٩]+)*/g;
const MIRRORED: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
};

const count = (text: string, pattern: RegExp) =>
  [...text].filter((char) => pattern.test(char)).length;

/** A line is right-to-left when it has more Arabic letters than Latin ones. */
export const isRtlText = (text: string): boolean => count(text, ARABIC) > count(text, LATIN);

/**
 * A word as a PDF text layer gives it for right-to-left text (visual order, presentation forms,
 * mirrored brackets) back in reading order: "(1س" → "س1)", "ﺔﺋﺮﻟا" → "الرئة", "5−" → "−5".
 */
export function toLogical(word: string): string {
  const reversed = [...word.normalize('NFKC')]
    .reverse()
    .map((char) => MIRRORED[char] ?? char)
    .join('');
  // Latin words and numbers were reversed with the rest: turn each run back.
  return reversed.replace(LTR_RUN, (run) => [...run].reverse().join(''));
}

/** Arabic-Indic digits as Latin ones, for numbering ("س١٢" is question 12). */
export const latinDigits = (text: string): string =>
  text.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
