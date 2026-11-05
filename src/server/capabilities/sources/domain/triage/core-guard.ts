/**
 * What must survive any rewrite of a question (DEC-34): its numbers and units, and every word
 * that turns its meaning (NOT, EXCEPT, least…). Without polishing, the organizer may only cut
 * and reorder the printed words, so nearly every word it returns must be on the page.
 */
const NEGATIONS = [
  'not',
  'except',
  'least',
  'never',
  'without',
  'false',
  'incorrect',
  'unlikely',
  'لا',
  'ليس',
  'ليست',
  'إلا',
  'غير',
  'عدا',
  'خطأ',
];

/** Share of the returned words that must be printed ones when only organizing. */
const VERBATIM_SHARE = 0.9;

const wordsOf = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const numbersOf = (text: string) =>
  (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')).sort();

function count(words: readonly string[], word: string) {
  return words.filter((w) => w === word).length;
}

/** The rewrite keeps every number, and does not drop a word that turns the meaning. */
export function keepsCore(before: string, after: string): boolean {
  const kept = numbersOf(before);
  const now = numbersOf(after);
  const numbers = kept.every((n) => now.includes(n));
  const was = wordsOf(before);
  const is = wordsOf(after);
  return numbers && NEGATIONS.every((word) => count(is, word) >= Math.min(1, count(was, word)));
}

/** Nearly every word returned is one printed on the page (organizing never writes). */
export function onlyPrintedWords(source: string, returned: string): boolean {
  const printed = new Set(wordsOf(source));
  const words = wordsOf(returned).filter((word) => word.length > 2);
  if (words.length === 0) return true;
  return words.filter((word) => printed.has(word)).length >= words.length * VERBATIM_SHARE;
}
